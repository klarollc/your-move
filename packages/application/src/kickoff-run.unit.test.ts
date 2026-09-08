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

function synthesis() {
  return {
    synthesisId: "synthesis_live",
    authorRoleId: "delivery",
    proposedGoal: "Assert every canonical record carries a validated timestamp.",
    includedContributionIds: ROLE_IDS.map((roleId) => `contribution_${roleId}`),
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

  it("stops on a failed contribution without fabricating one for that role", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) =>
        request.roleId === "implementation"
          ? { ok: false, code: "DISCONNECTED", detail: "stdio closed mid-turn" }
          : { ok: true, payload: contribution(request.roleId) },
    });

    expect(result.stopped?.code).toBe("DISCONNECTED");
    expect(Object.keys(result.state.contributions)).not.toContain("contribution_implementation");
    expect(result.state.synthesis).toBeUndefined();
  });

  it("records every role that never answered as silent, never as agreement", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) =>
        request.roleId === "implementation"
          ? { ok: false, code: "DISCONNECTED", detail: "stdio closed mid-turn" }
          : { ok: true, payload: contribution(request.roleId) },
    });

    // The three roles after the failure were never asked. Silence is not assent, and a stopped
    // run must not let an unasked role read as one that agreed.
    expect(result.silentRoleIds).toEqual(["implementation", "test", "visual", "release"]);
    expect(result.respondedRoleIds).toEqual(["delivery", "design"]);
  });

  it("preserves the partial record produced before the stop", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) =>
        request.roleId === "test"
          ? { ok: false, code: "MALFORMED", detail: "unparseable turn output" }
          : { ok: true, payload: contribution(request.roleId) },
    });

    expect(Object.keys(result.state.contributions)).toHaveLength(3);
    expect(result.turnsUsed).toBe(4);
  });

  it("stops when a turn reports an external effect, even though its payload was well formed", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) =>
        request.roleId === "design"
          ? {
              ok: true,
              payload: contribution(request.roleId),
              events: [{ kind: "runtime.command", phase: "item.completed" }],
            }
          : { ok: true, payload: contribution(request.roleId) },
    });

    // A well-formed contribution accompanied by a shell command is not an acceptable turn. The
    // payload being valid is exactly what makes this the dangerous case.
    expect(result.stopped?.code).toBe("EXTERNAL_EFFECT_OBSERVED");
    expect(Object.keys(result.state.contributions)).not.toContain("contribution_design");
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

    expect(result.stopped?.code).toBe("STALE");
    expect(seen.filter((r) => r.kind === "revision")).toHaveLength(0);
  });

  it("refuses a payload the kickoff domain rejects rather than coercing it", async () => {
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery",
      runTurn: async (request) =>
        request.roleId === "delivery"
          ? { ok: true, payload: { contributionId: "not-a-contribution" } }
          : { ok: true, payload: contribution(request.roleId) },
    });

    expect(result.stopped).toBeDefined();
    expect(Object.keys(result.state.contributions)).toHaveLength(0);
  });
});
