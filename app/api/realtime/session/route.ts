import { NextResponse } from "next/server";
import { agentInstructions } from "@/lib/prompts";
import { endCallTool, openaiHeaders, realtimeModel } from "@/lib/openai";
import type { CallBrief } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const brief = (await req.json()) as CallBrief;
    if (!brief?.goal || !brief.localLanguage || !brief.travelerLanguage) {
      return NextResponse.json({ error: "Missing call details." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        ...openaiHeaders(),
        "OpenAI-Safety-Identifier": "yappr-web",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: realtimeModel(),
          instructions: agentInstructions(brief),
          output_modalities: ["audio"],
          tools: [endCallTool],
          tool_choice: "auto",
          audio: {
            input: {
              transcription: { model: "gpt-4o-mini-transcribe" },
              turn_detection: null,
            },
            output: { voice: "marin" },
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Could not start a live session." },
        { status: response.status },
      );
    }

    const value = data?.value ?? data?.client_secret?.value;
    if (!value) {
      return NextResponse.json({ error: "No client secret returned." }, { status: 502 });
    }

    return NextResponse.json({ value, model: realtimeModel() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
