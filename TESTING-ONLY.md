# TESTING ONLY — remove before general release

> **This file exists because Yappr currently records real call sessions.**
> It is a temporary research feature for the invited-tester phase. It is not a
> product feature and it must not survive into a public launch.
> **Hard stop: `2026-12-31`.** After that date the endpoint stores nothing and
> logs a warning instead, so forgetting this fails closed.

## What is being recorded

When `NEXT_PUBLIC_ENABLE_TEST_LOGGING=true`, every finished call sends one JSON
record to `/api/test-log` containing:

- the brief: goal, extra notes, business type, city, both languages
- the full dual-language transcript, every turn
- every mid-call decision the traveller was asked to make: the question, the
  options, what the business had offered, what they chose, and how many seconds
  they took — plus the question as the model first wrote it, on the occasions
  the translator had to rescue it from the wrong language
- the generated summary
- timestamps and call duration
- the commit, branch and deployment the session ran on, so results from an
  older build can be traced and set aside if its prompts or UI have since
  changed

The summary page also shows testers three feedback questions. Their answers —
two multiple choices and one free-text comment — are sent as a second record
carrying the same `sessionId`, so an answer can be read next to the call it is
about. The comment box is free text, so assume it can contain anything a
tester felt like typing, and treat it as personal data too.

**This is personal data.** Names (a booking is made under someone's name), what
a person wants, where they are, and sometimes health information, because "my
son has an earache" is exactly the kind of call this product exists for. Treat
the collected records the way you would treat customer support tickets, not the
way you would treat analytics.

The business phone number is deliberately **not** recorded.

## Obligations while it is on

- **Tell every tester, before they use it.** The brief form shows a notice
  automatically whenever logging is on. One flag drives both the notice and the
  recording, so it is not possible to record silently — do not split them.
- **Retention is deliberate, not automatic.** Decision: records are kept
  permanently until someone explicitly decides to delete them, probably after
  release. They are research, not telemetry. Nothing expires them on its own.
- **Do not put the records anywhere public.** A webhook into a private sheet is
  fine; a public endpoint is not.
- **Deleting one tester's data is not solved, by decision.** If someone asks,
  it is a manual search of the Sheet — now across two tabs, though `sessionId`
  at least links a call to its feedback — and nothing ties rows to a person
  beyond what they typed. That is fine for a handful of invited testers who were told
  what is kept. It stops being fine the moment this points at strangers, or the
  moment accounts exist and rows can be tied to a real identity. Revisit it
  then.

## Where the data goes

| Destination | Set up by | Durable? |
| --- | --- | --- |
| Runtime logs (`console.log`, prefixed `[YAPPR-TEST-LOG]`) | Always on | **No.** Vercel retains runtime logs briefly. Fallback only. |
| `TEST_LOG_WEBHOOK_URL` | Optional env var | Yes. A Google Sheet via Apps Script — setup in `docs/testing/README.md`. This is the real archive. |

Without the webhook you will lose most of the sessions. **Set it up first:
`docs/testing/README.md` has the Apps Script and the step-by-step.**

## How to turn it on

In Vercel, set:

```
NEXT_PUBLIC_ENABLE_TEST_LOGGING=true
TEST_LOG_WEBHOOK_URL=https://…          # your private collector
```

Then redeploy. `NEXT_PUBLIC_` values are baked in at build time, so a redeploy
is required for a change to take effect.

## How to remove it (the whole point of this file)

1. Delete `lib/testLog.ts`
2. Delete `app/api/test-log/` (the whole folder)
3. Delete `app/components/TestFeedback.tsx`
4. In `app/call/live/LiveCall.tsx`: delete `recordTestSession()`, its call
   inside `hangUp()`, the `startedAt` and `sessionId` refs, and the `testLog`
   and `SESSION_ID_KEY` imports
5. In `app/call/summary/page.tsx`: delete the `<TestFeedback />` element, its
   import, the `sessionId` state and the `SESSION_ID_KEY` import
6. In `lib/types.ts`: delete `SESSION_ID_KEY`
7. In `app/call/page.tsx`: delete the `.notice` block and the `testLog` import
8. In `app/globals.css`: delete the `.notice` rule and the whole "tester
   feedback" block (`.feedback`, `.choice`, `.choice-row`, `.chip`)
9. In `.env.example`: delete the TESTING-ONLY block
10. In Vercel: delete `NEXT_PUBLIC_ENABLE_TEST_LOGGING` and
    `TEST_LOG_WEBHOOK_URL`
11. Delete the collected data once the research is written up, or move it
    somewhere with a retention policy
12. Delete `docs/testing/` (the Apps Script and its README)
13. Delete or archive the Google Sheet itself — **both tabs** — and undeploy
    the Apps Script web app so the URL stops accepting posts
14. Delete this file
15. `grep -ri "test-log\|testLog\|TESTING-ONLY\|TestFeedback\|SESSION_ID_KEY" .`
    should return nothing

Everything added for this is marked with a
`TEMPORARY - USER TESTING PHASE ONLY` banner comment, and every record carries
the string `[YAPPR-TEST-LOG]`, so both the code and the data are greppable.
