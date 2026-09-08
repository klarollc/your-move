import { validateSixRoleRoster } from "@cuckcode/contracts";

export type PromotedContract = Readonly<{
  roleId: string;
  sourceSha256: string;
  overlaySha256: string;
}>;

export type BindingCandidate = Readonly<{
  roleId: string;
  agentId: string;
  bindingId: string;
  qualified: boolean;
  roleContractVersion: string;
  evaluatedAt: number;
  exceptionExpiries: readonly number[];
}>;

export type PreflightFailure = Readonly<{
  code:
    | "SIX_DISTINCT_IDENTITIES_REQUIRED"
    | "ROLE_NOT_PROMOTED"
    | "QUALIFICATION_FAILED"
    | "QUALIFICATION_STALE"
    | "QUALIFICATION_VERSION_MISMATCH"
    | "EXCEPTION_EXPIRED";
  detail: string;
}>;

/** The version a qualification must have been evaluated against to be compatible with a promotion. */
export function contractVersionOf(contract: PromotedContract): string {
  return `${contract.sourceSha256}:${contract.overlaySha256}`;
}

/**
 * Every precondition for a bounded live kickoff, checked together.
 *
 * The load-bearing one is compatibility. A qualification is only meaningful against the contract
 * version it was evaluated against, so a binding qualified against a version other than the one
 * promoted is refused — that mismatch lives in the join between two records, each of which looks
 * correct alone.
 *
 * Every failure is collected rather than the first returned. Fixing one problem only to discover
 * the next is how a bounded 13-turn run spends its budget on setup.
 */
export function checkBindingPreconditions(input: {
  bindings: readonly BindingCandidate[];
  promoted: readonly PromotedContract[];
  now: number;
  maxQualificationAgeMs: number;
}): { ok: true } | { ok: false; failures: readonly PreflightFailure[] } {
  const failures: PreflightFailure[] = [];

  const roster = validateSixRoleRoster(
    input.bindings.map(({ roleId, agentId }) => ({ roleId, agentId })),
  );
  if (!roster.ok) {
    const missing =
      roster.missingRoleIds.length > 0 ? `missing ${roster.missingRoleIds.join(", ")}` : "";
    const duplicate =
      roster.duplicateAgentIds.length > 0 ? `duplicate ${roster.duplicateAgentIds.join(", ")}` : "";
    failures.push({
      code: "SIX_DISTINCT_IDENTITIES_REQUIRED",
      detail: [missing, duplicate].filter(Boolean).join("; "),
    });
  }

  const promotedByRole = new Map(input.promoted.map((contract) => [contract.roleId, contract]));

  for (const binding of input.bindings) {
    const contract = promotedByRole.get(binding.roleId);
    if (contract === undefined) {
      failures.push({
        code: "ROLE_NOT_PROMOTED",
        detail: `${binding.roleId} has no promoted contract; binding ${binding.bindingId} cannot run`,
      });
    } else if (binding.roleContractVersion !== contractVersionOf(contract)) {
      failures.push({
        code: "QUALIFICATION_VERSION_MISMATCH",
        detail: `${binding.roleId} was qualified against ${binding.roleContractVersion}, but the promoted contract is ${contractVersionOf(contract)}`,
      });
    }

    if (!binding.qualified) {
      failures.push({
        code: "QUALIFICATION_FAILED",
        detail: `${binding.roleId} (agent ${binding.agentId}) has no passing role qualification`,
      });
    }

    if (input.now - binding.evaluatedAt > input.maxQualificationAgeMs) {
      failures.push({
        code: "QUALIFICATION_STALE",
        detail: `${binding.roleId} was last qualified ${input.now - binding.evaluatedAt}ms ago, beyond the ${input.maxQualificationAgeMs}ms limit`,
      });
    }

    const expired = binding.exceptionExpiries.filter((expiresAt) => expiresAt <= input.now);
    if (expired.length > 0) {
      failures.push({
        code: "EXCEPTION_EXPIRED",
        detail: `${binding.roleId} relies on ${expired.length} expired qualification exception(s)`,
      });
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export { validateSixRoleRoster };
