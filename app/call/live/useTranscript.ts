"use client";

/**
 * The call transcript: the rendered list, a ref the async handlers can read,
 * the partial line Yappr is mid-way through saying, and persistence to
 * sessionStorage so the summary page can pick it up.
 *
 * A narrow seam, which is why it is worth having its own file — it takes no
 * dependencies and every other part of the call reads from it.
 *
 * The ref exists because the handlers that append lines are async (a
 * translation round trip sits in the middle of each one) and cannot read
 * state. It is also what the hang-up guard reads: whether the business has
 * replied since the traveler's last answer is a fact about this list. See
 * `awaitingBusinessReply` in lib/callFlow.ts.
 */

import { useEffect, useRef, useState } from "react";
import { TRANSCRIPT_KEY, newId, saveJson, type TranscriptLine } from "@/lib/types";

export function useTranscript() {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState("");
  const linesRef = useRef<TranscriptLine[]>([]);

  useEffect(() => {
    linesRef.current = lines;
    saveJson(TRANSCRIPT_KEY, lines);
  }, [lines]);

  /**
   * Appends through the ref rather than through a state updater, because two
   * lines can be appended from separate async handlers before React has
   * re-rendered either of them.
   */
  function pushLine(line: Omit<TranscriptLine, "id" | "at">) {
    const next: TranscriptLine = { ...line, id: newId(), at: Date.now() };
    linesRef.current = [...linesRef.current, next];
    setLines(linesRef.current);
    return next;
  }

  return { lines, linesRef, partial, setPartial, pushLine };
}
