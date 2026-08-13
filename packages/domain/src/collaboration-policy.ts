import {
  createActionableError,
  normalizeCollaborationCommand,
  type ActionableError,
  type CollaborationCommand,
  type ParticipantType,
} from "@cuckcode/contracts";

export function authorizeCollaborationCommand(
  participant: ParticipantType,
  input: CollaborationCommand,
  effectivePermissions: readonly string[],
): { ok: true; command: CollaborationCommand } | { ok: false; error: ActionableError } {
  const command = normalizeCollaborationCommand(participant, input);
  const missing = command.requiredPermissions.filter(
    (permission) => !effectivePermissions.includes(permission),
  );
  if (missing.length === 0) return { ok: true, command };
  const requiredAuthority = missing.sort()[0] as string;
  return {
    ok: false,
    error: createActionableError({
      code: "PERMISSION_REQUIRED",
      causeCategory: "authority",
      retrySafe: true,
      requiredAction: `Request ${requiredAuthority} from the manager.`,
      requiredAuthority,
      affectedCanonicalIds: [command.actorId, ...command.targetIds],
      escalationRoute: "manager_attention",
    }),
  };
}
