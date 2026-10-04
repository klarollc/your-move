import { describe, expect, it } from "vitest";

import { parseEventLog } from "./event-log.js";

const ev = (n: number) => ({
  schemaVersion: 1,
  eventId: `event_${String(n)}`,
  projectId: "project_alpha",
  kind: "work.created",
  occurredAt: "2026-10-04T10:00:00.000Z",
  receivedAt: "2026-10-04T10:00:00.000Z",
  source: "manager",
  trust: "verified",
  payload: { workItemId: `work_${String(n)}`, outcome: "x", requiredEvidenceKinds: [] },
});
const lines = (...events: unknown[]) => events.map((e) => JSON.stringify(e)).join("\n");

describe("parseEventLog", () => {
  it("reads an empty log as revision 0, not truncated", () => {
    expect(parseEventLog("")).toEqual({ events: [], revision: 0, truncated: false, problems: [] });
  });

  it("reads complete lines in order; revision is the event count", () => {
    const parsed = parseEventLog(`${lines(ev(1), ev(2))}\n`);
    expect(parsed.revision).toBe(2);
    expect(parsed.events.map((e) => (e as { eventId: string }).eventId)).toEqual([
      "event_1",
      "event_2",
    ]);
    expect(parsed).toMatchObject({ truncated: false, problems: [] });
  });

  it("reports a final line without a newline as truncated and does not count it", () => {
    const parsed = parseEventLog(`${lines(ev(1))}\n${JSON.stringify(ev(2)).slice(0, 40)}`);
    expect(parsed.truncated).toBe(true);
    expect(parsed.revision).toBe(1);
  });

  it("treats a complete final line with no trailing newline as truncated too", () => {
    const parsed = parseEventLog(lines(ev(1)));
    expect(parsed.truncated).toBe(true);
    expect(parsed.revision).toBe(0);
  });

  it("reports an unparseable middle line with its line number, and keeps the others", () => {
    const parsed = parseEventLog(`${JSON.stringify(ev(1))}\n{not json\n${JSON.stringify(ev(3))}\n`);
    expect(parsed.problems).toEqual([{ line: 2, reason: expect.stringContaining("JSON") }]);
    expect(parsed.events).toHaveLength(2);
  });

  it("reports a line that is JSON but not a valid project event", () => {
    const parsed = parseEventLog(`${JSON.stringify({ ...ev(1), projectId: "alpha" })}\n`);
    expect(parsed.problems).toEqual([{ line: 1, reason: expect.stringContaining("event") }]);
    expect(parsed.events).toHaveLength(0);
  });

  it("reports a duplicate event id", () => {
    const parsed = parseEventLog(`${lines(ev(1), ev(1))}\n`);
    expect(parsed.problems).toEqual([{ line: 2, reason: expect.stringContaining("duplicate") }]);
  });

  it("ignores blank lines without counting them", () => {
    const parsed = parseEventLog(`${JSON.stringify(ev(1))}\n\n${JSON.stringify(ev(2))}\n`);
    expect(parsed.revision).toBe(2);
    expect(parsed.problems).toEqual([]);
  });
});
