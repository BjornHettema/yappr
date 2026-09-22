"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CALL_BRIEF_KEY,
  SESSION_ID_KEY,
  SUMMARY_KEY,
  TRANSCRIPT_KEY,
  defaultBrief,
  loadJson,
  type CallBrief,
  type Summary,
  type TranscriptLine,
} from "@/lib/types";
import TranscriptLineView from "@/app/components/TranscriptLineView";
import CallRequest from "@/app/components/CallRequest";
import TestFeedback from "@/app/components/TestFeedback";

/**
 * What the outcome means, and how loudly to say it. A booked table and a
 * sold-out show used to arrive in the same teal pill, which made the one
 * question this page exists to answer — did I get it? — something you had to
 * read a paragraph to work out. The label always carries the meaning on its
 * own; the tone only reinforces it, so nothing depends on colour.
 *
 * "unavailable" is not an error tone. A no is a successful call with a
 * disappointing answer, and colouring it like a failure would be a lie.
 */
const VERDICTS: Record<string, { label: string; tone: string }> = {
  booked: { label: "Confirmed", tone: "ok" },
  answered: { label: "You have your answer", tone: "ok" },
  pending: { label: "Waiting on them", tone: "warn" },
  unavailable: { label: "Not available", tone: "no" },
  unclear: { label: "Needs a follow-up", tone: "warn" },
};

export default function SummaryPage() {
  const [brief] = useState<CallBrief>(() => loadJson(CALL_BRIEF_KEY, defaultBrief));
  const [summary] = useState<Summary>(() => loadJson(SUMMARY_KEY, {}));
  const [lines] = useState<TranscriptLine[]>(() => loadJson(TRANSCRIPT_KEY, []));
  const [fullTranscript, setFullTranscript] = useState(false);
  // TEMPORARY - testing phase. See TESTING-ONLY.md.
  const [sessionId] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_ID_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const verdict =
    VERDICTS[summary.outcome || ""] || { label: "Call notes", tone: "neutral" };

  /**
   * Whether the write-up can be trusted enough to make statements about what
   * did NOT happen. If the summary failed, an empty "agreed" list means we
   * don't know — and telling someone nothing was booked when a table may be
   * waiting for them is worse than telling them nothing at all.
   */
  const trustworthy =
    !summary.error && Boolean(summary.outcome || summary.headline);
  const settled = verdict.tone === "ok";

  const sections = useMemo(
    () => [
      {
        title: "What was agreed",
        items: summary.agreed || [],
        ticks: true,
        // The real worry after a call that got nowhere is whether someone
        // somewhere is now expecting you.
        empty: "Nothing was booked or arranged, so there's nothing to turn up for.",
      },
      {
        title: "Still open",
        items: summary.unresolved || [],
        ticks: false,
        // Nothing left hanging needs no announcement. A heading over the word
        // "none" is two lines spent saying nothing.
        empty: null,
      },
      {
        title: "Next steps",
        items: summary.nextSteps || [],
        ticks: false,
        // Worth saying when the call worked — the ball being in nobody's court
        // is the good news. Left unsaid when it didn't, because Yappr has no
        // business inventing advice it was never given.
        empty: settled ? "Nothing for you to do." : null,
      },
    ],
    [summary.agreed, summary.unresolved, summary.nextSteps, settled],
  );

  /**
   * A long transcript pushed the answer, the action and (during testing) the
   * feedback form off the bottom of the page. It is reference material, so it
   * opens folded rather than swallowing the screen.
   */
  const clipped = lines.length > 6 && !fullTranscript;

  const where = [brief.businessName, brief.place]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="page">
      <p className={`kicker verdict ${verdict.tone}`}>
        <span className={`status-dot ${verdict.tone}`} />
        {verdict.label}
      </p>
      <h1>{summary.headline || "Here’s what happened"}</h1>
      {where ? <p className="lede">{where}</p> : null}

      <div className="summary-grid">
        <section className="card panel">
          <CallRequest brief={brief} />

          {summary.error ? (
            <div className="alert" role="status">
              <strong>Yappr couldn’t write up this call.</strong> The full transcript is
              still complete, so nothing was lost — read it through instead.
              <span className="meta">{summary.error}</span>
            </div>
          ) : null}

          {sections.map((section) => {
            if (!section.items.length && !(section.empty && trustworthy)) return null;

            return (
              <div className="summary-block" key={section.title}>
                <h2>{section.title}</h2>
                {section.items.length ? (
                  <ul className={`clean${section.ticks ? " ticked" : ""}`}>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">{section.empty}</p>
                )}
              </div>
            );
          })}

          {summary.quote ? (
            <div className="summary-block">
              <h2>Worth remembering</h2>
              <p className="original">{summary.quote}</p>
            </div>
          ) : null}

          {/* Next to the answer, not under the transcript. A call that got
              nowhere is exactly when someone wants to try again, and they
              shouldn't have to scroll past every line of it to find out how. */}
          <div className="actions">
            <Link className="btn btn-primary" href="/call">
              New call
            </Link>
          </div>
        </section>

        <aside className="card panel">
          <h2>Full transcript</h2>
          {lines.length ? (
            <>
              <div className={`transcript${clipped ? " clipped" : ""}`}>
                {lines.map((line) => (
                  <TranscriptLineView
                    key={line.id}
                    line={line}
                    businessName={brief.businessName}
                  />
                ))}
              </div>
              {clipped ? (
                <div className="actions">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setFullTranscript(true)}
                  >
                    Read all {lines.length} lines
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="empty">
              No transcript — the call didn’t get far enough for anyone to speak.
            </p>
          )}
        </aside>
      </div>

      {/* TEMPORARY - USER TESTING PHASE ONLY. Goes when the logging does. */}
      <TestFeedback sessionId={sessionId} />
    </main>
  );
}
