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

/**
 * One turn that was spent and produced nothing usable, whether the runtime failed outright or
 * returned a payload the kickoff domain refused. Distinct from silence: a role listed here was
 * asked and cost a turn.
 */
export type TurnFailure = Readonly<{
  kind: TurnKind;
  roleId: string;
  code: string;
  detail: string;
  atTurn: number;
}>;

export type KickoffRunResult = Readonly<{
  state: KickoffState;
  turnsUsed: number;
  respondedRoleIds: readonly string[];
  silentRoleIds: readonly string[];
  failures: readonly TurnFailure[];
  stopped?: Readonly<{ code: string; detail: string; atTurn: number }>;
}>;

/**
 * Drives one bounded D-25 kickoff and stops rather than repairing.
 *
 * Four properties are deliberate and load-bearing:
 *
 * - **A failed turn is that role's failure, not the round's.** One dead connection at role three
 *   must not silence the three roles behind it. The round continues, is under-filled, and says so.
 * - **Silence and failure are different facts.** A role that was never asked is silent. A role
 *   that was asked, spent a turn and produced nothing usable is a recorded failure. Collapsing
 *   them would lose that a turn was spent, and silence must never read as assent.
 * - **A well-formed payload is not sufficient.** If a turn also reported a command, file, tool or
 *   artifact effect, the whole run stops. That is not a per-role failure: it means the containment
 *   meant to prevent the effect did not hold, so further turns would be spent against a runtime
 *   already known to be uncontained.
 * - **The budget is checked before a turn is spent**, so a fourteenth turn is never requested
 *   rather than detected afterwards. A failed turn still costs, because the runtime was asked.
 *
 * Three conditions still end the whole run: the budget, an observed external effect, and a failed
 * synthesis — revisions are revisions *of* the synthesis, so continuing without one would ask six
 * roles to respond to a document that does not exist. A round in which every contribution failed
 * stops before synthesis rather than synthesising a discussion that never happened.
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
  const failures: TurnFailure[] = [];
  const counts = { contributions: 0, syntheses: 0, revisions: 0 };
  let turnsUsed = 0;
  let stopped: KickoffRunResult["stopped"];

  const failedContribution = new Set<string>();

  const finish = (): KickoffRunResult => ({
    state,
    turnsUsed,
    respondedRoleIds: responded,
    // Silent means never answered. A role whose contribution failed is accounted for in
    // `failures`, and listing it here as well would report one spent turn as two different facts.
    silentRoleIds: input.roster
      .map(({ roleId }) => roleId)
      .filter((roleId) => !responded.includes(roleId) && !failedContribution.has(roleId)),
    failures,
    ...(stopped ? { stopped } : {}),
  });

  const note = (kind: TurnKind, roleId: string, code: string, detail: string): void => {
    failures.push({ kind, roleId, code, detail, atTurn: turnsUsed });
    if (kind === "contribution") failedContribution.add(roleId);
  };

  type SpendResult =
    | Readonly<{ status: "ok"; payload: unknown }>
    | Readonly<{ status: "failed" }>
    | Readonly<{ status: "halted" }>;

  const spend = async (entry: RosterEntry, kind: TurnKind): Promise<SpendResult> => {
    const projected = { ...counts };
    if (kind === "contribution") projected.contributions += 1;
    if (kind === "synthesis") projected.syntheses += 1;
    if (kind === "revision") projected.revisions += 1;

    const budget = checkTurnBudget(projected);
    if (budget) {
      stopped = { code: budget.code, detail: budget.detail, atTurn: turnsUsed };
      return { status: "halted" };
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
        return { status: "halted" };
      }
    }

    if (!outcome.ok) {
      note(kind, entry.roleId, outcome.code, outcome.detail);
      return { status: "failed" };
    }

    return { status: "ok", payload: outcome.payload };
  };

  for (const entry of input.roster) {
    const spent = await spend(entry, "contribution");
    if (spent.status === "halted") return finish();
    if (spent.status === "failed") continue;

    const recorded = recordKickoffContribution(state, spent.payload as KickoffContribution);
    if (!recorded.ok) {
      // A payload the domain refuses is the same class of event as a dead connection: this role
      // produced nothing usable. It is never coerced into the round.
      note(
        "contribution",
        entry.roleId,
        recorded.code,
        `${entry.roleId} produced a contribution the kickoff domain rejected`,
      );
      continue;
    }
    state = recorded.state;
    responded.push(entry.roleId);
  }

  if (responded.length === 0) {
    stopped = {
      code: "NO_CONTRIBUTIONS",
      detail: "no role produced a usable contribution, so there is nothing to synthesise",
      atTurn: turnsUsed,
    };
    return finish();
  }

  // D-25 defines a synthesis as standing over every active role, and the domain enforces it: the
  // round only reaches `ready_for_synthesis` once each active role has contributed. Carrying on
  // past a failed contribution therefore means asking every remaining role — which is the point,
  // since a failure at role three must not silence roles four through six — and then stopping here
  // rather than asking the domain for a synthesis it will refuse. A synthesis missing a
  // participant would read as a complete discussion; that substitution is what this stop prevents.
  if (responded.length < input.roster.length) {
    stopped = {
      code: "ROUND_UNDER_FILLED",
      detail:
        `${responded.length} of ${input.roster.length} roles contributed; ` +
        "a synthesis stands over every active role",
      atTurn: turnsUsed,
    };
    return finish();
  }

  const synthesisEntry =
    input.roster.find(({ roleId }) => roleId === input.synthesisRoleId) ?? input.roster[0];
  if (synthesisEntry === undefined) return finish();

  const synthesised = await spend(synthesisEntry, "synthesis");
  if (synthesised.status !== "ok") {
    if (synthesised.status === "failed") {
      const last = failures[failures.length - 1];
      if (last) stopped = { code: last.code, detail: last.detail, atTurn: last.atTurn };
    }
    return finish();
  }

  const withSynthesis = recordKickoffSynthesis(
    state,
    synthesised.payload as KickoffSynthesis,
    input.synthesisRoleId,
  );
  if (!withSynthesis.ok) {
    note(
      "synthesis",
      synthesisEntry.roleId,
      withSynthesis.code,
      "the synthesis was rejected by the kickoff domain",
    );
    stopped = {
      code: withSynthesis.code,
      detail: "the synthesis was rejected by the kickoff domain",
      atTurn: turnsUsed,
    };
    return finish();
  }
  state = withSynthesis.state;

  for (const entry of input.roster) {
    const spent = await spend(entry, "revision");
    if (spent.status === "halted") return finish();
    if (spent.status === "failed") continue;

    const recorded = recordKickoffRevision(state, spent.payload as KickoffRevision);
    if (!recorded.ok) {
      note(
        "revision",
        entry.roleId,
        recorded.code,
        `${entry.roleId} produced a revision the kickoff domain rejected`,
      );
      continue;
    }
    state = recorded.state;
  }

  return finish();
}
