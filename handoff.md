# Handoff — Yappr

Session-to-session status note, rewritten 2026-09-22 by a Claude (Opus 5)
Cowork session. Not project documentation: `README.md` covers product and
setup, `CLAUDE.md` covers conventions, the push workflow and the gotchas this
note assumes. **Read `CLAUDE.md` first** if you haven't worked here before.

Yappr lets a traveller brief a phone call in their own language; a live voice
model (OpenAI Realtime) makes the call in the *local* language, shows a
dual-language transcript as it happens, asks the traveller whenever the
business offers something they didn't ask for, and writes a summary on hangup.
Target user: **non-technical tourists**, explicitly not a business or
secretary tool.

- Repo: <https://github.com/BjornHettema/yappr> — public, and the only copy
  that matters. Clone fresh; no local working copy persists.
- Live: <https://yappr-rosy.vercel.app>, auto-deploying from `main`.
- Behind a shared passcode. Jeroen holds it; it is not in the repo and must
  never be committed.

## Read before touching

| If you're about to… | Read |
| --- | --- |
| change anything | `CLAUDE.md` |
| change the mid-call decision gate | `lib/callFlow.ts` header, then its test file |
| touch call recording or the feedback form | `TESTING-ONLY.md` |
| delete `api/simulate-business` | `docs/telephony-migration.md` |
| wonder why the Sheet is empty | "Standing traps" below, first bullet |

## Current state

Working and deployed. `npm run lint`, `npm run typecheck`, `npm test` and
`npm run build` all clean, and CI runs all four on every push to `main`.

Verified on the deployed instance repeatedly with real Realtime calls, most
recently a full forked booking: asked 19:00 → offered 20:00 or tomorrow →
both shown as equal options → picked 20:00 → relayed → restaurant confirmed in
its own words → call ended → summary "Confirmed" with the confirmation as the
quote. Each live run spends real OpenAI credit on Jeroen's key, so **one call
per change is enough.**

What exists: the brief form, the live call with a dual-language transcript,
the mid-call decision gate, the summary, dark mode, 47 languages, a passcode
gate, temporary session logging and a tester feedback form.

What doesn't: **real phone calls** (the business side is an LLM roleplay),
accounts, payment, and any test coverage beyond the decision protocol.

## What to do next

1. **Get 3–5 real non-technical-traveller testers on it.** This has been the
   top item since the project started and nothing substitutes for it. Every
   serious bug so far was found by Jeroen or a friend using the thing, not by
   reasoning about it. Jeroen is writing the invite himself. The
   instrumentation is finished and verified end to end (`archive: "stored"`).
2. **Decide the summary page's language.** Content comes back in the
   traveller's language; the headings are hardcoded English ("What was
   agreed", "Still open", "Next steps"). For a Dutch or Japanese traveller
   that reads half-finished, and the target user is non-technical. A real
   product decision, never discussed with Jeroen — ask, don't assume.
3. **Photography.** The site is entirely text, which reads as unfinished
   rather than minimal. Tracked on the Yappr Status dashboard.
4. Longer-term, unstarted: real outbound calling (Twilio Voice + a
   media-stream bridge, needs its own always-on service — `README.md` and
   `docs/telephony-migration.md`), then accounts and prepaid credits
   (`docs/adr/0001`), then a shorter domain.

## Invariants you must not relax

Each of these exists because a live call went wrong in a specific way. They
are **client-side on purpose** — the pattern across every serious bug in this
codebase is that the model was handed a judgement and got it wrong, and every
fix that stuck took the judgement away. Prefer a client-side invariant over a
firmer instruction.

All four are pinned in `lib/callFlow.test.ts` and `lib/realtimeEvents.test.ts`,
by name, with the failure in the case name. A failure there is a regression,
not a stale test. **If you edit those tests, re-check that they can still
fail** — mutate the rule and watch it go red. The guards are silent, so a test
that cannot fail is worse than none.

- **Yappr has no authority to accept anything the traveller did not write.**
  Any difference — seat, time, date, price, quantity, item — goes to the
  traveller via the `ask_traveler` tool. The only sanctioned exception is
  explicit latitude in the brief's extra notes. Do not reintroduce "offer a
  practical alternative"; that instruction is how someone ends up holding a
  seat they never agreed to.
- **The holding line is client-driven** (`holdLineRequested` /
  `expectHoldLine`). Told to say it itself, the model said it on the first
  fork of a live call and silently skipped the second, leaving a real salon on
  a dead line. It is queued and fired on `response.done` because the realtime
  API refuses a second response while one is open.
- **`ask_traveler` is refused while the traveller's last answer hasn't
  reached the business** (`answerUnspoken`). Without it, "at 22:00" came back
  to the traveller as *"They asked for 22:00. Can you offer that time?"* —
  Yappr had cast its own client as the shop, and the call never recovered.
- **`end_call` is refused while a request made since that answer is
  unanswered** (`awaitingBusinessReply`, read off the transcript). Yappr asked
  to book 20:30, was never replied to, hung up, and the summary read
  "Confirmed". The traveller would have turned up.

Two more rules that aren't state machines but are just as load-bearing:

- **Anything the model produces for the traveller to *read* goes through
  `/api/translate` before it is shown** — the question and its option labels
  included. The model is under a speak-only-the-local-language instruction all
  call and intermittently applies it to tool arguments, which is how an
  English traveller got a Thai question. Don't fix that class of bug by
  strengthening the prompt.
- **Every corrective instruction must restate the standing rules it could cut
  across.** A correction saying "wait for their confirmation" produced *"I have
  requested the table and will wait for the restaurant to confirm — I'll let
  you know"*, said out loud to the restaurant. Hence the shared
  `NO_NARRATION` clause in `lib/prompts.ts`. A targeted instruction sent
  mid-call outweighs a general one set at the start.

## Decisions already made — don't re-litigate

- **30 seconds** is the answer window and it is Jeroen's ceiling, not a
  default. It started at 45; longer than anyone holds a phone in silence.
- **Any difference needs a yes**, not just material ones.
- **Buttons plus free text**, with the free text on the decision card itself.
  A question answered with a value (name, number, spelling) must be
  `kind: "info"`, which renders a field — a button reading "here is my phone
  number" carries no phone number.
- **`unavailable` is not an error state.** A no is a successful call with a
  disappointing answer, so the verdict pill is grey, never red.
- **Prepaid credits, not a subscription** (`docs/adr/0001`). Accounts exist to
  enable payment, not for preferences.
- **The passcode gate stays** until there is real auth and rate limiting.
- **Test records are kept permanently** until deliberately deleted, and
  per-tester deletion is a known unsolved warning, not a blocker — Jeroen's
  call, revisit when accounts exist.
- **graphify stays**, at Jeroen's direction, and it earned it: it is what
  identified `LiveCall()` as the one oversized module. But **its god-node
  count is misleading after a refactor** — extracting logic into modules adds
  imports, and imports are edges, so `LiveCall()` went 36 → 47 while getting
  safer. Read it as "how much does this touch", not "how risky is this".

## Standing traps

- **The test-log archive fails silently.** A dead or archived Apps Script
  deployment answers with an HTML "page not found" rather than an error, so
  nothing throws. If asked why the Sheet is empty, check the collector first:
  open the Web app URL and read the landing text (`POST sessions and feedback
  here` = current script), and look at the `archive` field `/api/test-log`
  returns (`stored` / `failed` / `no-webhook`). Usual cause is "New
  deployment" instead of a new *version*, which mints a different URL while
  Vercel keeps pointing at the old. Diagnostic table in
  `docs/testing/README.md`.
- **Vercel CLI/API is fully blocked from this sandbox.** Env vars, redeploys
  and domains all go through Jeroen in the dashboard.
- **The GitHub API is refused** even with a valid PAT ("GitHub access to this
  repository is not enabled for this session. Use add_repo…"); there is no
  `add_repo` tool, so don't hunt for it. `gh` device-flow login is blocked
  too. Pushing works with a user-supplied fine-grained PAT used transiently
  via `http.extraHeader` — see `CLAUDE.md`.
- **A PAT without `workflow` scope cannot push to `.github/workflows/`**, and
  GitHub rejects the *whole* push, not just that file. Commit workflow edits
  separately or they block everything behind them.
- **`next/font` needs network access to `fonts.googleapis.com` at build time**, which
  this sandbox denies. `npm run build` failing on fonts is the environment, not
  the code; let CI build it.
- **`WebFetch` can't see these pages** — they are client-rendered, so it
  returns only `<head>` metadata and will convince you the passcode gate is
  off when it isn't. Use a browser tool.
- **The browser pane's `read_page` returns "(empty page)" while the pane is
  hidden.** `get_page_text` and `javascript_tool` still work.

## How to verify things quickly

- **The summary page:** seed `sessionStorage` (`yappr.summary`,
  `yappr.transcript`, `yappr.callBrief`) and reload `/call/summary`. Far
  faster than placing calls, and it is the only sane way to see all five
  outcomes.
- **A full call:** fill the brief form with `javascript_tool` using a native
  value setter plus dispatched `input`/`change` events (the inputs are
  React-controlled), then submit. Reading `.decision-question`,
  `.decision-actions .btn` and `.line` from the DOM tells you everything
  without screenshots.
- **The archive:** POST a clearly-marked record to `/api/test-log` from the
  deployed page's own origin and read the `archive` field. Cheaper and more
  precise than a real call. Delete the row afterwards and say so.
- **Dead code:** `npx knip` (`eslint-config-next` is a permanent false
  positive — consumed dynamically via `FlatCompat.extends()`). Orphan CSS is
  worth a check too; there is none right now.

## Bug history worth remembering

Compressed from a long session log. The lesson matters more than the incident.

| What happened | What it taught |
| --- | --- |
| Ordered a crab dish for a table with a shellfish allergy | The model will invent details. Prompt rules are necessary and not sufficient. |
| Narrated its own process to whoever picked up | Anything that sounds like reporting back tells the business it isn't the customer. Keeps returning in new grammar — a bare pronoun ("let me ask *him*") slipped through the rule against it. |
| Filed an information-only call as `booked` | The summary needs its own outcome vocabulary, and "agreed" means the local said so. |
| Said the holding line once, skipped the second | Don't leave a required action to the model's discretion. |
| Wrote the decision card in Thai for an English traveller | Intermittent means something skipped a deterministic path. Pin what the traveller reads. |
| Offered 17:00 *or* 15:30 and put only 17:00 to the traveller | Dropping an option is deciding. Style alternatives as peers. |
| Asked the traveller "can you offer that time?" | Role confusion is the worst failure mode; enforce the ordering in code. |
| Hung up on an unanswered request, summary said "Confirmed" | Asking is not agreeing. |
| A guard wired into the simulated business side | Don't couple an invariant to scaffolding; derive it from the transcript. |
| The archive died and nothing noticed | A resolved fetch is not a successful one. Report the outcome. |
