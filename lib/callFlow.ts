/**
 * The mid-call decision protocol, as pure logic.
 *
 * Yappr may not accept anything the traveler did not ask for. When the
 * business offers something different, or needs something only the traveler
 * has, Yappr stops and asks. Getting that right turned out to be less about
 * instructions than about three invariants, each of which exists because a
 * live call went wrong in a specific way:
 *
 *  1. The business is told to hold on EVERY question, not just the first.
 *     Left to the model it said it once and silently skipped the second,
 *     leaving a real salon on a dead line.
 *  2. Yappr may not ask the traveler anything until it has put their last
 *     answer to the business. It once took "at 10 PM" and asked the traveler
 *     "They asked for 10 PM. Can you offer that time?" — it had cast its own
 *     client as the shop, and the call never recovered.
 *  3. Yappr may not hang up on a request nobody answered. It asked to book
 *     20:30, was never replied to, hung up, and the summary read "Confirmed".
 *     The traveler would have turned up to a table that did not exist.
 *
 * These live here, apart from the component, for two reasons. They are the
 * load-bearing parts and they had no tests while they were tangled in refs
 * inside an 847-line client component; and the failure modes are quiet —
 * nothing on screen says "this booking was never confirmed". `callFlow.test.ts`
 * pins each of the four failures above as a named case, so relaxing one of
 * these back into a prompt instruction fails CI instead of failing a tester.
 */

import type { PendingQuestion, TranscriptLine } from "./types";

/** What the tool call asks for, once normalised. */
export type AskTravelerArgs = Pick<
  PendingQuestion,
  "kind" | "question" | "businessSaid" | "options"
>;

export type CallFlow = {
  /**
   * The traveler has answered and Yappr has not yet said it to the business.
   * An answer from the person who is not on the call is worth nothing until
   * it reaches the person who is.
   */
  answerUnspoken: boolean;
  /** A correction has already been sent for this answer. One is enough. */
  corrected: boolean;
  /** The next line Yappr speaks is the hold line the client asked for. */
  expectingHoldLine: boolean;
  /** A hang-up has already been refused once for this answer. */
  hangUpRefused: boolean;
  /** Winding up after an unanswered hold; the hang-up guard must stand aside. */
  windingUp: boolean;
};

export function initialCallFlow(): CallFlow {
  return {
    answerUnspoken: false,
    corrected: false,
    expectingHoldLine: false,
    hangUpRefused: false,
    windingUp: false,
  };
}

/* ---------- transitions ---------- */

export function travelerAnswered(flow: CallFlow): CallFlow {
  return { ...flow, answerUnspoken: true, corrected: false, hangUpRefused: false };
}

export function holdLineRequested(flow: CallFlow): CallFlow {
  return { ...flow, expectingHoldLine: true };
}

/**
 * Yappr finished a turn. A hold line carries none of the traveler's answer, so
 * it does not count as having relayed it — that distinction is the whole
 * reason the client drives the hold line rather than the model.
 */
export function yapprSpoke(flow: CallFlow): CallFlow {
  if (flow.expectingHoldLine) {
    return { ...flow, expectingHoldLine: false };
  }
  return { ...flow, answerUnspoken: false };
}

export function correctionSent(flow: CallFlow): CallFlow {
  return { ...flow, corrected: true };
}

export function hangUpRefused(flow: CallFlow): CallFlow {
  return { ...flow, hangUpRefused: true };
}

export function windUpStarted(flow: CallFlow): CallFlow {
  return { ...flow, windingUp: true };
}

/* ---------- queries ---------- */

/**
 * Should this ask_traveler call be sent back instead of shown? True when
 * nothing has been said on the line since the traveler's last answer, because
 * then whatever is being asked cannot have come from the business.
 */
export function shouldCorrectQuestion(flow: CallFlow) {
  return flow.answerUnspoken && !flow.corrected;
}

/**
 * Is Yappr waiting on a reply to something it said after the traveler's last
 * answer? Read off the transcript rather than tracked as a flag, deliberately:
 * `api/simulate-business` is scaffolding and goes when real calls arrive (see
 * docs/telephony-migration.md). A flag set inside that fetch would silently
 * stop being set, and the hang-up guard would then refuse every hang-up for
 * the rest of the call. Any source of business turns keeps this honest.
 */
export function awaitingBusinessReply(
  lines: Pick<TranscriptLine, "speaker">[],
): boolean {
  let lastAnswer = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].speaker === "you") {
      lastAnswer = i;
      break;
    }
  }
  if (lastAnswer === -1) return false;

  for (let i = lastAnswer + 1; i < lines.length; i += 1) {
    if (lines[i].speaker === "business") return false;
  }
  return true;
}

/** Should this end_call be refused? See invariant 3 above. */
export function shouldRefuseHangUp(
  flow: CallFlow,
  lines: Pick<TranscriptLine, "speaker">[],
) {
  if (flow.windingUp || flow.hangUpRefused) return false;
  return awaitingBusinessReply(lines);
}

/** Seconds left on the hold, never negative. */
export function secondsRemaining(askedAt: number, windowSeconds: number, now: number) {
  return Math.max(0, Math.ceil((askedAt + windowSeconds * 1000 - now) / 1000));
}

/* ---------- tool arguments ---------- */

/**
 * Normalises what the model passed to ask_traveler. Returns null when there is
 * no question, which is the one case where showing nothing is right.
 *
 * Two defaults matter. An unrecognised `kind` becomes "choice", never
 * "confirm": "confirm" styles the first option as the accepting one, and false
 * emphasis on an arbitrary option is Yappr nudging a decision it is not
 * allowed to make. And "info" keeps an empty option list, because that card is
 * answered by typing — a button reading "here is my phone number" carries no
 * phone number, which is exactly how Yappr once ended up asking the business
 * for the traveler's own number.
 */
export function parseAskTraveler(rawArgs: string | undefined): AskTravelerArgs | null {
  let parsed: {
    kind?: unknown;
    question?: unknown;
    businessSaid?: unknown;
    options?: unknown;
  };
  try {
    parsed = JSON.parse(rawArgs || "{}");
  } catch {
    return null;
  }

  const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
  if (!question) return null;

  const kind =
    parsed.kind === "confirm" || parsed.kind === "info" ? parsed.kind : "choice";

  const options = (Array.isArray(parsed.options) ? parsed.options : [])
    .map((option) => String(option).trim())
    .filter(Boolean)
    .slice(0, 3);

  return {
    kind,
    question,
    businessSaid:
      typeof parsed.businessSaid === "string" ? parsed.businessSaid.trim() : "",
    options: options.length || kind === "info" ? options : ["Yes", "No"],
  };
}

/** Only a yes/no gets a leading option; alternatives are peers. */
export function isLeadingOption(kind: PendingQuestion["kind"], index: number) {
  return kind === "confirm" && index === 0;
}
