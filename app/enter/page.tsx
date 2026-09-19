"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function safeNext(value: string | null) {
  // Only ever redirect to a local path, never off-site (this comes from a
  // query param, so it's attacker-controllable — guard against open redirects).
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

function EnterForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
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
      // A hard redirect, not the client router: this guarantees a fresh
      // request that re-checks the just-set cookie through middleware,
      // rather than relying on a client-side transition to catch up.
      window.location.href = next;
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
            name="code"
            autoFocus
            autoComplete="off"
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
