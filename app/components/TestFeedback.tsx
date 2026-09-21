"use client";

/**
 * ============================================================================
 *  TEMPORARY - USER TESTING PHASE ONLY - DELETE BEFORE GENERAL RELEASE
 *  Same flag and same expiry as the session logging. See TESTING-ONLY.md.
 * ============================================================================
 *
 * Asked once, on the summary page, right after a call ends. Three questions,
 * chosen so the answers are worth something:
 *
 *  1. Did it get what you needed?  Comparable across testers, and it can be
 *     checked against the outcome the summary recorded. Where a tester says
 *     "not really" and the summary says "booked", that gap is the finding.
 *  2. Would you have made this call yourself?  This is the product thesis in
 *     one question. If most people say yes they'd have just phoned, Yappr is
 *     a convenience, not a need, and that changes everything downstream.
 *  3. One open box.  Phrased as "anything confusing or wrong" rather than
 *     "what did you think", because the first gets specifics and the second
 *     gets "nice!".
 *
 * Deliberately NOT asked: whether they would pay. Stated willingness to pay,
 * collected free, seconds after a success, is the least reliable number in
 * research. That question belongs in a conversation.
 */

import { useState } from "react";
import { testLoggingActive } from "@/lib/testLog";

const GOT_IT = [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "no", label: "No" },
];

const WOULD_CALL = [
  { value: "yes", label: "Yes, easily" },
  { value: "reluctantly", label: "Only if I had to" },
  { value: "no", label: "No, I'd avoid it" },
];

export default function TestFeedback({ sessionId }: { sessionId: string }) {
  const [gotIt, setGotIt] = useState("");
  const [wouldCall, setWouldCall] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!testLoggingActive()) return null;

  async function send() {
    setSending(true);
    try {
      await fetch("/api/test-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "feedback",
          sessionId,
          gotIt,
          wouldCall,
          comment,
        }),
      });
    } catch {
      /* say thank you either way: a lost answer is not the tester's problem */
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="notice" role="status">
        <strong>Thank you.</strong> That is genuinely useful.
      </div>
    );
  }

  return (
    <section className="card panel feedback">
      <h2>How did that go?</h2>
      <p className="meta">
        Three questions while Yappr is being tested. Under a minute, and it shapes what
        gets fixed next.
      </p>

      <fieldset className="choice">
        <legend>Did Yappr get what you needed?</legend>
        <div className="choice-row">
          {GOT_IT.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip${gotIt === option.value ? " chosen" : ""}`}
              aria-pressed={gotIt === option.value}
              onClick={() => setGotIt(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="choice">
        <legend>Would you have made this call yourself?</legend>
        <div className="choice-row">
          {WOULD_CALL.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip${wouldCall === option.value ? " chosen" : ""}`}
              aria-pressed={wouldCall === option.value}
              onClick={() => setWouldCall(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        Anything confusing, wrong, or missing?
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Even something small. The half-finished thought is usually the useful one."
        />
      </label>

      <div className="actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={send}
          disabled={sending || (!gotIt && !wouldCall && !comment.trim())}
        >
          {sending ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </section>
  );
}
