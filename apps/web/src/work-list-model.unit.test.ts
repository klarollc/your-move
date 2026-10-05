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
    expect(model.items[0]?.evidence).toContainEqual({
      kind: "test-run",
      result: "passed",
      eventId: "event_model_8",
      outputSha256: "a".repeat(64),
    });
    expect(model.assignments).toEqual([
      { roleAssignmentId: "role-assignment_engineer", label: "Engineer · agent_engineer" },
    ]);
  });
});
