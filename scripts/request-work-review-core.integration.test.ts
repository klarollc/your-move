import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeWorkCommand } from "@cuckcode/application";
import type { PostureRecord } from "@cuckcode/contracts";
import { replayProject } from "@cuckcode/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appendEventLog, readEventLog } from "../apps/server/src/event-log.js";
import { recordWorkEvidence } from "./record-work-evidence-core.js";
import { parseReviewArgs, requestWorkReview } from "./request-work-review-core.js";
import { runWorkflowAttempt } from "./workflow-attempt.js";

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

function assignedLog(): unknown[] {
  const log: unknown[] = [
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
  log.push({
    ...env("event_work_seed", "work.created", {
      payloadVersion: 3,
      workItemId: "work_slug",
      outcome: contract.outcome,
      requiredEvidenceKinds: ["test-run"],
      contract,
    }),
    workItemId: "work_slug",
    source: "manager",
    actor: base.actor,
  });
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
}

let dir = "";
let logPath = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-review-"));
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

const claimDone = async () =>
  await runWorkflowAttempt({
    deps: {
      readLog: async () => await readEventLog(logPath),
      append: async (events, expected) => await appendEventLog(logPath, events, expected),
      startSession: async () => ({ posture, close: async () => undefined }),
      runTurn: async (number) => ({
        summary: {
          number,
          itemTypes: ["agentMessage"],
          streamedPaths: [],
          worktreePaths: [],
          partial: false,
          partialReasons: [],
        },
        claimDone: true,
      }),
      now: () => "2026-10-04T11:00:00.000Z",
    },
    projectId: "project_alpha",
    workItemId: "work_slug",
    runId: "run1",
    neededPaths: [],
    maxTurns: 2,
  });

const review = (over: Record<string, unknown> = {}) =>
  requestWorkReview({
    logPath,
    workItemId: "work_slug",
    actorId: "manager_nate",
    now: "2026-10-04T13:00:00.000Z",
    ...over,
  });

describe("requestWorkReview", () => {
  it("takes an item from claimed-done to review_requested only after verified evidence is recorded", async () => {
    expect((await claimDone()).outcome).toBe("claim_unsupported");
    const before = (await readEventLog(logPath)).revision;

    const early = await review();
    expect(early).toMatchObject({ ok: false, code: "DONE_NOT_SUPPORTED" });
    expect((await readEventLog(logPath)).revision).toBe(before);

    const output = join(dir, "out.txt");
    await writeFile(output, "Tests 1 passed\n", "utf8");
    const evidence = await recordWorkEvidence({
      logPath,
      workItemId: "work_slug",
      kind: "test-run",
      result: "passed",
      outputPath: output,
      actorId: "manager_nate",
      now: "2026-10-04T12:00:00.000Z",
    });
    expect(evidence).toMatchObject({ ok: true, doneSupported: true });

    const result = await review();
    expect(result).toMatchObject({ ok: true, revision: before + 2 });
    const log = await readEventLog(logPath);
    expect(log.problems).toEqual([]);
    const snapshot = replayProject(log.events).work;
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.workItems.work_slug?.state).toBe("review_requested");
    expect(snapshot.workItems.work_slug?.condition?.requestedAction?.kind).toBe("approve");
  });

  it("refuses an item the role never claimed done, and appends nothing", async () => {
    const before = (await readEventLog(logPath)).revision;
    expect(await review()).toMatchObject({ ok: false, code: "WORK_NOT_REVIEWABLE" });
    expect((await readEventLog(logPath)).revision).toBe(before);
  });

  it("refuses a damaged log without writing", async () => {
    const text = await readFile(logPath, "utf8");
    await writeFile(logPath, `${text}{"truncated`, "utf8");
    expect(await review()).toMatchObject({ ok: false, code: "LOG_DAMAGED" });
    expect(await readFile(logPath, "utf8")).toBe(`${text}{"truncated`);
  });

  it("refuses an ambiguous project unless one is named", async () => {
    const text = await readFile(logPath, "utf8");
    await writeFile(
      logPath,
      `${text}${JSON.stringify({ ...env("event_other", "project.created", { name: "Other" }), projectId: "project_other" })}\n`,
      "utf8",
    );
    expect(await review()).toMatchObject({ ok: false, code: "PROJECT_AMBIGUOUS" });
  });
});

describe("parseReviewArgs", () => {
  it("reads key=value arguments and defaults the actor", () => {
    expect(parseReviewArgs(["log=a.jsonl", "work=work_slug"])).toEqual({
      ok: true,
      value: { logPath: "a.jsonl", workItemId: "work_slug", actorId: "manager_owner" },
    });
    expect(parseReviewArgs(["log=a.jsonl", "work=w", "actor=me", "project=project_x"])).toEqual({
      ok: true,
      value: { logPath: "a.jsonl", workItemId: "w", actorId: "me", projectId: "project_x" },
    });
  });

  it("refuses missing and unknown arguments", () => {
    expect(parseReviewArgs(["log=a.jsonl"])).toMatchObject({ ok: false });
    expect(parseReviewArgs(["log=a", "work=w", "result=passed"])).toMatchObject({ ok: false });
  });
});
