import { NextResponse } from "next/server";
import { openaiHeaders } from "@/lib/openai";
import { summaryPrompt } from "@/lib/prompts";
import type { CallBrief, TranscriptLine } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { brief, lines } = (await req.json()) as {
      brief: CallBrief;
      lines: TranscriptLine[];
    };

    const transcript = (lines || [])
      .map(
        (line) =>
          `[${line.speaker}] ${line.original}${line.translation ? ` / ${line.translation}` : ""}`,
      )
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: openaiHeaders(),
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You write clear post-call notes for travelers. JSON only.",
          },
          { role: "user", content: summaryPrompt(brief, transcript) },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Summary failed." },
        { status: response.status },
      );
    }

    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Summary failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
