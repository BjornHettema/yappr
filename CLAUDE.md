# Yappr

Yappr lets a traveler brief a phone call in their own language; a live voice
model then makes the call in the *local* language, shows a dual-language
transcript as it happens, and writes a summary when it hangs up.

Repo: https://github.com/BjornHettema/yappr (public — this is the only copy
that matters; see "Workflow" below).

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, strict mode.
- No database, no auth, no backend server beyond Next's own API routes.
- Client-side state (the call brief, live transcript, summary) lives only in
  `sessionStorage` — see `lib/types.ts`. It does not persist across devices
  or page reloads in a new tab; that's intentional for this prototype stage,
  not a bug.

## Layout

```
app/
  page.tsx                     Marketing/landing page
  call/page.tsx                Step 1: brief the call (form -> sessionStorage)
  call/live/LiveCall.tsx        Step 2: the actual live call (WebRTC to OpenAI Realtime)
  call/summary/page.tsx        Step 3: post-call summary + full transcript
  enter/page.tsx                Early-access passcode entry page (see below)
  api/realtime/session/route.ts    Mints a short-lived OpenAI Realtime client secret
  api/simulate-business/route.ts   Roleplays the "business" side of the call (demo only)
  api/summary/route.ts             Turns the transcript into a structured summary
  api/translate/route.ts           One-off text translation for the live transcript
  api/access/route.ts              Checks the passcode, sets the access cookie
  components/TranscriptLineView.tsx  One transcript line, shared by live call + summary
lib/
  languages.ts    Dropdown options (traveler/local languages, business types)
  openai.ts       OpenAI headers/models, the shared `callOpenAI` fetch wrapper,
                  route `errorResponse` helper + the `end_call` tool definition
  prompts.ts      All LLM prompt strings (agent, business simulator, summary)
  types.ts        Shared types + sessionStorage read/write helpers
middleware.ts     Early-access passcode gate (see below)
```

## Commands

```bash
npm install
npm run dev         # http://localhost:3000
npm run build        # also type-checks
npm run lint
npm run typecheck    # tsc --noEmit, faster than a full build
```

## Environment variables

Copy `.env.example` to `.env.local` before running anything that hits the
API routes (the landing page and static parts build/run fine without it).

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Read server-side only, in `lib/openai.ts`. Never expose this to the client. |
| `OPENAI_REALTIME_MODEL` | No | Defaults to `gpt-realtime`. |
| `SITE_PASSCODE` | No | Gates the whole site behind a shared passcode when set — see below. Unset = gate is off. |
| `TWILIO_*`, `PUBLIC_MEDIA_STREAM_URL` | No | Placeholders for real PSTN dialing — **not implemented yet**, see below. |

`npm run build` does not need `OPENAI_API_KEY` set — the key is only read at
request time inside route handlers, never at module load or build time.

## Important context for future changes

- **The "business" side of the call is simulated.** `api/simulate-business`
  has an LLM roleplay the person answering the phone so the full loop is
  demoable without a real phone line. Real outbound calling would replace
  this with Twilio Voice + a media-stream bridge (see the README) — that
  bridge needs a long-lived WebSocket connection, which does not fit a
  typical serverless Next.js host, so it will likely need its own small
  always-on service rather than living in `app/api`.
- **The realtime voice connection is browser -> OpenAI directly**, via
  WebRTC, using a short-lived client secret minted by
  `api/realtime/session`. The Next.js server never proxies the audio.
- **Never commit `.env.local` or any real API key.** The repo is public;
  `.gitignore` already excludes `.env`, `.env.local`, and any `.env*.local`.
- **The site is gated by a shared passcode (`middleware.ts` + `app/enter` +
  `api/access`) while it's still early-access only.** This is deliberately
  not real authentication — just a cookie check against `SITE_PASSCODE` — to
  stop random visitors from running up the OpenAI bill on the public URL.
  It should stay in place until there's a real reason to open the site up
  (and real rate limiting/auth to go with it), not be removed casually.
- **API routes should go through `callOpenAI`/`chatCompletion` in `lib/openai.ts`**
  rather than calling `fetch` against OpenAI directly, and should end with
  `catch (error) { return errorResponse(error, "<fallback>"); }`. That keeps the
  upstream status code on failures and stops the four routes from drifting apart.
- **Transcript lines render through `app/components/TranscriptLineView.tsx`** in
  both the live call and the summary page — don't hand-roll the `<article
  className="line …">` markup again; the two copies had already drifted once.
- **`TESTING-ONLY.md` at the repo root is live right now.** Yappr records real
  call sessions (brief + transcript + summary) while
  `NEXT_PUBLIC_ENABLE_TEST_LOGGING=true`. That is personal data, it is
  temporary, and it expires on 2026-12-31. Read that file before touching
  `lib/testLog.ts`, `app/api/test-log/`, or the `.notice` block on the brief
  form, and do not remove the tester notice while leaving the recording on.
- **There are no automated tests yet.** Verify changes by running `npm run
  dev` and walking through: brief a call -> live call page connects and a
  transcript appears -> hang up -> summary page shows content. `npm run
  lint`, `npm run typecheck`, and `npm run build` should all stay clean —
  CI (`.github/workflows/ci.yml`) runs all three on every push/PR to `main`.

## Workflow

GitHub is the source of truth. Development happens by cloning fresh into
whatever session/device is doing the work — there is no local working copy
to keep in sync, so don't assume any prior local state exists. Commit and
push directly; there's no branch-protection or review gate, just CI as a
safety net.

## Codebase map (graphify)

Worth running at the start of a session that touches several files, and again
after a refactor. It is ~0.6s, deterministic, tree-sitter based, and costs no
API tokens.

```bash
pip install graphifyy --break-system-packages   # or: uv tool install graphifyy
graphify update .
graphify explain "LiveCall()"                    # one node and everything it touches
graphify path "A" "B"                            # how two things connect
```

Writes `graphify-out/` (gitignored): `graph.json`, an interactive `graph.html`,
and `GRAPH_REPORT.md`. Regenerate rather than trusting a stale copy; the report
prints the commit it was built from.

**What it is good for here.** The god-node list is the real payoff: it is how
`LiveCall()` was identified as the one oversized module in the codebase (19
edges, 11 nested functions, far ahead of anything else). It also verifies there
are no import cycles, and `graphify explain` is a fast way to see everything a
function touches before changing it.

**What to ignore in the report.** It indexes markdown as well as code, so
`handoff.md` and ADR headings show up as god nodes and as "surprising
connections" — those are just documents mentioning function names, not
structure. Likewise `package.json` and `tsconfig.json` keys form their own
"communities" and it will suggest splitting them into modules; they are
manifests, ignore it. The "isolated nodes" count is mostly types and constants
with naturally few edges. Read the god nodes, the cycles check and the
communities that correspond to real source files; skip the rest.

For dead code and unused exports specifically, `npx knip` is the sharper tool
and complements this well. Run both at the end of a refactoring session.
