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
