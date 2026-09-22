/**
 * What an OpenAI realtime event means, as one pure function.
 *
 * This exists because the event names are a hazard. The audio-transcript
 * events ship under two spellings — `response.output_audio_transcript.*` and
 * `response.audio_transcript.*` — and both are in the wild depending on the
 * model version. Handling only one of them breaks the entire transcript, and
 * it breaks it *silently*: the call still connects, audio still plays, nothing
 * throws, and the page simply shows no words. Exactly the kind of thing that
 * gets "tidied up" by someone who has never seen the other spelling.
 *
 * So the string matching lives here with a test around it, rather than inline
 * in a 700-line component where it looks like noise.
 */

export type RealtimeEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
};

export type RealtimeSignal =
  /** Yappr is mid-sentence; text is arriving a fragment at a time. */
  | { type: "speaking"; delta: string }
  /** Yappr finished a sentence and this is what it said. */
  | { type: "spoke"; transcript: string }
  /** The whole turn is over, whether or not anything was said. */
  | { type: "turnEnded" }
  /** Yappr called a tool. */
  | { type: "tool"; name: string; args?: string; callId?: string }
  | { type: "ignored" };

const SPEAKING = [
  "response.output_audio_transcript.delta",
  "response.audio_transcript.delta",
];

const SPOKE = [
  "response.output_audio_transcript.done",
  "response.audio_transcript.done",
];

export function classifyRealtimeEvent(event: RealtimeEvent): RealtimeSignal {
  if (SPEAKING.includes(event.type)) {
    return { type: "speaking", delta: event.delta || "" };
  }

  if (SPOKE.includes(event.type)) {
    return { type: "spoke", transcript: event.transcript || "" };
  }

  if (event.type === "response.done") {
    return { type: "turnEnded" };
  }

  if (event.type === "response.function_call_arguments.done" && event.name) {
    return {
      type: "tool",
      name: event.name,
      args: event.arguments,
      callId: event.call_id,
    };
  }

  return { type: "ignored" };
}
