import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  runRoleQualification,
  type RoleQualificationInput,
  type RoleQualificationSuite,
} from "./role-qualification.js";

const roleIds = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;

function suite(roleId: (typeof roleIds)[number]): RoleQualificationSuite {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/qualification/${roleId}.json`, import.meta.url), "utf8"),
  ) as RoleQualificationSuite;
}

function input(roleId: (typeof roleIds)[number]): RoleQualificationInput {
  const selected = suite(roleId);
  return {
    candidateId: `agent_${roleId}`,
    reviewerId: `reviewer_${roleId}`,
    bindingId: `binding_${roleId}`,
    bindingFingerprint: "a".repeat(64),
    roleContractVersion: "agency-ebe9c99-overlay-1",
    permissionFingerprint: "b".repeat(64),
    suite: selected,
    universalAdmissionPassed: true,
    checks: selected.rubric.map((criterion) => ({
      checkId: criterion.checkId,
      passed: true,
      evidenceHash: "c".repeat(64),
    })),
    exceptions: [],
    evaluatedAt: 50,
  };
}

describe("six role qualification suites", () => {
  it.each(roleIds)(
    "qualifies %s deterministically against its defining responsibility",
    (roleId) => {
      const first = runRoleQualification(input(roleId));
      const second = runRoleQualification(input(roleId));

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        roleId,
        qualified: true,
        independentlyReviewed: true,
        managerActivationEligible: true,
      });
      expect(first.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(first.definingResponsibility).toBe(suite(roleId).definingResponsibility);
    },
  );

  it("does not let universal admission or self-review activate a role", () => {
    const candidate = input("delivery-lead");
    candidate.reviewerId = candidate.candidateId;
    const result = runRoleQualification(candidate);

    expect(result.qualified).toBe(false);
    expect(result.managerActivationEligible).toBe(false);
    expect(result.blockingReasons).toContain("INDEPENDENT_REVIEW_REQUIRED");
  });

  it("does not waive a mandatory failure", () => {
    const candidate = input("implementation-engineer");
    candidate.checks[0] = { ...candidate.checks[0]!, passed: false };
    candidate.exceptions = [
      {
        exceptionId: "exception_1",
        checkId: candidate.checks[0]!.checkId,
        scope: "synthetic root only",
        residualRisk: "test may fail",
        compensatingControl: "manual review",
        ownerId: "manager_1",
        expiresAt: 100,
        affectedVersions: [
          candidate.suite.suiteVersion,
          candidate.roleContractVersion,
          candidate.bindingFingerprint,
          candidate.permissionFingerprint,
        ],
      },
    ];

    expect(runRoleQualification(candidate)).toMatchObject({
      qualified: false,
      blockingCheckIds: [candidate.checks[0]!.checkId],
    });
  });

  it("accepts only complete current non-chained advisory exceptions", () => {
    const candidate = input("test-engineer");
    const advisory = candidate.suite.rubric.find((criterion) => !criterion.mandatory)!;
    candidate.checks = candidate.checks.map((check) =>
      check.checkId === advisory.checkId ? { ...check, passed: false } : check,
    );
    candidate.exceptions = [
      {
        exceptionId: "exception_1",
        checkId: advisory.checkId,
        scope: "synthetic root only",
        residualRisk: "slower suite",
        compensatingControl: "serial execution",
        ownerId: "manager_1",
        expiresAt: 100,
        affectedVersions: [
          candidate.suite.suiteVersion,
          candidate.roleContractVersion,
          candidate.bindingFingerprint,
          candidate.permissionFingerprint,
        ],
      },
    ];
    expect(runRoleQualification(candidate).qualified).toBe(true);

    candidate.exceptions[0] = { ...candidate.exceptions[0]!, parentExceptionId: "exception_0" };
    expect(runRoleQualification(candidate).qualified).toBe(false);
  });
});
