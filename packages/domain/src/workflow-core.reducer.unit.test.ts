import { describe, expect, it } from "vitest";

import { stableStringify } from "./canonical-json.js";
import { replayProject } from "./replay.js";

const BASE = Date.parse("2026-10-04T12:00:00.000Z");
const at = (offsetMs: number) => new Date(BASE + offsetMs).toISOString();

const contract = (maxTurns = 2, over: Record<string, unknown> = {}) => ({
  outcome: "Complete the bounded change",
  exclusions: [],
  acceptanceCriteria: ["verified test evidence passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Run the focused test suite" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["the turn cap is reached"],
  definitionOfDone: "the manager rules on checked evidence",
  contextRefs: [],
  maxTurns,
  ...over,
});

const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  offsetMs: number,
  source = "manager",
  extra: Record<string, unknown> = {},
) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  workItemId: "work_alpha",
  kind,
  occurredAt: at(offsetMs),
  receivedAt: at(offsetMs),
  source,
  trust: "verified",
  payload,
  ...extra,
});

const created = (maxTurns = 2) =>
  event(
    "event_created",
    "work.created",
    {
      payloadVersion: 3,
      workItemId: "work_alpha",
      outcome: "Complete the bounded change",
      requiredEvidenceKinds: ["test-run"],
      contract: contract(maxTurns),
    },
    0,
  );

const posture = (runId: string, offsetMs: number) =>
  event(
    `event_posture_${runId}`,
    "posture.recorded",
    {
      workItemId: "work_alpha",
      runId,
      posture: {
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
          multiAgentMode: "explicitRequestOnly",
        },
        declared: {
          kind: "declared",
          read: "possible",
          write: "possible",
          run: "possible",
          basis: ["runner posture read-back"],
          observed: null,
        },
        match: true,
        differences: [],
      },
    },
    offsetMs,
    "adapter",
    { providerRunId: runId },
  );

const turn = (runId: string, number: number, offsetMs: number, partial = false) =>
  event(
    `event_turn_${runId}_${String(number)}`,
    "evidence.recorded",
    {
      evidenceId: `evidence_${runId}_${String(number)}`,
      workItemId: "work_alpha",
      kind: "turn-record",
      version: 1,
      result: partial ? "failed" : "passed",
      turn: number,
      partial,
      ...(partial ? { partialReasons: ["the stream closed before the turn finished"] } : {}),
    },
    offsetMs,
    "adapter",
    { providerRunId: runId },
  );

const toReview = () => [
  event("event_ready", "work.transitioned", { workItemId: "work_alpha", fromRevision: 0, toState: "ready" }, 1000),
  event("event_assigned", "work.transitioned", { workItemId: "work_alpha", fromRevision: 1, toState: "assigned" }, 2000),
  event("event_active", "work.transitioned", { workItemId: "work_alpha", fromRevision: 2, toState: "active" }, 3000),
  event(
    "event_evidence_v1",
    "evidence.recorded",
    { evidenceId: "evidence_test", workItemId: "work_alpha", kind: "test-run", version: 1, result: "failed" },
    4000,
    "manager",
  ),
  event(
    "event_evidence_v2",
    "evidence.recorded",
    { evidenceId: "evidence_test", workItemId: "work_alpha", kind: "test-run", version: 2, result: "passed" },
    4500,
    "manager",
  ),
  event("event_review", "work.transitioned", { workItemId: "work_alpha", fromRevision: 3, toState: "review_requested" }, 5000),
];

const accept = () =>
  event(
    "event_ruling_alpha",
    "work.ruling_recorded",
    {
      workItemId: "work_alpha",
      rulingId: "ruling_alpha",
      decision: "accept",
      sourceWorkRevision: 4,
      evidenceVersions: [{ evidenceId: "evidence_test", version: 2 }],
    },
    6000,
  );

describe("workflow-core reducer", () => {
  it("replays rescope and grants in canonical order with stable contract history", () => {
    const log = [
      created(),
      event(
        "event_rescope",
        "work.rescoped",
        {
          workItemId: "work_alpha",
          expectedContractRevision: 1,
          contractRevision: 2,
          contract: contract(3, {
            outcome: "Complete the rescaled change",
            acceptanceCriteria: ["verified integration evidence passes"],
          }),
        },
        1000,
      ),
      event(
        "event_grant",
        "work.turns_granted",
        { workItemId: "work_alpha", turnsGranted: 2, budgetRevision: 2 },
        2000,
      ),
    ];
    const forward = stableStringify(replayProject(log).work);
    const reversed = stableStringify(replayProject([...log].reverse()).work);
    expect(reversed).toBe(forward);
    expect(replayProject(log).work.workItems.work_alpha).toMatchObject({
      contractRevision: 2,
      contractHistory: [
        { revision: 1, eventId: "event_created" },
        { revision: 2, eventId: "event_rescope" },
      ],
      contract: { outcome: "Complete the rescaled change", maxTurns: 3 },
      turnBudget: { budgetRevision: 3, effectiveMaxTurns: 5 },
    });
    expect(replayProject(log).work.issues).toEqual([]);
  });

  it("preserves earlier evidence versions while the ruling binds the latest passing version", () => {
    const log = [created(), ...toReview(), accept()];
    const work = replayProject(log).work;
    expect(work.evidence.evidence_test).toMatchObject({ version: 2, result: "passed" });
    expect(work.evidenceHistory?.work_alpha?.map(({ version }) => version)).toEqual([1, 2]);
    expect(work.rulings?.ruling_alpha).toMatchObject({
      decision: "accept",
      evidenceVersions: [{ evidenceId: "evidence_test", version: 2 }],
      previousState: "review_requested",
      withdrawn: false,
    });
    expect(work.workItems.work_alpha?.state).toBe("verified");
    expect(work.issues).toEqual([]);
  });

  it("derives a defer's due state from its logged time and the supplied projection time", () => {
    const log = [
      created(),
      event(
        "event_defer",
        "work.ruling_recorded",
        {
          workItemId: "work_alpha",
          rulingId: "ruling_defer",
          decision: "defer",
          sourceWorkRevision: 0,
          evidenceVersions: [],
          reason: "Wait for the upstream dependency.",
          resurfaceAt: at(10_000),
        },
        1000,
      ),
    ];
    expect(replayProject(log, { asOf: at(9_999) }).work.workItems.work_alpha).toMatchObject({
      state: "paused",
      resurface: { at: at(10_000), due: false, projectedAt: at(9_999) },
    });
    expect(replayProject(log, { asOf: at(10_000) }).work.workItems.work_alpha).toMatchObject({
      resurface: { due: true, projectedAt: at(10_000) },
    });
  });

  it("counts unique verified bridge attempts, including partial turns, against the effective cap", () => {
    const first = turn("run_1", 1, 2000, true);
    const log = [created(2), posture("run_1", 1000), first, turn("run_1", 2, 3000)];
    expect(replayProject([...log, first]).work.workItems.work_alpha?.turnBudget).toMatchObject({
      usedTurns: 2,
      effectiveMaxTurns: 2,
      exhausted: true,
      countComplete: true,
    });

    const granted = [
      ...log,
      event(
        "event_grant",
        "work.turns_granted",
        { workItemId: "work_alpha", turnsGranted: 2, budgetRevision: 1 },
        4000,
      ),
    ];
    expect(replayProject(granted).work.workItems.work_alpha?.turnBudget).toMatchObject({
      usedTurns: 2,
      effectiveMaxTurns: 4,
      exhausted: false,
      remainingTurns: 2,
      budgetRevision: 2,
    });
  });

  it("keeps missing or contradictory turn streams unknown, and never infers a legacy cap", () => {
    const missing = replayProject([created(2), posture("run_missing", 1000)]).work;
    expect(missing.workItems.work_alpha?.turnBudget).toMatchObject({
      usedTurns: null,
      exhausted: null,
      countComplete: false,
    });

    const legacy = event(
      "event_legacy",
      "work.created",
      {
        payloadVersion: 2,
        workItemId: "work_alpha",
        outcome: "Old contract",
        requiredEvidenceKinds: ["test-run"],
        contract: { ...contract() },
      },
      0,
    );
    const noCap = replayProject([legacy, posture("run_old", 1000), turn("run_old", 1, 2000)]).work;
    expect(noCap.workItems.work_alpha?.turnBudget).toMatchObject({
      effectiveMaxTurns: null,
      exhausted: null,
      budgetRecorded: false,
    });
  });

  it("withdraws an unchanged ruling within 60 seconds by appending a compensating event", () => {
    const evidenceVersions = [{ evidenceId: "evidence_test", version: 2 }];
    const withdrawn = event(
      "event_withdrawal",
      "ruling.withdrawn",
      { workItemId: "work_alpha", rulingId: "ruling_alpha", evidenceVersions },
      36_000,
    );
    const work = replayProject([created(), ...toReview(), accept(), withdrawn]).work;
    expect(work.workItems.work_alpha?.state).toBe("review_requested");
    expect(work.workItems.work_alpha?.revision).toBe(6);
    expect(work.evidence.evidence_test).toMatchObject({ version: 2, result: "passed" });
    expect(work.rulings?.ruling_alpha).toMatchObject({
      withdrawn: true,
      withdrawnByEventId: "event_withdrawal",
    });
    expect(work.issues).toEqual([]);
  });

  it("refuses withdrawal after an intervening evidence version or work transition", () => {
    const evidenceVersions = [{ evidenceId: "evidence_test", version: 2 }];
    const withdrawal = event(
      "event_withdrawal",
      "ruling.withdrawn",
      { workItemId: "work_alpha", rulingId: "ruling_alpha", evidenceVersions },
      36_000,
    );
    const changedEvidence = event(
      "event_evidence_v3",
      "evidence.recorded",
      { evidenceId: "evidence_test", workItemId: "work_alpha", kind: "test-run", version: 3, result: "failed" },
      7000,
    );
    const afterEvidence = replayProject([
      created(),
      ...toReview(),
      accept(),
      changedEvidence,
      withdrawal,
    ]).work;
    expect(afterEvidence.workItems.work_alpha?.state).toBe("verified");
    expect(afterEvidence.rulings?.ruling_alpha?.withdrawn).toBe(false);
    expect(afterEvidence.issues.map(({ code }) => code)).toContain("RULING_WITHDRAWAL_REFUSED");

    const completed = event(
      "event_completed",
      "work.transitioned",
      { workItemId: "work_alpha", fromRevision: 5, toState: "completed" },
      7000,
    );
    const afterWorkChange = replayProject([created(), ...toReview(), accept(), completed, withdrawal]).work;
    expect(afterWorkChange.workItems.work_alpha?.state).toBe("completed");
    expect(afterWorkChange.rulings?.ruling_alpha?.withdrawn).toBe(false);
    expect(afterWorkChange.issues.map(({ code }) => code)).toContain("RULING_WITHDRAWAL_REFUSED");
  });
});
