# When the simulated business is replaced by a real phone call

`app/api/simulate-business/route.ts` is scaffolding. It has an LLM roleplay the
person answering the phone so the whole loop is demoable without a phone line,
and it **goes away** when Yappr dials real numbers (Twilio Voice plus a
media-stream bridge — see `README.md`; that bridge needs a long-lived
WebSocket, so it will likely be its own always-on service rather than a Next
route).

This file exists because a lot of behaviour now leans on the mid-call decision
gate, and some of it would break quietly rather than loudly when the simulator
is removed. Read it before deleting that route.

## What actually changes

Today a business turn is *pulled*: Yappr finishes speaking, `afterAgentSpoke`
POSTs to `/api/simulate-business`, gets one reply, pushes it to the transcript,
and feeds it back to the model as a `[BUSINESS]` user message.

With a real call it is *pushed*: the remote party's audio arrives on the
call leg, the realtime model hears it directly and transcribes it
(`conversation.item.input_audio_transcription.completed`), and there is no
request/response shape at all. Three consequences:

1. **Nothing is fetched.** Any state set inside that fetch stops being set.
2. **The model no longer needs `[BUSINESS]` messages** — it hears them. The
   line in `agentInstructions()` about `[BUSINESS]` becomes dead, and feeding
   the model a transcript of what it already heard would double it up.
3. **A real person cannot be paused.** Today a business turn is suppressed
   while a question is open simply by not asking for one. A human will talk
   during the hold, and their speech has to keep arriving and being
   transcribed.

## What survives, and why

The session already sets `turn_detection: null`, so the model only speaks when
the client asks it to with `response.create`. That is the half of the hold that
already works the same way in both worlds: Yappr stays quiet because nobody
asked it to talk, not because the other side was muted.

These guards in `LiveCall.tsx` are driven by Yappr's **own** output transcript,
which is unchanged by any of this:

- `expectHoldLine` — the next line Yappr speaks is the client-driven hold line
  and does not count as relaying anything.
- `answerNotSpoken` — refuses `ask_traveler` while the traveler's last answer
  has not been said to the business.

`awaitingBusinessReply()` is deliberately derived from the **transcript**
rather than set inside the simulator fetch, for exactly this reason. A flag set
in that fetch would stop being set the day the route is deleted, and the guard
would then refuse every hang-up for the rest of the call — a silent, total
failure. Reading the transcript keeps working with any source of business
turns, because a business turn reaching the transcript *is* the product.

**So: whatever replaces the simulator must still push each business turn into
the transcript as a `business` line.** That is the one contract the guards
depend on.

## What stops being free

The simulator is infinitely patient, always replies, never interrupts and never
mishears. A real call loses all four, and three of those land on the decision
gate:

- **Patience.** `ANSWER_WINDOW_SECONDS` is 30 and currently costs nothing. On a
  real line it is the difference between a hold and a hang-up. The testing log
  records `secondsToAnswer` per fork precisely so this can be judged on data
  before it matters.
- **Latency before the hold line.** The order today is: tool call → the
  response carrying it closes → the client asks for the hold line → Yappr
  speaks. That is two round trips of silence, which a patient simulator
  absorbs and a real person hears. Consider having the model speak the holding
  line *in the same turn* as the tool call, or playing a short pre-recorded
  filler while the model catches up. Do not fix it by going back to leaving the
  hold line to the model's discretion — it skipped it (see `handoff.md` item
  11).
- **Interruption.** While a question is open the remote party may keep talking,
  ask again, or hang up. Nothing handles a hang-up by the *business* today; the
  call simply ends from our side. That needs its own outcome, distinct from
  `unavailable`.

## Removal checklist

1. Delete `app/api/simulate-business/route.ts` and
   `businessSimulatorPrompt()` in `lib/prompts.ts`.
2. In `afterAgentSpoke`, remove the fetch, the `speak("business", …)` call and
   the `sendUserMessage("[BUSINESS] …")` call. Keep everything above it:
   pushing Yappr's own line, `expectHoldLine`, `answerNotSpoken`.
3. Add a handler for the remote party's completed input transcription that
   pushes a `business` line through `speak()` — this is what keeps
   `awaitingBusinessReply()` honest.
4. Remove the `[BUSINESS]` line from `agentInstructions()`.
5. Re-read "What stops being free" above and decide each point deliberately.
6. Walk a call that forks at least twice, and confirm: the hold line is spoken
   every time, the decision card is in the traveler's language, an unanswered
   request still blocks the hang-up, and the summary does not claim a booking
   the other side never confirmed.
