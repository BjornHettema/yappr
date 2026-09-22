"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ANSWER_WINDOW_SECONDS,
  CALL_BRIEF_KEY,
  SESSION_ID_KEY,
  SUMMARY_KEY,
  TRANSCRIPT_KEY,
  defaultBrief,
  loadJson,
  saveJson,
  type CallBrief,
  type PendingQuestion,
  type TranscriptLine,
} from "@/lib/types";
import TranscriptLineView from "@/app/components/TranscriptLineView";
import CallRequest from "@/app/components/CallRequest";
import DecisionPrompt from "@/app/components/DecisionPrompt";
import {
  callOpeningInstructions,
  holdExpiredInstructions,
  travelerAnswer,
} from "@/lib/prompts";
import { testLoggingActive } from "@/lib/testLog";

type RealtimeEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
};

/** One fork the traveler was asked to settle. Kept for the summary and the log. */
type Decision = {
  question: string;
  businessSaid: string;
  options: string[];
  answer: string;
  secondsToAnswer: number;
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
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_WINDOW_SECONDS);

  const audioRef = useRef<HTMLAudioElement>(null);
  const coachRef = useRef<HTMLTextAreaElement>(null);
  /** Mirrors `pending` for the async handlers, which can't read state. */
  const pendingRef = useRef<PendingQuestion | null>(null);
  const decisions = useRef<Decision[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const linesRef = useRef<TranscriptLine[]>([]);
  const hangingUp = useRef(false);
  const startedAt = useRef(Date.now());
  // TEMPORARY - testing phase: ties this call's log row to its feedback row.
  const sessionId = useRef(newId());
  const awaitingBusiness = useRef(false);
  const agentBuffer = useRef("");

  useEffect(() => {
    linesRef.current = lines;
    saveJson(TRANSCRIPT_KEY, lines);
  }, [lines]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !listenLive;
  }, [listenLive]);

  // Counts the hold down, and ends it when it runs out. Keyed on the question
  // id so answering one and being asked another restarts the clock cleanly.
  useEffect(() => {
    if (!pending) return;

    const deadline = pending.askedAt + ANSWER_WINDOW_SECONDS * 1000;
    function tick() {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) expireQuestion();
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id]);

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

  /** Keeps the ref and the rendered state in step; always use this, not setPending. */
  function setPendingQuestion(next: PendingQuestion | null) {
    pendingRef.current = next;
    setPending(next);
  }

  /**
   * Yappr hit something the traveler never asked for and called ask_traveler.
   * The tool call is acknowledged but NOT followed by a response.create — the
   * whole point is that Yappr goes quiet until the traveler decides.
   */
  function raiseQuestion(rawArgs: string | undefined, callId: string | undefined) {
    // One open question at a time. A second call before the first is answered
    // would silently replace the thing the traveler is looking at.
    if (pendingRef.current || hangingUp.current) return;

    let parsed: { question?: string; businessSaid?: string; options?: unknown };
    try {
      parsed = JSON.parse(rawArgs || "{}");
    } catch {
      return;
    }

    const question = (parsed.question || "").trim();
    if (!question) return;

    const options = (Array.isArray(parsed.options) ? parsed.options : [])
      .map((option) => String(option).trim())
      .filter(Boolean)
      .slice(0, 3);

    const next: PendingQuestion = {
      id: newId(),
      callId: callId || "",
      question,
      businessSaid: (parsed.businessSaid || "").trim(),
      businessSaidTranslated: "",
      options: options.length ? options : ["Yes", "No"],
      askedAt: Date.now(),
    };
    setPendingQuestion(next);

    if (callId) {
      send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({
            status: "waiting",
            note: "The traveler is deciding. Say nothing until a [TRAVELER ANSWER] message arrives.",
          }),
        },
      });
    }

    void translateQuestionQuote(next);
  }

  /**
   * Fills in the traveler-language version of what the business said. Separate
   * from raiseQuestion so the question itself renders immediately rather than
   * waiting on a translation round-trip while someone holds the line.
   */
  async function translateQuestionQuote(question: PendingQuestion) {
    if (!question.businessSaid) return;
    const translated = await translate(
      question.businessSaid,
      brief.localLanguage,
      brief.travelerLanguage,
    );
    // It may have been answered or expired while that was in flight.
    if (pendingRef.current?.id !== question.id) return;
    setPendingQuestion({ ...question, businessSaidTranslated: translated });
  }

  function recordDecision(question: PendingQuestion, answer: string) {
    decisions.current = [
      ...decisions.current,
      {
        question: question.question,
        businessSaid: question.businessSaid,
        options: question.options,
        answer,
        secondsToAnswer: Math.round((Date.now() - question.askedAt) / 1000),
      },
    ];
  }

  /** The traveler decided. Their answer is final; Yappr acts on it, unarguably. */
  function answerQuestion(answer: string) {
    const current = pendingRef.current;
    const text = answer.trim();
    if (!current || !text) return;

    setPendingQuestion(null);
    recordDecision(current, text);
    pushLine({
      speaker: "you",
      original: text,
      translation: `Your decision — Yappr asked: ${current.question}`,
      language: brief.travelerLanguage,
    });
    sendUserMessage(travelerAnswer(current.question, text));
  }

  /**
   * Nobody answered. Yappr apologises, says it will call back and hangs up,
   * rather than taking the offer — which is the whole reason this gate exists.
   */
  function expireQuestion() {
    const current = pendingRef.current;
    if (!current) return;

    setPendingQuestion(null);
    recordDecision(current, "(no answer — Yappr ended the call)");
    setStatus("No answer — wrapping up");
    pushLine({
      speaker: "you",
      original: "No answer in time",
      translation: `Yappr asked: ${current.question} — it will say it can call back.`,
      language: brief.travelerLanguage,
    });
    sendUserMessage(holdExpiredInstructions(brief));
  }

  async function afterAgentSpoke(original: string) {
    if (hangingUp.current || awaitingBusiness.current || !original.trim()) return;
    awaitingBusiness.current = true;
    setPartial("");

    await speak("yappr", original);

    try {
      // A decision is with the traveler, so the business is holding and
      // nobody speaks until the answer lands. Checked here as well as below
      // because the tool call and the spoken hold line arrive independently.
      if (pendingRef.current) return;

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
      // Same check again: ask_traveler can land while this request is open,
      // and a business line arriving mid-hold would be out of order.
      if (!res.ok || hangingUp.current || pendingRef.current) return;

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

    if (event.type === "response.function_call_arguments.done") {
      if (event.name === "ask_traveler") {
        raiseQuestion(event.arguments, event.call_id);
        return;
      }
      // Never hang up on a traveler who is mid-decision; the business is
      // holding precisely because an answer is still coming.
      if (event.name === "end_call" && !pendingRef.current) {
        void hangUp();
      }
    }
  }

  /**
   * The coach box doubles as the answer box: while a question is open, what
   * the traveler types IS their decision. "No, but ask about Saturday" is a
   * real answer that two buttons cannot express, and routing it through the
   * coaching channel instead would leave Yappr still waiting.
   */
  function sendCoach() {
    const note = coach.trim();
    if (!note) return;
    setCoach("");

    if (pendingRef.current) {
      answerQuestion(note);
      return;
    }

    pushLine({
      speaker: "you",
      original: note,
      translation: "Private note to Yappr",
      language: brief.travelerLanguage,
    });
    sendUserMessage(`[TRAVELER COACHING] ${note}`);
  }

  function focusCoach() {
    coachRef.current?.focus();
    coachRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /**
   * TEMPORARY - USER TESTING PHASE ONLY. Sends the finished session to
   * /api/test-log so it can be read back as research. No-ops unless the flag
   * is on, and never blocks or breaks the end of a call. See lib/testLog.ts.
   */
  function recordTestSession(summary: unknown) {
    if (!testLoggingActive()) return;
    try {
      sessionStorage.setItem(SESSION_ID_KEY, sessionId.current);
    } catch {
      /* the feedback row just won't join to this session */
    }
    void fetch("/api/test-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brief,
        lines: linesRef.current,
        summary,
        sessionId: sessionId.current,
        // How often Yappr had to stop and ask, what was chosen, and how long
        // the traveler took — the last of which is really a test of whether
        // testers are present during the call at all.
        decisions: decisions.current,
        startedAt: startedAt.current,
      }),
    }).catch(() => {
      /* research data is never worth interrupting a call for */
    });
  }

  async function hangUp() {
    if (hangingUp.current) return;
    hangingUp.current = true;
    setPendingQuestion(null);
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
      recordTestSession(summary);
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
    <main className={`page${pending ? " has-decision" : ""}`}>
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
            {pending ? "Answer in your own words" : "Coach Yappr mid-call"}
            <textarea
              ref={coachRef}
              value={coach}
              onChange={(e) => setCoach(e.target.value)}
              placeholder={
                pending
                  ? "No, but ask if Saturday is free."
                  : "Ask for outdoor seating instead."
              }
            />
          </label>
          <div className="actions">
            <button
              className={`btn ${pending ? "btn-primary" : "btn-ghost"}`}
              type="button"
              onClick={sendCoach}
            >
              {pending ? "Send answer" : "Send note"}
            </button>
            <button className="btn btn-danger" type="button" onClick={() => void hangUp()}>
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

      {pending ? (
        <DecisionPrompt
          question={pending}
          secondsLeft={secondsLeft}
          onAnswer={answerQuestion}
          onSomethingElse={focusCoach}
        />
      ) : null}
    </main>
  );
}
