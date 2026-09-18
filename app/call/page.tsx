"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { businessTypes, localLanguages, travelerLanguages } from "@/lib/languages";
import { CALL_BRIEF_KEY, defaultBrief, saveJson, type CallBrief } from "@/lib/types";

export default function CallSetupPage() {
  const router = useRouter();
  const [brief, setBrief] = useState<CallBrief>(defaultBrief);

  function update<K extends keyof CallBrief>(key: K, value: CallBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    saveJson(CALL_BRIEF_KEY, brief);
    router.push("/call/live");
  }

  return (
    <main className="page">
      <p className="kicker">Step 1 · Brief the call</p>
      <h1>What should Yappr get done?</h1>
      <p className="lede">
        Keep it ordinary: a booking, opening hours, a prescription hold, a pickup time. Yappr will
        speak the local language on the line.
      </p>

      <form className="card panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="field">
            Your language
            <select
              value={brief.travelerLanguage}
              onChange={(e) => update("travelerLanguage", e.target.value)}
            >
              {travelerLanguages.map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Local language
            <select
              value={brief.localLanguage}
              onChange={(e) => update("localLanguage", e.target.value)}
            >
              {localLanguages.map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Business name
            <input
              required
              placeholder="Baan Suan"
              value={brief.businessName}
              onChange={(e) => update("businessName", e.target.value)}
            />
          </label>
          <label className="field">
            Kind of place
            <select
              value={brief.businessType}
              onChange={(e) => update("businessType", e.target.value)}
            >
              {businessTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Phone number
            <input
              placeholder="+66 …"
              value={brief.phoneNumber}
              onChange={(e) => update("phoneNumber", e.target.value)}
            />
          </label>
          <label className="field">
            City / neighborhood
            <input
              placeholder="Ari, Bangkok"
              value={brief.place}
              onChange={(e) => update("place", e.target.value)}
            />
          </label>
          <label className="field full">
            What you need
            <textarea
              required
              placeholder="Table for two tonight at 7pm, window if they have one. Name under Maya."
              value={brief.goal}
              onChange={(e) => update("goal", e.target.value)}
            />
          </label>
          <label className="field full">
            Anything else Yappr should know
            <textarea
              placeholder="Allergy to shellfish. Prefer outside. Don't mention the hotel."
              value={brief.extraNotes}
              onChange={(e) => update("extraNotes", e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit">
            Start the call
          </button>
        </div>
        <p className="meta">
          This first version runs a live GPT Realtime session with a simulated local on the other
          end, so you can hear and read the full loop without a Twilio number. Add Twilio credentials
          later to dial the real shop.
        </p>
      </form>
    </main>
  );
}
