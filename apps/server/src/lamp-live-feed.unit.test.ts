import { describe, expect, it, vi } from "vitest";

import { createLampLiveFeed } from "./lamp-live-feed.js";

describe("lamp live feed", () => {
  it("publishes only validated verdict messages to current subscribers", () => {
    const feed = createLampLiveFeed();
    const messages: unknown[] = [];
    const unsubscribe = feed.subscribe((message) => messages.push(message));
    const verdict = {
      type: "lamp.verdict",
      attemptId: "attempt_1",
      utteranceId: "utterance_1",
      verdict: "lamp",
      ts: "2026-10-17T20:00:00.000Z",
    } as const;

    expect(feed.publish(verdict)).toBe(true);
    expect(feed.publish({ ...verdict, extra: true })).toBe(false);
    unsubscribe();
    expect(feed.publish({ ...verdict, attemptId: "attempt_2" })).toBe(true);
    expect(messages).toEqual([verdict]);
  });

  it("isolates subscriber failures and closes subscriptions idempotently", () => {
    const feed = createLampLiveFeed();
    const throwing = vi.fn(() => {
      throw new Error("socket closed");
    });
    const received: unknown[] = [];
    const unsubscribe = feed.subscribe(throwing);
    feed.subscribe((message) => received.push(message));
    const message = {
      type: "lamp.verdict",
      attemptId: "attempt_1",
      utteranceId: "utterance_1",
      verdict: "no-lamp",
      ts: "2026-10-17T20:00:00.000Z",
    };

    expect(feed.publish(message)).toBe(true);
    unsubscribe();
    unsubscribe();
    expect(received).toEqual([message]);
    expect(feed.subscriberCount).toBe(1);
  });
});
