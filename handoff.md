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

**Fonts are now self-hosted** (`c54df43`). `app/layout.tsx` uses `next/font/google`, so the files are fetched at build time and served from our own origin — confirmed live: zero requests to googleapis/gstatic, font files coming from `/_next/static/media/`. This closes a GDPR exposure (a `<link>` to Google's CDN sends every visitor's IP to Google; LG München I ruled in 2022 that this breaches the GDPR without consent) as well as removing a render-blocking third-party request.

**Gotcha for future sessions:** `npm run build` will FAIL in this sandbox on that file, because the egress policy 403s `fonts.googleapis.com` and `next/font` needs it at build time. That is the environment, not the code. Run lint and typecheck locally and let CI (open network) be the build check for anything touching fonts; check it with `WebFetch` on the Actions page.

**Verified on the deployed site** at `022b03e`: homepage and brief form at 390px and desktop, plus a full live call (Dutch → Thai) to see the new transcript bubbles in place. That walkthrough caught one thing worth knowing — moving the primary action to terracotta had made **"Hang up" the loudest button on the call screen**, sitting next to "Send note" at the same size. It now has its own outlined red treatment (`.btn-danger`). Lesson for next time: after any change to the button palette, look at every screen that has a destructive action on it, not just the marketing page.

### 5. Ran the three design skills properly (commits `e9ca326`, `8cdb4d0`)

**taste-skill pre-flight** found five real failures, all fixed: em-dashes in visible copy (it treats this as a binary ban and it is the most-violated AI tell), a 29-word hero subtext against a 20-word cap, two eyebrow labels on a two-section page (cap is one per three), a decorative status dot that duplicated the text beside it, and five ad-hoc corner radii now collapsed into one documented scale.

**ui-ux-pro-max** was run against its own palette and font-pairing data, and the useful result was negative: for "travel / booking / trust" it proposes sky-blue `#0EA5E9` with an orange CTA, and its generated design system for this product is trust-blue `#2563EB` + orange + Swiss minimalism. That is the templated look the other skill exists to prevent. Its font data returned children's-app pairings (Fredoka/Nunito, Caveat/Quicksand) for "warm and friendly", and independently recommends **Outfit**, which Yappr already uses. **Conclusion: keep Fraunces + Outfit and the cream/terracotta/teal palette.** Both are technically on taste-skill's banned-default lists (Fraunces by name, the cream in the "premium-consumer beige" family), but they are pre-existing brand, not a default reach, and nothing in the data is better. Do not let a future session "fix" them without asking Jeroen.

**design-motion-principles audit** — its most useful step is the gap analysis (conditional UI with NO transition is usually worse than badly-tuned motion). One real gap: new transcript lines appeared instantly mid-call, on the screen whose whole purpose is watching lines arrive. Now a 200ms enter. Also replaced the browser default `ease` with one `--ease-out` token. Nothing else gained motion.

### 6. Dark mode (commit `bd01cfa`)

Every colour in `globals.css` is now a semantic token, so dark mode is one `@media (prefers-color-scheme: dark)` override block rather than a parallel stylesheet. **Do not add raw hex to a rule** — add a token and give it both values, or dark mode silently breaks.

The brand hues do not move between modes; surfaces, text and tint amounts do. The part that needed thought: terracotta and teal are too dark to read *as text* on a dark surface, so `--accent-text` and `--teal-text` lift to `#e8845a` / `#5fc0b4`, while the button *fill* stays brand terracotta with white on it. Shadows do almost nothing on dark, so depth there comes from the hairline insets plus a deeper ambient shadow. `color-scheme: light dark` is set so form controls and scrollbars follow.

Every pair was measured and passes AA. Lowest are white on the terracotta fill (4.8:1) and the field border against its field (4.0:1); body text is 14.6:1, muted 7.1:1. Verified on the deployed site in both modes, including the transcript bubbles.

**A switch followed in `0c6de32`**, after Jeroen pointed out there was no way to override the OS. Behaviour he chose: follow the system until someone picks a side, then remember their choice and stop following. Dark is keyed on `data-theme` on `<html>`, not on a media query, resolved by a small **blocking inline script** in `layout.tsx` before first paint (a deferred script or a `useEffect` both run after the browser has painted, which is the flash this avoids). `ThemeToggle` only reads and changes it, and listens to the OS only while nothing is stored. Verified live: the stored choice survives a reload and beats an OS set to dark.

**Still open, deliberately not done:**
- **No images anywhere.** taste-skill: "a pure-text page is not minimalism, it is incomplete work." No image-generation tool was available in the session, and stock placeholders on a live product would be worse than nothing. Now tracked on the status dashboard under Now: needs a hero image plus two or three supporting shots, generated or licensed.

### 7. Test-session logging (TEMPORARY)

Jeroen asked for call transcripts to be captured as user-testing data. Built with three safeguards, because this records personal data: names, what someone wants, and sometimes health details.

- **Off by default.** Nothing is recorded unless `NEXT_PUBLIC_ENABLE_TEST_LOGGING=true`.
- **It expires on 2026-12-31.** After that `/api/test-log` stores nothing and warns instead, so forgetting to remove it fails closed rather than quietly collecting data for a year.
- **One flag drives both the recording and the tester notice** on the brief form, so it is not possible to record people silently. Do not split them.

Destinations: a one-line `[YAPPR-TEST-LOG]` JSON record on stdout (Vercel runtime logs, short retention, fallback only) and, if `TEST_LOG_WEBHOOK_URL` is set, a POST to that URL. **Jeroen needs to set the webhook before inviting testers** or most sessions will be lost.

`TESTING-ONLY.md` at the repo root is the removal checklist, and `CLAUDE.md` points at it. Every file involved carries a `TEMPORARY - USER TESTING PHASE ONLY` banner.

**Live and collecting as of `a6948d9`.** Jeroen deployed the Apps Script collector and set both env vars (`NEXT_PUBLIC_ENABLE_TEST_LOGGING` as Config, `TEST_LOG_WEBHOOK_URL` as Secret). Verified end to end: rows land in the Sheet with transcript, summary and commit stamp.

**The logging immediately earned its keep**, which is the useful part of this note. The first real session — a Lisbon apartment host explaining that the key is in a lockbox — was recorded as `outcome: "booked"` when nothing had been booked, because the enum only offered booked/pending/unavailable/unclear. Since the homepage examples are now mostly *information* errands (key pickup, opening hours, lost jacket, pharmacy), most calls would have been misclassified and sorting the research by outcome would have misled. Fixed in `a6948d9` by adding an **`answered`** outcome, and `summaryPrompt()` now explains what each value means instead of listing them bare. Re-tested with an information-only call: correctly returns `answered`, labelled "You have your answer".

Two lessons for whoever reads the research: rows before `a6948d9` use the old enum, and the `commitMessage` column carried the full commit body until `c5fda36` (subject line only after that).

### 8. Cleanup pass (commit `9953fb5`)

`npx knip` after several sessions of building found seven unused exports and one dead constant, all drift rather than mistakes: `businessTypeLabel`, `speakerLabel`, `openaiHeaders`, `CHAT_COMPLETIONS_URL` and `OpenAIRequestError` were each only used inside their own file and are no longer exported; the flattened `languages` array in `lib/languages.ts` had been unused since the dropdown moved to grouped optgroups and is gone; `THEME_KEY` moved to `lib/types.ts` so `ThemeToggle` and the pre-paint script in `layout.tsx` read one constant instead of two copies of the same string.

Also checked that every CSS class in `globals.css` is still referenced from JSX — the redesign left no orphan styles.

**`eslint-config-next` is knip's one false positive** and always will be: it is consumed dynamically via `FlatCompat.extends()` in `eslint.config.mjs`, which static analysis cannot follow. Don't remove it, and don't spend time on it again.

`npx knip` is worth running at the end of any session that refactors across files.

**graphify is in use, at Jeroen's direction.** An earlier draft of this session downgraded it on the grounds that nothing had reached for it; Jeroen asked for it to stay, and running it proved him right on the substance. `CLAUDE.md` now says what it is good for and — more usefully — what to ignore in its report, because it indexes markdown too and the doc headings crowd the god-node list.

**Its one concrete finding, still open:** `LiveCall()` is by a distance the most connected thing in the codebase — 19 edges and 11 nested functions in a single ~450-line client component handling WebRTC setup, transcript state, translation, the business simulator, coaching, hangup, summary and test logging. Nothing is broken, but it is the obvious next refactor if anyone touches that file substantially. Splitting the realtime connection and the transcript state into hooks is the natural cut.

### 9. Tester feedback form (TEMPORARY, commit `9fab1f1`)

`app/components/TestFeedback.tsx` on the summary page, behind the same
`testLoggingActive()` flag as the session recording — one flag drives the
tester notice, the recording and the form, and splitting them would make it
possible to collect silently.

Three questions. *Did Yappr get what you needed?* is comparable across testers
and can be read against the `outcome` the summary recorded — a tester saying
"partly" where the summary says "booked" is the finding. *Would you have made
this call yourself?* is the product thesis in one question; if most say they'd
have just phoned, this is a convenience rather than a need. Then one open box,
phrased as "anything confusing, wrong, or missing" rather than "what did you
think", because the first gets specifics and the second gets "nice!".

**Willingness to pay is deliberately not asked.** Stated willingness,
collected free, seconds after a success, is the least reliable number in
research. That belongs in a conversation, and the ADR already assumes prepaid
credits.

A `sessionId` is minted at the start of the call, stored in `sessionStorage`
and sent with both records, so a comment can be read next to the transcript it
is about. The Apps Script now writes feedback to its own **Feedback** tab;
`sessionId` was *appended* to the end of the session columns rather than
inserted, so rows written before today stay aligned.

**Jeroen must re-paste `docs/testing/google-sheet-collector.gs` into the Sheet
and redeploy a new version** (Deploy → Manage deployments → pencil → New
version), or feedback rows keep landing on the sessions tab as near-empty
rows. The URL does not change. Until then, one smoke-test row from this
session's live check is sitting on the first tab and can be deleted.

Verified live on the deployed site: chips, the disabled-until-answered send
button, the thank-you state and a `200` from `/api/test-log`.

### 10. Yappr may no longer choose for the traveler (commit `183fe5a`)

Jeroen's call, and the right one: Yappr had standing permission to improvise
— *"if something is unavailable, offer a practical alternative"* — which is how
someone ends up holding a middle seat they never agreed to. Its authority is
now exactly what the traveler wrote.

Anything different the business offers is a new offer it cannot accept,
decline or pick between. It says a short holding line in the local language,
calls the new **`ask_traveler`** tool, and goes silent. A tool rather than
another prompt rule, deliberately: the model then has to *declare* the fork
instead of resolving it quietly, and a prompt rule alone is what produced the
crab-dish bug.

The traveler gets a docked card (`app/components/DecisionPrompt.tsx`) with the
business's actual words, translated, **and** one short yes/no question. Both,
because the quote is the evidence and the question is the action. The coach box
becomes the answer box while a question is open, so "no, but ask about
Saturday" — which two buttons cannot express — still works.

Decisions settled with Jeroen: **any** difference needs a yes (not just
material ones); buttons plus free text; and on no answer within
`ANSWER_WINDOW_SECONDS` (45) Yappr apologises, says it will call back and hangs
up rather than taking the offer. A lost call can be remade; a booking on a
substitute cannot be unmade.

While a question is open, the simulated business turn is suppressed and
`end_call` is ignored — checked twice in `afterAgentSpoke`, because the tool
call and the spoken hold line arrive as independent events.

Also in this commit: the business simulator now runs out of things sometimes
(otherwise the fork is unreachable in a demo), the summary reports a declined
offer as the traveler's decision rather than as unavailability, and every fork
is logged with how many seconds the traveler took — which is really a test of
whether testers are at the screen while the call runs.

**Verified live, full loop.** Asked for front-row boxing seats; the stadium
offered the second row; Yappr said *"สักครู่นะครับ เดี๋ยวผมเช็กก่อนครับ"* and
asked. Declined → it said no, asked what else there was, got "nothing, any
day" and came straight back through `ask_traveler` instead of accepting. Let
the clock run out → it apologised, said it would call back, hung up, and the
summary came out `unavailable` with *"Traveler did not accept second row seats"*
under Still open. Nothing was ever agreed on the traveler's behalf.

Two prompt polish items came out of watching it: the decline line read as
*"we do not accept the second row"* (fixed — one person on the phone, not a
company), and the summary was putting facts it had merely learned under "What
was agreed" (fixed — that field is for things actually arranged).

**Still needs Jeroen:** the collector re-paste from item 9 now also picks up
two new columns, `forks` and `decisions`.

## What failed / known blockers (standing)

- **Vercel CLI/API is fully blocked from this cloud sandbox.** Any Vercel action (env vars, redeploys, domains) has to go through Jeroen in the dashboard.
- **`gh` CLI OAuth device-flow login is blocked**, and the **GitHub API is refused** even with a valid PAT in the header ("GitHub access to this repository is not enabled for this session. Use add_repo…"); there is no `add_repo` tool to invoke, so don't hunt for it. Pushing works with a fresh user-supplied fine-grained PAT used transiently via `http.extraHeader` (see `CLAUDE.md`). To read CI status, `WebFetch` https://github.com/BjornHettema/yappr/actions — the repo is public, so that works.
- **`WebFetch` can't see these pages' content** — they're client-rendered, so it only returns `<head>` metadata and will make you think the passcode gate is off when it isn't. Use a browser tool.
- **The browser pane's `read_page` returns "(empty page)" / viewport 0x0 while the pane is hidden.** `get_page_text` still works, and filling the brief form via `javascript_tool` (native value setter + dispatched `input`/`change` events, since the inputs are React-controlled) works without needing refs. That's the reliable way to drive a test call when you can't see the pane.

## What it should do next

1. **Get 3–5 real non-technical-traveler testers on the deployed app.** This is the one open item nothing else substitutes for. One friend's manual test already produced a real feature (item 2 above) and, indirectly, the three prompt bugs. The instrumentation is now finished — sessions and feedback both land in the Sheet — so the only missing ingredient is testers. Claude can draft the invite.
2. **Decide on the summary page's language.** Content comes back in the traveler's language but the headings are hardcoded English ("What was agreed", "Still open", "Next steps"). For a Dutch or Japanese traveler that reads half-finished, and the target user is explicitly non-technical. Not yet discussed with Jeroen.
3. Longer-term, unstarted: real outbound calling via Twilio Voice + a media-stream bridge (needs its own always-on service, doesn't fit serverless Next.js — see `README.md`), then a shorter custom domain.

Note for whoever runs the next live test: each one spends real OpenAI credit on Jeroen's key. One call per change is enough.
