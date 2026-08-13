import { describe, expect, it } from "vitest";

import { evaluateRoleOffer } from "./role-offers.js";

const offer = {
  offerId: "offer_1",
  agentId: "agent_1",
  roleId: "implementation-engineer",
  roleContractVersion: "agency-overlay-1",
  overlayDiff: ["TDD required", "project-root only"],
  qualificationOutcome: "passed" as const,
  qualificationEvidenceIds: ["evidence_1"],
  permissionCeiling: ["project.read", "project.write"],
  prohibitedActions: ["deploy", "publish"],
  workload: { activeRoles: 0, capacity: "available" },
  conflicts: [],
};

describe("reciprocal role offers", () => {
  it("requires a complete offer before an agent response", () => {
    expect(() =>
      evaluateRoleOffer({
        offer: { ...offer, permissionCeiling: [] },
        response: { kind: "accept" },
        manager: { decision: "assign", managerId: "manager_1", reason: "Approved" },
        existingAssignments: [],
        independentReviewerId: "reviewer_1",
      }),
    ).toThrow("INCOMPLETE_ROLE_OFFER");
  });

  it.each([
    { kind: "rank" as const, rankedRoleIds: ["test-engineer", "implementation-engineer"] },
    { kind: "request_reassignment" as const, reason: "Prefer test responsibility" },
    { kind: "decline" as const, category: "capacity" as const, reason: "Current workload" },
  ])("keeps a $kind response auditable and the role vacant", (response) => {
    const result = evaluateRoleOffer({
      offer,
      response,
      manager: { decision: "defer", managerId: "manager_1", reason: "Recorded" },
      existingAssignments: [],
      independentReviewerId: "reviewer_1",
    });

    expect(result.assignment).toBeUndefined();
    expect(result.roleVacant).toBe(true);
    expect(result.auditEvents.map(({ kind }) => kind)).toEqual([
      "role.offer_recorded",
      "role.response_recorded",
      "role.assignment_decided",
    ]);
    expect(result.managerView.actionableFacts).toEqual(result.candidateView.actionableFacts);
  });

  it("assigns only after acceptance and manager approval", () => {
    const result = evaluateRoleOffer({
      offer,
      response: { kind: "accept" },
      manager: { decision: "assign", managerId: "manager_1", reason: "Approved" },
      existingAssignments: [],
      independentReviewerId: "reviewer_1",
    });

    expect(result.assignment).toEqual({
      roleAssignmentId: "role-assignment_offer_1",
      roleId: "implementation-engineer",
      agentId: "agent_1",
    });
    expect(result.roleVacant).toBe(false);
  });

  it("blocks dual roles, reviewer conflict, and agent-chosen replacements", () => {
    expect(
      evaluateRoleOffer({
        offer,
        response: { kind: "accept" },
        manager: { decision: "assign", managerId: "manager_1", reason: "Approved" },
        existingAssignments: [{ roleId: "delivery-lead", agentId: "agent_1" }],
        independentReviewerId: "reviewer_1",
      }).blockingReasons,
    ).toContain("DUAL_ROLE_FORBIDDEN");
    expect(
      evaluateRoleOffer({
        offer,
        response: { kind: "accept" },
        manager: { decision: "assign", managerId: "manager_1", reason: "Approved" },
        existingAssignments: [],
        independentReviewerId: "agent_1",
      }).blockingReasons,
    ).toContain("REVIEWER_CONFLICT");
    expect(() =>
      evaluateRoleOffer({
        offer,
        response: {
          kind: "decline",
          category: "fit",
          reason: "Mismatch",
          replacementAgentId: "agent_2",
        },
        manager: { decision: "defer", managerId: "manager_1", reason: "Recorded" },
        existingAssignments: [],
        independentReviewerId: "reviewer_1",
      }),
    ).toThrow("AGENT_REPLACEMENT_FORBIDDEN");
  });
});
