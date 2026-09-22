"use client";

/**
 * The mid-call decision gate, as the traveler sees it.
 *
 * Two things are on screen deliberately, not one. The business's actual words
 * are the evidence — a generated summary of an offer is exactly the place a
 * detail gets quietly invented — and the short question is the action. One
 * without the other is either unreadable or untrustworthy.
 *
 * Pinned to the bottom of the viewport rather than added to the transcript:
 * the transcript scrolls and a question in it would be missed, and the
 * traveler may well be looking at their phone rather than at this page. It is
 * also deliberately nowhere near "Hang up", which lives in the other column.
 */

import { useState } from "react";
import { isLeadingOption } from "@/lib/callFlow";
import type { PendingQuestion } from "@/lib/types";

export default function DecisionPrompt({
  question,
  secondsLeft,
  onAnswer,
}: {
  question: PendingQuestion;
  secondsLeft: number;
  onAnswer: (answer: string) => void;
}) {
  // "Something else" opens a field here rather than sending someone off to a
  // box in the other column. Answering in your own words is an answer to this
  // question, so it belongs on this card — and with a business holding the
  // line, a detour across the screen is time nobody has.
  // An "info" question — a name, a phone number, a spelling — is answered by
  // typing, so the field is there from the start. A button reading "here is my
  // phone number" that contains no phone number leaves Yappr with nothing to
  // say, and it went and asked the shop for the traveler's own number instead.
  const needsTyping = question.kind === "info";
  const [typing, setTyping] = useState(needsTyping);
  const [text, setText] = useState("");

  const answerForm = () => (
    <form
      className="decision-answer"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) onAnswer(text);
      }}
    >
      <input
        // Deliberate: the field is either the whole point of the card, or it
        // appeared because the traveler asked for it. Someone is holding.
        autoFocus
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={
          needsTyping
            ? "Type it exactly as they should hear it."
            : "No, but ask if Saturday is free."
        }
        aria-label="Answer in your own words"
        enterKeyHint="send"
      />
      <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
        Send
      </button>
    </form>
  );

  // Runs low in the last third rather than being urgent from the start: a red
  // countdown for the whole window just reads as pressure.
  const low = secondsLeft <= 10;

  return (
    <div className="decision-dock">
      <section
        className="decision shell"
        role="alertdialog"
        aria-live="assertive"
        aria-label="Yappr needs your decision"
      >
        <div className="decision-head">
          <p className="kicker">
            <span className="status-dot warn" /> They&rsquo;re holding for you
          </p>
          <p className={`decision-clock${low ? " low" : ""}`}>
            {secondsLeft}s
            <span className="meta"> until Yappr says it will call back</span>
          </p>
        </div>

        <p className="decision-question">{question.question}</p>

        {question.businessSaidTranslated || question.businessSaid ? (
          <blockquote className="decision-said">
            {question.businessSaidTranslated || question.businessSaid}
            {question.businessSaidTranslated && question.businessSaid ? (
              <cite>{question.businessSaid}</cite>
            ) : null}
          </blockquote>
        ) : null}

        {/* For an "info" question the field is the answer and any option is a
            way out of it, so the field leads and the buttons sit under it. */}
        {needsTyping ? answerForm() : null}

        {question.options.length || !needsTyping ? (
        <div className={`decision-actions${needsTyping ? " secondary" : ""}`}>
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              // Only a yes/no gets a leading option. When the business named
              // several alternatives they are peers, and a filled first button
              // would read as Yappr's recommendation — which is the nudge this
              // whole screen exists to avoid.
              className={`btn ${
                isLeadingOption(question.kind, index) ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => onAnswer(option)}
            >
              {option}
            </button>
          ))}
          {/* The options stay put while the field is open: changing your mind
              back to a one-tap answer shouldn't cost a step. */}
          {typing || needsTyping ? null : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTyping(true)}
            >
              Something else…
            </button>
          )}
        </div>
        ) : null}

        {typing && !needsTyping ? answerForm() : null}
      </section>
    </div>
  );
}
