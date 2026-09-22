"use client";

/**
 * The browser→OpenAI leg of the call: mint a short-lived client secret, open a
 * WebRTC peer connection, and hand raw realtime events back to the caller.
 *
 * Extracted from LiveCall because it is the one part of that component with a
 * genuinely narrow interface — events out, `send` in — and because it is the
 * part that changes shape when real telephony arrives
 * (docs/telephony-migration.md). Keeping it separate means that migration
 * touches this file and the business-turn handler, not the decision gate.
 *
 * Deliberately not extracted: the decision gate itself. Its state is shared
 * with the event routing (the same protocol state decides whether a question
 * may be raised and whether the call may end), so pulling it out would mean an
 * interface about as wide as the code it hides. Tests were the answer there,
 * not a file move — see lib/callFlow.ts.
 */

import { useEffect, useRef, type RefObject } from "react";
import type { RealtimeEvent } from "@/lib/realtimeEvents";
import type { CallBrief } from "@/lib/types";

/**
 * OpenAI's realtime endpoint expects an outbound audio track, and Yappr has no
 * microphone: the traveler is not speaking, the business is. A near-silent
 * oscillator satisfies the negotiation without putting anything on the line.
 */
function silentTrack() {
  const context = new AudioContext();
  const dest = context.createMediaStreamDestination();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  oscillator.connect(gain).connect(dest);
  oscillator.start();
  return { context, track: dest.stream.getAudioTracks()[0] };
}

type Options = {
  brief: CallBrief;
  /**
   * False when there is nothing to call about — the brief lives in
   * sessionStorage, so a fresh tab has none. Without this the hook would dial
   * on arrival, mint a session with an empty brief, and race a 400 against the
   * redirect back to the form.
   */
  enabled: boolean;
  /** Where the remote audio is played. Muted by the caller unless listening. */
  audioRef: RefObject<HTMLAudioElement | null>;
  onOpen: () => void;
  onEvent: (event: RealtimeEvent) => void;
  onError: (message: string) => void;
};

export function useRealtimeCall({
  brief,
  enabled,
  audioRef,
  onOpen,
  onEvent,
  onError,
}: Options) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  /**
   * The connection is set up once, but the handlers are rebuilt on every
   * render. Reading them through a ref keeps the effect's dependency list
   * empty without the listeners going stale — the alternative is tearing down
   * and re-dialling a live call on every keystroke.
   */
  const handlers = useRef({ onOpen, onEvent, onError });
  handlers.current = { onOpen, onEvent, onError };

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const contexts: AudioContext[] = [];

    async function connect() {
      try {
        const tokenRes = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brief),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
          throw new Error(tokenData.error || "Could not mint a live session.");
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
          }
        };

        const silent = silentTrack();
        contexts.push(silent.context);
        pc.addTrack(silent.track);

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.addEventListener("open", () => {
          if (!cancelled) handlers.current.onOpen();
        });
        dc.addEventListener("message", (event) => {
          try {
            handlers.current.onEvent(JSON.parse(event.data) as RealtimeEvent);
          } catch {
            /* ignore malformed events */
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${tokenData.value}`,
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpResponse.ok) {
          throw new Error("The live voice service rejected the call setup.");
        }

        await pc.setRemoteDescription({
          type: "answer" as const,
          sdp: await sdpResponse.text(),
        });
      } catch (err) {
        if (!cancelled) {
          handlers.current.onError(
            err instanceof Error ? err.message : "Could not start the call.",
          );
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      dcRef.current?.close();
      pcRef.current?.close();
      contexts.forEach((context) => context.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Drops anything sent before the channel opens or after it closes. */
  function send(payload: unknown) {
    const dc = dcRef.current;
    if (dc?.readyState === "open") {
      dc.send(JSON.stringify(payload));
    }
  }

  function close() {
    dcRef.current?.close();
    pcRef.current?.close();
  }

  return { send, close };
}
