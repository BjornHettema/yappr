import { NextResponse } from "next/server";
import { chatCompletion, chatText, errorResponse } from "@/lib/openai";
import { translatePrompt } from "@/lib/prompts";

export async function POST(req: Request) {
  try {
    const { text, from, to, names } = (await req.json()) as {
      text: string;
      from: string;
      to: string;
      names?: string;
    };

    if (!text?.trim()) {
      return NextResponse.json({ translation: "" });
    }

    if (from === to) {
      return NextResponse.json({ translation: text });
    }

    const data = await chatCompletion(
      {
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: translatePrompt(from, to, names) },
          { role: "user", content: text },
        ],
      },
      "Translate failed.",
    );

    return NextResponse.json({ translation: chatText(data) || text });
  } catch (error) {
    return errorResponse(error, "Translate failed.");
  }
}
