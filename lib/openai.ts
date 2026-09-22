import { NextResponse } from "next/server";

function openaiHeaders() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function realtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
}

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/** An OpenAI call that came back with a non-2xx status, carrying that status. */
class OpenAIRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
  }
}

/**
 * POST JSON to OpenAI and return the parsed response body.
 * Throws an OpenAIRequestError (with the upstream status) when the call fails,
 * so route handlers can funnel everything through one catch + errorResponse().
 */
export async function callOpenAI(
  url: string,
  body: unknown,
  options: { fallbackError?: string; extraHeaders?: Record<string, string> } = {},
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...openaiHeaders(), ...(options.extraHeaders ?? {}) },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new OpenAIRequestError(
      data?.error?.message || options.fallbackError || "OpenAI request failed.",
      response.status,
    );
  }
  return data;
}

/** callOpenAI aimed at chat completions, which is what most routes here need. */
export async function chatCompletion(body: unknown, fallbackError?: string) {
  return callOpenAI(CHAT_COMPLETIONS_URL, body, { fallbackError });
}

/** The assistant's message text from a chat-completions response, trimmed. */
export function chatText(data: unknown): string {
  const content = (data as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

/** Turn anything thrown inside a route handler into a JSON error response. */
export function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof OpenAIRequestError ? error.status : 500;
  const message = error instanceof Error && error.message ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

/**
 * The decision gate. Yappr has no authority to accept anything the traveler
 * did not write, so when the business offers something different — a middle
 * seat instead of front row, 20:00 instead of 19:00 — it must stop and ask
 * rather than choose. Making that a tool rather than a prompt rule means the
 * model has to declare the fork instead of silently resolving it; a prompt
 * rule alone is what let it order a crab dish for a shellfish allergy.
 */
export const askTravelerTool = {
  type: "function",
  name: "ask_traveler",
  description:
    "Ask the traveler to decide, mid-call, when the business offers anything different from what the traveler wrote, or needs something only the traveler can supply. Call this instead of accepting, declining or choosing yourself. ONLY ask things the traveler themselves can answer — what they want, and facts about them. They are sitting somewhere else with no idea what this business has free, what it charges or what it allows; asking them that is asking the wrong person, and it reads to them as if you had mistaken them for the shop. Anything about the business is asked OUT LOUD, on the phone, to the business.",
  parameters: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["confirm", "choice", "info"],
        description:
          "'confirm' when there is one offer on the table and the answer is yes or no. 'choice' when the business named more than one alternative and the traveler has to pick. 'info' when the business needs something only the traveler can supply — a name, a phone number, a spelling, a date, how many people. Get this right: 'confirm' puts the weight of a recommendation behind the first option, which is wrong when they are merely alternatives, and a button cannot carry a phone number, so a question answered with information must never be 'confirm' or 'choice'.",
      },
      question: {
        type: "string",
        description:
          "The decision, IN THE TRAVELER'S LANGUAGE, as short as it can be. One sentence, no preamble. This is read by the traveler on a screen, never spoken to the business, so it is the one thing on this call that is not in the local language.",
      },
      businessSaid: {
        type: "string",
        description:
          "What the business actually said, in their own words, in the local language. Do not paraphrase or soften it.",
      },
      options: {
        type: "array",
        items: { type: "string" },
        description:
          "Very short answer labels, IN THE TRAVELER'S LANGUAGE, at most three. For 'confirm', exactly two, the accepting one first. For 'choice', one for EVERY alternative the business named — if they offered two times, both times appear here. Never leave one out and never pick between them yourself; choosing which alternative to put to the traveler is still choosing for them. For 'info', leave this empty, or give a single way of declining such as the equivalent of 'I'd rather not say' — the traveler types the answer, so a button claiming to hand over a name or number without containing one is worse than no button.",
      },
    },
    required: ["kind", "question", "businessSaid", "options"],
  },
};

export const endCallTool = {
  type: "function",
  name: "end_call",
  description:
    "End the phone call after a goodbye, once the request is resolved or cannot continue.",
  parameters: {
    type: "object",
    properties: {
      outcome: {
        type: "string",
        description: "Short outcome in the traveler's language.",
      },
    },
    required: ["outcome"],
  },
};
