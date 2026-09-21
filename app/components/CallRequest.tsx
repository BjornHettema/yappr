import type { CallBrief } from "@/lib/types";

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

  const details = [brief.businessType, brief.phoneNumber, brief.place]
    .map((value) => value?.trim())
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
