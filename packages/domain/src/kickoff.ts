import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";

export type KickoffSynthesis = Readonly<{
  synthesisId: string;
  authorRoleId: string;
  proposedGoal: string;
  includedContributionIds: string[];
  disagreementRegister: Array<Readonly<{ roleId: string; statement: string }>>;
  unresolvedEvidenceGaps: string[];
}>;

export type KickoffRevision = Readonly<{
  revisionId: string;
  roleId: string;
  agentId: string;
  response: "affirm" | "amend" | "challenge";
  statement: string;
}>;

export type KickoffCharter = Readonly<{
  charterId: string;
  version: number;
  managerId: string;
  goal: string;
  scope: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  evidenceRequirements: string[];
  disposition: "approve";
}>;

export type KickoffState = Readonly<{
  briefing: KickoffBriefing;
  phase:
    "contribution" | "ready_for_synthesis" | "revision" | "chartered" | "redirected" | "rejected";
  round: 1;
  contributions: Readonly<Record<string, KickoffContribution>>;
  synthesis?: KickoffSynthesis;
  revisions: Readonly<Record<string, KickoffRevision>>;
  charter?: KickoffCharter;
  managerDisposition?: Readonly<{
    managerId: string;
    disposition: "redirect" | "reject";
    reason: string;
  }>;
  implementationAllowed: boolean;
}>;

type Result = { ok: true; state: KickoffState } | { ok: false; code: string };

export function createKickoff(briefing: KickoffBriefing): KickoffState {
  return {
    briefing,
    phase: "contribution",
    round: 1,
    contributions: {},
    revisions: {},
    implementationAllowed: false,
  };
}

export function recordKickoffContribution(
  state: KickoffState,
  contribution: KickoffContribution,
): Result {
  if (state.phase !== "contribution") return failure("KICKOFF_CONTRIBUTION_CLOSED");
  if (
    contribution.kickoffId !== state.briefing.kickoffId ||
    contribution.briefingVersion !== state.briefing.briefingVersion
  ) {
    return failure("KICKOFF_BRIEFING_MISMATCH");
  }
  if (!state.briefing.activeRoleIds.includes(contribution.roleId)) {
    return failure("KICKOFF_ROLE_INACTIVE");
  }
  if (state.contributions[contribution.roleId]) return failure("KICKOFF_INITIAL_LIMIT");
  const contributions = { ...state.contributions, [contribution.roleId]: contribution };
  return success({
    ...state,
    contributions,
    phase:
      Object.keys(contributions).length === state.briefing.activeRoleIds.length
        ? "ready_for_synthesis"
        : "contribution",
  });
}

export function recordKickoffSynthesis(state: KickoffState, synthesis: KickoffSynthesis): Result {
  if (state.phase !== "ready_for_synthesis") return failure("KICKOFF_SYNTHESIS_NOT_READY");
  if (synthesis.authorRoleId !== "delivery") return failure("KICKOFF_SYNTHESIS_AUTHORITY");
  const expected = Object.values(state.contributions)
    .map(({ contributionId }) => contributionId)
    .sort();
  if (
    !nonEmpty(synthesis.synthesisId) ||
    !nonEmpty(synthesis.proposedGoal) ||
    !sameStrings(synthesis.includedContributionIds, expected) ||
    !synthesis.disagreementRegister.every(
      ({ roleId, statement }) =>
        state.briefing.activeRoleIds.includes(roleId) && nonEmpty(statement),
    ) ||
    !synthesis.unresolvedEvidenceGaps.every(nonEmpty)
  ) {
    return failure("KICKOFF_SYNTHESIS_INCOMPLETE");
  }
  return success({ ...state, synthesis, phase: "revision" });
}

export function recordKickoffRevision(state: KickoffState, revision: KickoffRevision): Result {
  if (state.phase !== "revision") return failure("KICKOFF_REVISION_CLOSED");
  if (!state.briefing.activeRoleIds.includes(revision.roleId))
    return failure("KICKOFF_ROLE_INACTIVE");
  if (state.revisions[revision.roleId]) return failure("KICKOFF_REVISION_LIMIT");
  if (!nonEmpty(revision.statement) || !nonEmpty(revision.agentId)) {
    return failure("KICKOFF_REVISION_INVALID");
  }
  return success({
    ...state,
    revisions: { ...state.revisions, [revision.roleId]: revision },
  });
}

export function approveKickoffCharter(state: KickoffState, charter: KickoffCharter): Result {
  if (state.phase !== "revision") return failure("KICKOFF_CHARTER_NOT_READY");
  if (
    !nonEmpty(charter.charterId) ||
    charter.version < 1 ||
    !nonEmpty(charter.managerId) ||
    !nonEmpty(charter.goal) ||
    !nonEmptyArray(charter.scope) ||
    !nonEmptyArray(charter.constraints) ||
    !nonEmptyArray(charter.acceptanceCriteria) ||
    !nonEmptyArray(charter.evidenceRequirements) ||
    charter.disposition !== "approve"
  ) {
    return failure("KICKOFF_CHARTER_INCOMPLETE");
  }
  return success({
    ...state,
    charter,
    phase: "chartered",
    implementationAllowed: true,
  });
}

export function redirectKickoff(
  state: KickoffState,
  disposition: Readonly<{
    managerId: string;
    disposition: "redirect" | "reject";
    reason: string;
  }>,
): Result {
  if (state.phase !== "revision") return failure("KICKOFF_ROUND_CLOSED");
  if (!nonEmpty(disposition.managerId) || !nonEmpty(disposition.reason)) {
    return failure("KICKOFF_DISPOSITION_INVALID");
  }
  return success({
    ...state,
    managerDisposition: disposition,
    phase: disposition.disposition === "redirect" ? "redirected" : "rejected",
    implementationAllowed: false,
  });
}

function success(state: KickoffState): Result {
  return { ok: true, state };
}

function failure(code: string): Result {
  return { ok: false, code };
}

function nonEmpty(value: string): boolean {
  return value.length > 0;
}

function nonEmptyArray(value: readonly string[]): boolean {
  return value.length > 0 && value.every(nonEmpty);
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.toSorted().every((value, i) => value === expected[i])
  );
}
