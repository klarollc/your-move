import { describe, expect, it } from "vitest";

import { parseStableId, parseUtcTimestamp, type Clock, type IdFactory } from "./primitives.js";

describe("stable primitives", () => {
  it("accepts a matching named prefix and rejects empty or mismatched IDs", () => {
    expect(parseStableId("project", "project_alpha")).toEqual({
      ok: true,
      value: "project_alpha",
    });
    expect(parseStableId("project", "")).toEqual({
      ok: false,
      error: { code: "INVALID_ID", field: "id", reason: "empty" },
    });
    expect(parseStableId("project", "event_alpha")).toEqual({
      ok: false,
      error: { code: "INVALID_ID", field: "id", reason: "prefix_mismatch" },
    });
  });

  it("normalizes valid RFC 3339 timestamps to UTC and rejects invalid input", () => {
    expect(parseUtcTimestamp("2026-08-13T15:30:00-07:00")).toEqual({
      ok: true,
      value: "2026-08-13T22:30:00.000Z",
    });
    expect(parseUtcTimestamp("not-a-time")).toEqual({
      ok: false,
      error: { code: "INVALID_TIMESTAMP", field: "timestamp", reason: "invalid_rfc3339" },
    });
  });

  it("supports deterministic clock and ID injection contracts", () => {
    const clock: Clock = { now: () => "2026-08-13T22:30:00.000Z" };
    const ids: IdFactory = { next: (prefix) => `${prefix}_fixed` };

    expect(clock.now()).toBe("2026-08-13T22:30:00.000Z");
    expect(ids.next("event")).toBe("event_fixed");
  });
});
