import { executeWorkCommand } from "@cuckcode/application";
import { parseProjectEvent, type PostureRecord } from "@cuckcode/contracts";
import { reduceWorkTruth } from "@cuckcode/domain";
import { describe, expect, it } from "vitest";

import {
  planHalt,
  planPreflight,
  planTurn,
  type BridgeContext,
  type TurnSummary,
} from "./workflow-bridge.js";

const T0 = "2026-10-04T10:00:00.000Z";
const contract = (paths: string[] = ["src/slugify.ts"]) => ({
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
  contextRefs: paths.map((path) => ({ path, sha256: "a".repeat(64) })),
});

const staffing = () => [
  {
    schemaVersion: 1,
    eventId: "event_s1",
    projectId: "project_alpha",
    kind: "agent.registered",
    occurredAt: T0,
    receivedAt: T0,
    source: "system",
    trust: "verified",
    payload: { agentId: "agent_engineer", capabilities: ["engineer"], health: "connected" },
  },
  {
    schemaVersion: 1,
    eventId: "event_s2",
    projectId: "project_alpha",
    kind: "role.assigned",
    occurredAt: T0,
    receivedAt: T0,
    source: "system",
    trust: "verified",
    payload: {
      roleAssignmentId: "role-assignment_engineer",
      roleId: "engineer",
      agentId: "agent_engineer",
      requiredCapabilities: ["engineer"],
    },
  },
];

const command = (over: Record<string, unknown>) => ({
  commandId: "c",
  projectId: "project_alpha",
  expectedRevision: 0,
  actor: { actorType: "manager" as const, actorId: "manager_nate" },
  intent: "create" as const,
  workItemId: "work_slug",
  ...over,
});

function assignedLog(paths?: string[]): unknown[] {
  let log: unknown[] = staffing();
  const created = executeWorkCommand({
    log,
    currentRevision: log.length,
    now: T0,
    command: command({ commandId: "c1", expectedRevision: log.length, contract: contract(paths) }),
  });
  if (!created.ok) throw new Error(created.code);
  log = [...log, ...created.events];
  const assigned = executeWorkCommand({
    log,
    currentRevision: log.length,
    now: T0,
    command: command({
      commandId: "c2",
      expectedRevision: log.length,
      intent: "assign",
      roleAssignmentId: "role-assignment_engineer",
    }),
  });
  if (!assigned.ok) throw new Error(assigned.code);
  return [...log, ...assigned.events];
}

const posture = (read: "no" | "possible" = "no", match = true): PostureRecord =>
  ({
    schemaVersion: 1,
    requested: {
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccess: false,
      windowsSandbox: "unelevated",
    },
    granted: {
      type: match ? "workspaceWrite" : "readOnly",
      networkAccess: false,
      approvalPolicy: "never",
      multiAgentMode: "disabled",
    },
    declared: {
      kind: "declared",
      read,
      write: "possible",
      run: "no",
      basis: ["x"],
      observed: null,
    },
    match,
    differences: match
      ? []
      : [{ field: "sandbox.type", requested: "workspaceWrite", granted: "readOnly" }],
  }) as unknown as PostureRecord;

const ctx = (log: readonly unknown[]): BridgeContext => ({
  projectId: "project_alpha",
  workItemId: "work_slug",
  runId: "run1",
  now: "2026-10-04T11:00:00.000Z",
  log,
});
const stateOf = (log: readonly unknown[], events: readonly unknown[]) =>
  reduceWorkTruth([...log, ...events]).workItems.work_slug;
const kinds = (events: readonly Record<string, unknown>[]) => events.map((e) => e.kind);
const evidenceKinds = (events: readonly Record<string, unknown>[]) =>
  events
    .filter((e) => e.kind === "evidence.recorded")
    .map((e) => (e.payload as Record<string, unknown>).kind);

describe("planPreflight", () => {
  it("records the posture and moves the item to active when all checks pass", () => {
    const log = assignedLog();
    const plan = planPreflight({
      ...ctx(log),
      posture: posture(),
      neededPaths: ["src/slugify.ts"],
    });
    expect(plan).toMatchObject({ ok: true, proceed: true, outcome: "started" });
    if (!plan.ok) return;
    expect(evidenceKinds(plan.events)).toEqual(["posture-record"]);
    expect(stateOf(log, plan.events)?.state).toBe("active");
    expect(reduceWorkTruth([...log, ...plan.events]).issues).toEqual([]);
  });

  it("blocks before turn 1, with a condition, when a needed file is unreadable and not inlined", () => {
    const log = assignedLog();
    const plan = planPreflight({
      ...ctx(log),
      posture: posture(),
      neededPaths: ["src/slugify.ts", "src/other.ts"],
    });
    expect(plan).toMatchObject({ ok: true, proceed: false, outcome: "blocked" });
    if (!plan.ok) return;
    expect(kinds(plan.events)).toEqual(["evidence.recorded", "work.transitioned"]);
    const item = stateOf(log, plan.events);
    expect(item?.state).toBe("blocked");
    expect(item?.condition?.summary).toContain("src/other.ts");
    expect(plan.notes.join(" ")).toContain("src/other.ts");
  });

  it("blocks and records a failed posture when granted differs from requested", () => {
    const log = assignedLog();
    const plan = planPreflight({
      ...ctx(log),
      posture: posture("no", false),
      neededPaths: ["src/slugify.ts"],
    });
    expect(plan).toMatchObject({ ok: true, proceed: false, outcome: "blocked" });
    if (!plan.ok) return;
    const evidence = plan.events.find((e) => e.kind === "evidence.recorded");
    expect(evidence?.payload).toMatchObject({ kind: "posture-record", result: "failed" });
    expect(stateOf(log, plan.events)?.state).toBe("blocked");
  });

  it("is rejected, not partly applied, when the item is not assigned", () => {
    const log = assignedLog().slice(0, -2); // created, never assigned
    const plan = planPreflight({ ...ctx(log), posture: posture(), neededPaths: [] });
    expect(plan).toMatchObject({ ok: false, code: "BRIDGE_REJECTED" });
  });

  it("emits parseable events carrying the run id as providerRunId", () => {
    const log = assignedLog();
    const plan = planPreflight({ ...ctx(log), posture: posture(), neededPaths: [] });
    if (!plan.ok) throw new Error("setup");
    for (const event of plan.events) {
      const parsed = parseProjectEvent(event);
      expect(parsed.ok).toBe(true);
      expect(event.providerRunId).toBe("run1");
    }
    const ids = plan.events.map((e) => e.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const activeLog = () => {
  const log = assignedLog();
  const plan = planPreflight({ ...ctx(log), posture: posture(), neededPaths: [] });
  if (!plan.ok) throw new Error("setup");
  return [...log, ...plan.events];
};
const turn = (over: Partial<TurnSummary> = {}): TurnSummary => ({
  number: 1,
  itemTypes: ["agentMessage", "fileChange"],
  streamedPaths: ["src/slugify.ts"],
  worktreePaths: ["src/slugify.ts"],
  partial: false,
  partialReasons: [],
  ...over,
});
const turnCtx = (log: readonly unknown[]) => ({ ...ctx(log), runId: "run1t1" });

describe("planTurn", () => {
  it("records a passing turn record and lets the run continue", () => {
    const log = activeLog();
    const plan = planTurn({ ...turnCtx(log), turn: turn(), claimDone: false });
    expect(plan).toMatchObject({ ok: true, proceed: true, outcome: "continue" });
    if (!plan.ok) return;
    expect(plan.events).toHaveLength(1);
    expect(plan.events[0]?.payload).toMatchObject({
      kind: "turn-record",
      result: "passed",
      turn: 1,
      partial: false,
      itemTypes: ["agentMessage", "fileChange"],
      paths: ["src/slugify.ts"],
    });
    expect(stateOf(log, plan.events)?.state).toBe("active");
  });

  it("marks a partial turn record failed, with its reasons, and continues", () => {
    const log = activeLog();
    const plan = planTurn({
      ...turnCtx(log),
      turn: turn({ partial: true, partialReasons: ["an item started and never completed"] }),
      claimDone: false,
    });
    expect(plan).toMatchObject({ ok: true, proceed: true, outcome: "continue" });
    if (!plan.ok) return;
    expect(plan.events[0]?.payload).toMatchObject({
      result: "failed",
      partial: true,
      partialReasons: ["an item started and never completed"],
    });
  });

  it("hard-stops and blocks the item when the worktree shows a change the stream never did", () => {
    const log = activeLog();
    const plan = planTurn({
      ...turnCtx(log),
      turn: turn({ worktreePaths: ["src/slugify.ts", "secret.ts"] }),
      claimDone: false,
    });
    expect(plan).toMatchObject({ ok: true, proceed: false, outcome: "hard_stop" });
    if (!plan.ok) return;
    expect(plan.events[0]?.payload).toMatchObject({ kind: "turn-record", result: "failed" });
    const item = stateOf(log, plan.events);
    expect(item?.state).toBe("blocked");
    expect(item?.condition?.summary).toContain("secret.ts");
  });

  it("rejects a done claim with no verified evidence, records it, and keeps the item active", () => {
    const log = activeLog();
    const plan = planTurn({ ...turnCtx(log), turn: turn(), claimDone: true });
    expect(plan).toMatchObject({ ok: true, proceed: true, outcome: "done_unsupported" });
    if (!plan.ok) return;
    expect(evidenceKinds(plan.events)).toEqual(["turn-record", "done-claim"]);
    const claim = plan.events.find(
      (e) => (e.payload as Record<string, unknown>).kind === "done-claim",
    );
    expect(claim).toMatchObject({ source: "adapter", trust: "reported" });
    expect(claim?.payload).toMatchObject({ result: "failed", missingKinds: ["test-run"] });
    expect(stateOf(log, plan.events)?.state).toBe("active");
  });

  it("moves to review_requested, asking the manager, when verified evidence supports the claim", () => {
    const log = [
      ...activeLog(),
      {
        schemaVersion: 1,
        eventId: "event_owner_test",
        projectId: "project_alpha",
        workItemId: "work_slug",
        kind: "evidence.recorded",
        occurredAt: T0,
        receivedAt: T0,
        source: "manager",
        trust: "verified",
        payload: {
          evidenceId: "evidence_owner_test",
          workItemId: "work_slug",
          kind: "test-run",
          version: 1,
          result: "passed",
        },
      },
    ];
    const plan = planTurn({ ...turnCtx(log), turn: turn(), claimDone: true });
    expect(plan).toMatchObject({ ok: true, proceed: false, outcome: "review_requested" });
    if (!plan.ok) return;
    const item = stateOf(log, plan.events);
    expect(item?.state).toBe("review_requested");
    expect(item?.condition?.requestedAction?.kind).toBe("approve");
    expect(reduceWorkTruth([...log, ...plan.events]).issues).toEqual([]);
  });

  it("does not let a done claim bypass a hard stop in the same turn", () => {
    const log = activeLog();
    const plan = planTurn({
      ...turnCtx(log),
      turn: turn({ worktreePaths: [] }),
      claimDone: true,
    });
    expect(plan).toMatchObject({ ok: true, outcome: "hard_stop", proceed: false });
    if (plan.ok) expect(stateOf(log, plan.events)?.state).toBe("blocked");
  });

  it("is rejected when the item is not active", () => {
    const log = assignedLog(); // assigned, never started
    expect(planTurn({ ...turnCtx(log), turn: turn(), claimDone: false })).toMatchObject({
      ok: false,
      code: "BRIDGE_REJECTED",
    });
  });
});

describe("planHalt", () => {
  it("records why the run halted, then blocks the item and asks the manager", () => {
    const log = activeLog();
    const plan = planHalt({
      ...ctx(log),
      runId: "run1h",
      reason: "turn_cap",
      detail: "10 turns used",
    });
    expect(plan).toMatchObject({ ok: true, proceed: false, outcome: "hard_stop" });
    if (!plan.ok) return;
    expect(evidenceKinds(plan.events)).toEqual(["run-halt"]);
    expect(plan.events[0]?.payload).toMatchObject({ result: "failed", reason: "turn_cap" });
    const item = stateOf(log, plan.events);
    expect(item?.state).toBe("blocked");
    expect(item?.condition?.summary).toContain("10 turns used");
    expect(item?.condition?.requestedAction?.kind).toBe("redirect");
  });

  it("is rejected when the item is not active", () => {
    const plan = planHalt({
      ...ctx(assignedLog()),
      reason: "runtime_failure",
      detail: "x",
    });
    expect(plan).toMatchObject({ ok: false, code: "BRIDGE_REJECTED" });
  });
});

describe("planTurn: the role reports blocked", () => {
  it("blocks the item with a clarification request carrying the role's question", () => {
    const log = activeLog();
    const plan = planTurn({
      ...turnCtx(log),
      turn: turn(),
      claimDone: false,
      claimBlocked: "Should slugify keep unicode letters or strip them?",
    });
    expect(plan).toMatchObject({ ok: true, proceed: false, outcome: "role_blocked" });
    if (!plan.ok) return;
    expect(evidenceKinds(plan.events)).toEqual(["turn-record"]);
    const item = stateOf(log, plan.events);
    expect(item?.state).toBe("blocked");
    expect(item?.condition).toMatchObject({
      reasonCode: "awaiting_clarification",
      waitingOn: { kind: "manager" },
      requestedAction: { kind: "answer_question" },
    });
    expect(item?.condition?.summary).toContain("unicode");
  });

  it("lets a hard stop win over the role's blocked report", () => {
    const log = activeLog();
    const plan = planTurn({
      ...turnCtx(log),
      turn: turn({ worktreePaths: [] }),
      claimDone: false,
      claimBlocked: "stuck",
    });
    expect(plan).toMatchObject({ ok: true, outcome: "hard_stop" });
  });

  it("clamps a long question to the condition summary limit", () => {
    const log = activeLog();
    const plan = planTurn({
      ...turnCtx(log),
      turn: turn(),
      claimDone: false,
      claimBlocked: "q".repeat(500),
    });
    expect(plan).toMatchObject({ ok: true, outcome: "role_blocked" });
  });
});
