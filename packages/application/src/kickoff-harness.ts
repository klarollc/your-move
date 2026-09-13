import type { KickoffBriefing, RuntimeBindingReport } from "@cuckcode/contracts";
import {
  checkBindingPreconditions,
  type BindingCandidate,
  type PreflightFailure,
  type PromotedContract,
} from "@cuckcode/domain";

import {
  runBoundedKickoff,
  type KickoffRunResult,
  type RosterEntry,
  type TurnRunner,
} from "./kickoff-run.js";

/**
 * A binding has two deliberately separate records: the provider's report and the role-specific
 * preflight candidate. The report establishes what runtime session exists; the candidate joins it
 * to a role contract and qualification. Neither is allowed to stand in for the other.
 */
export type PreparedKickoffBinding = Readonly<{
  displayName: string;
  createdAt: string;
  providerIds: Record<string, string>;
  report: RuntimeBindingReport;
  candidate: BindingCandidate;
}>;

export type KickoffTrustStore = Readonly<{
  registerAgent: (input: { agentId: string; displayName: string; createdAt: string }) => void;
  appendBinding: (input: {
    report: RuntimeBindingReport;
    providerIds: Record<string, string>;
    createdAt: string;
  }) => void;
}>;

export type PreflightedKickoffResult =
  | Readonly<{
      status: "binding_mismatch";
      failures: readonly Readonly<{
        code: "BINDING_REPORT_MISMATCH";
        roleId: string;
        detail: string;
      }>[];
    }>
  | Readonly<{ status: "preflight_failed"; failures: readonly PreflightFailure[] }>
  | Readonly<{ status: "completed"; result: KickoffRunResult }>;

/**
 * Runs the provider-neutral half of Task 17c-5.
 *
 * Candidate bindings are persisted as audit evidence before they are admitted. The complete
 * preflight then runs as one gate; a failure cannot spend a provider turn. Only a passing roster
 * reaches the existing bounded kickoff orchestrator, which remains responsible for the thirteen
 * turn cap and observed-effect stop.
 */
export async function runPreflightedKickoff(input: {
  briefing: KickoffBriefing;
  preparedBindings: readonly PreparedKickoffBinding[];
  promoted: readonly PromotedContract[];
  now: number;
  maxQualificationAgeMs: number;
  synthesisRoleId: string;
  trustStore: KickoffTrustStore;
  runTurn: TurnRunner;
}): Promise<PreflightedKickoffResult> {
  const mismatches = input.preparedBindings.flatMap((binding) => {
    const { candidate, report } = binding;
    if (candidate.agentId === report.agentId && candidate.bindingId === report.bindingId) return [];
    return [
      {
        code: "BINDING_REPORT_MISMATCH" as const,
        roleId: candidate.roleId,
        detail:
          `${candidate.roleId} candidate ${candidate.agentId}/${candidate.bindingId} does not match ` +
          `report ${report.agentId}/${report.bindingId}`,
      },
    ];
  });
  // A mismatched report cannot be persisted as evidence for this candidate. Unlike an ordinary
  // preflight failure, retaining it would make the audit trail assert a relationship that is
  // known false, so this stops before either persistence or a provider turn.
  if (mismatches.length > 0) return { status: "binding_mismatch", failures: mismatches };

  for (const binding of input.preparedBindings) {
    input.trustStore.registerAgent({
      agentId: binding.candidate.agentId,
      displayName: binding.displayName,
      createdAt: binding.createdAt,
    });
    input.trustStore.appendBinding({
      report: binding.report,
      providerIds: binding.providerIds,
      createdAt: binding.createdAt,
    });
  }

  const preflight = checkBindingPreconditions({
    bindings: input.preparedBindings.map(({ candidate }) => candidate),
    promoted: input.promoted,
    now: input.now,
    maxQualificationAgeMs: input.maxQualificationAgeMs,
  });
  if (!preflight.ok) return { status: "preflight_failed", failures: preflight.failures };

  const roster: RosterEntry[] = input.preparedBindings.map(({ candidate }) => ({
    roleId: candidate.roleId,
    agentId: candidate.agentId,
    bindingId: candidate.bindingId,
  }));
  return {
    status: "completed",
    result: await runBoundedKickoff({
      briefing: input.briefing,
      roster,
      synthesisRoleId: input.synthesisRoleId,
      runTurn: input.runTurn,
    }),
  };
}
