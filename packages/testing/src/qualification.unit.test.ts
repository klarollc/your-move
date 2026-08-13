import { describe, expect, it } from "vitest";

import {
  REQUIRED_UNIVERSAL_CHECKS,
  decideUniversalAdmission,
  runUniversalAdmission,
} from "./qualification.js";

function passingInput() {
  return {
    candidateId: "agent_1",
    bindingId: "binding_1",
    bindingFingerprint: "a".repeat(64),
    suiteVersion: "universal-1",
    permissionFingerprint: "b".repeat(64),
    validUntil: 100,
    evaluatedAt: 50,
    revoked: false,
    stale: false,
    checks: REQUIRED_UNIVERSAL_CHECKS.map((checkId) => ({
      checkId,
      passed: true,
      evidence: { artifactId: `artifact_${checkId}`, hash: "c".repeat(64) },
    })),
  };
}

describe("universal Candidate admission", () => {
  it("replays complete mandatory evidence to a stable hash", () => {
    const first = runUniversalAdmission(passingInput());
    const second = runUniversalAdmission(passingInput());

    expect(first).toEqual(second);
    expect(first).toMatchObject({ findingsPassed: true, eligibleForManagerAdmission: true });
    expect(first.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.checks).toHaveLength(10);
  });

  it("keeps findings separate from the manager disposition", () => {
    const findings = runUniversalAdmission(passingInput());

    expect(
      decideUniversalAdmission(findings, { decision: "defer", reason: "Review pending" }),
    ).toEqual({
      lifecycle: "candidate",
      managerDecision: "defer",
      reason: "Review pending",
    });
    expect(
      decideUniversalAdmission(findings, { decision: "admit", reason: "Evidence accepted" }),
    ).toEqual({
      lifecycle: "available",
      managerDecision: "admit",
      reason: "Evidence accepted",
    });
  });

  const base = passingInput();
  const invalidEvidence = [
    { label: "missing", input: { ...base, checks: base.checks.slice(1) } },
    {
      label: "failed",
      input: {
        ...base,
        checks: base.checks.map((check, index) =>
          index === 0 ? { ...check, passed: false } : check,
        ),
      },
    },
    { label: "expired", input: { ...base, evaluatedAt: 101 } },
    { label: "revoked", input: { ...base, revoked: true } },
    { label: "stale", input: { ...base, stale: true } },
  ];

  it.each(invalidEvidence)("does not admit $label evidence", ({ input }) => {
    const findings = runUniversalAdmission(input);
    expect(findings.eligibleForManagerAdmission).toBe(false);
    expect(
      decideUniversalAdmission(findings, { decision: "admit", reason: "Attempted" }).lifecycle,
    ).toBe("candidate");
  });
});
