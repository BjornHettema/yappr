/**
 * The point of these is the two spellings. OpenAI ships the audio-transcript
 * events as both `response.output_audio_transcript.*` and
 * `response.audio_transcript.*`, and dropping either one empties the
 * transcript without raising anything — the call connects, the audio plays,
 * and the page just shows nothing. Don't delete a spelling because it looks
 * redundant.
 */

import { describe, expect, it } from "vitest";
import { classifyRealtimeEvent } from "./realtimeEvents";

describe("both spellings of the transcript events are handled", () => {
  it.each([
    "response.output_audio_transcript.delta",
    "response.audio_transcript.delta",
  ])("%s is speech in progress", (type) => {
    expect(classifyRealtimeEvent({ type, delta: "สวัสดี" })).toEqual({
      type: "speaking",
      delta: "สวัสดี",
    });
  });

  it.each(["response.output_audio_transcript.done", "response.audio_transcript.done"])(
    "%s is a finished turn of speech",
    (type) => {
      expect(classifyRealtimeEvent({ type, transcript: "สวัสดีครับ" })).toEqual({
        type: "spoke",
        transcript: "สวัสดีครับ",
      });
    },
  );

  it("treats a missing delta or transcript as empty rather than undefined", () => {
    expect(classifyRealtimeEvent({ type: "response.audio_transcript.delta" })).toEqual({
      type: "speaking",
      delta: "",
    });
    expect(classifyRealtimeEvent({ type: "response.audio_transcript.done" })).toEqual({
      type: "spoke",
      transcript: "",
    });
  });
});

describe("turns and tools", () => {
  it("reports the end of a turn, which is when queued work is allowed out", () => {
    // The realtime API refuses a second response while one is open, so the
    // hold line and the corrections both wait for this.
    expect(classifyRealtimeEvent({ type: "response.done" })).toEqual({
      type: "turnEnded",
    });
  });

  it("carries the call id through, which the tool output has to echo", () => {
    expect(
      classifyRealtimeEvent({
        type: "response.function_call_arguments.done",
        name: "ask_traveler",
        arguments: '{"kind":"confirm"}',
        call_id: "call_123",
      }),
    ).toEqual({
      type: "tool",
      name: "ask_traveler",
      args: '{"kind":"confirm"}',
      callId: "call_123",
    });
  });

  it("ignores a tool event with no name rather than guessing which tool it was", () => {
    expect(
      classifyRealtimeEvent({ type: "response.function_call_arguments.done" }),
    ).toEqual({ type: "ignored" });
  });

  it("ignores everything else", () => {
    expect(classifyRealtimeEvent({ type: "session.created" })).toEqual({
      type: "ignored",
    });
    expect(classifyRealtimeEvent({ type: "" })).toEqual({ type: "ignored" });
  });
});
