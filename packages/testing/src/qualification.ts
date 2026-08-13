import { createHash } from "node:crypto";

import { stableStringify } from "@cuckcode/domain";

export const REQUIRED_UNIVERSAL_CHECKS = [
  "protocol-handshake",
  "identity",
  "event-correlation",
  "cancellation",
  "permission-denial-escalation",
  "project-root-secret-isolation",
  "context-disclosure",
  "health-recovery",
  "knowledge-citation",
  "deterministic-synthetic-completion",
] as const;

type UniversalCheckId = (typeof REQUIRED_UNIVERSAL_CHECKS)[number];
type Evidence = { artifactId: string; hash: string };

export type UniversalAdmissionFindings = {
  candidateId: string;
  bindingId: string;
  suiteVersion: string;
  permissionFingerprint: string;
  checks: { checkId: UniversalCheckId; passed: boolean; evidence: Evidence | null }[];
  findingsPassed: boolean;
  eligibleForManagerAdmission: boolean;
  evidenceHash: string;
};

export function runUniversalAdmission(input: {
  candidateId: string;
  bindingId: string;
  bindingFingerprint: string;
  suiteVersion: string;
  permissionFingerprint: string;
  validUntil: number;
  evaluatedAt: number;
  revoked: boolean;
  stale: boolean;
  checks: readonly { checkId: string; passed: boolean; evidence: Evidence }[];
}): UniversalAdmissionFindings {
  const supplied = new Map(input.checks.map((check) => [check.checkId, check]));
  const checks = REQUIRED_UNIVERSAL_CHECKS.map((checkId) => {
    const check = supplied.get(checkId);
    return {
      checkId,
      passed: check?.passed === true,
      evidence: check?.evidence ?? null,
    };
  });
  const exactSet =
    input.checks.length === REQUIRED_UNIVERSAL_CHECKS.length &&
    input.checks.every(({ checkId }) =>
      REQUIRED_UNIVERSAL_CHECKS.includes(checkId as UniversalCheckId),
    );
  const findingsPassed = exactSet && checks.every(({ passed, evidence }) => passed && evidence);
  const eligibleForManagerAdmission =
    findingsPassed && !input.revoked && !input.stale && input.evaluatedAt <= input.validUntil;
  const evidenceRecord = {
    candidateId: input.candidateId,
    bindingId: input.bindingId,
    bindingFingerprint: input.bindingFingerprint,
    suiteVersion: input.suiteVersion,
    permissionFingerprint: input.permissionFingerprint,
    validUntil: input.validUntil,
    evaluatedAt: input.evaluatedAt,
    revoked: input.revoked,
    stale: input.stale,
    checks,
  };
  return {
    candidateId: input.candidateId,
    bindingId: input.bindingId,
    suiteVersion: input.suiteVersion,
    permissionFingerprint: input.permissionFingerprint,
    checks,
    findingsPassed,
    eligibleForManagerAdmission,
    evidenceHash: createHash("sha256").update(stableStringify(evidenceRecord)).digest("hex"),
  };
}

export function decideUniversalAdmission(
  findings: UniversalAdmissionFindings,
  manager: { decision: "admit" | "reject" | "defer" | "remediate"; reason: string },
): { lifecycle: "candidate" | "available" | "rejected"; managerDecision: string; reason: string } {
  if (manager.decision === "reject")
    return { lifecycle: "rejected", managerDecision: manager.decision, reason: manager.reason };
  if (manager.decision === "admit" && findings.eligibleForManagerAdmission)
    return { lifecycle: "available", managerDecision: manager.decision, reason: manager.reason };
  return {
    lifecycle: "candidate",
    managerDecision: manager.decision,
    reason:
      manager.decision === "admit"
        ? "Mandatory admission evidence is not current."
        : manager.reason,
  };
}
