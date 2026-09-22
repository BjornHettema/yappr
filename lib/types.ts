export type Speaker = "yappr" | "business" | "you";

export type TranscriptLine = {
  id: string;
  speaker: Speaker;
  original: string;
  translation: string;
  language: string;
  at: number;
};

/** Shape of `/api/summary`'s response, as rendered by the summary page. */
export type Summary = {
  headline?: string;
  outcome?: string;
  agreed?: string[];
  unresolved?: string[];
  nextSteps?: string[];
  quote?: string;
  error?: string;
};

export type CallBrief = {
  travelerLanguage: string;
  localLanguage: string;
  businessName: string;
  businessType: string;
  phoneNumber: string;
  place: string;
  goal: string;
  extraNotes: string;
};

/**
 * A decision Yappr has handed back to the traveler mid-call, because the
 * business offered something the traveler never asked for. Yappr is silent and
 * the business is holding while one of these is open.
 */
export type PendingQuestion = {
  id: string;
  /** The realtime tool call this came from, so it can be acknowledged. */
  callId: string;
  /**
   * "confirm" is one offer, answered yes or no, so the accepting option can
   * lead. "choice" is several alternatives the business named, which are peers
   * — styling one of them as the recommendation would be Yappr nudging a
   * decision it is not allowed to make. "info" is the business needing
   * something only the traveler has: a name, a number, a spelling. No button
   * can carry a phone number, so that one opens a field instead.
   */
  kind: "confirm" | "choice" | "info";
  /** Short and answerable, in the traveler's language. */
  question: string;
  /**
   * The question exactly as the model wrote it, before it was put through the
   * translator. Kept only so the testing log can show how often the model
   * drifts into the local language — see TESTING-ONLY.md. Never rendered.
   */
  questionRaw: string;
  /** What the business said, in their own words. */
  businessSaid: string;
  /** The same line in the traveler's language. Empty until it arrives. */
  businessSaidTranslated: string;
  options: string[];
  askedAt: number;
};

/**
 * How long the traveler gets. Jeroen's ceiling, and it is a ceiling: someone
 * who picked up a phone will not hold in silence longer than this, and being
 * left waiting is how a real business decides not to take the next call.
 * On timeout Yappr says it will call back rather than guessing — a lost call
 * can be made again, a booking on a substitute nobody agreed to cannot be
 * taken back.
 */
export const ANSWER_WINDOW_SECONDS = 30;

export const CALL_BRIEF_KEY = "yappr.callBrief";
export const TRANSCRIPT_KEY = "yappr.transcript";
export const SUMMARY_KEY = "yappr.summary";
/** Light/dark preference. Read by the pre-paint script in app/layout.tsx too. */
export const THEME_KEY = "yappr.theme";
/** TEMPORARY - testing phase. Joins a logged session to its feedback row. */
export const SESSION_ID_KEY = "yappr.sessionId";

export const defaultBrief: CallBrief = {
  travelerLanguage: "English",
  localLanguage: "Thai",
  businessName: "",
  businessType: "restaurant",
  phoneNumber: "",
  place: "",
  extraNotes: "",
  goal: "",
};

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

/**
 * Ids for transcript lines, questions and the test-log session. One copy:
 * it had drifted into two, which is how the shared transcript component and
 * the shared OpenAI helper both came about in earlier cleanups.
 */
export function newId() {
  return crypto.randomUUID();
}
