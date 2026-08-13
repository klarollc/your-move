import { describe, expect, it } from "vitest";

import { parseProjectEvent } from "./events.js";

const baseEvent = {
  schemaVersion: 1,
  eventId: "event_001",
  projectId: "project_alpha",
  kind: "project.created",
  occurredAt: "2026-08-13T20:00:00.000Z",
  receivedAt: "2026-08-13T20:00:01.000Z",
  source: "manager",
  trust: "verified",
  payload: { name: "Alpha" },
} as const;

describe("parseProjectEvent", () => {
  it("accepts a supported versioned event envelope", () => {
    expect(parseProjectEvent(baseEvent)).toEqual({ ok: true, value: baseEvent });
  });

  it("rejects unsupported schema versions and event kinds", () => {
    expect(parseProjectEvent({ ...baseEvent, schemaVersion: 2 })).toMatchObject({
      ok: false,
      error: { code: "MALFORMED_EVENT", reason: "unsupported_schema_version" },
    });
    expect(parseProjectEvent({ ...baseEvent, kind: "provider.prose" })).toMatchObject({
      ok: false,
      error: { code: "MALFORMED_EVENT", reason: "unsupported_event_kind" },
    });
  });
});
