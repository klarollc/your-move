import { validateWorkTransitionPayload, type PostureRecord } from "@cuckcode/contracts";
import { describe, expect, it } from "vitest";

import { checkReadiness, judgeDoneClaim, reconcileRecords } from "./completion-gate.js";

const contract = (contextPaths: string[] = []) => ({
  outcome: "Implement slugify",
  exclusions: [],
  acceptanceCriteria: ["the test is green"],
  dependencies: [],
  evidenceObligations: [
    { kind: "test-run", description: "RED then GREEN" },
    { kind: "git-status", description: "worktree status" },
  ],
  permissionCeiling: {
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "never",
    networkAccess: false as const,
    windowsSandbox: "unelevated" as const,
  },
  stopConditions: ["turn cap"],
  definitionOfDone: "owner acceptance",
  contextRefs: contextPaths.map((path) => ({ path, sha256: "a".repeat(64) })),
});

const posture = (over: Partial<PostureRecord> = {}, read: "no" | "possible" | "unknown" = "no") =>
  ({
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
      read,
      write: "possible",
      run: "no",
      basis: ["x"],
      observed: null,
    },
    match: true,
    differences: [],
    ...over,
  }) as unknown as PostureRecord;

describe("checkReadiness (invariant 2)", () => {
  it("passes when every needed file is inlined, even if the role cannot read", () => {
    const result = checkReadiness({
      contract: contract(["src/slugify.ts", "src/slugify.test.ts"]),
      posture: posture(),
      neededPaths: ["src/slugify.ts", "./src/slugify.test.ts"],
    });
    expect(result).toMatchObject({ ok: true, uninlined: [] });
  });

  it("blocks before turn 1 when the role cannot read a needed file that is not inlined", () => {
    const result = checkReadiness({
      contract: contract(["src/slugify.test.ts"]),
      posture: posture(),
      neededPaths: ["src/slugify.ts", "src/slugify.test.ts"],
    });
    expect(result).toMatchObject({
      ok: false,
      code: "BLOCKED_CANNOT_READ",
      missingPaths: ["src/slugify.ts"],
      condition: {
        reasonCode: "awaiting_evidence",
        waitingOn: { kind: "manager" },
        requestedAction: { kind: "provide_evidence" },
      },
    });
  });

  it("produces a condition the work.transitioned contract accepts, even for many paths", () => {
    const result = checkReadiness({
      contract: contract(),
      posture: posture(),
      neededPaths: Array.from({ length: 60 }, (_, i) => `src/module-${String(i)}.ts`),
    });
    expect(result.ok).toBe(false);
    if (result.ok || !result.condition) return;
    const payload = {
      payloadVersion: 3,
      workItemId: "work_slug",
      fromRevision: 2,
      toState: "blocked",
      condition: result.condition,
    };
    expect(validateWorkTransitionPayload(payload)).toMatchObject({ ok: true });
  });

  it("blocks when read capability is unknown (fail closed)", () => {
    const result = checkReadiness({
      contract: contract(),
      posture: posture({}, "unknown"),
      neededPaths: ["src/a.ts"],
    });
    expect(result).toMatchObject({ ok: false, code: "BLOCKED_CANNOT_READ" });
  });

  it("allows an un-inlined file when read is possible, and says it is untested", () => {
    const result = checkReadiness({
      contract: contract(),
      posture: posture({}, "possible"),
      neededPaths: ["src/a.ts"],
    });
    expect(result).toMatchObject({ ok: true, uninlined: ["src/a.ts"] });
    if (result.ok) expect(result.readBasis).toContain("possible");
  });

  it("refuses a posture whose granted state differs from requested", () => {
    const result = checkReadiness({
      contract: contract(["a.ts"]),
      posture: posture({
        match: false,
        differences: [{ field: "sandbox.type", requested: "workspaceWrite", granted: "readOnly" }],
      }),
      neededPaths: ["a.ts"],
    });
    expect(result).toMatchObject({ ok: false, code: "POSTURE_MISMATCH" });
  });

  it("refuses a requested posture broader than the contract's permission ceiling", () => {
    const narrow = {
      ...contract(["a.ts"]),
      permissionCeiling: { ...contract().permissionCeiling, sandboxMode: "read-only" as const },
    };
    const result = checkReadiness({ contract: narrow, posture: posture(), neededPaths: ["a.ts"] });
    expect(result).toMatchObject({ ok: false, code: "CEILING_EXCEEDED" });
  });
});

let clock = 0;
const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  trust = "verified",
  source = "system",
) => {
  clock += 1;
  const at = new Date(Date.parse("2026-10-04T10:00:00.000Z") + clock * 1000).toISOString();
  return {
    schemaVersion: 1,
    eventId,
    projectId: "project_alpha",
    kind,
    occurredAt: at,
    receivedAt: at,
    source,
    trust,
    payload,
  };
};
const created = () =>
  event("event_created", "work.created", {
    payloadVersion: 2,
    workItemId: "work_slug",
    outcome: "Implement slugify",
    requiredEvidenceKinds: ["test-run", "git-status"],
    contract: contract(),
  });
const evidence = (
  id: string,
  kind: string,
  result: string,
  trust = "verified",
  source = "system",
) =>
  event(
    `event_${id}`,
    "evidence.recorded",
    { evidenceId: id, workItemId: "work_slug", kind, version: 1, result },
    trust,
    source,
  );

describe("judgeDoneClaim (invariant 5)", () => {
  it("accepts when every obligation has verified passing evidence", () => {
    const log = [
      created(),
      evidence("e1", "test-run", "passed"),
      evidence("e2", "git-status", "passed"),
    ];
    expect(judgeDoneClaim({ log, workItemId: "work_slug" })).toEqual({ ok: true });
  });

  it("rejects a claim with no evidence, naming the missing kinds", () => {
    const result = judgeDoneClaim({ log: [created()], workItemId: "work_slug" });
    expect(result).toMatchObject({
      ok: false,
      code: "DONE_UNSUPPORTED",
      missingKinds: ["test-run", "git-status"],
      failedKinds: [],
      unverifiedKinds: [],
    });
  });

  it("does not accept the role's own report as evidence", () => {
    const log = [
      created(),
      evidence("e1", "test-run", "passed", "reported", "adapter"),
      evidence("e2", "git-status", "passed"),
    ];
    expect(judgeDoneClaim({ log, workItemId: "work_slug" })).toMatchObject({
      ok: false,
      unverifiedKinds: ["test-run"],
      missingKinds: [],
    });
  });

  it("rejects when the latest verified evidence for a kind failed", () => {
    const log = [
      created(),
      evidence("e1", "test-run", "passed"),
      evidence("e3", "test-run", "failed"),
      evidence("e2", "git-status", "passed"),
    ];
    expect(judgeDoneClaim({ log, workItemId: "work_slug" })).toMatchObject({
      ok: false,
      failedKinds: ["test-run"],
    });
  });

  it("lets a later verified pass supersede an earlier failure", () => {
    const log = [
      created(),
      evidence("e1", "test-run", "failed"),
      evidence("e3", "test-run", "passed"),
      evidence("e2", "git-status", "passed"),
    ];
    expect(judgeDoneClaim({ log, workItemId: "work_slug" })).toEqual({ ok: true });
  });

  it("refuses an unknown item and an item without a contract", () => {
    expect(judgeDoneClaim({ log: [], workItemId: "work_slug" })).toMatchObject({
      ok: false,
      code: "WORK_ITEM_NOT_FOUND",
    });
    const old = event("event_old", "work.created", {
      workItemId: "work_slug",
      outcome: "x",
      requiredEvidenceKinds: [],
    });
    expect(judgeDoneClaim({ log: [old], workItemId: "work_slug" })).toMatchObject({
      ok: false,
      code: "CONTRACT_MISSING",
    });
  });
});

describe("reconcileRecords (invariant 6)", () => {
  const base = { log: [created()], workItemId: "work_slug", displayedState: "draft" };

  it("agrees when status matches and stream and worktree name the same paths", () => {
    expect(
      reconcileRecords({
        ...base,
        streamedPaths: ["a.ts", "./b.ts"],
        worktreePaths: ["b.ts", "a.ts"],
      }),
    ).toEqual({ ok: true });
  });

  it("hard-stops on a displayed status that differs from the replay", () => {
    const result = reconcileRecords({
      ...base,
      displayedState: "active",
      streamedPaths: [],
      worktreePaths: [],
    });
    expect(result).toMatchObject({
      ok: false,
      hardStop: true,
      mismatches: [{ kind: "STATUS_MISMATCH" }],
    });
  });

  it("hard-stops on a worktree change the stream never showed", () => {
    const result = reconcileRecords({
      ...base,
      streamedPaths: ["a.ts"],
      worktreePaths: ["a.ts", "secret.ts"],
    });
    expect(result).toMatchObject({
      ok: false,
      mismatches: [{ kind: "UNCLAIMED_CHANGE", path: "secret.ts" }],
    });
  });

  it("hard-stops on a streamed change the worktree does not show", () => {
    const result = reconcileRecords({ ...base, streamedPaths: ["a.ts"], worktreePaths: [] });
    expect(result).toMatchObject({
      ok: false,
      mismatches: [{ kind: "CLAIMED_NOT_PRESENT", path: "a.ts" }],
    });
  });

  it("hard-stops when the replay itself reports issues for the item", () => {
    const bad = event("event_bad", "work.transitioned", {
      workItemId: "work_slug",
      fromRevision: 7,
      toState: "ready",
    });
    const result = reconcileRecords({
      ...base,
      log: [created(), bad],
      streamedPaths: [],
      worktreePaths: [],
    });
    expect(result).toMatchObject({ ok: false, mismatches: [{ kind: "REPLAY_ISSUE" }] });
  });

  it("hard-stops on an unknown work item", () => {
    const result = reconcileRecords({
      ...base,
      log: [],
      streamedPaths: [],
      worktreePaths: [],
    });
    expect(result).toMatchObject({ ok: false, mismatches: [{ kind: "WORK_ITEM_NOT_FOUND" }] });
  });
});

describe("judgeDoneClaim: canonical order, not file order", () => {
  it("lets the later-in-time verified failure win even when it was written first", () => {
    const early = {
      ...evidence("e1", "test-run", "passed"),
      occurredAt: "2026-10-04T10:00:10.000Z",
    };
    const late = {
      ...evidence("e3", "test-run", "failed"),
      occurredAt: "2026-10-04T10:00:20.000Z",
    };
    const git = evidence("e2", "git-status", "passed");
    // File order puts the passing record last; time order puts the failure last.
    const log = [created(), late, early, git];
    expect(judgeDoneClaim({ log, workItemId: "work_slug" })).toMatchObject({
      ok: false,
      failedKinds: ["test-run"],
    });
  });
});
