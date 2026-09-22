/**
 * ============================================================================
 *  TEMPORARY - USER TESTING PHASE ONLY - DELETE BEFORE GENERAL RELEASE
 *  See lib/testLog.ts for what this captures and TESTING-ONLY.md to remove it.
 * ============================================================================
 *
 * Receives one finished call session, or one tester feedback answer, and
 * records it as research data. The two share a `sessionId` so an answer can be
 * read next to the call it is about.
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

/** One mid-call fork the traveler was asked to settle. */
type Decision = {
  kind?: string;
  question?: string;
  /** Set only when the model wrote the question in the wrong language. */
  questionAsWritten?: string | null;
  businessSaid?: string;
  options?: string[];
  answer?: string;
  secondsToAnswer?: number;
};

type SessionPayload = {
  kind?: "session";
  sessionId?: string;
  brief?: CallBrief;
  lines?: TranscriptLine[];
  summary?: Summary;
  decisions?: Decision[];
  startedAt?: number;
};

/** One tester's answers on the summary page. See app/components/TestFeedback.tsx. */
type FeedbackPayload = {
  kind: "feedback";
  sessionId?: string;
  gotIt?: string;
  wouldCall?: string;
  comment?: string;
};

type Payload = SessionPayload | FeedbackPayload;

/**
 * Send one record to the collector. Never throws, but does report.
 *
 * It used to only catch a thrown fetch, which meant a dead collector was
 * completely invisible: an archived Apps Script deployment answers with an
 * HTML "page not found" rather than failing, so `fetch` resolved, nothing was
 * logged, the endpoint still replied `{logged: true}`, and every session went
 * nowhere. That is how a week of tester data disappears without anyone
 * noticing. The status now comes back in the response so it shows up in the
 * network tab, and a failure is shouted at the runtime log.
 */
async function forward(record: object): Promise<"stored" | "no-webhook" | "failed"> {
  // One line, so it can be grepped out of a log stream and parsed.
  console.log(`${TEST_LOG_MARKER} ${JSON.stringify(record)}`);

  const webhook = process.env.TEST_LOG_WEBHOOK_URL;
  if (!webhook) {
    console.warn(
      `${TEST_LOG_MARKER} NO ARCHIVE: TEST_LOG_WEBHOOK_URL is unset, so this ` +
        `session exists only in these logs and will age out. See docs/testing/README.md.`,
    );
    return "no-webhook";
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!response.ok) {
      // The usual cause: the Apps Script was redeployed as a NEW deployment
      // instead of a new version of the existing one, so the URL in Vercel now
      // points at something archived.
      console.error(
        `${TEST_LOG_MARKER} ARCHIVE REJECTED THE RECORD (HTTP ${response.status}). ` +
          `Nothing was stored. Check that TEST_LOG_WEBHOOK_URL still matches a live ` +
          `Apps Script deployment — see docs/testing/README.md.`,
      );
      return "failed";
    }
    return "stored";
  } catch (error) {
    console.error(`${TEST_LOG_MARKER} ARCHIVE UNREACHABLE, nothing stored:`, error);
    return "failed";
  }
}

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
    const body = (await req.json()) as Payload;

    const build = buildInfo();
    const common = {
      marker: TEST_LOG_MARKER,
      loggedAt: new Date().toISOString(),
      sessionId: body.sessionId ?? null,
      // Traceability: which build this came from.
      commit: build.commit,
      commitFull: build.commitFull,
      branch: build.branch,
      commitMessage: build.commitMessage,
      deploymentUrl: build.deploymentUrl,
      environment: build.environment,
    };

    if (body.kind === "feedback") {
      const archive = await forward({
        ...common,
        kind: "feedback",
        gotIt: body.gotIt || null,
        wouldCall: body.wouldCall || null,
        comment: body.comment || null,
      });
      return NextResponse.json({ logged: true, archive });
    }

    const record = {
      ...common,
      kind: "session",
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
      // How often Yappr had to stop and ask rather than decide for itself.
      // `secondsToAnswer` is the one that says whether testers are actually
      // at the screen while the call is running.
      forks: body.decisions?.length ?? 0,
      // How many of those questions the model wrote in the wrong language and
      // the translator had to rescue. Should trend to zero; if it doesn't, the
      // client-side guard is the only thing keeping the card readable.
      rescuedQuestions:
        body.decisions?.filter((decision) => decision.questionAsWritten).length ?? 0,
      decisions: body.decisions ?? [],
    };

    const archive = await forward(record);

    // `archive` is the part that matters: "stored" means it reached the Sheet,
    // anything else means this session only exists in the runtime logs.
    return NextResponse.json({ logged: true, archive });
  } catch (error) {
    console.warn(`${TEST_LOG_MARKER} could not record session:`, error);
    return NextResponse.json({ logged: false, reason: "error" });
  }
}
