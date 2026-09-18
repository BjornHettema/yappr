export type Speaker = "yappr" | "business" | "you";

export type TranscriptLine = {
  id: string;
  speaker: Speaker;
  original: string;
  translation: string;
  language: string;
  at: number;
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
