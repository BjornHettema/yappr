import { NextResponse } from "next/server";
import { chatCompletion, chatText, errorResponse } from "@/lib/openai";
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

    const data = await chatCompletion(
      {
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
      },
      "Summary failed.",
    );

    const parsed = JSON.parse(chatText(data) || "{}");
    return NextResponse.json(parsed);
  } catch (error) {
    return errorResponse(error, "Summary failed.");
  }
}
