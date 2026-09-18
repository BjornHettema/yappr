# Yappr: call like a local

Yappr helps tourists and other non-locals talk to nearby businesses in a language they do not speak. You type a simple brief. A live voice model places the call, the conversation appears as a transcript (with translation), you can listen if you want, and you get a summary when it hangs up.

## What this version does

- Brief a call: your language, their language, the business, and what you need
- Connects to OpenAI Realtime (`gpt-realtime` — the first generally available live voice model) in the browser
- Yappr speaks the local language on the line
- A simulated local answers, so you can try the full loop without a phone carrier
- Live dual transcript + optional listen-live audio
- Mid-call coaching notes from you
- Post-call summary: outcome, agreements, open questions, next steps

Real PSTN dialing (Twilio Voice + media streams) is the next layer. The UI is already shaped for that; it needs a long-lived WebSocket bridge, which does not live well on a typical serverless Next.js host.

## Setup

```bash
cd yappr
npm install
copy .env.example .env.local
```

Put your OpenAI API key in `.env.local`, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required |
| `OPENAI_REALTIME_MODEL` | Defaults to `gpt-realtime`. You can switch to `gpt-realtime-1.5`, `gpt-realtime-2`, or `gpt-realtime-2.1` |

Microphone permission is not required for the simulated call. The live model still streams audio; use **Listen live** to hear it.
