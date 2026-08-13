import { describe, expect, it } from "vitest";

import { normalizeEventLog } from "./event-order.js";

const event = (eventId: string, occurredAt: string, payload: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  kind: "project.created",
  occurredAt,
  receivedAt: "2026-08-13T20:00:10.000Z",
  source: "manager",
  trust: "verified",
  payload,
});

describe("normalizeEventLog", () => {
  it("orders equivalent event sets identically regardless of input order", () => {
    const later = event("event_002", "2026-08-13T20:00:02.000Z");
    const earlier = event("event_001", "2026-08-13T20:00:01.000Z");

    expect(normalizeEventLog([later, earlier])).toEqual(normalizeEventLog([earlier, later]));
    expect(normalizeEventLog([later, earlier]).events.map(({ eventId }) => eventId)).toEqual([
      "event_001",
      "event_002",
    ]);
  });

  it("treats identical duplicate IDs as idempotent", () => {
    const first = event("event_001", "2026-08-13T20:00:01.000Z");

    expect(normalizeEventLog([first, { ...first }])).toEqual({ events: [first], issues: [] });
  });

  it("quarantines conflicting duplicate IDs instead of choosing a winner", () => {
    const first = event("event_001", "2026-08-13T20:00:01.000Z", { name: "Alpha" });
    const conflict = event("event_001", "2026-08-13T20:00:01.000Z", { name: "Beta" });

    expect(normalizeEventLog([conflict, first])).toEqual({
      events: [],
      issues: [
        {
          code: "DUPLICATE_EVENT_CONFLICT",
          eventId: "event_001",
          message: "Conflicting content shares one eventId; all variants were quarantined.",
        },
      ],
    });
  });

  it("returns malformed input issues in deterministic order", () => {
    const unknownKind = { ...event("event_002", "2026-08-13T20:00:02.000Z"), kind: "unknown" };
    const badVersion = { ...event("event_001", "2026-08-13T20:00:01.000Z"), schemaVersion: 2 };

    expect(normalizeEventLog([unknownKind, badVersion])).toEqual(
      normalizeEventLog([badVersion, unknownKind]),
    );
  });
});
