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
