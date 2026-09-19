"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function EnterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "That code is not correct.");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <p className="kicker">Early access</p>
      <h1>Yappr is being tested right now</h1>
      <p className="lede">Enter the code you were given to try it.</p>
      <form className="card panel" onSubmit={onSubmit}>
        <label className="field">
          Access code
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter the code you were given"
          />
        </label>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={submitting || !code.trim()}>
            {submitting ? "Checking…" : "Continue"}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </main>
  );
}

export default function EnterPage() {
  return (
    <Suspense fallback={null}>
      <EnterForm />
    </Suspense>
  );
}
