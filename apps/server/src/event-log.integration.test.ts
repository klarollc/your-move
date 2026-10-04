import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appendEventLog, readEventLog } from "./event-log.js";

const ev = (n: number, over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  eventId: `event_${String(n)}`,
  projectId: "project_alpha",
  kind: "work.created",
  occurredAt: "2026-10-04T10:00:00.000Z",
  receivedAt: "2026-10-04T10:00:00.000Z",
  source: "manager",
  trust: "verified",
  payload: { workItemId: `work_${String(n)}`, outcome: "x", requiredEvidenceKinds: [] },
  ...over,
});

let dir = "";
let path = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-log-"));
  path = join(dir, "events.jsonl");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("event log file", () => {
  it("reads a missing file as an empty log", async () => {
    expect(await readEventLog(path)).toMatchObject({ revision: 0, truncated: false, problems: [] });
  });

  it("appends events, one per line, and reads them back", async () => {
    const result = await appendEventLog(path, [ev(1), ev(2)], 0);
    expect(result).toEqual({ ok: true, revision: 2 });
    const text = await readFile(path, "utf8");
    expect(text.split("\n")).toHaveLength(3);
    expect(text.endsWith("\n")).toBe(true);
    const log = await readEventLog(path);
    expect(log.revision).toBe(2);
  });

  it("refuses a stale expected revision and writes nothing", async () => {
    await appendEventLog(path, [ev(1)], 0);
    const result = await appendEventLog(path, [ev(2)], 0);
    expect(result).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect((await readEventLog(path)).revision).toBe(1);
  });

  it("refuses an invalid event and writes none of the batch", async () => {
    const result = await appendEventLog(path, [ev(1), ev(2, { projectId: "alpha" })], 0);
    expect(result).toMatchObject({ ok: false, code: "EVENT_INVALID" });
    expect((await readEventLog(path)).revision).toBe(0);
  });

  it("refuses an event id already in the log, and a duplicate inside the batch", async () => {
    await appendEventLog(path, [ev(1)], 0);
    expect(await appendEventLog(path, [ev(1)], 1)).toMatchObject({
      ok: false,
      code: "EVENT_DUPLICATE",
    });
    expect(await appendEventLog(path, [ev(2), ev(2)], 1)).toMatchObject({
      ok: false,
      code: "EVENT_DUPLICATE",
    });
  });

  it("refuses to append to a truncated log, and leaves it untouched", async () => {
    await writeFile(path, `${JSON.stringify(ev(1))}\n{"schemaVersion":1,"eve`, "utf8");
    const before = await readFile(path, "utf8");
    const result = await appendEventLog(path, [ev(2)], 1);
    expect(result).toMatchObject({ ok: false, code: "LOG_DAMAGED" });
    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("refuses to append to a log with an unparseable line", async () => {
    await writeFile(path, `${JSON.stringify(ev(1))}\n{bad\n`, "utf8");
    expect(await appendEventLog(path, [ev(2)], 1)).toMatchObject({
      ok: false,
      code: "LOG_DAMAGED",
    });
  });

  it("lets only one of two simultaneous appends at the same revision succeed", async () => {
    const results = await Promise.all([
      appendEventLog(path, [ev(1)], 0),
      appendEventLog(path, [ev(2)], 0),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect((await readEventLog(path)).revision).toBe(1);
  });
});
