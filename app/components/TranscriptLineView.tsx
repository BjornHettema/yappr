import type { Speaker, TranscriptLine } from "@/lib/types";

function speakerLabel(speaker: Speaker, businessName?: string) {
  if (speaker === "yappr") return "Yappr";
  if (speaker === "business") return businessName?.trim() || "The business";
  return "You";
}

/**
 * One line of a call transcript. Shared by the live call and the summary page
 * so the two views can't drift apart again.
 */
export default function TranscriptLineView({
  line,
  businessName,
  labelSuffix,
}: {
  line: Pick<TranscriptLine, "speaker" | "original" | "translation">;
  businessName?: string;
  labelSuffix?: string;
}) {
  const label = speakerLabel(line.speaker, businessName);

  return (
    <article className={`line ${line.speaker}`}>
      <div className="who">{labelSuffix ? `${label} · ${labelSuffix}` : label}</div>
      <div className="original">{line.original}</div>
      {line.translation ? <div className="translation">{line.translation}</div> : null}
    </article>
  );
}
