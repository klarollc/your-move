import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { executeWorkCommand } from "@cuckcode/application";
import { judgeDoneClaim } from "@cuckcode/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEventLog } from "../apps/server/src/event-log.js";
import { parseEvidenceArgs, recordWorkEvidence } from "./record-work-evidence-core.js";

const T0 = "2026-10-04T10:00:00.000Z";
const contract = {
  outcome: "Implement slugify",
  exclusions: [],
  acceptanceCriteria: ["the test is green"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "RED then GREEN" }],
  permissionCeiling: {
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "never",
    networkAccess: false as const,
    windowsSandbox: "unelevated" as const,
  },
  stopConditions: ["turn cap"],
  definitionOfDone: "owner acceptance",
  contextRefs: [],
  maxTurns: 5,
};
const env = (eventId: string, kind: string, payload: Record<string, unknown>) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  kind,
  occurredAt: T0,
  receivedAt: T0,
  source: "system",
  trust: "verified",
  payload,
});
function assignedLog(): unknown[] {
  let log: unknown[] = [
    env("event_s1", "agent.registered", {
      agentId: "agent_engineer",
      capabilities: ["engineer"],
      health: "connected",
    }),
    env("event_s2", "role.assigned", {
      roleAssignmentId: "role-assignment_engineer",
      roleId: "engineer",
      agentId: "agent_engineer",
      requiredCapabilities: ["engineer"],
    }),
  ];
  const base = {
    projectId: "project_alpha",
    actor: { actorType: "manager" as const, actorId: "manager_nate" },
    workItemId: "work_slug",
  };
  for (const [id, intent, extra] of [
    ["c1", "create", { contract }],
    ["c2", "assign", { roleAssignmentId: "role-assignment_engineer" }],
  ] as const) {
    const r = executeWorkCommand({
      log,
      currentRevision: log.length,
      now: T0,
      command: { ...base, commandId: id, expectedRevision: log.length, intent, ...extra },
    });
    if (!r.ok) throw new Error(r.code);
    log = [...log, ...r.events];
  }
  return log;
}

let dir = "";
let logPath = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-evidence-"));
  logPath = join(dir, "events.jsonl");
  await writeFile(
    logPath,
    assignedLog()
      .map((e) => `${JSON.stringify(e)}\n`)
      .join(""),
    "utf8",
  );
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const input = (over: Record<string, unknown> = {}) => ({
  logPath,
  workItemId: "work_slug",
  kind: "test-run",
  result: "passed" as const,
  actorId: "manager_nate",
  now: "2026-10-04T12:00:00.000Z",
  ...over,
});

describe("recordWorkEvidence", () => {
  it("appends verified evidence with the digest of the saved output, and says done is now supported", async () => {
    const outputPath = join(dir, "vitest.txt");
    await writeFile(outputPath, "Tests 1 passed\n", "utf8");
    const result = await recordWorkEvidence(input({ outputPath, note: "GREEN" }));
    expect(result).toMatchObject({
      ok: true,
      outputSha256: createHash("sha256").update("Tests 1 passed\n").digest("hex"),
      doneSupported: true,
      unsatisfied: [],
      revision: 7,
    });
    const log = await readEventLog(logPath);
    expect(log.revision).toBe(7);
    expect(judgeDoneClaim({ log: log.events, workItemId: "work_slug" })).toEqual({ ok: true });
  });

  it("records a failed result and says done is not supported", async () => {
    const result = await recordWorkEvidence(input({ result: "failed" }));
    expect(result).toMatchObject({ ok: true, doneSupported: false, unsatisfied: ["test-run"] });
  });

  it("refuses a kind the contract does not oblige and appends nothing", async () => {
    const result = await recordWorkEvidence(input({ kind: "tset-run" }));
    expect(result).toMatchObject({ ok: false, code: "EVIDENCE_KIND_UNKNOWN" });
    expect((await readEventLog(logPath)).revision).toBe(6);
  });

  it("refuses a missing or empty output file rather than recording without it", async () => {
    const missing = await recordWorkEvidence(input({ outputPath: join(dir, "nope.txt") }));
    expect(missing).toMatchObject({ ok: false, code: "OUTPUT_UNREADABLE" });
    const empty = join(dir, "empty.txt");
    await writeFile(empty, "", "utf8");
    expect(await recordWorkEvidence(input({ outputPath: empty }))).toMatchObject({
      ok: false,
      code: "OUTPUT_UNREADABLE",
    });
    expect((await readEventLog(logPath)).revision).toBe(6);
  });

  it("refuses a damaged log and leaves it untouched", async () => {
    await writeFile(logPath, `${JSON.stringify(assignedLog()[0])}\n{"schemaVersion":1,"ev`, "utf8");
    expect(await recordWorkEvidence(input())).toMatchObject({ ok: false, code: "LOG_DAMAGED" });
  });

  it("derives the project from the log, and refuses when the log holds more than one", async () => {
    expect(await recordWorkEvidence(input())).toMatchObject({ ok: true });
    const other = {
      ...env("event_other", "project.created", { name: "x" }),
      projectId: "project_beta",
    };
    await writeFile(
      logPath,
      [...assignedLog(), other].map((e) => `${JSON.stringify(e)}\n`).join(""),
      "utf8",
    );
    expect(await recordWorkEvidence(input())).toMatchObject({
      ok: false,
      code: "PROJECT_AMBIGUOUS",
    });
    expect(await recordWorkEvidence(input({ projectId: "project_alpha" }))).toMatchObject({
      ok: true,
    });
  });
});

describe("parseEvidenceArgs", () => {
  it("parses key=value arguments", () => {
    expect(
      parseEvidenceArgs([
        "log=events.jsonl",
        "work=work_slug",
        "kind=test-run",
        "result=passed",
        "output=out.txt",
        "note=GREEN run",
        "actor=manager_nate",
      ]),
    ).toEqual({
      ok: true,
      value: {
        logPath: "events.jsonl",
        workItemId: "work_slug",
        kind: "test-run",
        result: "passed",
        outputPath: "out.txt",
        note: "GREEN run",
        actorId: "manager_nate",
      },
    });
  });

  it("names every missing or invalid argument and refuses unknown ones", () => {
    const result = parseEvidenceArgs(["kind=test-run", "result=maybe", "bogus=1"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.issues.join(" | ");
    for (const word of ["log", "work", "result", "bogus"]) expect(text).toContain(word);
  });
});
