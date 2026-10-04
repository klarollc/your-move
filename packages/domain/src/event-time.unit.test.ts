import { describe, expect, it } from "vitest";

import { nextEventTimes, normalizeEventLog } from "./event-order.js";

const ev = (id: string, at: string, receivedAt = at) => ({
  schemaVersion: 1,
  eventId: id,
  projectId: "project_alpha",
  kind: "project.created",
  occurredAt: at,
  receivedAt,
  source: "system",
  trust: "verified",
  payload: { name: "x" },
});

describe("nextEventTimes", () => {
  it("uses now, one millisecond apart, when the log is empty or older", () => {
    expect(nextEventTimes([], "2026-10-04T11:00:00.000Z", 3)).toEqual([
      "2026-10-04T11:00:00.000Z",
      "2026-10-04T11:00:00.001Z",
      "2026-10-04T11:00:00.002Z",
    ]);
    expect(
      nextEventTimes([ev("event_a", "2026-10-04T10:00:00.000Z")], "2026-10-04T11:00:00.000Z", 1),
    ).toEqual(["2026-10-04T11:00:00.000Z"]);
  });

  it("starts one millisecond after the newest occurredAt or receivedAt already in the log", () => {
    const log = [
      ev("event_a", "2026-10-04T12:00:00.000Z"),
      ev("event_b", "2026-10-04T09:00:00.000Z", "2026-10-04T12:30:00.000Z"),
    ];
    expect(nextEventTimes(log, "2026-10-04T11:00:00.000Z", 2)).toEqual([
      "2026-10-04T12:30:00.001Z",
      "2026-10-04T12:30:00.002Z",
    ]);
  });

  it("ignores records that are not valid events", () => {
    expect(
      nextEventTimes([{ occurredAt: "2999-01-01T00:00:00.000Z" }], "2026-10-04T11:00:00.000Z", 1),
    ).toEqual(["2026-10-04T11:00:00.000Z"]);
  });

  it("gives times that sort after the whole log in canonical order, whatever the event ids are", () => {
    const log = [ev("event_zzz", "2026-10-04T11:00:00.000Z")];
    const times = nextEventTimes(log, "2026-10-04T11:00:00.000Z", 2);
    const added = [ev("event_aaa_1", times[0] as string), ev("event_aaa_2", times[1] as string)];
    const order = normalizeEventLog([...log, ...added]).events.map((e) => e.eventId);
    expect(order).toEqual(["event_zzz", "event_aaa_1", "event_aaa_2"]);
  });

  it("refuses an unparseable now", () => {
    expect(() => nextEventTimes([], "yesterday", 1)).toThrow();
  });
});
