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
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");

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
              // Only a yes/no gets a leading option. When the business named
              // several alternatives they are peers, and a filled first button
              // would read as Yappr's recommendation — which is the nudge this
              // whole screen exists to avoid.
              className={`btn ${
                question.kind === "confirm" && index === 0 ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => onAnswer(option)}
            >
              {option}
            </button>
          ))}
          {/* The options stay put while the field is open: changing your mind
              back to a one-tap answer shouldn't cost a step. */}
          {typing ? null : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTyping(true)}
            >
              Something else…
            </button>
          )}
        </div>

        {typing ? (
          <form
            className="decision-answer"
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim()) onAnswer(text);
            }}
          >
            <input
              // Deliberate: the field appears because the traveler asked for
              // it, and someone is holding the line.
              autoFocus
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="No, but ask if Saturday is free."
              aria-label="Answer in your own words"
              enterKeyHint="send"
            />
            <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
