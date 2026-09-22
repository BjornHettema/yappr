/**
 * Every case here is a bug that reached a live call.
 *
 * The decision gate's failures are quiet ones: a business left holding a dead
 * line, a question in a language the traveler cannot read, a card that asks
 * the traveler to speak for the shop, a summary announcing a booking nobody
 * made. None of them throws, and three of the four looked fine on screen. So
 * the point of this file is less "does the logic work" than "does it still
 * work after someone decides one of these guards is redundant".
 *
 * If you are here because a test failed while you were simplifying something:
 * read the case name. It happened.
 */

import { describe, expect, it } from "vitest";
import {
  awaitingBusinessReply,
  correctionSent,
  hangUpRefused,
  holdLineRequested,
  initialCallFlow,
  isLeadingOption,
  parseAskTraveler,
  secondsRemaining,
  shouldCorrectQuestion,
  shouldRefuseHangUp,
  travelerAnswered,
  windUpStarted,
  yapprSpoke,
} from "./callFlow";
import type { Speaker } from "./types";

/** Lets the cases below read as conversations rather than object literals. */
function line(speaker: Speaker) {
  return { speaker };
}

describe("the hold line is not a turn", () => {
  it("still counts the answer as unspoken after only a hold line", () => {
    // The live failure: Yappr said "one moment" on the first question and
    // nothing at all on the second. The hold line is the client's doing and
    // carries none of what the traveler said.
    let flow = travelerAnswered(initialCallFlow());
    flow = holdLineRequested(flow);
    flow = yapprSpoke(flow);

    expect(flow.answerUnspoken).toBe(true);
    expect(shouldCorrectQuestion(flow)).toBe(true);
  });

  it("counts a real turn as relaying the answer", () => {
    let flow = travelerAnswered(initialCallFlow());
    flow = yapprSpoke(flow);

    expect(flow.answerUnspoken).toBe(false);
    expect(shouldCorrectQuestion(flow)).toBe(false);
  });

  it("consumes the hold expectation once, so the next turn is a real one", () => {
    let flow = holdLineRequested(travelerAnswered(initialCallFlow()));
    flow = yapprSpoke(flow); // the hold line
    flow = yapprSpoke(flow); // the actual request to the business

    expect(flow.answerUnspoken).toBe(false);
  });
});

describe("Yappr may not ask the traveler to speak for the business", () => {
  it("corrects a question raised before the answer reached the business", () => {
    // "at 10 PM" came back as "They asked for 10 PM. Can you offer that
    // time?" — the traveler cast as the shop.
    const flow = travelerAnswered(initialCallFlow());
    expect(shouldCorrectQuestion(flow)).toBe(true);
  });

  it("corrects only once, so a stubborn model can't be argued with forever", () => {
    let flow = correctionSent(travelerAnswered(initialCallFlow()));
    expect(shouldCorrectQuestion(flow)).toBe(false);

    // A fresh answer earns a fresh correction.
    flow = travelerAnswered(flow);
    expect(shouldCorrectQuestion(flow)).toBe(true);
  });

  it("allows a question once the business has been spoken to", () => {
    const flow = yapprSpoke(travelerAnswered(initialCallFlow()));
    expect(shouldCorrectQuestion(flow)).toBe(false);
  });

  it("allows questions before any answer exists at all", () => {
    expect(shouldCorrectQuestion(initialCallFlow())).toBe(false);
  });
});

describe("Yappr may not hang up on a request nobody answered", () => {
  const flow = initialCallFlow();

  it("refuses the hang-up when the last word was Yappr's own request", () => {
    // Asked to book 20:30, never answered, hung up, summary said "Confirmed".
    const lines = [
      line("yappr"),
      line("business"),
      line("yappr"), // hold line
      line("you"), // "Yes, book 20:30"
      line("yappr"), // the request
    ];
    expect(awaitingBusinessReply(lines)).toBe(true);
    expect(shouldRefuseHangUp(flow, lines)).toBe(true);
  });

  it("allows it once the business has confirmed in its own words", () => {
    const lines = [
      line("you"),
      line("yappr"),
      line("business"), // "that is reserved"
      line("yappr"), // goodbye
    ];
    expect(awaitingBusinessReply(lines)).toBe(false);
    expect(shouldRefuseHangUp(flow, lines)).toBe(false);
  });

  it("does not block a call that never forked", () => {
    const lines = [line("yappr"), line("business"), line("yappr")];
    expect(awaitingBusinessReply(lines)).toBe(false);
  });

  it("stands aside while winding up after an unanswered hold", () => {
    // The wind-up pushes its own "no answer in time" line, which is a `you`
    // line — so without this the guard would block the very hang-up it exists
    // to perform.
    const lines = [line("you"), line("yappr")];
    expect(shouldRefuseHangUp(windUpStarted(flow), lines)).toBe(false);
  });

  it("refuses only once, so the call can always eventually end", () => {
    const lines = [line("you"), line("yappr")];
    expect(shouldRefuseHangUp(hangUpRefused(flow), lines)).toBe(false);
  });

  it("scopes to the most recent answer, not the first", () => {
    const lines = [
      line("you"),
      line("yappr"),
      line("business"),
      line("you"), // answered again
      line("yappr"), // and asked again, unanswered
    ];
    expect(awaitingBusinessReply(lines)).toBe(true);
  });
});

describe("a button cannot carry a phone number", () => {
  it("leaves an info question with no options to press", () => {
    // "Sure, here is my name and phone number" contained neither, which is
    // why Yappr then asked the shop for the traveler's own number.
    const args = parseAskTraveler(
      JSON.stringify({ kind: "info", question: "What name should they use?" }),
    );
    expect(args?.kind).toBe("info");
    expect(args?.options).toEqual([]);
  });

  it("keeps an explicit way of declining on an info question", () => {
    const args = parseAskTraveler(
      JSON.stringify({
        kind: "info",
        question: "Your name?",
        options: ["I'd rather not say"],
      }),
    );
    expect(args?.options).toEqual(["I'd rather not say"]);
  });

  it("still gives a confirm question something to press", () => {
    const args = parseAskTraveler(
      JSON.stringify({ kind: "confirm", question: "20:30 instead?" }),
    );
    expect(args?.options).toEqual(["Yes", "No"]);
  });
});

describe("no false emphasis on an option Yappr picked", () => {
  it("treats an unknown kind as a choice, never a confirm", () => {
    const args = parseAskTraveler(JSON.stringify({ question: "Which time?" }));
    expect(args?.kind).toBe("choice");
    expect(isLeadingOption(args!.kind, 0)).toBe(false);
  });

  it("leads only on a genuine yes/no", () => {
    expect(isLeadingOption("confirm", 0)).toBe(true);
    expect(isLeadingOption("confirm", 1)).toBe(false);
    // The shop offered 17:00 or 15:30; filling the first would read as a
    // recommendation Yappr is not allowed to make.
    expect(isLeadingOption("choice", 0)).toBe(false);
    expect(isLeadingOption("info", 0)).toBe(false);
  });
});

describe("parsing what the model sent", () => {
  it("returns nothing when there is no question", () => {
    expect(parseAskTraveler(JSON.stringify({ kind: "confirm" }))).toBeNull();
    expect(parseAskTraveler(JSON.stringify({ question: "   " }))).toBeNull();
  });

  it("survives malformed arguments rather than throwing mid-call", () => {
    expect(parseAskTraveler("{not json")).toBeNull();
    expect(parseAskTraveler(undefined)).toBeNull();
  });

  it("caps the options at three and drops the empty ones", () => {
    const args = parseAskTraveler(
      JSON.stringify({
        kind: "choice",
        question: "Which?",
        options: ["a", "", "  ", "b", "c", "d"],
      }),
    );
    expect(args?.options).toEqual(["a", "b", "c"]);
  });

  it("trims but never rewrites what the business said", () => {
    const args = parseAskTraveler(
      JSON.stringify({ question: "Which?", businessSaid: "  ที่นั่งเต็มแล้ว  " }),
    );
    expect(args?.businessSaid).toBe("ที่นั่งเต็มแล้ว");
  });
});

describe("the hold countdown", () => {
  it("counts down and stops at zero rather than going negative", () => {
    const askedAt = 1_000_000;
    expect(secondsRemaining(askedAt, 30, askedAt)).toBe(30);
    expect(secondsRemaining(askedAt, 30, askedAt + 10_000)).toBe(20);
    expect(secondsRemaining(askedAt, 30, askedAt + 40_000)).toBe(0);
  });
});
