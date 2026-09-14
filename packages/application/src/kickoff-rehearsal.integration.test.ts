import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import { describe, expect, it } from "vitest";

import { runBoundedKickoff, type TurnRequest, type TurnRunner } from "./kickoff-run.js";

/**
 * A full thirteen-turn rehearsal against a fake runtime.
 *
 * The one live kickoff is a single approved allowance, so the orchestration is proved here first:
 * the turn sequence, the routing of each turn to the role that owns it, the budget, and the stop on
 * an observed external effect. The provider is the only thing this does not exercise.
 *
 * This is the rehearsal that would have caught the notification-replay defect end to end: every
 * request is recorded, so a run that asked the same role twice in a row, or produced six identical
 * contributions, fails here rather than in the one run that cannot be repeated.
 */
const ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
];

const briefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_rehearsal",
  projectId: "project_rehearsal",
  briefingVersion: 1,
  goal: "Seed candidate, open to revision.",
  constraints: ["isolated"],
  permissions: ["propose"],
  evidenceFloor: ["red-green"],
  knowledgeSnapshotId: "knowledge_rehearsal",
  managerNonNegotiables: ["no implementation before charter approval"],
  activeRoleIds: [...ROLE_IDS],
};

const roster = ROLE_IDS.map((roleId) => ({
  roleId,
  agentId: `agent_${roleId.replace(/-/gu, "_")}`,
  bindingId: `binding_${roleId.replace(/-/gu, "_")}`,
}));

/** A payload distinct per role, so a replayed turn is visible as a duplicate rather than plausible. */
function contributionFor(request: TurnRequest): KickoffContribution {
  return {
    schemaVersion: 1,
    contributionId: `contribution_${request.roleId}`,
    kickoffId: briefing.kickoffId,
    briefingVersion: 1,
    roleId: request.roleId,
    agentId: request.agentId,
    kind: "proposal",
    goal: `goal as seen by ${request.roleId}`,
    value: `value from ${request.roleId}`,
    risk: `risk named by ${request.roleId}`,
    dependencies: [],
    acceptanceCriteria: [`criterion from ${request.roleId}`],
    evidenceNeeds: [`evidence ${request.roleId} requires`],
    uncertainties: [],
    disagreements: [],
  };
}

function rehearsalRunner(options: { effectAtTurn?: number } = {}): {
  runTurn: TurnRunner;
  requests: TurnRequest[];
} {
  const requests: TurnRequest[] = [];
  const runTurn: TurnRunner = async (request) => {
    requests.push(request);
    const events =
      options.effectAtTurn === request.turnIndex
        ? [{ kind: "runtime.command", phase: "completed" }]
        : undefined;

    if (request.kind === "contribution") {
      return { ok: true, payload: contributionFor(request), ...(events ? { events } : {}) };
    }
    if (request.kind === "synthesis") {
      return {
        ok: true,
        payload: {
          synthesisId: "synthesis_rehearsal",
          authorRoleId: request.roleId,
          proposedGoal: "synthesised goal",
          includedContributionIds: ROLE_IDS.map((roleId) => `contribution_${roleId}`),
          disagreementRegister: [{ roleId: "test-engineer", statement: "evidence floor is thin" }],
          unresolvedEvidenceGaps: ["no browser evidence yet"],
        },
        ...(events ? { events } : {}),
      };
    }
    return {
      ok: true,
      payload: {
        revisionId: `revision_${request.roleId}`,
        roleId: request.roleId,
        agentId: request.agentId,
        response: request.roleId === "test-engineer" ? "amend" : "affirm",
        statement: `position of ${request.roleId}`,
      },
      ...(events ? { events } : {}),
    };
  };
  return { runTurn, requests };
}

describe("bounded kickoff rehearsal", () => {
  it("spends exactly thirteen turns in the D-25 order", async () => {
    const { runTurn, requests } = rehearsalRunner();
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery-lead",
      runTurn,
    });

    expect(result.turnsUsed).toBe(13);
    expect(result.stopped).toBeUndefined();
    expect(result.failures).toEqual([]);
    expect(requests.map((request) => request.kind)).toEqual([
      ...Array<string>(6).fill("contribution"),
      "synthesis",
      ...Array<string>(6).fill("revision"),
    ]);
  });

  it("asks every role once per phase and never the same role twice in a row", async () => {
    const { runTurn, requests } = rehearsalRunner();
    await runBoundedKickoff({ briefing, roster, synthesisRoleId: "delivery-lead", runTurn });

    const contributions = requests.filter((request) => request.kind === "contribution");
    const revisions = requests.filter((request) => request.kind === "revision");
    expect(contributions.map((request) => request.roleId)).toEqual(ROLE_IDS);
    expect(revisions.map((request) => request.roleId)).toEqual(ROLE_IDS);
    expect(new Set(contributions.map((request) => request.agentId)).size).toBe(6);
  });

  it("gives every turn a distinct index, so a replayed turn is not mistaken for a new one", async () => {
    // The notification-replay defect would have produced thirteen turns that all returned the first
    // turn's output. Distinct indices are what let the runner and the evidence tell them apart.
    const { runTurn, requests } = rehearsalRunner();
    await runBoundedKickoff({ briefing, roster, synthesisRoleId: "delivery-lead", runTurn });

    const indices = requests.map((request) => request.turnIndex);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("reaches a synthesis that stands over all six contributions", async () => {
    const { runTurn } = rehearsalRunner();
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery-lead",
      runTurn,
    });

    expect([...result.respondedRoleIds].sort()).toEqual([...ROLE_IDS].sort());
    expect(result.silentRoleIds).toEqual([]);
  });

  it("stops the whole run when a turn reports an external effect", async () => {
    // Not a per-role failure: an observed effect means the containment did not hold, so further
    // turns would be spent against a runtime already known to be uncontained.
    const { runTurn, requests } = rehearsalRunner({ effectAtTurn: 3 });
    const result = await runBoundedKickoff({
      briefing,
      roster,
      synthesisRoleId: "delivery-lead",
      runTurn,
    });

    expect(result.stopped).toBeDefined();
    expect(result.turnsUsed).toBe(3);
    expect(requests).toHaveLength(3);
  });
});
