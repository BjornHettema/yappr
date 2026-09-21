import { businessTypes } from "@/lib/languages";
import type { CallBrief } from "@/lib/types";

function businessTypeLabel(value: string) {
  return businessTypes.find((type) => type.value === value)?.label || value;
}

/**
 * What the traveler asked for, shown unchanged during the call and after it.
 * Testers wanted to be able to check the live call and the summary against
 * their own words without going back to the brief form.
 */
export default function CallRequest({
  brief,
  title = "What you asked for",
}: {
  brief: CallBrief;
  title?: string;
}) {
  // The brief lives in sessionStorage, so it can be empty if this page is
  // opened fresh in a new tab. Show nothing rather than an empty box.
  if (!brief?.goal?.trim()) return null;

  // The business name and place are already in the heading above this block
  // on both pages, so only the things that aren't shown elsewhere go here.
  const details = [
    brief.businessType ? businessTypeLabel(brief.businessType) : "",
    brief.phoneNumber?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="request">
      <div className="who">{title}</div>
      <p className="request-goal">{brief.goal}</p>
      {brief.extraNotes?.trim() ? (
        <p className="request-note">
          <strong>You also said:</strong> {brief.extraNotes}
        </p>
      ) : null}
      {details ? <p className="meta">{details}</p> : null}
    </div>
  );
}
