import type { KickoffContribution } from "@cuckcode/contracts";
import {
  approveKickoffCharter,
  recordKickoffContribution,
  recordKickoffRevision,
  recordKickoffSynthesis,
  redirectKickoff,
  type KickoffCharter,
  type KickoffRevision,
  type KickoffState,
  type KickoffSynthesis,
} from "@cuckcode/domain";

type KickoffIntent =
  "contribute" | "synthesize" | "revise" | "approve_charter" | "redirect" | "reject";

type KickoffCommand = Readonly<{
  commandId: string;
  expectedRevision: number;
  actor: Readonly<{ actorType: "manager" | "agent"; actorId: string }>;
  intent: KickoffIntent;
  payload: unknown;
}>;

type KickoffCommandResult =
  | Readonly<{
      ok: true;
      state: KickoffState;
      receipt: Readonly<{
        receiptId: string;
        commandId: string;
        acceptedRevision: number;
        resultingRevision: number;
        intent: KickoffIntent;
        actorId: string;
        kickoffId: string;
        implementationAllowed: boolean;
      }>;
    }>
  | Readonly<{ ok: false; code: string; retrySafe?: true; requiredAction?: string }>;

export function executeKickoffCommand(
  input: Readonly<{
    state: KickoffState;
    currentRevision: number;
    command: KickoffCommand;
    /** The role this round designates as synthesiser. D-25 gives it to the delivery lead; which
     *  identifier that role carries is the round's configuration, not the domain's to assume. */
    synthesisRoleId: string;
  }>,
): KickoffCommandResult {
  if (input.command.expectedRevision !== input.currentRevision) {
    return {
      ok: false,
      code: "KICKOFF_COMMAND_STALE",
      retrySafe: true,
      requiredAction: "Refresh the kickoff record before retrying.",
    };
  }
  const managerOnly = ["approve_charter", "redirect", "reject"].includes(input.command.intent);
  if (managerOnly && input.command.actor.actorType !== "manager") {
    return { ok: false, code: "KICKOFF_MANAGER_AUTHORITY_REQUIRED" };
  }
  if (
    ["contribute", "revise"].includes(input.command.intent) &&
    input.command.actor.actorType !== "agent"
  ) {
    return { ok: false, code: "KICKOFF_AGENT_AUTHORITY_REQUIRED" };
  }

  const transition = transitionKickoff(input.state, input.command, input.synthesisRoleId);
  if (!transition.ok) return transition;
  return {
    ok: true,
    state: transition.state,
    receipt: {
      receiptId: `receipt_${input.command.commandId}`,
      commandId: input.command.commandId,
      acceptedRevision: input.currentRevision,
      resultingRevision: input.currentRevision + 1,
      intent: input.command.intent,
      actorId: input.command.actor.actorId,
      kickoffId: transition.state.briefing.kickoffId,
      implementationAllowed: transition.state.implementationAllowed,
    },
  };
}

function transitionKickoff(
  state: KickoffState,
  command: KickoffCommand,
  synthesisRoleId: string,
): { ok: true; state: KickoffState } | { ok: false; code: string } {
  if (command.intent === "contribute") {
    const contribution = command.payload as KickoffContribution;
    if (contribution.agentId !== command.actor.actorId) {
      return { ok: false, code: "KICKOFF_ATTRIBUTION_MISMATCH" };
    }
    return recordKickoffContribution(state, contribution);
  }
  if (command.intent === "synthesize") {
    return recordKickoffSynthesis(state, command.payload as KickoffSynthesis, synthesisRoleId);
  }
  if (command.intent === "revise") {
    const revision = command.payload as KickoffRevision;
    if (revision.agentId !== command.actor.actorId) {
      return { ok: false, code: "KICKOFF_ATTRIBUTION_MISMATCH" };
    }
    return recordKickoffRevision(state, revision);
  }
  if (command.intent === "approve_charter") {
    const charter = command.payload as KickoffCharter;
    if (charter.managerId !== command.actor.actorId) {
      return { ok: false, code: "KICKOFF_ATTRIBUTION_MISMATCH" };
    }
    return approveKickoffCharter(state, charter);
  }
  const disposition = command.payload as { managerId: string; reason: string };
  if (disposition.managerId !== command.actor.actorId) {
    return { ok: false, code: "KICKOFF_ATTRIBUTION_MISMATCH" };
  }
  return redirectKickoff(state, {
    ...disposition,
    disposition: command.intent === "redirect" ? "redirect" : "reject",
  });
}
