type RoleOffer = {
  offerId: string;
  agentId: string;
  roleId: string;
  roleContractVersion: string;
  overlayDiff: string[];
  qualificationOutcome: "passed" | "failed" | "stale";
  qualificationEvidenceIds: string[];
  permissionCeiling: string[];
  prohibitedActions: string[];
  workload: { activeRoles: number; capacity: string };
  conflicts: string[];
};

type RoleResponse =
  | { kind: "accept" }
  | { kind: "rank"; rankedRoleIds: string[] }
  | { kind: "request_reassignment"; reason: string }
  | {
      kind: "decline";
      category: "capacity" | "fit" | "conflict" | "permission";
      reason: string;
      replacementAgentId?: string;
    };

type RoleOfferInput = {
  offer: RoleOffer;
  response: RoleResponse;
  manager: { decision: "assign" | "reject" | "defer"; managerId: string; reason: string };
  existingAssignments: { roleId: string; agentId: string }[];
  independentReviewerId: string;
};

export function evaluateRoleOffer(input: RoleOfferInput) {
  validateCompleteOffer(input.offer);
  if (input.response.kind === "decline" && input.response.replacementAgentId)
    throw new Error("AGENT_REPLACEMENT_FORBIDDEN");
  const blockingReasons: string[] = [];
  if (input.offer.qualificationOutcome !== "passed")
    blockingReasons.push("CURRENT_QUALIFICATION_REQUIRED");
  if (
    input.offer.workload.activeRoles > 0 ||
    input.existingAssignments.some(({ agentId }) => agentId === input.offer.agentId)
  )
    blockingReasons.push("DUAL_ROLE_FORBIDDEN");
  if (input.independentReviewerId === input.offer.agentId)
    blockingReasons.push("REVIEWER_CONFLICT");
  if (input.offer.conflicts.length > 0) blockingReasons.push("UNRESOLVED_ROLE_CONFLICT");

  const accepted = input.response.kind === "accept";
  const managerAssigned = input.manager.decision === "assign";
  const canAssign = accepted && managerAssigned && blockingReasons.length === 0;
  const assignment = canAssign
    ? {
        roleAssignmentId: `role-assignment_${input.offer.offerId}`,
        roleId: input.offer.roleId,
        agentId: input.offer.agentId,
      }
    : undefined;
  const actionableFacts = {
    offer: structuredClone(input.offer),
    response: structuredClone(input.response),
    managerDecision: structuredClone(input.manager),
    blockingReasons: [...blockingReasons],
    roleVacant: !assignment,
  };
  return {
    ...(assignment ? { assignment } : {}),
    roleVacant: !assignment,
    blockingReasons,
    managerView: { audience: "manager" as const, actionableFacts },
    candidateView: {
      audience: "candidate" as const,
      actionableFacts: structuredClone(actionableFacts),
    },
    auditEvents: [
      {
        kind: "role.offer_recorded" as const,
        source: "system" as const,
        payload: { offer: structuredClone(input.offer) },
      },
      {
        kind: "role.response_recorded" as const,
        source: "adapter" as const,
        payload: { agentId: input.offer.agentId, response: structuredClone(input.response) },
      },
      {
        kind: "role.assignment_decided" as const,
        source: "manager" as const,
        payload: {
          roleId: input.offer.roleId,
          agentId: input.offer.agentId,
          decision: input.manager,
          assigned: Boolean(assignment),
          blockingReasons,
        },
      },
    ],
  };
}

function validateCompleteOffer(offer: RoleOffer): void {
  if (
    !offer.offerId ||
    !offer.agentId ||
    !offer.roleId ||
    !offer.roleContractVersion ||
    offer.overlayDiff.length === 0 ||
    offer.qualificationEvidenceIds.length === 0 ||
    offer.permissionCeiling.length === 0 ||
    offer.prohibitedActions.length === 0 ||
    !offer.workload.capacity
  )
    throw new Error("INCOMPLETE_ROLE_OFFER");
}
