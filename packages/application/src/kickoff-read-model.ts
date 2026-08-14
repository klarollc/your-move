import type { KickoffState } from "@cuckcode/domain";

type SharedKickoffRecord = Readonly<{
  scope: Readonly<{ kickoffId: string; projectId: string; goal: string; briefingVersion: number }>;
  constraints: readonly string[];
  permissions: readonly string[];
  conflicts: ReadonlyArray<Readonly<{ roleId: string; statement: string }>>;
  evidenceRequirements: readonly string[];
  disposition: Readonly<{ status: string; managerId?: string; charterId?: string }>;
}>;

export function projectKickoffReadModel(
  state: KickoffState,
  edits?: Readonly<{
    managerDraft: Readonly<{ goal: string; scope: readonly string[] }>;
    managerEdit: Readonly<{ goal: string; scope: readonly string[] }>;
  }>,
) {
  const contributions = Object.values(state.contributions).toSorted(
    (left, right) =>
      state.briefing.activeRoleIds.indexOf(left.roleId) -
      state.briefing.activeRoleIds.indexOf(right.roleId),
  );
  const conflicts = [
    ...contributions.flatMap(({ roleId, disagreements }) =>
      disagreements.map((statement) => ({ roleId, statement })),
    ),
    ...(state.synthesis?.disagreementRegister ?? []),
  ].filter(
    (value, index, all) =>
      all.findIndex(
        (candidate) => candidate.roleId === value.roleId && candidate.statement === value.statement,
      ) === index,
  );
  const disposition = state.charter
    ? { status: "approved", managerId: state.charter.managerId, charterId: state.charter.charterId }
    : state.managerDisposition
      ? {
          status: state.managerDisposition.disposition,
          managerId: state.managerDisposition.managerId,
        }
      : { status: "pending" };
  const shared: SharedKickoffRecord = {
    scope: {
      kickoffId: state.briefing.kickoffId,
      projectId: state.briefing.projectId,
      goal: state.synthesis?.proposedGoal ?? state.briefing.goal,
      briefingVersion: state.briefing.briefingVersion,
    },
    constraints: [...state.briefing.constraints],
    permissions: [...state.briefing.permissions],
    conflicts,
    evidenceRequirements: [...state.briefing.evidenceFloor],
    disposition,
  };
  return {
    schemaVersion: 1 as const,
    shared,
    manager: {
      phase: state.phase,
      entries: contributions.map((entry) => ({
        contributionId: entry.contributionId,
        roleId: entry.roleId,
        agentId: entry.agentId,
        kind: entry.kind,
        goal: entry.goal,
        value: entry.value,
        risk: entry.risk,
        evidenceNeeds: [...entry.evidenceNeeds],
      })),
      synthesis: state.synthesis,
      disagreements: conflicts,
      revisionState: state.briefing.activeRoleIds.map((roleId) => ({
        roleId,
        response: state.revisions[roleId]?.response ?? "not_submitted",
      })),
      decisionImpact: {
        disposition: disposition.status,
        implementationAllowed: state.implementationAllowed,
      },
      editDiff: edits ? buildDiff(edits.managerDraft, edits.managerEdit) : [],
      transcriptRequired: false,
    },
    agents: state.briefing.activeRoleIds.map((roleId) => ({
      schemaVersion: 1 as const,
      roleId,
      agentId: state.contributions[roleId]?.agentId ?? null,
      ...shared,
      ownContribution: state.contributions[roleId] ?? null,
      ownRevision: state.revisions[roleId] ?? null,
    })),
  };
}

function buildDiff(
  before: Readonly<{ goal: string; scope: readonly string[] }>,
  after: Readonly<{ goal: string; scope: readonly string[] }>,
): Array<
  Readonly<{
    field: "goal" | "scope";
    before: string | readonly string[];
    after: string | readonly string[];
  }>
> {
  const diff = [];
  if (before.goal !== after.goal)
    diff.push({ field: "goal" as const, before: before.goal, after: after.goal });
  if (JSON.stringify(before.scope) !== JSON.stringify(after.scope)) {
    diff.push({ field: "scope" as const, before: [...before.scope], after: [...after.scope] });
  }
  return diff;
}
