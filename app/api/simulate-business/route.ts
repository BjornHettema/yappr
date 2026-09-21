import { NextResponse } from "next/server";
import { chatCompletion, chatText, errorResponse } from "@/lib/openai";
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

    const data = await chatCompletion(
      {
        model: "gpt-4o-mini",
        temperature: 0.8,
        messages: [
          { role: "system", content: businessSimulatorPrompt(brief) },
          {
            role: "user",
            content: `Call so far:\n${convo || "(just ringing)"}\n\nYappr just said:\n${lastAgentLine}\n\nYour spoken reply:`,
          },
        ],
      },
      "Simulator failed.",
    );

    const reply = chatText(data);
    if (!reply) {
      return NextResponse.json({ error: "Empty business reply." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    return errorResponse(error, "Simulator failed.");
  }
}
