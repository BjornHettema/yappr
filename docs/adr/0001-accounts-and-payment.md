# ADR-0001: Accounts and payment

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jeroen (sole decision-maker)

## Context

Yappr is a prototype. It has no database, no auth and no user identity — the call brief, transcript and summary live in `sessionStorage` and vanish when the tab closes. The public deployment is protected by a single shared passcode (`middleware.ts` + `app/enter` + `api/access`), which exists only to stop strangers running up the bill on one OpenAI key. Every call today is paid for by Jeroen.

The service will not be free. Payment is the reason to build accounts; everything else accounts would enable (saved call history, per-user rate limits, a profile-level language setting) is a consequence, not a justification.

Forces at play:

- **The target user is a non-technical traveler who doesn't want to make a phone call.** Sign-up friction lands hardest on exactly this person. Anything placed before their first call costs conversions.
- **Cost per call is real and variable.** Unlike most SaaS, each use spends money on a live voice model. Pricing has to map to that, and an uncapped call is an uncapped loss.
- **Usage is bursty and infrequent.** Four calls during a two-week trip, then nothing for eight months. This shape is hostile to subscriptions.
- **Small transactions are expensive to collect.** Stripe's standard Netherlands rate is around 1.5% + €0.25 for EEA cards, with roughly 3.25% more for cards issued outside the Netherlands and about 2% for currency conversion ([Stripe pricing](https://stripe.com/pricing), [NL calculator](https://affonso.io/resources/stripe-fee-calculator/netherlands) — confirm against Jeroen's own account before pricing anything). On a €1 charge from a traveler's foreign card, fees plausibly eat 30% or more.
- **Nobody has validated demand yet.** Zero real users have tried Yappr. Three to five testers remains the open item in `handoff.md`.

## Decision

Build accounts as a **payment mechanism, not a gate**: prepaid call credits, bought through Stripe Checkout, with a passwordless (magic-link) account created at the point of purchase rather than before the first call. Signed-out visitors get one free call so they can see what they're buying.

Before any of it: instrument what a call actually costs, and put a hard ceiling on call length.

## Options considered

### Option A: Monthly subscription

| Dimension | Assessment |
|---|---|
| Complexity | Medium — Stripe Billing, webhooks, dunning, cancellation |
| Cost fit | Poor — bills for months of no travel |
| Margin safety | Poor — a heavy user in one trip can exceed their fee |
| User comprehension | Medium — familiar, but resented for occasional use |

**Pros:** predictable revenue; one payment rail; standard patterns.
**Cons:** fundamentally mismatched to travel usage. Users will subscribe for a trip and cancel on landing, so churn is structural rather than a fixable problem. Also caps nothing: a chatty user's calls can cost more than the monthly fee.

### Option B: Pay-per-call (charge at the time of each call)

| Dimension | Assessment |
|---|---|
| Complexity | Medium — a payment per call, plus failure handling mid-flow |
| Cost fit | Excellent — revenue tracks cost exactly |
| Margin safety | Good, if a per-call ceiling exists |
| User comprehension | Excellent — "€1 a call" needs no explanation |

**Pros:** the clearest possible pricing for a non-technical user; no commitment; revenue and cost move together.
**Cons:** the fixed per-transaction fee is brutal at this price point — roughly a quarter of a €1 charge before the foreign-card surcharge. Also puts a payment step between the user and every single call, which is the worst possible place for friction in this product.

### Option C: Prepaid credits / call packs (recommended)

| Dimension | Assessment |
|---|---|
| Complexity | Medium — Stripe Checkout, a balance column, a webhook |
| Cost fit | Good — packs sized against measured per-call cost |
| Margin safety | Good — exposure is bounded by the balance |
| User comprehension | Good — "5 calls for €7" is concrete |

**Pros:** one transaction amortises the fixed fee across several calls, which is the single biggest lever on margin at this price point. Money is collected before the cost is incurred, so an abusive or fraudulent account can only burn what it paid for. No recurring charge to resent or cancel. Payment happens once, away from the moment of use, so the call flow stays frictionless.
**Cons:** unspent credit is a liability and an eventual refund question. "Credits" is one more concept to explain. Needs a top-up prompt that doesn't interrupt someone mid-trip.

### Option D: Keep it free, defer payment entirely

| Dimension | Assessment |
|---|---|
| Complexity | None |
| Cost fit | None — every call is a loss |
| Margin safety | None |
| User comprehension | Perfect |

**Pros:** zero build; maximum testing velocity; the fastest path to knowing whether anyone wants this.
**Cons:** unsustainable beyond a handful of testers; postpones the question of whether anyone will pay, which is the question that decides whether to keep going.

## Trade-off analysis

The real choice is between C and D, and they are not actually in conflict — they are sequential. D is correct for the next few weeks and C is correct after that.

Between the paid options, the deciding factor is transaction economics rather than anything technical. At a plausible price point of about €1–2 per call, a per-transaction model (B) gives up a quarter or more of revenue to fixed card fees, and more again on foreign cards — which, for a product used by travelers abroad, is the normal case rather than the exception. Bundling several calls into one purchase (C) is the only option that fixes that without raising the per-call price to something that feels expensive for a phone call.

Subscriptions (A) lose on usage shape alone. This is not a product anyone uses monthly.

The friction argument points the same way. Option B places a payment in the path of every call. Option C places one payment outside the path entirely, and the call itself stays a single button.

Prepaid also happens to be the best answer to fraud. A paid product attracts stolen cards, and a chargeback on a call already delivered is a double loss. When the money arrives first, the worst case is bounded by the pack price.

## Consequences

**Easier**
- Revenue is collected before cost is incurred; exposure per account is bounded.
- The shared passcode can retire — accounts and a free-call limit replace what it was crudely doing.
- Call history can outlive the tab, which is the single most-requested thing a `sessionStorage`-only app can't do.
- The traveler's language becomes a profile setting with a per-call override (see `lib/languages.ts` and the discussion that prompted this ADR).

**Harder**
- Yappr acquires its first database and its first auth system. `CLAUDE.md` currently states, as a deliberate choice, that it has neither. That statement needs rewriting, and the deployment stops being stateless.
- Unspent credit is a real liability with a refund policy attached.
- Selling to consumers across borders brings tax obligations. EU VAT on digital services is charged based on where the customer lives, from the first sale. **Confirm the specifics with an accountant before taking money** — this is not something to work out from documentation.
- Someone has to handle chargebacks, refunds and failed payments. That is ongoing operational work, not a one-off build.

**To revisit**
- Whether the free call converts at all. If it doesn't, the pricing is wrong, not the funnel.
- Pack sizes, once per-call cost is measured rather than estimated.
- Whether real PSTN calling (Twilio) changes the unit economics enough to reprice — it will add a per-minute carrier cost on top of the model cost.

## Action items

**Before anything is built**

1. [ ] **Measure the true cost of one call.** Place several calls of realistic length and read actual spend from the OpenAI dashboard. Every number in this ADR is an estimate until this exists; pack pricing depends on it.
2. [ ] **Check whether the silent audio track is being billed.** `LiveCall.tsx` streams a near-silent oscillator track to OpenAI for the entire call (`silentTrack()`), with input transcription enabled and `turn_detection: null`. If that audio is counted as input tokens, every call is paying for silence for its full duration, and the fix is far cheaper than pricing around it. Verify against real usage data before assuming either way.
3. [ ] **Put a hard ceiling on a call** — maximum duration and/or maximum turns, with a defined, non-alarming behaviour when reached. This is a prerequisite for charging anything, and is worth doing even while the product is free.

**Validation, which does not require any of the above**

4. [ ] Get 3–5 real non-technical travelers using the free version and find out whether they'd pay, and roughly what. This answers the pricing question better than analysis does.

**Build, once 1–4 are answered**

5. [ ] Choose the datastore. Something managed and Postgres-shaped fits Vercel and keeps this small.
6. [ ] Passwordless magic-link auth. No passwords: nothing to store, nothing to leak, and no password-reset flow to build.
7. [ ] Schema, kept deliberately thin: account (id, email, created), preferences (traveler language), credit balance, call records (brief, transcript, summary, cost, timestamps), payments.
8. [ ] Stripe Checkout for credit packs, plus a webhook that credits the balance. **Jeroen configures Stripe himself** — API keys and payment settings are not something to hand to an agent or paste into a chat.
9. [ ] Decrement a credit when a call connects, not when it's briefed. Define what happens when a call fails early.
10. [ ] One free call for a signed-out visitor, tracked well enough to be inconvenient to bypass but not hostile.
11. [ ] Retire the passcode gate only once accounts plus the free-call limit are live — not before. It is the only abuse control that currently exists.
12. [ ] Rewrite the "no database, no auth" section of `CLAUDE.md`, and add the account/billing model to `README.md`.

## Notes

The recommendation above is a judgement on product and engineering trade-offs, not financial or legal advice. Tax treatment, refund obligations and consumer-protection rules for a paid service sold across borders should be checked with an accountant and, if the numbers get meaningful, a lawyer.
