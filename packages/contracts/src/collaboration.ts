export type ParticipantType = "human" | "agent";
export type CollaborationAction =
  "propose" | "question" | "decline" | "disagree" | "feedback" | "handoff";
export type CollaborationCommand = {
  commandId: string;
  projectId: string;
  actorId: string;
  action: CollaborationAction;
  targetIds: string[];
  summary: string;
  requiredPermissions: string[];
};
export type ActionableError = {
  code: string;
  causeCategory: string;
  retrySafe: boolean;
  requiredAction: string;
  requiredAuthority: string;
  affectedCanonicalIds: string[];
  escalationRoute: string;
};
export type Handoff = {
  handoffId: string;
  fromAgentId: string;
  toAgentId: string;
  workItemId: string;
  decisions: unknown[];
  openQuestions: unknown[];
  uncertainties: unknown[];
  artifacts: unknown[];
  evidence: unknown[];
  nextResponsibility: string;
};

export function normalizeCollaborationCommand(
  participant: ParticipantType,
  input: CollaborationCommand,
): CollaborationCommand {
  void participant;
  return {
    ...input,
    targetIds: [...input.targetIds].sort(),
    requiredPermissions: [...input.requiredPermissions].sort(),
  };
}

export function validateHandoff(
  input: unknown,
):
  | { ok: true; value: Handoff }
  | { ok: false; error: { code: "INCOMPLETE_HANDOFF"; missingFields: string[] } } {
  const required = [
    "handoffId",
    "fromAgentId",
    "toAgentId",
    "workItemId",
    "decisions",
    "openQuestions",
    "uncertainties",
    "artifacts",
    "evidence",
    "nextResponsibility",
  ] as const;
  const record =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const missingFields = required.filter((field) => record[field] === undefined);
  return missingFields.length > 0
    ? { ok: false, error: { code: "INCOMPLETE_HANDOFF", missingFields } }
    : { ok: true, value: input as Handoff };
}

export function createActionableError(input: ActionableError): ActionableError {
  return { ...input, affectedCanonicalIds: [...input.affectedCanonicalIds].sort() };
}
