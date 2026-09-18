import { NextResponse } from "next/server";
import { openaiHeaders } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { text, from, to } = (await req.json()) as {
      text: string;
      from: string;
      to: string;
    };

    if (!text?.trim()) {
      return NextResponse.json({ translation: "" });
    }

    if (from === to) {
      return NextResponse.json({ translation: text });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: openaiHeaders(),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Translate from ${from} to ${to}. Return only the translation, no quotes or notes.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Translate failed." },
        { status: response.status },
      );
    }

    return NextResponse.json({
      translation: data.choices?.[0]?.message?.content?.trim() || text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translate failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
