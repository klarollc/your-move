export type KickoffIssueCode =
  | "KICKOFF_BRIEFING_INVALID"
  | "KICKOFF_ROSTER_INVALID"
  | "KICKOFF_SECRET_REJECTED"
  | "KICKOFF_CONTRIBUTION_INVALID"
  | "KICKOFF_BRIEFING_MISMATCH";

type Validation<T> = { ok: true; value: T } | { ok: false; code: KickoffIssueCode };

export type KickoffBriefing = Readonly<{
  schemaVersion: 1;
  kickoffId: string;
  projectId: string;
  briefingVersion: number;
  goal: string;
  constraints: string[];
  permissions: string[];
  evidenceFloor: string[];
  knowledgeSnapshotId: string;
  managerNonNegotiables: string[];
  activeRoleIds: string[];
}>;

export type KickoffContribution = Readonly<{
  schemaVersion: 1;
  contributionId: string;
  kickoffId: string;
  briefingVersion: number;
  roleId: string;
  agentId: string;
  kind: "proposal" | "critique" | "question" | "decline";
  goal: string;
  value: string;
  risk: string;
  dependencies: string[];
  acceptanceCriteria: string[];
  evidenceNeeds: string[];
  uncertainties: string[];
  disagreements: string[];
}>;

export function validateKickoffBriefing(input: unknown): Validation<KickoffBriefing> {
  if (!isRecord(input) || containsSecret(input)) return invalid("KICKOFF_SECRET_REJECTED");
  if (!Array.isArray(input.activeRoleIds)) return invalid("KICKOFF_BRIEFING_INVALID");
  const roles = input.activeRoleIds;
  if (roles.length !== 6 || new Set(roles).size !== 6 || !roles.every(nonEmpty)) {
    return invalid("KICKOFF_ROSTER_INVALID");
  }
  if (
    input.schemaVersion !== 1 ||
    !nonEmpty(input.kickoffId) ||
    !nonEmpty(input.projectId) ||
    !Number.isInteger(input.briefingVersion) ||
    Number(input.briefingVersion) < 1 ||
    !nonEmpty(input.goal) ||
    !stringArray(input.constraints) ||
    !stringArray(input.permissions) ||
    !stringArray(input.evidenceFloor) ||
    !nonEmpty(input.knowledgeSnapshotId) ||
    !stringArray(input.managerNonNegotiables)
  ) {
    return invalid("KICKOFF_BRIEFING_INVALID");
  }
  return { ok: true, value: input as KickoffBriefing };
}

export function validateKickoffContribution(
  input: unknown,
  briefing: Readonly<{ kickoffId: string; briefingVersion: number }>,
): Validation<KickoffContribution> {
  if (!isRecord(input) || containsSecret(input)) return invalid("KICKOFF_SECRET_REJECTED");
  if (
    input.kickoffId !== briefing.kickoffId ||
    input.briefingVersion !== briefing.briefingVersion
  ) {
    return invalid("KICKOFF_BRIEFING_MISMATCH");
  }
  if (
    input.schemaVersion !== 1 ||
    !nonEmpty(input.contributionId) ||
    !nonEmpty(input.roleId) ||
    !nonEmpty(input.agentId) ||
    !["proposal", "critique", "question", "decline"].includes(String(input.kind)) ||
    !nonEmpty(input.goal) ||
    !nonEmpty(input.value) ||
    !nonEmpty(input.risk) ||
    !stringArray(input.dependencies) ||
    !stringArray(input.acceptanceCriteria) ||
    !stringArray(input.evidenceNeeds) ||
    !stringArray(input.uncertainties) ||
    !stringArray(input.disagreements)
  ) {
    return invalid("KICKOFF_CONTRIBUTION_INVALID");
  }
  return { ok: true, value: input as KickoffContribution };
}

const secretKey = /api[_-]?key|authorization|credential|password|secret|token/iu;
const secretValue = /\bsk-[a-z0-9_-]+\b|\bauthorization\s*:|\bbearer\s+[a-z0-9._-]+/iu;

function containsSecret(value: unknown): boolean {
  if (typeof value === "string") return secretValue.test(value);
  if (Array.isArray(value)) return value.some(containsSecret);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => secretKey.test(key) || containsSecret(child));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(code: KickoffIssueCode): { ok: false; code: KickoffIssueCode } {
  return { ok: false, code };
}
