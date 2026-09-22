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
} from "@/lib/types";
import TranscriptLineView from "@/app/components/TranscriptLineView";
import CallRequest from "@/app/components/CallRequest";
import DecisionPrompt from "@/app/components/DecisionPrompt";
import {
  answerNotRelayed,
  callOpeningInstructions,
  confirmationMissing,
  holdExpiredInstructions,
  holdInstructions,
  travelerAnswer,
} from "@/lib/prompts";
import {
  correctionSent,
  hangUpRefused,
  holdLineRequested,
  initialCallFlow,
  parseAskTraveler,
  secondsRemaining,
  shouldCorrectQuestion,
  shouldRefuseHangUp,
  travelerAnswered,
  windUpStarted,
  yapprSpoke,
} from "@/lib/callFlow";
import {
  classifyRealtimeEvent,
  type RealtimeEvent,
} from "@/lib/realtimeEvents";
import { testLoggingActive } from "@/lib/testLog";
import { useRealtimeCall } from "./useRealtimeCall";
import { useTranscript } from "./useTranscript";

/** One fork the traveler was asked to settle. Kept for the summary and the log. */
type Decision = {
  kind: string;
  question: string;
  /**
   * What the model originally wrote, recorded only when the translator had to
   * change it. That is the wrong-language drift showing up in the wild, and
   * counting it is the only way to know whether the guard is still earning its
   * round trip. Null means the model got it right on its own.
   */
  questionAsWritten: string | null;
  businessSaid: string;
  options: string[];
  answer: string;
  secondsToAnswer: number;
};

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
  const { lines, linesRef, partial, setPartial, pushLine } = useTranscript();
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_WINDOW_SECONDS);

  const audioRef = useRef<HTMLAudioElement>(null);
  /** Mirrors `pending` for the async handlers, which can't read state. */
  const pendingRef = useRef<PendingQuestion | null>(null);
  /** A question being translated into the traveler's language, not yet shown. */
  const preparingQuestion = useRef(false);
  const decisions = useRef<Decision[]>([]);
  const hangingUp = useRef(false);
  const startedAt = useRef(Date.now());
  // TEMPORARY - testing phase: ties this call's log row to its feedback row.
  const sessionId = useRef(newId());
  const awaitingBusiness = useRef(false);
  const agentBuffer = useRef("");
  /** Hold-line instructions waiting for the current response to finish. */
  const holdQueued = useRef<string | null>(null);
  /** Whether the response now in flight has produced any speech. */
  const spokeThisResponse = useRef(false);
  /** Correction instructions waiting for the current response to finish. */
  const correctionQueued = useRef<string | null>(null);
  /**
   * The mid-call decision protocol's bookkeeping. Pure, and tested in
   * lib/callFlow.test.ts against the four bugs that reached a live call — it
   * used to be five loose refs in here, which is how three of them got
   * through. Read that file before changing any of this.
   */
  const flow = useRef(initialCallFlow());

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !listenLive;
  }, [listenLive]);

  // Counts the hold down, and ends it when it runs out. Keyed on the question
  // id so answering one and being asked another restarts the clock cleanly.
  useEffect(() => {
    if (!pending) return;

    const askedAt = pending.askedAt;
    function tick() {
      const left = secondsRemaining(askedAt, ANSWER_WINDOW_SECONDS, Date.now());
      setSecondsLeft(left);
      if (left <= 0) expireQuestion();
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id]);

  // The brief lives in sessionStorage, so a fresh tab has nothing to call
  // about. Bounce back to the form rather than dialling with no request.
  useEffect(() => {
    if (!brief.goal || !brief.businessName) router.replace("/call");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Anything in flight when this component goes away must not be treated as
    // a live call still worth speaking on.
    return () => {
      hangingUp.current = true;
    };
  }, []);

  const { send, close } = useRealtimeCall({
    brief,
    enabled: Boolean(brief.goal && brief.businessName),
    audioRef,
    onOpen: () => {
      setStatus("On the line");
      send({
        type: "response.create",
        response: { instructions: callOpeningInstructions(brief) },
      });
    },
    onEvent: onRealtime,
    onError: (message) => {
      setError(message);
      setStatus("Failed");
    },
  });

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

  /**
   * A decision is with the traveler — or is about to be. Everything that
   * suppresses the rest of the call has to count the gap between the tool
   * call and the card appearing, or a business reply lands in the middle of
   * a hold that has already been promised.
   */
  function questionOpen() {
    return pendingRef.current !== null || preparingQuestion.current;
  }

  /** Keeps the ref and the rendered state in step; always use this, not setPending. */
  function setPendingQuestion(next: PendingQuestion | null) {
    pendingRef.current = next;
    // Closing a question cancels any hold line still waiting to go out: the
    // answer (or the wind-up) is already on its way and "one moment" after it
    // would be nonsense.
    if (!next) holdQueued.current = null;
    setPending(next);
  }

  /**
   * Yappr hit something the traveler never asked for and called ask_traveler.
   * The tool call is acknowledged but NOT followed by a response.create — the
   * whole point is that Yappr goes quiet until the traveler decides.
   */
  function raiseQuestion(rawArgs: string | undefined, callId: string | undefined) {
    // One open question at a time. A second call before the first is answered
    // would silently replace the thing the traveler is looking at — including
    // while the first is still being prepared.
    if (pendingRef.current || preparingQuestion.current || hangingUp.current) return;

    const args = parseAskTraveler(rawArgs);
    if (!args) return;

    // Nothing has been said on the line since the traveler last answered, so
    // whatever is being asked now cannot have come from the business. Send it
    // back once rather than showing a card that asks the traveler to speak for
    // the shop.
    if (shouldCorrectQuestion(flow.current)) {
      flow.current = correctionSent(flow.current);
      // Queued for the same reason the hold line is: the response carrying
      // this tool call is still open.
      correctionQueued.current = answerNotRelayed(brief);
      return;
    }

    const draft: PendingQuestion = {
      ...args,
      id: newId(),
      callId: callId || "",
      questionRaw: args.question,
      businessSaidTranslated: "",
      // Timed from now, not from when the card appears: the business starts
      // waiting the moment Yappr says "one moment", and 30s is their ceiling.
      askedAt: Date.now(),
    };
    preparingQuestion.current = true;

    if (callId) {
      send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({
            status: "waiting",
            note: "Asked. Say your holding line now, then nothing until a [TRAVELER ANSWER] message arrives.",
          }),
        },
      });
    }

    // Tell the business to hold, every time, on the client's initiative. Left
    // to the model this happened on the first question of a live call and not
    // on the second — the whole point is that nobody is left listening to
    // silence while the traveler decides. Queued rather than sent: the
    // response carrying this tool call is still open, and the realtime API
    // refuses a second response while one is active.
    holdQueued.current = holdInstructions(brief, decisions.current.length > 0);

    void showQuestion(draft);
  }

  /**
   * Guarantees the card is in the traveler's language before it is shown.
   *
   * The tool asks for `question` and `options` in the traveler's language, and
   * the model mostly complies — but it spends the whole call under an
   * instruction to speak only the local language, so sometimes it writes these
   * in that language too. A traveler who set English and got "17:00
   * ได้ไหมครับ?" cannot answer, which is the one thing this card must never be.
   * Intermittent by nature: `businessSaid` was always right because it goes
   * through the translator, and the question was wrong only when the model
   * drifted. So the question goes through the translator as well.
   *
   * The translator is told to return text already in the target language
   * unchanged, so the correct case costs a round trip and changes nothing.
   * All of it runs in parallel and the card appears once, complete — no text
   * rewriting itself under someone's finger.
   */
  async function showQuestion(draft: PendingQuestion) {
    const sameLanguage =
      brief.travelerLanguage.trim().toLowerCase() ===
      brief.localLanguage.trim().toLowerCase();

    // A failed translation falls back to what the model wrote. Wrong-language
    // text is bad; no question at all, with a business holding the line, is
    // worse.
    const toTraveler = (text: string) =>
      text && !sameLanguage
        ? translate(text, brief.localLanguage, brief.travelerLanguage).catch(
            () => text,
          )
        : Promise.resolve(text);

    try {
      const [businessSaidTranslated, question, ...options] = await Promise.all([
        toTraveler(draft.businessSaid),
        toTraveler(draft.question),
        ...draft.options.map(toTraveler),
      ]);

      // The call may have ended while those were in flight.
      if (hangingUp.current) return;

      setPendingQuestion({
        ...draft,
        businessSaidTranslated,
        question: question || draft.question,
        options: options.map((option, index) => option || draft.options[index]),
      });
    } finally {
      preparingQuestion.current = false;
    }
  }

  function recordDecision(question: PendingQuestion, answer: string) {
    decisions.current = [
      ...decisions.current,
      {
        kind: question.kind,
        question: question.question,
        questionAsWritten:
          question.questionRaw === question.question ? null : question.questionRaw,
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
    // Until Yappr says this to the business, it has no new information and no
    // business asking the traveler anything else.
    flow.current = travelerAnswered(flow.current);
    sendUserMessage(travelerAnswer(current.question, text, current.kind));
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
    // The line below is a "you" line, so the unanswered-request guard would
    // otherwise read the wind-up as a request nobody answered and refuse to
    // let the call end — which is the one thing that has to happen here.
    flow.current = windUpStarted(flow.current);
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

    // A hold line is the client asking for "one moment" — it carries none of
    // the traveler's answer, so it doesn't count as having relayed it.
    // Anything else Yappr says does.
    flow.current = yapprSpoke(flow.current);

    await speak("yappr", original);

    try {
      // A decision is with the traveler, so the business is holding and
      // nobody speaks until the answer lands. Checked here as well as below
      // because the tool call and the spoken hold line arrive independently.
      if (questionOpen()) return;

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
      if (!res.ok || hangingUp.current || questionOpen()) return;

      const businessOriginal = data.reply as string;
      await speak("business", businessOriginal);
      sendUserMessage(`[BUSINESS] ${businessOriginal}`);
    } finally {
      awaitingBusiness.current = false;
    }
  }

  function onRealtime(event: RealtimeEvent) {
    const signal = classifyRealtimeEvent(event);

    if (signal.type === "speaking") {
      agentBuffer.current += signal.delta;
      spokeThisResponse.current = true;
      setPartial(agentBuffer.current);
      return;
    }

    if (signal.type === "spoke") {
      const text = (signal.transcript || agentBuffer.current).trim();
      agentBuffer.current = "";
      spokeThisResponse.current = true;
      void afterAgentSpoke(text);
      return;
    }

    if (signal.type === "turnEnded") {
      const text = agentBuffer.current.trim();
      agentBuffer.current = "";
      if (text) void afterAgentSpoke(text);

      // The turn is over, so a queued hold line can go now. Skipped if the
      // model already spoke in this turn — then it has said something to the
      // business itself and a second "one moment" on top would be noise.
      const hold = holdQueued.current;
      const correction = correctionQueued.current;
      holdQueued.current = null;
      correctionQueued.current = null;

      if (correction && !hangingUp.current) {
        // Always sent, even if the model spoke in this turn: what it said was
        // not the traveler's answer, which is the whole complaint.
        send({ type: "response.create", response: { instructions: correction } });
      } else if (hold && !spokeThisResponse.current && !hangingUp.current) {
        flow.current = holdLineRequested(flow.current);
        send({ type: "response.create", response: { instructions: hold } });
      }
      spokeThisResponse.current = false;
      return;
    }

    if (signal.type === "tool") {
      if (signal.name === "ask_traveler") {
        raiseQuestion(signal.args, signal.callId);
        return;
      }
      // Never hang up on a traveler who is mid-decision; the business is
      // holding precisely because an answer is still coming.
      if (signal.name === "end_call" && !questionOpen()) {
        // Nor on a request the business has not answered. Yappr asked to book
        // 20:30, nobody said yes, it hung up, and the summary read "Confirmed"
        // — a booking the traveler would have turned up for.
        if (shouldRefuseHangUp(flow.current, linesRef.current)) {
          flow.current = hangUpRefused(flow.current);
          correctionQueued.current = confirmationMissing(brief);
          return;
        }
        void hangUp();
      }
    }
  }

  /**
   * A private nudge to Yappr mid-call. Not available while a question is open:
   * answering in your own words happens on the decision card itself, and two
   * live text boxes both claiming to talk to Yappr — one of which would leave
   * the question unanswered — is a choice nobody should have to make with a
   * business holding the line.
   */
  function sendCoach() {
    const note = coach.trim();
    if (!note || questionOpen()) return;
    setCoach("");

    pushLine({
      speaker: "you",
      original: note,
      translation: "Private note to Yappr",
      language: brief.travelerLanguage,
    });
    sendUserMessage(`[TRAVELER COACHING] ${note}`);
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
    close();

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
            Coach Yappr mid-call
            <textarea
              value={coach}
              onChange={(e) => setCoach(e.target.value)}
              disabled={Boolean(pending)}
              placeholder={
                pending
                  ? "Answer the question below first."
                  : "Ask for outdoor seating instead."
              }
            />
          </label>
          <div className="actions">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={sendCoach}
              disabled={Boolean(pending)}
            >
              Send note
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
          // Keyed so a second question arrives with a clean card rather than
          // inheriting the first one's half-typed answer.
          key={pending.id}
          question={pending}
          secondsLeft={secondsLeft}
          onAnswer={answerQuestion}
        />
      ) : null}
    </main>
  );
}
