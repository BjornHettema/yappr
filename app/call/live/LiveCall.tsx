"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CALL_BRIEF_KEY,
  SUMMARY_KEY,
  TRANSCRIPT_KEY,
  defaultBrief,
  loadJson,
  saveJson,
  type CallBrief,
  type TranscriptLine,
} from "@/lib/types";
import TranscriptLineView from "@/app/components/TranscriptLineView";
import CallRequest from "@/app/components/CallRequest";
import { callOpeningInstructions } from "@/lib/prompts";

type RealtimeEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
};

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

function newId() {
  return crypto.randomUUID();
}

export default function LiveCall() {
  const router = useRouter();
  const [brief] = useState<CallBrief>(() => loadJson(CALL_BRIEF_KEY, defaultBrief));
  const [status, setStatus] = useState("Connecting…");
  const [listenLive, setListenLive] = useState(false);
  const [error, setError] = useState("");
  const [coach, setCoach] = useState("");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const linesRef = useRef<TranscriptLine[]>([]);
  const hangingUp = useRef(false);
  const awaitingBusiness = useRef(false);
  const agentBuffer = useRef("");

  useEffect(() => {
    linesRef.current = lines;
    saveJson(TRANSCRIPT_KEY, lines);
  }, [lines]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !listenLive;
  }, [listenLive]);

  useEffect(() => {
    if (!brief.goal || !brief.businessName) {
      router.replace("/call");
      return;
    }

    let cancelled = false;
    const extra: AudioContext[] = [];

    async function connect() {
      try {
        const tokenRes = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brief),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || "Could not mint a live session.");

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
          }
        };

        const silent = silentTrack();
        extra.push(silent.context);
        pc.addTrack(silent.track);

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.addEventListener("open", () => {
          if (cancelled) return;
          setStatus("On the line");
          send({
            type: "response.create",
            response: { instructions: callOpeningInstructions(brief) },
          });
        });
        dc.addEventListener("message", (event) => {
          try {
            onRealtime(JSON.parse(event.data) as RealtimeEvent);
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

        const answer = { type: "answer" as const, sdp: await sdpResponse.text() };
        await pc.setRemoteDescription(answer);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start the call.");
          setStatus("Failed");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      hangingUp.current = true;
      dcRef.current?.close();
      pcRef.current?.close();
      extra.forEach((ctx) => ctx.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(payload: unknown) {
    const dc = dcRef.current;
    if (dc?.readyState === "open") {
      dc.send(JSON.stringify(payload));
    }
  }

  /** Inject a message into the realtime conversation and ask for a reply. */
  function sendUserMessage(text: string) {
    send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    send({ type: "response.create" });
  }

  function pushLine(line: Omit<TranscriptLine, "id" | "at">) {
    const next: TranscriptLine = { ...line, id: newId(), at: Date.now() };
    linesRef.current = [...linesRef.current, next];
    setLines(linesRef.current);
    return next;
  }

  /**
   * The names the traveler actually wrote, so the translator can restore
   * their spelling instead of guessing one back out of the local script.
   */
  function nameHints() {
    return [brief.businessName, brief.place, brief.goal, brief.extraNotes]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 600);
  }

  async function translate(text: string, from: string, to: string) {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from, to, names: nameHints() }),
    });
    const data = await res.json();
    return (data.translation as string) || text;
  }

  /** Translate a spoken line from the local language and add it to the transcript. */
  async function speak(speaker: "yappr" | "business", original: string) {
    const translation = await translate(
      original,
      brief.localLanguage,
      brief.travelerLanguage,
    );
    return pushLine({
      speaker,
      original,
      translation,
      language: brief.localLanguage,
    });
  }

  async function afterAgentSpoke(original: string) {
    if (hangingUp.current || awaitingBusiness.current || !original.trim()) return;
    awaitingBusiness.current = true;
    setPartial("");

    await speak("yappr", original);

    try {
      const res = await fetch("/api/simulate-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          lastAgentLine: original,
          history: linesRef.current.map((line) => ({
            speaker: line.speaker,
            original: line.original,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || hangingUp.current) return;

      const businessOriginal = data.reply as string;
      await speak("business", businessOriginal);
      sendUserMessage(`[BUSINESS] ${businessOriginal}`);
    } finally {
      awaitingBusiness.current = false;
    }
  }

  function onRealtime(event: RealtimeEvent) {
    if (
      event.type === "response.output_audio_transcript.delta" ||
      event.type === "response.audio_transcript.delta"
    ) {
      agentBuffer.current += event.delta || "";
      setPartial(agentBuffer.current);
      return;
    }

    if (
      event.type === "response.output_audio_transcript.done" ||
      event.type === "response.audio_transcript.done"
    ) {
      const text = (event.transcript || agentBuffer.current).trim();
      agentBuffer.current = "";
      void afterAgentSpoke(text);
      return;
    }

    if (event.type === "response.done" && agentBuffer.current.trim()) {
      const text = agentBuffer.current.trim();
      agentBuffer.current = "";
      void afterAgentSpoke(text);
      return;
    }

    if (
      event.type === "response.function_call_arguments.done" &&
      event.name === "end_call"
    ) {
      void hangUp();
    }
  }

  function sendCoach() {
    const note = coach.trim();
    if (!note) return;
    pushLine({
      speaker: "you",
      original: note,
      translation: "Private note to Yappr",
      language: brief.travelerLanguage,
    });
    sendUserMessage(`[TRAVELER COACHING] ${note}`);
    setCoach("");
  }

  async function hangUp() {
    if (hangingUp.current) return;
    hangingUp.current = true;
    setStatus("Wrapping up…");
    dcRef.current?.close();
    pcRef.current?.close();

    const snapshot = linesRef.current;
    saveJson(TRANSCRIPT_KEY, snapshot);

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, lines: snapshot }),
      });
      const summary = await res.json();
      saveJson(SUMMARY_KEY, summary);
    } catch {
      saveJson(SUMMARY_KEY, {
        headline: "Call ended",
        outcome: "unclear",
        agreed: [],
        unresolved: [],
        nextSteps: [],
        quote: "",
      });
    }

    router.push("/call/summary");
  }

  return (
    <main className="page">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="live-layout">
        <aside className="card panel">
          <p className="kicker">
            <span className={`status-dot ${status === "On the line" ? "" : "warn"}`} />{" "}
            {status}
          </p>
          <h2>{brief.businessName}</h2>
          <p className="meta">
            {brief.place || "Local business"} · {brief.localLanguage}
          </p>
          <CallRequest brief={brief} />
          <div className="toggle">
            <div>
              <strong>Listen live</strong>
              <div className="meta">Hear Yappr on the line</div>
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setListenLive((value) => !value)}
            >
              {listenLive ? "On" : "Off"}
            </button>
          </div>
          <label className="field" style={{ marginTop: 16 }}>
            Coach Yappr mid-call
            <textarea
              value={coach}
              onChange={(e) => setCoach(e.target.value)}
              placeholder="Ask for outdoor seating instead."
            />
          </label>
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={sendCoach}>
              Send note
            </button>
            <button className="btn btn-primary" type="button" onClick={() => void hangUp()}>
              Hang up
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </aside>

        <section className="card panel">
          <h2>Live transcript</h2>
          <div className="transcript">
            {lines.map((line) => (
              <TranscriptLineView
                key={line.id}
                line={line}
                businessName={brief.businessName}
              />
            ))}
            {partial ? (
              <TranscriptLineView
                line={{ speaker: "yappr", original: partial, translation: "" }}
                labelSuffix="speaking"
              />
            ) : null}
            {!lines.length && !partial ? (
              <p className="meta">The line is connecting. Transcript appears as soon as someone speaks.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
