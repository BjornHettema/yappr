"use client";

import { useEffect, useState } from "react";
import { callExamples } from "@/lib/examples";

/**
 * The "live call" postcard on the homepage, showing a different example on
 * every visit.
 *
 * The example is picked in an effect rather than during render on purpose:
 * the homepage is statically prerendered, so randomising at render time would
 * either bake one example in at build time (same for everyone until the next
 * deploy) or mismatch on hydration. Picking after mount keeps the page static
 * and cacheable, and the fade makes the swap read as intentional.
 */
export default function LivePostcard() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * callExamples.length));
  }, []);

  const example = callExamples[index];

  return (
    <aside className="postcard">
      <div className="postcard-head">
        On the line with {example.business} · {example.place}
      </div>

      <div className="wave" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="bubble fade-in" key={index}>
        <div className="who">{example.language}</div>
        <p className="original" lang={example.lang}>
          {example.original}
        </p>
        <p className="translation">{example.translation}</p>
      </div>
    </aside>
  );
}
