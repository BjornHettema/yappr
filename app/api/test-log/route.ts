/**
 * ============================================================================
 *  TEMPORARY - USER TESTING PHASE ONLY - DELETE BEFORE GENERAL RELEASE
 *  See lib/testLog.ts for what this captures and TESTING-ONLY.md to remove it.
 * ============================================================================
 *
 * Receives one finished call session and records it as research data.
 *
 * Two destinations, both optional and neither requiring a database:
 *  - Always: one line of structured JSON on stdout, which on Vercel means the
 *    runtime logs. Good for a quick look, but retention is short, so treat it
 *    as a fallback rather than the archive.
 *  - If TEST_LOG_WEBHOOK_URL is set: the same JSON is POSTed there. Point it at
 *    whatever collects rows for you. That is the durable copy.
 */

import { NextResponse } from "next/server";
import {
  TEST_LOG_EXPIRES,
  TEST_LOG_MARKER,
  testLoggingConfigured,
  testLoggingExpired,
} from "@/lib/testLog";
import type { CallBrief, Summary, TranscriptLine } from "@/lib/types";

/**
 * Which build produced this session. Vercel injects these at build time, so
 * research from a deploy whose prompts or UI later changed can be identified
 * and set aside rather than silently mixed in with newer results.
 */
function buildInfo() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return {
    commit: sha ? sha.slice(0, 7) : "local",
    commitFull: sha,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    // Subject line only. The full body (paragraphs, trailers) is repeated on
    // every row and makes the sheet unreadable; the subject is the part that
    // actually identifies a build at a glance.
    commitMessage:
      process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0].slice(0, 120) ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    environment: process.env.VERCEL_ENV ?? "development",
  };
}

type SessionPayload = {
  brief?: CallBrief;
  lines?: TranscriptLine[];
  summary?: Summary;
  startedAt?: number;
};

export async function POST(req: Request) {
  if (!testLoggingConfigured()) {
    // Not an error: this is the normal state outside the testing phase.
    return NextResponse.json({ logged: false, reason: "disabled" });
  }

  if (testLoggingExpired()) {
    console.warn(
      `${TEST_LOG_MARKER} EXPIRED: test-session logging passed ${TEST_LOG_EXPIRES} and is no longer storing anything. ` +
        `Remove this feature (see TESTING-ONLY.md) or deliberately extend TEST_LOG_EXPIRES.`,
    );
    return NextResponse.json({ logged: false, reason: "expired" });
  }

  try {
    const body = (await req.json()) as SessionPayload;

    const build = buildInfo();

    const record = {
      marker: TEST_LOG_MARKER,
      loggedAt: new Date().toISOString(),
      // Traceability: which build this session came from.
      commit: build.commit,
      commitFull: build.commitFull,
      branch: build.branch,
      commitMessage: build.commitMessage,
      deploymentUrl: build.deploymentUrl,
      environment: build.environment,
      startedAt: body.startedAt ? new Date(body.startedAt).toISOString() : null,
      durationSeconds: body.startedAt
        ? Math.round((Date.now() - body.startedAt) / 1000)
        : null,
      travelerLanguage: body.brief?.travelerLanguage ?? null,
      localLanguage: body.brief?.localLanguage ?? null,
      businessType: body.brief?.businessType ?? null,
      place: body.brief?.place ?? null,
      goal: body.brief?.goal ?? null,
      extraNotes: body.brief?.extraNotes ?? null,
      turns: body.lines?.length ?? 0,
      transcript:
        body.lines?.map((line) => ({
          speaker: line.speaker,
          original: line.original,
          translation: line.translation,
        })) ?? [],
      summary: body.summary ?? null,
    };

    // One line, so it can be grepped out of a log stream and parsed.
    console.log(`${TEST_LOG_MARKER} ${JSON.stringify(record)}`);

    const webhook = process.env.TEST_LOG_WEBHOOK_URL;
    if (webhook) {
      // Never let a failing webhook break the end of someone's call.
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch((error) => {
        console.warn(`${TEST_LOG_MARKER} webhook failed:`, error);
      });
    }

    return NextResponse.json({ logged: true });
  } catch (error) {
    console.warn(`${TEST_LOG_MARKER} could not record session:`, error);
    return NextResponse.json({ logged: false, reason: "error" });
  }
}
