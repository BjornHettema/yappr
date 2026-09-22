# Setting up the test-session collector

> **TEMPORARY — USER TESTING PHASE ONLY.** This whole folder goes when the
> testing phase ends. See `TESTING-ONLY.md` at the repo root for the removal
> checklist.

Sessions are kept **permanently and deliberately** — they are research, not
telemetry, and they are only deleted when someone decides to delete them,
probably after release. Every record carries the commit it came from, so
results from a build whose prompts or UI later changed can be identified and
set aside rather than silently mixed in with newer ones.

## 1. Make the Sheet

1. Go to <https://sheets.new> and name it something unmistakable, e.g.
   **Yappr test sessions (TEMPORARY — contains personal data)**.
2. Leave it private. Do not use File → Share → Publish to the web.

## 2. Add the collector script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete the stub `function myFunction() {}`.
3. Paste the entire contents of `google-sheet-collector.gs` from this folder.
4. Save (the disk icon). Name the project `Yappr test log` if it asks.

> **The Sheet holds its own copy of this script, and a deployment is pinned to
> a version.** Changing `google-sheet-collector.gs` in the repo changes
> nothing until you (1) paste it in again and save, and (2) **Deploy → Manage
> deployments →** the pencil icon **→ Version: New version → Deploy**. That
> keeps the same URL, so nothing in Vercel changes. Saving alone is not
> enough. If rows stop matching the columns documented below, a stale
> deployment is the first thing to check.

## 3. Deploy it as a web app

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** `Yappr test sessions`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. **Deploy**, then **Authorize access** and allow it for your Google account.
   Google will warn that the app is unverified — that is expected for your own
   Apps Script. Choose **Advanced → Go to Yappr test log (unsafe)**.
5. Copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfycb…/exec`.

> **"Anyone" means anyone with the URL can POST rows into the Sheet.** They
> cannot read the Sheet, and the URL is unguessable, but treat it as a secret:
> keep it in Vercel's environment variables and out of the repo. If it ever
> leaks, redeploy the script to get a fresh URL.

Open the URL in a browser to check it is alive. It should say
`Yappr test-session collector is running.`

## 4. Point Yappr at it

In the Vercel project → **Settings → Environment Variables**, add:

| Name | Value | Type |
| --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_TEST_LOGGING` | `true` | **Config** |
| `TEST_LOG_WEBHOOK_URL` | the Web app URL from step 3 | **Secret** |

Why each type:

- The flag is **Config** because it is baked into the client bundle by design
  and is visible to anyone who views source. Marking it Secret would hide it
  from you in the dashboard while hiding nothing from the public, and you want
  to be able to see at a glance whether recording is on.
- The webhook is **Secret** because anyone holding that URL can write rows into
  a sheet of personal data. It has no `NEXT_PUBLIC_` prefix, so it stays
  server-side and never reaches the browser.

**Save the webhook URL in your password manager before you save it in Vercel.**
A Secret cannot be read back afterwards: it keeps working and can be replaced,
but nobody can retrieve the value. You will want it again.

Two Vercel details worth knowing: Secret is only available for the Production
and Preview environments, not Development; and Vercel redacts secret values
over 32 characters from build logs, which the Apps Script URL comfortably is.

Scope both to **Production**, and to **Preview** as well only if you intend
preview deploys to record too.

Then **redeploy**. `NEXT_PUBLIC_` values are baked in at build time, so the
change does not take effect until a new build exists.

## 5. Check it end to end

Place one call on the deployed site and hang up. Within a few seconds a row
should appear in the Sheet. Confirm that:

- the `commit` column matches the deploy you are testing
- the `transcript` cell holds the full conversation
- the brief form showed the testing notice before you started

Then answer the three feedback questions at the bottom of the summary page and
confirm a row appears on the **Feedback** tab with the same `sessionId` as the
session row.

If nothing arrives, look at the Vercel runtime logs for a line starting
`[YAPPR-TEST-LOG]`. The record is always written there too, so if the line
exists but the row does not, the problem is the webhook, not the app.

## Two tabs

The first sheet holds **call sessions**. A second tab named **Feedback** is
created automatically the first time a tester answers the three questions on
the summary page. Both carry a `sessionId`, so a `VLOOKUP` on that column lines
an answer up with the call it is about. A call with no matching feedback row
just means that tester skipped the form, which is itself worth noticing.

### Sessions columns

`loggedAt`, `commit`, `branch`, `environment`, `startedAt`, `durationSeconds`,
`travelerLanguage`, `localLanguage`, `businessType`, `place`, `goal`,
`extraNotes`, `turns`, `outcome`, `headline`, `agreed`, `unresolved`,
`nextSteps`, `transcript`, `commitMessage`, `deploymentUrl`, `raw`,
`sessionId`, `forks`, `decisions`, `rescuedQuestions`.

`forks` is how many times Yappr stopped and asked the traveller to decide;
`decisions` spells each one out — whether it was a `confirm` or a `choice`,
what was offered, what they chose and how long they took.

Three things to watch in there:

- **A high `secondsToAnswer`**, or a `(no answer — Yappr ended the call)`, means
  the tester was not at the screen while the call ran. The whole mid-call gate
  assumes they are, so this is the number that tests the premise.
- **`rescuedQuestions` above zero** means the model wrote the question in the
  wrong language and the translator had to rescue it; the `decisions` cell shows
  what it originally wrote, marked `WRONG LANGUAGE`. It should trend to zero. If
  it doesn't, the client-side guard is the only thing keeping the card readable,
  so nobody should be tempted to remove it as redundant.
- **A `confirm` whose `businessSaid` names more than one alternative** is the
  model collapsing a real choice into a yes/no and picking for the traveller.
  That is the same class of bug as accepting a substitute outright.

`raw` holds the complete JSON payload, so nothing is lost even if the flattened
columns change later. Add new columns to the **end** of `HEADERS` only, or
existing rows will stop lining up — that is why `sessionId` sits after `raw`
rather than next to `loggedAt` where it would read better.

### Feedback columns

`loggedAt`, `sessionId`, `gotIt`, `wouldCall`, `comment`, `commit`,
`environment`.

`gotIt` is `yes` / `partly` / `no`; `wouldCall` is `yes` / `reluctantly` /
`no`. Either can be blank — the form sends whatever was filled in and does not
require all three answers.

The business phone number is deliberately not collected.

## A standing warning

Deleting an individual tester's data is not a problem being solved at this
stage, by decision. Worth knowing what that means: if a tester asks for their
records to be removed, the answer is a manual search of the Sheet, and there is
no identifier tying rows to a person other than what they typed. That is
acceptable for a handful of invited testers who have been told what is being
kept. It stops being acceptable the moment this points at strangers, or the
moment accounts exist and rows can be tied to a real identity.
