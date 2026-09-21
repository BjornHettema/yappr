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
    <aside className="card postcard">
      <div className="meta">
        Live with {example.business} · {example.place} · {example.language}
      </div>
      <div className="wave" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>
      <p className="original fade-in" lang={example.lang} key={`o${index}`}>
        {example.original}
      </p>
      <p className="translation fade-in" key={`t${index}`}>
        {example.translation}
      </p>
    </aside>
  );
}
