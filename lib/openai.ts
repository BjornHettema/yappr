import { NextResponse } from "next/server";

export function openaiHeaders() {
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

export const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/** An OpenAI call that came back with a non-2xx status, carrying that status. */
export class OpenAIRequestError extends Error {
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
