import { describe, expect, it } from "vitest";

import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";

import {
  runBoundedKickoff,
  type RosterEntry,
  type TurnOutcome,
  type TurnRequest,
} from "./kickoff-run.js";

const ROLE_IDS = ["delivery", "design", "implementation", "test", "visual", "release"];

const briefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_live",
  projectId: "project_live",
  briefingVersion: 1,
  goal: "Assert that every canonical record type carries a validated timestamp.",
  constraints: ["No pre-charter implementation"],
  permissions: ["project.read", "collaboration.contribute"],
  evidenceFloor: ["test", "visual", "release"],
  knowledgeSnapshotId: "snapshot_live",
  managerNonNegotiables: ["Six attributable roles", "One revision maximum"],
  activeRoleIds: ROLE_IDS,
};

const roster: RosterEntry[] = ROLE_IDS.map((roleId, index) => ({
  roleId,
  agentId: `agent_${index}`,
  bindingId: `binding_${index}`,
}));

function contribution(roleId: string): KickoffContribution {
  return {
    schemaVersion: 1,
    contributionId: `contribution_${roleId}`,
    kickoffId: "kickoff_live",
    briefingVersion: 1,
    roleId,
    agentId: `agent_${ROLE_IDS.indexOf(roleId)}`,
    kind: "proposal",
    goal: "Assert every canonical record carries a validated timestamp.",
    value: "Records become attributable in time.",
    risk: "Existing records need a migration decision.",
    dependencies: [],
    acceptanceCriteria: ["A test fails when a record type omits its timestamp"],
    evidenceNeeds: ["unit"],
    uncertainties: [],
    disagreements: [],
  } as unknown as KickoffContribution;
}

function synthesis(overRoleIds: readonly string[] = ROLE_IDS) {
  return {
    synthesisId: "synthesis_live",
    authorRoleId: "delivery",
    proposedGoal: "Assert every canonical record carries a validated timestamp.",
    includedContributionIds: overRoleIds.map((roleId) => `contribution_${roleId}`),
    disagreementRegister: [],
    unresolvedEvidenceGaps: [],
  };
}

function revision(roleId: string) {
  return {
    revisionId: `revision_${roleId}`,
    roleId,
    agentId: `agent_${ROLE_IDS.indexOf(roleId)}`,
    response: "affirm" as const,
    statement: "Affirmed without amendment.",
  };
}

function happyRunner(seen: TurnRequest[] = []) {
  return {
    seen,
    run: async (request: TurnRequest): Promise<TurnOutcome> => {
      seen.push(request);
      if (request.kind === "contribution")
        return { ok: true, payload: contribution(request.roleId) };
      if (request.kind === "synthesis") return { ok: true, payload: synthesis() };
      return { ok: true, payload: revision(request.roleId) };
    },
  };
}

/** A runner where exactly one role fails at one kind of turn and everything else succeeds. */
function runnerFailingAt(
  failRoleId: string,
  failKind: TurnRequest["kind"],
  failure: { code: string; detail: string },
  seen: TurnRequest[] = [],
) {
  const survivors = ROLE_IDS.filter(
    (roleId) => !(roleId === failRoleId && failKind === "contribution"),
  );
  return {
    seen,
    run: async (request: TurnRequest): Promise<TurnOutcome> => {
      seen.push(request);
      if (request.roleId === failRoleId && request.kind === failKind) {
        return { ok: false, ...failure };
      }
      if (request.kind === "contribution")
        return { ok: true, payload: contribution(request.roleId) };
      if (request.kind === "synthesis") return { ok: true, payload: synthesis(survivors) };
      return { ok: true, payload: revision(request.roleId) };
    },
  };
}

describe("bounded kickoff run", () => {
  it("completes the D-25 shape in exactly thirteen turns", async () => {
    const runner = happyRunner();
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runner.run,
    });

    expect(result.stopped).toBeUndefined();
    expect(result.turnsUsed).toBe(13);
    expect(runner.seen.filter((r) => r.kind === "contribution")).toHaveLength(6);
    expect(runner.seen.filter((r) => r.kind === "synthesis")).toHaveLength(1);
    expect(runner.seen.filter((r) => r.kind === "revision")).toHaveLength(6);
    expect(result.silentRoleIds).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it("never requests a fourteenth turn", async () => {
    const runner = happyRunner();
    await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runner.run,
    });
    expect(runner.seen.length).toBeLessThanOrEqual(13);
  });

  it("never authorises implementation, whatever the run produces", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: happyRunner().run,
    });
    expect(result.state.implementationAllowed).toBe(false);
    expect(result.state.charter).toBeUndefined();
  });

  it("asks every remaining role after a contribution fails", async () => {
    const runner = runnerFailingAt("implementation", "contribution", {
      code: "DISCONNECTED",
      detail: "stdio closed mid-turn",
    });
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runner.run,
    });

    // One flaky turn at role three must not silence the three roles behind it. All six are asked
    // and the five that answered are recorded.
    expect(runner.seen.filter((r) => r.kind === "contribution")).toHaveLength(6);
    expect(Object.keys(result.state.contributions)).toHaveLength(5);
    expect(Object.keys(result.state.contributions)).not.toContain("contribution_implementation");
  });

  it("stops before synthesis when the round is under-filled", async () => {
    const runner = runnerFailingAt("implementation", "contribution", {
      code: "DISCONNECTED",
      detail: "stdio closed mid-turn",
    });
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runner.run,
    });

    // A synthesis stands over every active role, and the domain will not produce one otherwise.
    // Stopping here rather than asking is the difference between an honest incomplete round and a
    // document that reads as a complete discussion with a participant quietly missing.
    expect(result.stopped?.code).toBe("ROUND_UNDER_FILLED");
    expect(result.stopped?.detail).toContain("5 of 6");
    expect(runner.seen.filter((r) => r.kind === "synthesis")).toHaveLength(0);
    expect(runner.seen.filter((r) => r.kind === "revision")).toHaveLength(0);
  });

  it("reports a role that failed as failed, never as silent", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runnerFailingAt("implementation", "contribution", {
        code: "DISCONNECTED",
        detail: "stdio closed mid-turn",
      }).run,
    });

    // Silence means never answered. A role that was asked, spent a turn and produced nothing
    // usable is a different fact, and collapsing the two would lose that a turn was spent.
    expect(result.silentRoleIds).toEqual([]);
    expect(result.respondedRoleIds).toEqual(["delivery", "design", "test", "visual", "release"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      kind: "contribution",
      roleId: "implementation",
      code: "DISCONNECTED",
      atTurn: 3,
    });
  });

  it("still spends the turn a failed contribution consumed", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runnerFailingAt("test", "contribution", {
        code: "MALFORMED",
        detail: "unparseable turn output",
      }).run,
    });

    // A failed turn is not free. The budget must reflect what the runtime was actually asked to
    // do, or a run that fails repeatedly could exceed its budget while appearing not to. Six
    // contributions were requested; five were recorded.
    expect(result.turnsUsed).toBe(6);
    expect(Object.keys(result.state.contributions)).toHaveLength(5);
  });

  it("carries on past a failed revision", async () => {
    const runner = runnerFailingAt("visual", "revision", {
      code: "DISCONNECTED",
      detail: "stdio closed mid-turn",
    });
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: runner.run,
    });

    expect(result.stopped).toBeUndefined();
    expect(runner.seen.filter((r) => r.kind === "revision")).toHaveLength(6);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ kind: "revision", roleId: "visual" });
  });

  it("records a domain-rejected payload as that role's failure and continues", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) => {
        if (request.kind === "contribution")
          return request.roleId === "delivery"
            ? { ok: true, payload: { contributionId: "not-a-contribution" } }
            : { ok: true, payload: contribution(request.roleId) };
        if (request.kind === "synthesis")
          return { ok: true, payload: synthesis(ROLE_IDS.filter((r) => r !== "delivery")) };
        return { ok: true, payload: revision(request.roleId) };
      },
    });

    // A malformed payload is the same class of event as a dead connection: this role produced
    // nothing usable. It is never coerced into the round, and it never reads as silence.
    expect(result.stopped?.code).toBe("ROUND_UNDER_FILLED");
    expect(Object.keys(result.state.contributions)).toHaveLength(5);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ kind: "contribution", roleId: "delivery" });
    expect(result.silentRoleIds).toEqual([]);
  });

  it("stops the whole run when a turn reports an external effect", async () => {
    const seen: TurnRequest[] = [];
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) => {
        seen.push(request);
        return request.roleId === "design"
          ? {
              ok: true,
              payload: contribution(request.roleId),
              events: [{ kind: "runtime.command", phase: "item.completed" }],
            }
          : { ok: true, payload: contribution(request.roleId) };
      },
    });

    // Not a per-role failure. An observed external effect means the containment that was meant to
    // prevent it did not hold, so continuing would keep spending turns against a runtime already
    // known to be uncontained.
    expect(result.stopped?.code).toBe("EXTERNAL_EFFECT_OBSERVED");
    expect(seen).toHaveLength(2);
    expect(Object.keys(result.state.contributions)).not.toContain("contribution_design");
    expect(result.silentRoleIds).toEqual(["design", "implementation", "test", "visual", "release"]);
  });

  it("stops before requesting any revision when synthesis fails", async () => {
    const seen: TurnRequest[] = [];
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) => {
        seen.push(request);
        if (request.kind === "synthesis")
          return { ok: false, code: "STALE", detail: "briefing version moved" };
        return { ok: true, payload: contribution(request.roleId) };
      },
    });

    // Revisions are revisions of the synthesis. Continuing without one would ask six roles to
    // respond to a document that does not exist.
    expect(result.stopped?.code).toBe("STALE");
    expect(seen.filter((r) => r.kind === "revision")).toHaveLength(0);
  });

  it("does not synthesise a round in which every contribution failed", async () => {
    const seen: TurnRequest[] = [];
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) => {
        seen.push(request);
        return { ok: false, code: "DISCONNECTED", detail: "stdio closed mid-turn" };
      },
    });

    // Synthesising six failures would produce a document asserting a discussion that never
    // happened. Continuing past individual failures is not the same as inventing a round.
    expect(result.stopped?.code).toBe("NO_CONTRIBUTIONS");
    expect(seen.filter((r) => r.kind === "synthesis")).toHaveLength(0);
    expect(result.failures).toHaveLength(6);
    expect(result.state.synthesis).toBeUndefined();
  });
});
