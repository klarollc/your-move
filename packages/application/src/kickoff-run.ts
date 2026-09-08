import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import {
  checkObservedEvent,
  checkTurnBudget,
  createKickoff,
  recordKickoffContribution,
  recordKickoffRevision,
  recordKickoffSynthesis,
  type KickoffRevision,
  type KickoffState,
  type KickoffSynthesis,
} from "@cuckcode/domain";

export type TurnKind = "contribution" | "synthesis" | "revision";

export type ObservedEvent = Readonly<{ kind: string; phase: string }>;

export type TurnRequest = Readonly<{
  kind: TurnKind;
  roleId: string;
  agentId: string;
  bindingId: string;
  turnIndex: number;
}>;

export type TurnOutcome =
  | Readonly<{ ok: true; payload: unknown; events?: readonly ObservedEvent[] }>
  | Readonly<{ ok: false; code: string; detail: string; events?: readonly ObservedEvent[] }>;

export type TurnRunner = (request: TurnRequest) => Promise<TurnOutcome>;

export type RosterEntry = Readonly<{ roleId: string; agentId: string; bindingId: string }>;

export type KickoffRunResult = Readonly<{
  state: KickoffState;
  turnsUsed: number;
  respondedRoleIds: readonly string[];
  silentRoleIds: readonly string[];
  stopped?: Readonly<{ code: string; detail: string; atTurn: number }>;
}>;

/**
 * Drives one bounded D-25 kickoff and stops rather than repairing.
 *
 * Three properties are deliberate and load-bearing:
 *
 * - **Silence is never assent.** A role that was never asked, because the run stopped before
 *   reaching it, is reported silent. Nothing infers agreement from an absent answer.
 * - **A well-formed payload is not sufficient.** If a turn also reported a command, file, tool or
 *   artifact effect, the turn is refused and its payload is not recorded. Valid-looking output
 *   accompanying an external effect is the dangerous case, not the harmless one.
 * - **The budget is checked before a turn is spent**, so a fourteenth turn is never requested
 *   rather than detected afterwards.
 *
 * A stopped run is evidence. Everything recorded before the stop is preserved.
 */
export async function runBoundedKickoff(input: {
  briefing: KickoffBriefing;
  roster: readonly RosterEntry[];
  synthesisRoleId: string;
  runTurn: TurnRunner;
}): Promise<KickoffRunResult> {
  let state = createKickoff(input.briefing);
  const responded: string[] = [];
  const counts = { contributions: 0, syntheses: 0, revisions: 0 };
  let turnsUsed = 0;
  let stopped: KickoffRunResult["stopped"];

  const finish = (): KickoffRunResult => ({
    state,
    turnsUsed,
    respondedRoleIds: responded,
    silentRoleIds: input.roster
      .map(({ roleId }) => roleId)
      .filter((roleId) => !responded.includes(roleId)),
    ...(stopped ? { stopped } : {}),
  });

  const spend = async (entry: RosterEntry, kind: TurnKind): Promise<TurnOutcome | undefined> => {
    const projected = { ...counts };
    if (kind === "contribution") projected.contributions += 1;
    if (kind === "synthesis") projected.syntheses += 1;
    if (kind === "revision") projected.revisions += 1;

    const budget = checkTurnBudget(projected);
    if (budget) {
      stopped = { code: budget.code, detail: budget.detail, atTurn: turnsUsed };
      return undefined;
    }

    const outcome = await input.runTurn({
      kind,
      roleId: entry.roleId,
      agentId: entry.agentId,
      bindingId: entry.bindingId,
      turnIndex: turnsUsed + 1,
    });

    turnsUsed += 1;
    counts.contributions = projected.contributions;
    counts.syntheses = projected.syntheses;
    counts.revisions = projected.revisions;

    for (const event of outcome.events ?? []) {
      const violation = checkObservedEvent(event as never);
      if (violation) {
        stopped = { code: violation.code, detail: violation.detail, atTurn: turnsUsed };
        return undefined;
      }
    }

    if (!outcome.ok) {
      stopped = { code: outcome.code, detail: outcome.detail, atTurn: turnsUsed };
      return undefined;
    }

    return outcome;
  };

  for (const entry of input.roster) {
    const outcome = await spend(entry, "contribution");
    if (!outcome?.ok) return finish();
    const recorded = recordKickoffContribution(state, outcome.payload as KickoffContribution);
    if (!recorded.ok) {
      stopped = {
        code: recorded.code,
        detail: `${entry.roleId} produced a contribution the kickoff domain rejected`,
        atTurn: turnsUsed,
      };
      return finish();
    }
    state = recorded.state;
    responded.push(entry.roleId);
  }

  const synthesisEntry =
    input.roster.find(({ roleId }) => roleId === input.synthesisRoleId) ?? input.roster[0];
  if (synthesisEntry === undefined) return finish();

  const synthesised = await spend(synthesisEntry, "synthesis");
  if (!synthesised?.ok) return finish();
  const withSynthesis = recordKickoffSynthesis(state, synthesised.payload as KickoffSynthesis);
  if (!withSynthesis.ok) {
    stopped = {
      code: withSynthesis.code,
      detail: "the synthesis was rejected by the kickoff domain",
      atTurn: turnsUsed,
    };
    return finish();
  }
  state = withSynthesis.state;

  for (const entry of input.roster) {
    const outcome = await spend(entry, "revision");
    if (!outcome?.ok) return finish();
    const recorded = recordKickoffRevision(state, outcome.payload as KickoffRevision);
    if (!recorded.ok) {
      stopped = {
        code: recorded.code,
        detail: `${entry.roleId} produced a revision the kickoff domain rejected`,
        atTurn: turnsUsed,
      };
      return finish();
    }
    state = recorded.state;
  }

  return finish();
}
