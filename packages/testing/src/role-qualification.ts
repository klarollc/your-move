import { createHash } from "node:crypto";

import { stableStringify } from "@cuckcode/domain";

export type RoleQualificationSuite = {
  roleId: string;
  suiteVersion: string;
  definingResponsibility: string;
  prohibitedShortcuts: string[];
  rubric: { checkId: string; mandatory: boolean }[];
};

export type QualificationException = {
  exceptionId: string;
  checkId: string;
  scope: string;
  residualRisk: string;
  compensatingControl: string;
  ownerId: string;
  expiresAt: number;
  affectedVersions: string[];
  parentExceptionId?: string;
};

export type RoleQualificationInput = {
  candidateId: string;
  reviewerId: string;
  bindingId: string;
  bindingFingerprint: string;
  roleContractVersion: string;
  permissionFingerprint: string;
  suite: RoleQualificationSuite;
  universalAdmissionPassed: boolean;
  checks: { checkId: string; passed: boolean; evidenceHash: string }[];
  exceptions: QualificationException[];
  evaluatedAt: number;
};

export function runRoleQualification(input: RoleQualificationInput) {
  const supplied = new Map(input.checks.map((check) => [check.checkId, check]));
  const blockingCheckIds: string[] = [];
  const exceptedCheckIds: string[] = [];
  const blockingReasons: string[] = [];
  const expectedVersions = [
    input.suite.suiteVersion,
    input.roleContractVersion,
    input.bindingFingerprint,
    input.permissionFingerprint,
  ].sort();

  if (!input.universalAdmissionPassed) blockingReasons.push("UNIVERSAL_ADMISSION_REQUIRED");
  if (input.reviewerId === input.candidateId) blockingReasons.push("INDEPENDENT_REVIEW_REQUIRED");
  if (
    input.checks.length !== input.suite.rubric.length ||
    input.checks.some(
      (check) => !input.suite.rubric.some(({ checkId }) => checkId === check.checkId),
    )
  )
    blockingReasons.push("RUBRIC_EVIDENCE_INCOMPLETE");

  const checks = input.suite.rubric.map((criterion) => {
    const observed = supplied.get(criterion.checkId);
    const passed = observed?.passed === true && /^[a-f0-9]{64}$/u.test(observed.evidenceHash);
    if (!passed && criterion.mandatory) blockingCheckIds.push(criterion.checkId);
    if (!passed && !criterion.mandatory) {
      const exception = input.exceptions.find(({ checkId }) => checkId === criterion.checkId);
      if (exception && validException(exception, input.evaluatedAt, expectedVersions))
        exceptedCheckIds.push(criterion.checkId);
      else blockingReasons.push(`ADVISORY_EXCEPTION_REQUIRED:${criterion.checkId}`);
    }
    return {
      checkId: criterion.checkId,
      mandatory: criterion.mandatory,
      passed,
      evidenceHash: observed?.evidenceHash ?? null,
    };
  });
  const qualified = blockingCheckIds.length === 0 && blockingReasons.length === 0;
  const evidenceRecord = {
    candidateId: input.candidateId,
    reviewerId: input.reviewerId,
    bindingId: input.bindingId,
    bindingFingerprint: input.bindingFingerprint,
    roleContractVersion: input.roleContractVersion,
    permissionFingerprint: input.permissionFingerprint,
    suite: input.suite,
    checks,
    exceptions: input.exceptions,
    evaluatedAt: input.evaluatedAt,
    blockingCheckIds: [...blockingCheckIds].sort(),
    exceptedCheckIds: [...exceptedCheckIds].sort(),
    blockingReasons: [...blockingReasons].sort(),
  };
  return {
    roleId: input.suite.roleId,
    definingResponsibility: input.suite.definingResponsibility,
    qualified,
    independentlyReviewed: input.reviewerId !== input.candidateId,
    managerActivationEligible: qualified,
    blockingCheckIds: evidenceRecord.blockingCheckIds,
    exceptedCheckIds: evidenceRecord.exceptedCheckIds,
    blockingReasons: evidenceRecord.blockingReasons,
    evidenceHash: createHash("sha256").update(stableStringify(evidenceRecord)).digest("hex"),
  };
}

function validException(
  exception: QualificationException,
  evaluatedAt: number,
  expectedVersions: string[],
): boolean {
  const actualVersions = [...exception.affectedVersions].sort();
  return (
    exception.scope.length > 0 &&
    exception.residualRisk.length > 0 &&
    exception.compensatingControl.length > 0 &&
    exception.ownerId.length > 0 &&
    exception.expiresAt >= evaluatedAt &&
    exception.parentExceptionId === undefined &&
    actualVersions.length === expectedVersions.length &&
    actualVersions.every((version, index) => version === expectedVersions[index])
  );
}
