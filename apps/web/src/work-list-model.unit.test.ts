import { describe, expect, it } from "vitest";

import { projectWorkList } from "./work-list-model.js";

const at = (n: number) => new Date(Date.parse("2026-10-04T10:00:00.000Z") + n * 1000).toISOString();
const event = (
  n: number,
  kind: string,
  payload: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  schemaVersion: 1,
  eventId: `event_model_${String(n)}`,
  projectId: "project_surface_b",
  kind,
  occurredAt: at(n),
  receivedAt: at(n),
  source: "system",
  trust: "verified",
  payload,
  ...extra,
});

const contract = {
  outcome: "Implement slugify",
  exclusions: ["Do not edit the test"],
  acceptanceCriteria: ["The test passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Owner-run test output" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["Stop if the granted posture differs"],
  definitionOfDone: "The manager reviews the evidence",
  contextRefs: [],
};

const events = [
  event(1, "agent.registered", {
    agentId: "agent_engineer",
    capabilities: ["engineer"],
    health: "connected",
  }),
  event(2, "role.assigned", {
    roleAssignmentId: "role-assignment_engineer",
    roleId: "engineer",
    agentId: "agent_engineer",
    requiredCapabilities: ["engineer"],
  }),
  event(
    3,
    "work.created",
    {
      payloadVersion: 2,
      workItemId: "work_slugify",
      outcome: contract.outcome,
      requiredEvidenceKinds: ["test-run"],
      contract,
    },
    { source: "manager" },
  ),
  event(
    4,
    "work.transitioned",
    {
      workItemId: "work_slugify",
      fromRevision: 0,
      toState: "ready",
    },
    { source: "manager", workItemId: "work_slugify" },
  ),
  event(
    5,
    "work.assigned",
    {
      workItemId: "work_slugify",
      roleAssignmentId: "role-assignment_engineer",
    },
    { source: "manager", workItemId: "work_slugify", roleAssignmentId: "role-assignment_engineer" },
  ),
  event(
    6,
    "work.transitioned",
    {
      workItemId: "work_slugify",
      fromRevision: 1,
      toState: "assigned",
    },
    { source: "manager", workItemId: "work_slugify" },
  ),
  event(
    7,
    "evidence.recorded",
    {
      evidenceId: "evidence_partial_turn",
      workItemId: "work_slugify",
      kind: "turn-record",
      version: 1,
      result: "failed",
      partial: true,
    },
    { source: "adapter", workItemId: "work_slugify" },
  ),
  event(
    8,
    "evidence.recorded",
    {
      evidenceId: "evidence_test_run",
      workItemId: "work_slugify",
      kind: "test-run",
      version: 1,
      result: "passed",
      outputSha256: "a".repeat(64),
    },
    { source: "manager", workItemId: "work_slugify" },
  ),
];

describe("Surface B canonical list projection", () => {
  it("replays work, assignment and partial evidence from the shared event log", () => {
    const model = projectWorkList(events, "2026-10-04T10:01:00.000Z");
    expect(model.revision).toBe(8);
    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({
      workItemId: "work_slugify",
      outcome: "Implement slugify",
      state: "assigned",
      assignee: "Engineer · agent_engineer",
      partial: true,
      contractAcceptsEvidence: true,
    });
    expect(model.items[0]?.sourceRevision).toBe(6);
    expect(model.items[0]?.evidence).toContainEqual(
      expect.objectContaining({
        kind: "test-run",
        result: "passed",
        eventId: "event_model_8",
        status: "checked",
        source: "manager",
        trust: "verified",
        sourceRevision: 8,
        outputSha256: "a".repeat(64),
        providerRunId: null,
        worktreeSha256: null,
      }),
    );
    expect(model.assignments).toEqual([
      expect.objectContaining({
        roleAssignmentId: "role-assignment_engineer",
        label: "Engineer · agent_engineer",
        sourceRevision: 2,
        source: "system",
        trust: "verified",
      }),
    ]);
  });

  it("keeps a reported done claim distinct and exposes absent provenance as missing", () => {
    const claim = event(
      9,
      "evidence.recorded",
      {
        evidenceId: "evidence_done_claim",
        workItemId: "work_slugify",
        kind: "done-claim",
        version: 1,
        result: "passed",
      },
      { source: "adapter", trust: "reported", providerRunId: "run_slugify_1" },
    );
    const model = projectWorkList([...events, claim], { revision: 9 });
    const evidence = model.items[0]?.evidence.find((entry) => entry.eventId === "event_model_9");

    expect(evidence).toMatchObject({
      status: "claimed",
      source: "adapter",
      trust: "reported",
      providerRunId: "run_slugify_1",
      worktreeSha256: null,
      sourceRevision: 9,
    });
  });

  it("reports disagreement between the server revision and the projected log prefix", () => {
    const model = projectWorkList(events, {
      revision: 10,
      fetchedAt: "2026-10-04T10:01:00.000Z",
      now: "2026-10-04T10:02:00.000Z",
    });

    expect(model.health).toMatchObject({
      status: "disagreement",
      revision: 10,
      projectedRevision: 8,
      ageMs: 60_000,
    });
  });

  it("keeps log damage explicit instead of projecting a healthy read", () => {
    const model = projectWorkList(events, {
      revision: 8,
      problems: [{ code: "MALFORMED_EVENT", revision: 5 }],
    });

    expect(model.health).toMatchObject({ status: "damaged", issueCount: 1 });
  });

  it("derives the your-move group from canonical attention and records its waiting age", () => {
    const failed = event(
      9,
      "work.transitioned",
      { workItemId: "work_slugify", fromRevision: 2, toState: "failed" },
      { source: "adapter", workItemId: "work_slugify" },
    );
    const model = projectWorkList([...events, failed], { now: at(100) });

    expect(model.items[0]).toMatchObject({
      workItemId: "work_slugify",
      group: "your-move",
      attentionReason: "failed",
      waitingMs: 91_000,
      lastSignalRevision: 9,
    });
  });

  it("projects the accepted agreement and condition provenance for focused decisions", () => {
    const active = event(
      9,
      "work.transitioned",
      { payloadVersion: 3, workItemId: "work_slugify", fromRevision: 2, toState: "active" },
      { source: "adapter", trust: "reported", workItemId: "work_slugify" },
    );
    const review = event(
      10,
      "work.transitioned",
      {
        payloadVersion: 3,
        workItemId: "work_slugify",
        fromRevision: 3,
        toState: "review_requested",
        condition: {
          reasonCode: "review_requested",
          summary: "Evidence is ready for the manager.",
          waitingOn: { kind: "manager" },
          requestedAction: { kind: "approve", summary: "Accept or redirect this work." },
        },
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const model = projectWorkList([...events, active, review]);

    expect(model.items[0]).toMatchObject({
      contract: {
        outcome: "Implement slugify",
        exclusions: ["Do not edit the test"],
        acceptanceCriteria: ["The test passes"],
        dependencies: [],
        stopConditions: ["Stop if the granted posture differs"],
        definitionOfDone: "The manager reviews the evidence",
      },
      condition: {
        reasonCode: "review_requested",
        summary: "Evidence is ready for the manager.",
        source: "manager",
        trust: "verified",
        sourceRevision: 10,
      },
    });
    expect(model.log.at(-1)).toMatchObject({
      revision: 10,
      summary: "review_requested · Evidence is ready for the manager.",
    });
  });

  it("does not put a completed state in Done unless the latest evidence for every obligation is checked and passing", () => {
    const active = event(
      9,
      "work.transitioned",
      { payloadVersion: 3, workItemId: "work_slugify", fromRevision: 2, toState: "active" },
      { source: "adapter", trust: "reported", workItemId: "work_slugify" },
    );
    const unverifiedPass = event(
      10,
      "evidence.recorded",
      {
        evidenceId: "evidence_unverified",
        workItemId: "work_slugify",
        kind: "test-run",
        version: 2,
        result: "passed",
      },
      { source: "adapter", trust: "reported", workItemId: "work_slugify" },
    );
    const review = event(
      11,
      "work.transitioned",
      {
        payloadVersion: 3,
        workItemId: "work_slugify",
        fromRevision: 3,
        toState: "review_requested",
        condition: {
          reasonCode: "review_requested",
          summary: "Ready for review.",
          waitingOn: { kind: "manager" },
          requestedAction: { kind: "approve", summary: "Review the evidence." },
        },
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const verified = event(
      12,
      "work.transitioned",
      { payloadVersion: 3, workItemId: "work_slugify", fromRevision: 4, toState: "verified" },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const cleanEvidenceEvents = events.filter((entry) => entry.eventId !== "event_model_7");
    const model = projectWorkList(
      [...cleanEvidenceEvents, active, unverifiedPass, review, verified],
      { now: at(20) },
    );

    expect(model.items[0]).toMatchObject({
      state: "verified",
      doneVerified: false,
      group: "other",
    });
  });

  it("raises a failed evidence result as a blocker and keeps its recorded provenance", () => {
    const failed = event(
      9,
      "evidence.recorded",
      {
        evidenceId: "evidence_failed",
        workItemId: "work_slugify",
        kind: "test-run",
        version: 2,
        result: "failed",
        outputSha256: "b".repeat(64),
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const model = projectWorkList([...events, failed], { now: at(20) });

    expect(model.items[0]).toMatchObject({
      group: "your-move",
      attentionReason: "verification_failed",
      hasEvidenceFailure: true,
      waitingMs: 11_000,
    });
    expect(model.items[0]?.evidence.at(-1)).toMatchObject({
      result: "failed",
      source: "manager",
      trust: "verified",
      outputSha256: "b".repeat(64),
    });
  });

  it("derives resurface-due from the defer event and the requested projection clock", () => {
    const deferred = event(
      9,
      "work.ruling_recorded",
      {
        workItemId: "work_slugify",
        rulingId: "ruling_defer_1",
        decision: "defer",
        sourceWorkRevision: 2,
        evidenceVersions: [{ evidenceId: "evidence_test_run", version: 1 }],
        reason: "Waiting for the maintainer",
        resurfaceAt: at(15),
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );

    const withoutFailure = events.filter((entry) => entry.eventId !== "event_model_7");
    const beforeDue = projectWorkList([...withoutFailure, deferred], { now: at(14) });
    const atDue = projectWorkList([...withoutFailure, deferred], { now: at(15) });

    expect(beforeDue.items[0]?.resurface).toMatchObject({ at: at(15), due: false });
    expect(atDue.items[0]?.resurface).toMatchObject({ at: at(15), due: true });
    expect(atDue.items[0]).toMatchObject({
      group: "your-move",
      attentionReason: "resurface_due",
      waitingMs: 0,
    });
    expect(atDue.log.some((entry) => entry.kind === "work.resurfaced")).toBe(false);
  });

  it("projects nudge suppression and manager waiting age from recorded events", () => {
    const review = event(
      9,
      "work.transitioned",
      {
        payloadVersion: 3,
        workItemId: "work_slugify",
        fromRevision: 2,
        toState: "review_requested",
        condition: {
          reasonCode: "review_requested",
          summary: "The evidence is ready for your decision.",
          waitingOn: { kind: "manager" },
        },
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const suppressedAt = at(10);
    const suppressed = event(
      10,
      "work.nudge_suppressed",
      {
        workItemId: "work_slugify",
        disposition: "snooze",
        until: new Date(Date.parse(suppressedAt) + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const model = projectWorkList([...events, review, suppressed], {
      now: new Date(Date.parse(suppressedAt) + 60_000).toISOString(),
    });

    expect(model.items[0]).toMatchObject({
      group: "your-move",
      waitingMs: 63_000,
      nudgeSuppression: {
        disposition: "snooze",
        eventId: "event_model_10",
      },
    });
  });

  it("retains both full contract revisions for an assignee-visible rescope diff", () => {
    const replacement = {
      ...contract,
      outcome: "Implement slugify with Unicode normalization",
      maxTurns: 4,
    };
    const rescope = event(
      9,
      "work.rescoped",
      {
        workItemId: "work_slugify",
        expectedContractRevision: 1,
        contractRevision: 2,
        contract: replacement,
      },
      { source: "manager", trust: "verified", workItemId: "work_slugify" },
    );
    const model = projectWorkList([...events, rescope]);

    expect(model.items[0]).toMatchObject({
      contract: replacement,
      contractHistory: [
        { revision: 1, eventId: "event_model_3", contract },
        { revision: 2, eventId: "event_model_9", contract: replacement },
      ],
    });
  });
});
