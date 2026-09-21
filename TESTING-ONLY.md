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
- the generated summary
- timestamps and call duration

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
- **Say how long you keep it and delete it when testing ends.** Decide a
  retention period now, not later.
- **Do not put the records anywhere public.** A webhook into a private sheet is
  fine; a public endpoint is not.
- If a tester asks for their data to be deleted, you need to be able to find and
  delete it. That is easier if the destination is one sheet, not a log stream.

## Where the data goes

| Destination | Set up by | Durable? |
| --- | --- | --- |
| Runtime logs (`console.log`, prefixed `[YAPPR-TEST-LOG]`) | Always on | **No.** Vercel retains runtime logs briefly. Fallback only. |
| `TEST_LOG_WEBHOOK_URL` | Optional env var | Yes, wherever you point it. This is the real archive. |

Without the webhook you will lose most of the sessions. Point it at a private
Google Sheet / Airtable / Make / Zapier endpoint before inviting testers.

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
3. In `app/call/live/LiveCall.tsx`: delete `recordTestSession()`, its call
   inside `hangUp()`, the `startedAt` ref, and the `testLog` import
4. In `app/call/page.tsx`: delete the `.notice` block and the `testLog` import
5. In `app/globals.css`: delete the `.notice` rule
6. In `.env.example`: delete the TESTING-ONLY block
7. In Vercel: delete `NEXT_PUBLIC_ENABLE_TEST_LOGGING` and
   `TEST_LOG_WEBHOOK_URL`
8. Delete the collected data once the research is written up, or move it
   somewhere with a retention policy
9. Delete this file
10. `grep -ri "test-log\|testLog\|TESTING-ONLY" .` should return nothing

Everything added for this is marked with a
`TEMPORARY - USER TESTING PHASE ONLY` banner comment, and every record carries
the string `[YAPPR-TEST-LOG]`, so both the code and the data are greppable.
