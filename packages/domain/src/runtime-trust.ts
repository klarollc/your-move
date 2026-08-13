export type TrustCheck = { checkId: string; mandatory: boolean; passed: boolean };
export type TrustException = { checkId: string; expiresAt: string };

export function evaluateTrustQualification(input: {
  checks: readonly TrustCheck[];
  exceptions: readonly TrustException[];
}): { qualified: boolean; blockingCheckIds: string[]; exceptedCheckIds: string[] } {
  const exceptions = new Set(input.exceptions.map(({ checkId }) => checkId));
  const blockingCheckIds = input.checks
    .filter(({ mandatory, passed }) => mandatory && !passed)
    .map(({ checkId }) => checkId)
    .sort();
  const exceptedCheckIds = input.checks
    .filter(({ checkId, mandatory, passed }) => !mandatory && !passed && exceptions.has(checkId))
    .map(({ checkId }) => checkId)
    .sort();
  const unexceptedFailure = input.checks.some(
    ({ checkId, mandatory, passed }) => !mandatory && !passed && !exceptions.has(checkId),
  );
  return {
    qualified: blockingCheckIds.length === 0 && !unexceptedFailure,
    blockingCheckIds,
    exceptedCheckIds,
  };
}

export function decideRoleActivation(input: {
  universalAdmission: "passed" | "failed" | "missing";
  roleQualification: "passed" | "failed" | "missing";
  independentReview: "passed" | "failed" | "missing";
  managerDecision: "approved" | "rejected" | "deferred" | "missing";
}): { active: boolean; reason: string } {
  if (input.universalAdmission !== "passed") return { active: false, reason: "ADMISSION_REQUIRED" };
  if (input.roleQualification !== "passed")
    return { active: false, reason: "ROLE_QUALIFICATION_REQUIRED" };
  if (input.independentReview !== "passed")
    return { active: false, reason: "INDEPENDENT_REVIEW_REQUIRED" };
  if (input.managerDecision !== "approved")
    return { active: false, reason: "MANAGER_APPROVAL_REQUIRED" };
  return { active: true, reason: "ACTIVATED" };
}

export type ActionableTrustFacts = {
  candidateId: string;
  bindingId: string;
  roleId: string;
  permissionCeiling: string[];
  prohibitedActions: string[];
  qualificationEvidenceIds: string[];
  decision: { status: "approved" | "rejected" | "deferred"; reason: string };
  nextActions: string[];
};

export function buildReciprocalTrustViews(facts: ActionableTrustFacts): {
  manager: { audience: "manager"; actionableFacts: ActionableTrustFacts };
  candidate: { audience: "candidate"; actionableFacts: ActionableTrustFacts };
} {
  const actionableFacts = structuredClone(facts);
  return {
    manager: { audience: "manager", actionableFacts },
    candidate: { audience: "candidate", actionableFacts: structuredClone(actionableFacts) },
  };
}
