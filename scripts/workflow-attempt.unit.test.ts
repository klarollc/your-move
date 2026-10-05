import { executeWorkCommand } from "@cuckcode/application";
import type { PostureRecord } from "@cuckcode/contracts";
import { reduceWorkTruth } from "@cuckcode/domain";
import { describe, expect, it } from "vitest";

import { runWorkflowAttempt, type AttemptDeps } from "./workflow-attempt.js";
import type { TurnSummary } from "./workflow-bridge.js";

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
  maxTurns: 3,
};
const staffing = [
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
const base = {
  projectId: "project_alpha",
  actor: { actorType: "manager" as const, actorId: "manager_nate" },
  workItemId: "work_slug",
};
function assignedLog(): unknown[] {
  const created = {
    schemaVersion: 1,
    eventId: "event_work_seed",
    projectId: "project_alpha",
    workItemId: "work_slug",
    kind: "work.created",
    occurredAt: T0,
    receivedAt: T0,
    source: "manager",
    trust: "verified",
    actor: { actorType: "manager", actorId: "manager_nate" },
    payload: {
      payloadVersion: 3,
      workItemId: "work_slug",
      outcome: contract.outcome,
      requiredEvidenceKinds: ["test-run"],
      contract,
    },
  };
  const log: unknown[] = [...staffing, created];
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

const posture = (match = true): PostureRecord =>
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
      read: "no",
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

const cleanTurn = (n: number, over: Partial<TurnSummary> = {}): TurnSummary => ({
  number: n,
  itemTypes: ["agentMessage", "fileChange"],
  streamedPaths: ["src/slugify.ts"],
  worktreePaths: ["src/slugify.ts"],
  partial: false,
  partialReasons: [],
  ...over,
});

type Fake = {
  deps: AttemptDeps;
  log: unknown[];
  turnsCalled: number[];
  closed: () => number;
  appendCalls: () => number;
};
function fake(opts: {
  posture?: PostureRecord;
  turns?: (
    n: number,
  ) => { summary: TurnSummary; claimDone: boolean; claimBlocked?: string } | Error;
  refuseAppendAt?: number;
  verifiedEvidence?: boolean;
  startFails?: boolean;
}): Fake {
  const log = assignedLog();
  if (opts.verifiedEvidence) {
    log.push({
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
    });
  }
  const turnsCalled: number[] = [];
  let closed = 0;
  let appends = 0;
  const deps: AttemptDeps = {
    readLog: async () => ({ events: [...log], revision: log.length }),
    append: async (events, expected) => {
      appends += 1;
      if (opts.refuseAppendAt === appends) return { ok: false, code: "LOG_DAMAGED", detail: "x" };
      if (expected !== log.length) return { ok: false, code: "STALE_REVISION", detail: "x" };
      log.push(...events);
      return { ok: true, revision: log.length };
    },
    startSession: async () => {
      if (opts.startFails) throw new Error("spawn failed");
      return {
        posture: opts.posture ?? posture(),
        close: async () => {
          closed += 1;
        },
      };
    },
    runTurn: async (n) => {
      turnsCalled.push(n);
      const next = (opts.turns ?? ((k) => ({ summary: cleanTurn(k), claimDone: false })))(n);
      if (next instanceof Error) throw next;
      return next;
    },
    now: () => "2026-10-04T11:00:00.000Z",
  };
  return { deps, log, turnsCalled, closed: () => closed, appendCalls: () => appends };
}
const input = (f: Fake, over: Record<string, unknown> = {}) => ({
  deps: f.deps,
  projectId: "project_alpha",
  workItemId: "work_slug",
  runId: "run1",
  neededPaths: ["src/slugify.ts"],
  maxTurns: 3,
  ...over,
});
const stateOf = (f: Fake) => reduceWorkTruth(f.log).workItems.work_slug;

describe("runWorkflowAttempt", () => {
  it("blocks before turn 1: no turn is run, the item is blocked, the session is closed", async () => {
    const f = fake({});
    const result = await runWorkflowAttempt(
      input(f, { neededPaths: ["src/slugify.ts", "src/b.ts"] }),
    );
    expect(result.outcome).toBe("blocked_before_turn");
    expect(result.turnsRun).toBe(0);
    expect(f.turnsCalled).toEqual([]);
    expect(stateOf(f)?.state).toBe("blocked");
    expect(f.closed()).toBe(1);
  });

  it("blocks on a posture mismatch without running a turn", async () => {
    const f = fake({ posture: posture(false) });
    const result = await runWorkflowAttempt(input(f));
    expect(result.outcome).toBe("blocked_before_turn");
    expect(f.turnsCalled).toEqual([]);
  });

  it("runs turns until the role's supported done claim, then asks for review", async () => {
    const f = fake({
      verifiedEvidence: true,
      turns: (n) => ({ summary: cleanTurn(n), claimDone: n === 2 }),
    });
    const result = await runWorkflowAttempt(input(f));
    expect(result).toMatchObject({ outcome: "review_requested", turnsRun: 2 });
    expect(stateOf(f)?.state).toBe("review_requested");
    expect(f.closed()).toBe(1);
  });

  it("stops at an unsupported done claim and leaves the item active", async () => {
    const f = fake({ turns: (n) => ({ summary: cleanTurn(n), claimDone: true }) });
    const result = await runWorkflowAttempt(input(f));
    expect(result).toMatchObject({ outcome: "claim_unsupported", turnsRun: 1 });
    expect(stateOf(f)?.state).toBe("active");
  });

  it("hard-stops when the worktree and stream disagree", async () => {
    const f = fake({
      turns: (n) => ({
        summary: cleanTurn(n, { worktreePaths: ["src/slugify.ts", "x.ts"] }),
        claimDone: false,
      }),
    });
    const result = await runWorkflowAttempt(input(f));
    expect(result).toMatchObject({ outcome: "hard_stop", turnsRun: 1 });
    expect(stateOf(f)?.state).toBe("blocked");
  });

  it("halts and escalates at the turn cap, running exactly the allowed turns", async () => {
    const f = fake({});
    const result = await runWorkflowAttempt(input(f, { maxTurns: 2 }));
    expect(result).toMatchObject({ outcome: "turn_cap", turnsRun: 2 });
    expect(f.turnsCalled).toEqual([1, 2]);
    expect(stateOf(f)?.state).toBe("blocked");
  });

  it("records a runtime failure mid-run as a halt, and closes the session", async () => {
    const f = fake({
      turns: (n) =>
        n === 2 ? new Error("codex exited") : { summary: cleanTurn(n), claimDone: false },
    });
    const result = await runWorkflowAttempt(input(f));
    expect(result).toMatchObject({ outcome: "runtime_failure", turnsRun: 1 });
    expect(JSON.stringify(f.log)).toContain("codex exited");
    expect(stateOf(f)?.state).toBe("blocked");
    expect(f.closed()).toBe(1);
  });

  it("stops at once when the log refuses an append, and runs no further turn", async () => {
    const f = fake({ refuseAppendAt: 2 }); // preflight append ok, first turn's append refused
    const result = await runWorkflowAttempt(input(f));
    expect(result.outcome).toBe("log_refused");
    expect(f.turnsCalled).toEqual([1]);
    expect(f.closed()).toBe(1);
  });

  it("reports a session that never started, appends nothing, and does not claim a record", async () => {
    const f = fake({ startFails: true });
    const result = await runWorkflowAttempt(input(f));
    expect(result.outcome).toBe("runtime_failure");
    expect(result.turnsRun).toBe(0);
    expect(f.appendCalls()).toBe(0);
    expect(result.notes.join(" ")).toContain("spawn failed");
  });

  it("stops when the role reports blocked, asking the manager, with the item blocked", async () => {
    const f = fake({
      turns: (n) => ({ summary: cleanTurn(n), claimDone: false, claimBlocked: "which locale?" }),
    });
    const result = await runWorkflowAttempt(input(f));
    expect(result).toMatchObject({ outcome: "role_blocked", turnsRun: 1 });
    expect(stateOf(f)?.state).toBe("blocked");
    expect(stateOf(f)?.condition?.summary).toContain("which locale?");
  });
});
