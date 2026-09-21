# Handoff — Yappr

Written 2026-09-21 by a Claude (Opus 5) Cowork session, for whichever session picks this up next. This is a session-to-session status note, not project documentation — see `README.md` (product/setup) and `CLAUDE.md` (dev conventions, workflow, known gotchas) for that. Read `CLAUDE.md` first if you haven't worked in this repo before; it has the GitHub-push workaround, pre-push checks, and product-tone rules this note assumes you already know.

## Goal

Yappr lets a traveler brief a phone call in their own language; a live voice model (OpenAI Realtime API) makes the call in the local language, shows a dual-language transcript live, and writes a summary on hangup. Target user: non-technical tourists, not a business/secretary tool. Repo: https://github.com/BjornHettema/yappr (public, source of truth — always clone fresh, no local dev copy exists). Live: https://yappr-rosy.vercel.app.

## Current state

Working, deployed, CI green at `576946c`. The passcode has been rotated off `admin` (Jeroen holds the current one — ask him, it is not in the repo and must never be committed). The previous session's dead-code/duplication audit is fully actioned and closed.

**The app has now been walked through end to end on the deployed instance three times this session, with real GPT Realtime calls** (Dutch traveler → Thai restaurant). The last run was clean: correct opening turn, correct details, accurate summary. Still no automated tests; verification is manual plus CI's lint/typecheck/build.

## What this session did

### 1. Actioned the duplication audit (commit `36f4b91`)

`lib/openai.ts` gained `callOpenAI` / `chatCompletion` / `chatText`, an `OpenAIRequestError` carrying the upstream status, and `errorResponse()`; all four API routes use them. New `app/components/TranscriptLineView.tsx` is the single transcript-line renderer for the live call and the summary page — which fixed the summary page printing raw speaker keys. `sendUserMessage()` and `speak()` helpers in `LiveCall.tsx`. `Summary` type moved to `lib/types.ts`; unused `RealtimeEvent.call_id` dropped. Both conventions are written into `CLAUDE.md`.

### 2. Kept the traveler's request visible (commits `11290af`, `fbb9337`)

Tester feedback (a friend of Jeroen's, manual test): you couldn't check the call against what you'd actually asked for. New `app/components/CallRequest.tsx` shows the goal, the extra notes and the place details — in the live call panel and at the top of the summary. The extra notes were previously never shown again anywhere. Renders nothing when the brief is empty, since `sessionStorage` is cold in a fresh tab.

### 3. Fixed three prompt bugs found by live testing (commits `a71770c`, `576946c`)

These are the substantive finds, and **none of them are visible in static code review** — they only appear when you actually place a call:

- **The agent narrated its own process on the first turn.** Its opening was, translated: "Hello, welcome. We're about to start the request for the travelers. I'll send the information to the team, so please wait a moment." Whoever picks up has no idea what that means, and it burned a whole turn before asking anything. The opening turn now lives in `callOpeningInstructions()` in `lib/prompts.ts`.
- **The booking name got re-spelled.** "Jeroen" came back from Thai as "de heer Jeron" in one line and "meneer Jeroen" in the next. `/api/translate` now takes an optional `names` hint; `LiveCall` passes the proper nouns the traveler typed so the translator restores their spelling instead of guessing one back out of the local script.
- **The agent invented details it was never given — the serious one.** Briefed with "table for four at 19:00, name Jeroen, outside, one shellfish allergy", its opening turn asked for 18:00, a window seat, and a crab curry. It corrected itself over later turns, but the summary still reported the crab dish as agreed — i.e. the app told a traveler with a shellfish allergy that shellfish had been ordered for them. `callOpeningInstructions()` now restates the goal and notes verbatim and forbids adding any detail not in them; `agentInstructions()` carries a hard no-invention rule plus a requirement that allergies and medical/accessibility needs be stated and never contradicted; `summaryPrompt()` may only report what the local actually confirmed.

**Watch this one.** It is the failure mode with real consequences for this product, and a prompt rule is a soft guarantee. The last live run was clean, but one clean run is not proof — re-test invention specifically whenever the agent prompt or the model changes, and consider whether a real check (e.g. diffing the summary's `agreed` items against the brief) belongs in the app.

### 4. Language list, homepage and a visual redesign (commits `a0e9767` … `f12e31e`)

- **One shared language list of 47** (`lib/languages.ts`), replacing separate traveler/local lists that made an Indonesian speaker in Thailand unable to use the app at all. Grouped by region for the dropdown. Verified with an Indonesian → Thai live call.
- **The homepage example rotates** (`lib/examples.ts` + `app/components/LivePostcard.tsx`), picked in an effect so the page stays statically prerendered.
- **Redesign.** The site read as a stack of identical rounded rectangles: every surface had the same border, radius and shadow. Now: "How it works" is a dotted route between numbered milestones (vertical on a phone) rather than four equal cards; transcript lines are speech bubbles leaning to the speaker's side; surfaces use layered shadows and hairline insets instead of 1px borders; the background is a warm wash; the primary action is terracotta; buttons and inputs are >= 50px for thumbs. The brief form is grouped with **the request first**, so you say what you need before answering six questions about the business.
- **Accessibility work that came with it**: focus-visible rings (there were none at all), `prefers-reduced-motion` (the waveform animated forever regardless), `:autofill` highlighting, `:user-invalid` so required fields only complain after interaction, and two measured contrast fixes — input borders were 1.3:1 (WCAG 1.4.11 wants 3:1 for a component boundary) and placeholders were 2.6:1. Every other new pair was measured and passes AA; white on the terracotta button is 4.8:1.
- The `design` and `modern-web-guidance` plugins are now installed and were used for this. `modern-web-guidance` is worth running before any CSS work — it's how the container-query and `:autofill` patterns got in.
- **Four community design skills are now in Jeroen's catalog** (all MIT, packaged from their public repos and uploaded by him): `design-taste-frontend` (leonxlnx/taste-skill), `ui-ux-pro-max` (nextlevelbuilder), `design-motion-principles` (kylezantos), plus `awesome-claude-design` (VoltAgent) which is a reference README rather than a skill. Their anti-slop checklists are what caught the pulsing status dot.

**One improvement left undone, deliberately:** the Google Fonts `<link>` in `app/layout.tsx` is a render-blocking third-party request on every first visit — the slowest thing on the page over hotel wifi. It should be `next/font/google` (self-hosted, metric-matched, no FOUT). **It cannot be done from this cloud sandbox**: the egress policy 403s `fonts.googleapis.com`, so `next/font` fails at build and the font files can't be downloaded to self-host either. `globals.css` is already written as `var(--font-sans, "Outfit")`, so switching is a one-file change in `layout.tsx` from a machine with open network. Verify the build before pushing — an unbuildable push just fails the deploy.

**Verified on the deployed site** at `022b03e`: homepage and brief form at 390px and desktop, plus a full live call (Dutch → Thai) to see the new transcript bubbles in place. That walkthrough caught one thing worth knowing — moving the primary action to terracotta had made **"Hang up" the loudest button on the call screen**, sitting next to "Send note" at the same size. It now has its own outlined red treatment (`.btn-danger`). Lesson for next time: after any change to the button palette, look at every screen that has a destructive action on it, not just the marketing page.

## What failed / known blockers (standing)

- **Vercel CLI/API is fully blocked from this cloud sandbox.** Any Vercel action (env vars, redeploys, domains) has to go through Jeroen in the dashboard.
- **`gh` CLI OAuth device-flow login is blocked**, and the **GitHub API is refused** even with a valid PAT in the header ("GitHub access to this repository is not enabled for this session. Use add_repo…"); there is no `add_repo` tool to invoke, so don't hunt for it. Pushing works with a fresh user-supplied fine-grained PAT used transiently via `http.extraHeader` (see `CLAUDE.md`). To read CI status, `WebFetch` https://github.com/BjornHettema/yappr/actions — the repo is public, so that works.
- **`WebFetch` can't see these pages' content** — they're client-rendered, so it only returns `<head>` metadata and will make you think the passcode gate is off when it isn't. Use a browser tool.
- **The browser pane's `read_page` returns "(empty page)" / viewport 0x0 while the pane is hidden.** `get_page_text` still works, and filling the brief form via `javascript_tool` (native value setter + dispatched `input`/`change` events, since the inputs are React-controlled) works without needing refs. That's the reliable way to drive a test call when you can't see the pane.

## What it should do next

1. **Get 3–5 real non-technical-traveler testers on the deployed app.** This is the one open item nothing else substitutes for. One friend's manual test already produced a real feature (item 2 above) and, indirectly, the three prompt bugs. Claude can draft the invite and a lightweight feedback form.
2. **Decide on the summary page's language.** Content comes back in the traveler's language but the headings are hardcoded English ("What was agreed", "Still open", "Next steps"). For a Dutch or Japanese traveler that reads half-finished, and the target user is explicitly non-technical. Not yet discussed with Jeroen.
3. Longer-term, unstarted: real outbound calling via Twilio Voice + a media-stream bridge (needs its own always-on service, doesn't fit serverless Next.js — see `README.md`), then a shorter custom domain.

Note for whoever runs the next live test: each one spends real OpenAI credit on Jeroen's key. One call per change is enough.
