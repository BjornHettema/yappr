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
  /** Short and yes/no-able, in the traveler's language. */
  question: string;
  /** What the business said, in their own words. */
  businessSaid: string;
  /** The same line in the traveler's language. Empty until it arrives. */
  businessSaidTranslated: string;
  options: string[];
  askedAt: number;
};

/**
 * How long the traveler gets. Someone who picked up a phone will not hold in
 * silence much longer than this, and on timeout Yappr says it will call back
 * rather than guessing: a lost call can be made again, a booking made on a
 * substitute nobody agreed to cannot be taken back.
 */
export const ANSWER_WINDOW_SECONDS = 45;

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
