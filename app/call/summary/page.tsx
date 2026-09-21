"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CALL_BRIEF_KEY,
  SUMMARY_KEY,
  TRANSCRIPT_KEY,
  defaultBrief,
  loadJson,
  type CallBrief,
  type Summary,
  type TranscriptLine,
} from "@/lib/types";
import TranscriptLineView from "@/app/components/TranscriptLineView";

export default function SummaryPage() {
  const [brief] = useState<CallBrief>(() => loadJson(CALL_BRIEF_KEY, defaultBrief));
  const [summary] = useState<Summary>(() => loadJson(SUMMARY_KEY, {}));
  const [lines] = useState<TranscriptLine[]>(() => loadJson(TRANSCRIPT_KEY, []));

  const outcomeLabel = useMemo(() => {
    const map: Record<string, string> = {
      booked: "Confirmed",
      pending: "Waiting on them",
      unavailable: "Not available",
      unclear: "Needs a follow-up",
    };
    return map[summary.outcome || ""] || "Call notes";
  }, [summary.outcome]);

  return (
    <main className="page">
      <p className="kicker">{outcomeLabel}</p>
      <h1>{summary.headline || "Here’s what happened"}</h1>
      <p className="lede">
        {brief.businessName} · {brief.place || brief.localLanguage}
      </p>

      <div className="summary-grid">
        <section className="card panel">
          <h2>What was agreed</h2>
          <ul className="clean">
            {(summary.agreed || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {summary.quote ? (
            <>
              <h2>Worth remembering</h2>
              <p className="original">{summary.quote}</p>
            </>
          ) : null}
          <h2>Still open</h2>
          <ul className="clean">
            {(summary.unresolved || []).length
              ? (summary.unresolved || []).map((item) => <li key={item}>{item}</li>)
              : <li>Nothing flagged.</li>}
          </ul>
          <h2>Next steps</h2>
          <ul className="clean">
            {(summary.nextSteps || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {summary.error ? <p className="error">{summary.error}</p> : null}
        </section>

        <aside className="card panel">
          <h2>Full transcript</h2>
          <div className="transcript">
            {lines.map((line) => (
              <TranscriptLineView
                key={line.id}
                line={line}
                businessName={brief.businessName}
              />
            ))}
          </div>
          <div className="actions">
            <Link className="btn btn-primary" href="/call">
              New call
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
