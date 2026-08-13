export const sixRoleIds = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;

export type QualificationCheck = {
  checkId: string;
  category: string;
  mandatory: boolean;
  passed: boolean;
};

export function evaluateQualification(input: {
  checks: readonly QualificationCheck[];
  exceptions: readonly string[];
}): { qualified: boolean; blockingCheckIds: string[]; exceptedCheckIds: string[] } {
  const exceptionSet = new Set(input.exceptions);
  const blockingCheckIds = input.checks
    .filter((check) => !check.passed && check.mandatory)
    .map((check) => check.checkId)
    .sort();
  const exceptedCheckIds = input.checks
    .filter((check) => !check.passed && !check.mandatory && exceptionSet.has(check.checkId))
    .map((check) => check.checkId)
    .sort();
  const unexceptedAdvisoryFailure = input.checks.some(
    (check) => !check.passed && !check.mandatory && !exceptionSet.has(check.checkId),
  );
  return {
    qualified: blockingCheckIds.length === 0 && !unexceptedAdvisoryFailure,
    blockingCheckIds,
    exceptedCheckIds,
  };
}

export function validateSixRoleRoster(assignments: readonly { roleId: string; agentId: string }[]):
  | { ok: true }
  | {
      ok: false;
      code: "SIX_DISTINCT_IDENTITIES_REQUIRED";
      missingRoleIds: string[];
      duplicateAgentIds: string[];
    } {
  const activeRoles = new Set(assignments.map(({ roleId }) => roleId));
  const agentCounts = new Map<string, number>();
  for (const { agentId } of assignments)
    agentCounts.set(agentId, (agentCounts.get(agentId) ?? 0) + 1);
  const missingRoleIds = sixRoleIds.filter((roleId) => !activeRoles.has(roleId));
  const duplicateAgentIds = [...agentCounts]
    .filter(([, count]) => count > 1)
    .map(([agentId]) => agentId)
    .sort();
  return missingRoleIds.length === 0 && duplicateAgentIds.length === 0
    ? { ok: true }
    : { ok: false, code: "SIX_DISTINCT_IDENTITIES_REQUIRED", missingRoleIds, duplicateAgentIds };
}
