import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeWorkCommand } from "@cuckcode/application";
import type { PostureRecord } from "@cuckcode/contracts";
import { reduceWorkTruth, replayProject } from "@cuckcode/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { appendEventLog, readEventLog } from "../apps/server/src/event-log.js";
import { runWorkflowAttempt, type AttemptDeps } from "./workflow-attempt.js";

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
  contextRefs: [{ path: "src/slugify.ts", sha256: "a".repeat(64) }],
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
const seed = (): unknown[] => {
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
  const created = executeWorkCommand({
    log,
    currentRevision: log.length,
    now: T0,
    command: { ...base, commandId: "c1", expectedRevision: log.length, intent: "create", contract },
  });
  if (!created.ok) throw new Error(created.code);
  log = [...log, ...created.events];
  const assigned = executeWorkCommand({
    log,
    currentRevision: log.length,
    now: T0,
    command: {
      ...base,
      commandId: "c2",
      expectedRevision: log.length,
      intent: "assign",
      roleAssignmentId: "role-assignment_engineer",
    },
  });
  if (!assigned.ok) throw new Error(assigned.code);
  return [...log, ...assigned.events];
};
const posture = {
  schemaVersion: 1,
  requested: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  granted: {
    type: "workspaceWrite",
    networkAccess: false,
    approvalPolicy: "never",
    multiAgentMode: "disabled",
  },
  declared: {
    kind: "declared",
    read: "no",
    write: "possible",
    run: "no",
    basis: ["x"],
    observed: null,
  },
  match: true,
  differences: [],
} as unknown as PostureRecord;

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-attempt-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it("a run appended to the real file log replays to the same state as the in-memory run", async () => {
  const path = join(dir, "events.jsonl");
  const initial = seed();
  await writeFile(path, initial.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
  const memory = [...initial];
  const clean = (n: number) => ({
    summary: {
      number: n,
      itemTypes: ["agentMessage", "fileChange"],
      streamedPaths: ["src/slugify.ts"],
      worktreePaths: ["src/slugify.ts"],
      partial: n === 1,
      partialReasons: n === 1 ? ["an item started and never completed"] : [],
    },
    claimDone: n === 2,
  });
  const make = (useFile: boolean): AttemptDeps => ({
    readLog: async () =>
      useFile ? await readEventLog(path) : { events: [...memory], revision: memory.length },
    append: async (events, expected) => {
      if (useFile) return await appendEventLog(path, events, expected);
      memory.push(...events);
      return { ok: true, revision: memory.length };
    },
    startSession: async () => ({ posture, close: async () => undefined }),
    runTurn: async (n) => clean(n),
    now: () => "2026-10-04T11:00:00.000Z",
  });
  const args = {
    projectId: "project_alpha",
    workItemId: "work_slug",
    runId: "run1",
    neededPaths: ["src/slugify.ts"],
    maxTurns: 3,
  };
  const fromFile = await runWorkflowAttempt({ ...args, deps: make(true) });
  const fromMemory = await runWorkflowAttempt({ ...args, deps: make(false) });
  expect(fromFile).toEqual(fromMemory);
  expect(fromFile.outcome).toBe("claim_unsupported");

  const onDisk = await readEventLog(path);
  expect(onDisk).toMatchObject({ truncated: false, problems: [] });
  expect(onDisk.events).toEqual(memory);
  expect(reduceWorkTruth(onDisk.events)).toEqual(reduceWorkTruth(memory));
  expect(replayProject(onDisk.events).work.issues).toEqual([]);
  const turnOne = JSON.stringify(onDisk.events);
  expect(turnOne).toContain("an item started and never completed");
});
