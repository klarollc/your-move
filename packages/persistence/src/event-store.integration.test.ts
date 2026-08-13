import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProjectStore } from "./project-store.js";
import { appendEvents, readEvents } from "./event-store.js";
const roots: string[] = [];
const make = () => {
  const r = mkdtempSync(join(tmpdir(), "cuckcode-events-"));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
const event = (
  id: string,
  projectId = "project_alpha",
  kind = "project.created",
  payload: Record<string, unknown> = { name: "Alpha" },
) => ({
  schemaVersion: 1,
  eventId: id,
  projectId,
  kind,
  occurredAt: `2026-08-13T20:00:${id.slice(-2)}.000Z`,
  receivedAt: `2026-08-13T20:01:${id.slice(-2)}.000Z`,
  source: "manager",
  trust: "verified",
  payload,
});
describe("append-only event store", () => {
  it("atomically stores canonical order and identical duplicates", () => {
    const s = openProjectStore(make());
    appendEvents(s, "project_alpha", [event("event_02"), event("event_01")]);
    appendEvents(s, "project_alpha", [event("event_01")]);
    expect(readEvents(s, "project_alpha").map((e) => e.eventId)).toEqual(["event_01", "event_02"]);
    s.close();
  });
  it("rejects conflicting duplicate IDs without modifying history", () => {
    const s = openProjectStore(make());
    appendEvents(s, "project_alpha", [event("event_01")]);
    expect(() =>
      appendEvents(s, "project_alpha", [
        event("event_01", "project_alpha", "project.created", { name: "Beta" }),
      ]),
    ).toThrow("CUCKCODE_EVENT_ID_CONFLICT");
    expect(readEvents(s, "project_alpha")).toHaveLength(1);
    s.close();
  });
  it("rejects cross-project batches atomically", () => {
    const s = openProjectStore(make());
    expect(() =>
      appendEvents(s, "project_alpha", [event("event_01"), event("event_02", "project_beta")]),
    ).toThrow("CUCKCODE_EVENT_PROJECT_MISMATCH");
    expect(readEvents(s, "project_alpha")).toEqual([]);
    s.close();
  });
});
