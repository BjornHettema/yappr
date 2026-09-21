# Handoff — Yappr

Written 2026-09-21 by a Claude (Opus 5) Cowork session, for whichever session picks this up next. This is a session-to-session status note, not project documentation — see `README.md` (product/setup) and `CLAUDE.md` (dev conventions, workflow, known gotchas) for that. Read `CLAUDE.md` first if you haven't worked in this repo before; it has the GitHub-push workaround, pre-push checks, and product-tone rules this note assumes you already know.

## Goal

Yappr lets a traveler brief a phone call in their own language; a live voice model (OpenAI Realtime API) makes the call in the local language, shows a dual-language transcript live, and writes a summary on hangup. Target user: non-technical tourists, not a business/secretary tool. Repo: https://github.com/BjornHettema/yappr (public, source of truth — always clone fresh, no local dev copy exists). Live: https://yappr-rosy.vercel.app (gated behind `SITE_PASSCODE`, currently `admin` — flagged as too guessable, **still not rotated**).

## Current state

Working, deployed, feature-complete for its current scope: brief → live call → dual transcript → summary. No automated tests exist; verification is manual plus CI's lint/typecheck/build on every push. The previous session's dead-code/duplication audit is now **fully actioned** — all five of its findings are done, so that audit is closed. Roadmap tracked in a Claude Artifact dashboard ("Yappr Status" — ask the user for the link if you need it, it's not in this repo).

## What this session did

Implemented every refactor the previous session's audit recommended (it was audit-only, no code changes). Changes, all pushed to `main`:

1. **Shared OpenAI call wrapper.** `lib/openai.ts` gained `callOpenAI(url, body, { fallbackError, extraHeaders })`, a `chatCompletion(body, fallbackError)` shorthand, `chatText(data)` for pulling the assistant message out, an `OpenAIRequestError` that carries the upstream status, and `errorResponse(error, fallback)` for the catch block. All four API routes (`summary`, `translate`, `simulate-business`, `realtime/session`) now use them — the repeated fetch/`if (!response.ok)`/catch-500 skeleton is gone. External behavior is unchanged: same error message strings, same status codes (verified by hand, see below).
2. **`sendUserMessage(text)` in `LiveCall.tsx`** replaces the duplicated `conversation.item.create` + `response.create` pair in `afterAgentSpoke()` and `sendCoach()`.
3. **`app/components/TranscriptLineView.tsx`** is now the single renderer for a transcript line, used by both `LiveCall.tsx` and `app/call/summary/page.tsx`. This also **fixed the real drift the audit found**: the summary page used to print the raw speaker key (`yappr`/`business`/`you`); it now shows the same friendly labels as the live view (`Yappr` / the business name / `You`). `speakerLabel()` falls back to "The business" when no business name is set.
4. **`speak(speaker, original)` helper in `LiveCall.tsx`** folds the two identical translate-then-`pushLine` blocks together (audit item 4, marked optional).
5. **`Summary` type moved to `lib/types.ts`** next to `CallBrief`/`TranscriptLine` (audit item 5, marked optional), and the unused `RealtimeEvent.call_id` field was dropped (audit's one real dead-code finding). `Speaker` stays exported — it's now genuinely used by `TranscriptLineView`, so knip shouldn't flag it again.

`CLAUDE.md` gained two conventions so these don't regress: routes go through `callOpenAI`/`errorResponse`, transcript markup goes through `TranscriptLineView`.

### How it was verified (no test suite, so: by hand)

- `npm run lint`, `npm run typecheck`, `npm run build` all clean — same three checks CI runs. CI itself then went **green on `36f4b91`** (checked via the public Actions page with WebFetch — that works even though the GitHub *API* is blocked in this sandbox; useful trick for the next session).
- Dev server smoke test: `/`, `/call`, `/call/live`, `/call/summary` all 200.
- API error-shape regression check with no `OPENAI_API_KEY` set: `/api/translate` → 500 `{"error":"Missing OPENAI_API_KEY"}`, `/api/summary` → same, `/api/realtime/session` with an empty body → 400 `{"error":"Missing call details."}`. Identical to pre-refactor behavior.
- Rendered `TranscriptLineView` through a throwaway page under `app/` (deleted again before committing) and asserted the markup: correct `line <speaker>` class, correct friendly label for all three speakers, business-name fallback, `· speaking` suffix on the partial line, and no `translation` div when the translation is empty.
- **Not verified: a real end-to-end voice call**, because no `OPENAI_API_KEY` was available in this session and the built-in browser can't reach a localhost dev server. The refactors are behavior-preserving and the realtime message payloads are byte-identical to before, but if you want belt-and-braces, walk through one live call on the deployed instance before building anything on top of this.

## What failed / known blockers (standing, not new this session)

- **Vercel CLI/API is fully blocked from this cloud sandbox** (org policy). Any Vercel action (checking deploys, env vars, redeploys) has to go through Jeroen via the Vercel dashboard.
- **`gh` CLI OAuth device-flow login is blocked** by the sandbox proxy. Pushing needs a fresh user-supplied fine-grained PAT used transiently via `http.extraHeader`, per `CLAUDE.md`. Ask for a token each session; don't assume a prior one is still valid. (Plain `git push` without a token was not granted this session either.)
- **GitHub API calls are refused** in this sandbox ("GitHub access to this repository is not enabled for this session. Use add_repo…") — and there is still no `add_repo` tool to invoke, even with a valid PAT in the header, so don't hunt for it. Workaround that does work: `WebFetch` on https://github.com/BjornHettema/yappr/actions reads CI status fine, since the repo is public.

## What it should do next

1. **Rotate `SITE_PASSCODE` away from `admin`.** This is now the oldest open item and it's a two-minute change in the Vercel dashboard (Jeroen has to do it; Claude can't reach Vercel). Do this before the link goes to any tester.
2. **Get 3–5 real non-technical-traveler testers on the deployed app** and collect feedback. This is the one open item nothing else can substitute for, and everything below it is speculative until it's done. Offer to draft the invite message and a lightweight feedback form.
3. Longer-term, unstarted: real outbound calling via Twilio Voice + a media-stream bridge (needs its own always-on service, doesn't fit serverless Next.js — see `README.md`), then a shorter custom domain.

Nothing in the codebase is blocking any of the above — the code is in good shape and the maintenance backlog the last audit raised is empty. The next real risk is building more features before step 2 tells you which ones matter.
