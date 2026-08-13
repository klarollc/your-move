import { describe, expect, it } from "vitest";

import {
  buildReciprocalTrustViews,
  decideRoleActivation,
  evaluateTrustQualification,
} from "./runtime-trust.js";

const facts = {
  candidateId: "agent_1",
  bindingId: "binding_1",
  roleId: "delivery-lead",
  permissionCeiling: ["project.read", "project.write"],
  prohibitedActions: ["deploy", "publish"],
  qualificationEvidenceIds: ["evidence_1"],
  decision: { status: "deferred" as const, reason: "Independent review pending" },
  nextActions: ["complete_independent_review"],
};

describe("runtime trust policy", () => {
  it("never lets an exception waive a mandatory failure", () => {
    expect(
      evaluateTrustQualification({
        checks: [
          { checkId: "identity", mandatory: true, passed: false },
          { checkId: "style", mandatory: false, passed: false },
        ],
        exceptions: [
          { checkId: "identity", expiresAt: "2026-09-01T00:00:00.000Z" },
          { checkId: "style", expiresAt: "2026-09-01T00:00:00.000Z" },
        ],
      }),
    ).toEqual({
      qualified: false,
      blockingCheckIds: ["identity"],
      exceptedCheckIds: ["style"],
    });
  });

  it("does not treat universal admission as role activation", () => {
    expect(
      decideRoleActivation({
        universalAdmission: "passed",
        roleQualification: "missing",
        independentReview: "missing",
        managerDecision: "approved",
      }),
    ).toEqual({ active: false, reason: "ROLE_QUALIFICATION_REQUIRED" });
  });

  it("gives manager and candidate the same actionable trust facts", () => {
    const views = buildReciprocalTrustViews(facts);

    expect(views.manager.actionableFacts).toEqual(views.candidate.actionableFacts);
    expect(views.candidate.actionableFacts).toEqual(facts);
  });
});
