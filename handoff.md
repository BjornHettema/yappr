# Handoff — Yappr

Written 2026-09-21 by a Claude (Sonnet 5) Cowork session, for whichever session picks this up next (expected: Opus 5). This is a session-to-session status note, not project documentation — see `README.md` (product/setup) and `CLAUDE.md` (dev conventions, workflow, known gotchas) for that. Read `CLAUDE.md` first if you haven't worked in this repo before; it has the GitHub-push workaround, pre-push checks, and product-tone rules this note assumes you already know.

## Goal

Yappr lets a traveler brief a phone call in their own language; a live voice model (OpenAI Realtime API) makes the call in the local language, shows a dual-language transcript live, and writes a summary on hangup. Target user: non-technical tourists, not a business/secretary tool. Repo: https://github.com/BjornHettema/yappr (public, source of truth — always clone fresh, no local dev copy exists). Live: https://yappr-rosy.vercel.app (gated behind `SITE_PASSCODE`, currently `admin` — flagged as too guessable, not yet rotated).

## Current state

Working, deployed, CI green as of commit `18b50e4`. Feature-complete for its current scope: brief → live call → dual transcript → summary, all verified end-to-end against the deployed instance. No automated tests exist; verification has been manual (`npm run dev` walkthrough) plus live browser testing against the deployed URL, plus CI's lint/typecheck/build on every push. Roadmap tracked in a Claude Artifact dashboard ("Yappr Status" — ask the user for the link if you need it, it's not in this repo) with three phases already shipped (setup, deploy, passcode-gate) and two open: rotate the passcode, and get 3–5 real target users testing.

## What this session did

Asked to find dead code and duplicate logic and hand off findings — **audit only, no code changes made.** Method: regenerated the `graphify` knowledge graph (`graphify update .` — see `CLAUDE.md`), ran `npx knip` for unused-export/dependency detection, then manually read every file under `app/` and `lib/` to verify or discard what those tools flagged (both have false-positive modes worth knowing about — see below).

Files touched: none in git. `graphify-out/` was regenerated locally (it's gitignored, regenerate it yourself with `graphify update .` rather than trusting anything I might have left behind).

### Findings: dead code (small, low-severity)

- `RealtimeEvent.call_id` in `app/call/live/LiveCall.tsx:22` — field declared on the type, never read anywhere. Either wire it up (e.g. for logging) or drop the field.
- `Speaker` type in `lib/types.ts:1` is exported but only ever used inside that same file. Not harmful, just an unnecessary `export` — knip flags it as an "unused exported type."
- Tool false positives worth knowing, so you don't waste time on them: knip also flagged `eslint-config-next` in `package.json` as an unused devDependency — it's actually consumed dynamically via `FlatCompat.extends("next/core-web-vitals", ...)` in `eslint.config.mjs`, which knip's static analysis can't trace through. Leave it. Similarly, graphify's report lists "63 isolated nodes" — almost all of those are config keys, type fields, and doc headings with naturally few graph edges, not actual dead code; don't chase that number down without reading each one.

### Findings: duplicate logic (the real substance — worth fixing)

1. **The same fetch-to-OpenAI/error-handling skeleton is repeated in all four API routes**: `app/api/summary/route.ts`, `app/api/translate/route.ts`, `app/api/simulate-business/route.ts`, `app/api/realtime/session/route.ts`. Each wraps `fetch(..., { headers: openaiHeaders(), body: JSON.stringify(...) })` in the identical try/`if (!response.ok) return NextResponse.json({error}, {status})`/catch-and-500 shape — roughly 15–20 duplicated lines × 4. This is the highest-value refactor here: extract a shared `callOpenAI(url, body, extraHeaders?)` helper into `lib/openai.ts` that returns the parsed JSON or throws a normalized error, and have each route call it.
2. **The "inject a message, then trigger a response" realtime pattern is duplicated** in `app/call/live/LiveCall.tsx` between `afterAgentSpoke()` (~line 227) and `sendCoach()` (~line 285): both send an identical `conversation.item.create` + `response.create` pair, differing only in the text and its `[BUSINESS]`/`[TRAVELER COACHING]` prefix. Extract a `sendUserMessage(text: string)` helper.
3. **Transcript-line JSX is duplicated** between `LiveCall.tsx` (~line 380) and `app/call/summary/page.tsx` (~line 80) — near-identical `<article className="line ...">` markup. Worth noting: they're not just duplicated, they've already drifted — `LiveCall.tsx` shows a friendly speaker label (`Yappr` / business name / `You`), while `summary/page.tsx` prints the raw `line.speaker` key (`yappr`/`business`/`you`) verbatim. That drift is a small real inconsistency, not just duplication. Extract a shared `<TranscriptLine>` component so it can't drift again.
4. Lower priority: `afterAgentSpoke()` calls `translate()` twice sequentially (once for the agent's line, once for the business's reply) with an identical translate-then-`pushLine` shape each time. Could fold into a `speak(speaker, original)` helper alongside fix #2, but it's a minor DRY/perf note, not urgent.
5. Architecture note, not duplication exactly: the `Summary` type (the implicit shape of `/api/summary`'s response) is defined locally in `app/call/summary/page.tsx` rather than centrally in `lib/types.ts` next to `CallBrief`/`TranscriptLine`, even though it's the same category of shared data and nothing enforces that the API's actual output matches it. Consider moving it.

None of the above are bugs users would notice today — they're maintenance-cost and consistency issues. #1–#3 are the ones worth actually doing; #4–#5 are optional.

## What failed / known blockers (standing, not new this session)

- **Vercel CLI/API is fully blocked from this cloud sandbox** (org policy, 403 on the CONNECT tunnel to `vercel.com`/`api.vercel.com`). Any Vercel action (checking deploys, env vars, redeploys) has to go through the user directly via the Vercel dashboard.
- **`gh` CLI OAuth device-flow login is blocked** by the sandbox's proxy. Pushing to GitHub needs either a plain `git push` (works only if the session has been granted access to this specific repo — check first) or a fresh user-supplied fine-grained PAT used transiently via `http.extraHeader`, per `CLAUDE.md`/the yappr-dev-workflow skill. Ask the user for a token each session; don't assume a prior one is still valid.
- **Unauthenticated GitHub API calls (checking CI run status, etc.) were refused** this session with `"GitHub access to this repository is not enabled for this session. Use add_repo to request access."` — that's a real mechanism (some kind of session-level repo authorization), but no `add_repo` tool was found via ToolSearch to actually invoke it. If you need CI status and hit the same wall, that's expected — try asking for a PAT and using `gh api` with it, or ask the user to check Actions in the GitHub UI directly, rather than spending time hunting for `add_repo`.
- **The built-in browser tools (`mcp__remote-devices__Claude_Browser__*`) disconnected mid-session** this time (their MCP server dropped) — that's how live end-to-end testing against the deployed URL has been done in prior sessions. If they're unavailable when you start, that's a transient connection thing, not a project issue; Claude in Chrome (`mcp__claude-in-chrome__*`) is the fallback if the user has that extension.

## What it should do next

1. Do the three worthwhile refactors above (the `callOpenAI` helper, `sendUserMessage` helper, shared `<TranscriptLine>` component) — each is small and isolated, good first task. Run `npm run lint && npm run typecheck && npm run build` before pushing (CI runs the same three checks), and manually walk through brief → live call → transcript → hangup → summary afterward since there's no test suite. Push per the PAT workflow in `CLAUDE.md`.
2. Then pick the product roadmap back up: rotate `SITE_PASSCODE` away from `admin`, then help get 3–5 real non-technical-traveler testers using the deployed app and collect feedback — that's the one open item nothing else can substitute for.
3. Longer-term, unstarted: real outbound calling via Twilio Voice + a media-stream bridge (needs its own always-on service, doesn't fit serverless Next.js hosting — see `README.md`), and eventually a shorter custom domain.
