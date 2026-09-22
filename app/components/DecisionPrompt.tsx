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

import type { PendingQuestion } from "@/lib/types";

export default function DecisionPrompt({
  question,
  secondsLeft,
  onAnswer,
  onSomethingElse,
}: {
  question: PendingQuestion;
  secondsLeft: number;
  onAnswer: (answer: string) => void;
  onSomethingElse: () => void;
}) {
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

        <div className="decision-actions">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              className={`btn ${index === 0 ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onAnswer(option)}
            >
              {option}
            </button>
          ))}
          <button type="button" className="btn btn-ghost" onClick={onSomethingElse}>
            Something else…
          </button>
        </div>
      </section>
    </div>
  );
}
