import { NextResponse } from "next/server";
import { openaiHeaders } from "@/lib/openai";
import { businessSimulatorPrompt } from "@/lib/prompts";
import type { CallBrief } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { brief, lastAgentLine, history } = (await req.json()) as {
      brief: CallBrief;
      lastAgentLine: string;
      history: { speaker: string; original: string }[];
    };

    const convo = (history || [])
      .map((line) => `${line.speaker}: ${line.original}`)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: openaiHeaders(),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        messages: [
          { role: "system", content: businessSimulatorPrompt(brief) },
          {
            role: "user",
            content: `Call so far:\n${convo || "(just ringing)"}\n\nYappr just said:\n${lastAgentLine}\n\nYour spoken reply:`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Simulator failed." },
        { status: response.status },
      );
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: "Empty business reply." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulator failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
