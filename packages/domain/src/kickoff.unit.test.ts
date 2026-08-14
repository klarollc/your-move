import { describe, expect, it } from "vitest";

import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";

import {
  approveKickoffCharter,
  createKickoff,
  recordKickoffContribution,
  recordKickoffRevision,
  recordKickoffSynthesis,
  redirectKickoff,
} from "./kickoff.js";

const roles = ["delivery", "design", "implementation", "test", "visual", "release"];
const briefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_1",
  projectId: "project_graybox",
  briefingVersion: 1,
  goal: "Choose the first project goal collaboratively.",
  constraints: ["No pre-charter implementation"],
  permissions: ["project.read", "collaboration.contribute"],
  evidenceFloor: ["test", "visual", "release"],
  knowledgeSnapshotId: "snapshot_42",
  managerNonNegotiables: ["Six roles", "One revision maximum"],
  activeRoleIds: roles,
};

describe("D-25 kickoff aggregate", () => {
  it("shares one briefing, collects exactly six initial entries, and preserves dissent in synthesis", () => {
    let state = createKickoff(briefing);
    for (const role of roles) {
      const result = recordKickoffContribution(state, contribution(role));
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.phase).toBe("ready_for_synthesis");
    expect(Object.values(state.contributions)).toHaveLength(6);
    expect(
      new Set(Object.values(state.contributions).map(({ briefingVersion }) => briefingVersion)),
    ).toEqual(new Set([1]));

    const synthesis = recordKickoffSynthesis(state, {
      synthesisId: "synthesis_1",
      authorRoleId: "delivery",
      proposedGoal: "Build the manager attention office slice.",
      includedContributionIds: roles.map((role) => `contribution_${role}`),
      disagreementRegister: [
        { roleId: "visual", statement: "Graybox evidence cannot approve final art." },
        { roleId: "release", statement: "Release review must remain independent." },
      ],
      unresolvedEvidenceGaps: ["Five-person comprehension evidence"],
    });
    expect(synthesis).toMatchObject({ ok: true, state: { phase: "revision" } });
    if (synthesis.ok) {
      expect(synthesis.state.synthesis?.disagreementRegister).toHaveLength(2);
      expect(JSON.stringify(synthesis.state)).toContain(
        "Graybox evidence cannot approve final art",
      );
    }
  });

  it("allows one attributable revision per role and never treats silence as affirmation", () => {
    let state = synthesized();
    const first = recordKickoffRevision(state, {
      revisionId: "revision_design",
      roleId: "design",
      agentId: "agent_design",
      response: "amend",
      statement: "Name the evidence origin in the UI.",
    });
    expect(first).toMatchObject({ ok: true });
    if (first.ok) state = first.state;
    expect(
      recordKickoffRevision(state, {
        revisionId: "revision_design_again",
        roleId: "design",
        agentId: "agent_design",
        response: "affirm",
        statement: "Second response",
      }),
    ).toEqual({ ok: false, code: "KICKOFF_REVISION_LIMIT" });
    expect(state.revisions.design?.response).toBe("amend");
    expect(state.revisions.release).toBeUndefined();
    expect(state.phase).toBe("revision");
  });

  it("blocks active work until an explicit complete manager-approved charter", () => {
    const state = synthesized();
    expect(state.implementationAllowed).toBe(false);
    expect(
      approveKickoffCharter(state, {
        charterId: "charter_1",
        version: 1,
        managerId: "manager_local",
        goal: "",
        scope: ["Office attention"],
        constraints: ["No high fidelity"],
        acceptanceCriteria: ["Tests pass"],
        evidenceRequirements: ["test", "visual", "release"],
        disposition: "approve",
      }),
    ).toEqual({ ok: false, code: "KICKOFF_CHARTER_INCOMPLETE" });
    const approved = approveKickoffCharter(state, {
      charterId: "charter_1",
      version: 1,
      managerId: "manager_local",
      goal: "Build the manager attention office slice.",
      scope: ["Office attention"],
      constraints: ["No high fidelity"],
      acceptanceCriteria: ["Tests pass"],
      evidenceRequirements: ["test", "visual", "release"],
      disposition: "approve",
    });
    expect(approved).toMatchObject({
      ok: true,
      state: { phase: "chartered", implementationAllowed: true },
    });
  });

  it("redirects without deleting evidence or opening an unbounded round", () => {
    const state = synthesized();
    const redirected = redirectKickoff(state, {
      managerId: "manager_local",
      disposition: "redirect",
      reason: "Narrow the first goal.",
    });
    expect(redirected).toMatchObject({
      ok: true,
      state: { phase: "redirected", implementationAllowed: false, round: 1 },
    });
    if (redirected.ok) {
      expect(Object.keys(redirected.state.contributions)).toHaveLength(6);
      expect(
        redirectKickoff(redirected.state, {
          managerId: "manager_local",
          disposition: "reject",
          reason: "Again",
        }),
      ).toEqual({ ok: false, code: "KICKOFF_ROUND_CLOSED" });
    }
  });
});

function contribution(roleId: string): KickoffContribution {
  return {
    schemaVersion: 1,
    contributionId: `contribution_${roleId}`,
    kickoffId: "kickoff_1",
    briefingVersion: 1,
    roleId,
    agentId: `agent_${roleId}`,
    kind: roleId === "release" ? "critique" : "proposal",
    goal: `${roleId} goal`,
    value: `${roleId} value`,
    risk: `${roleId} risk`,
    dependencies: [`${roleId} dependency`],
    acceptanceCriteria: [`${roleId} acceptance`],
    evidenceNeeds: [`${roleId} evidence`],
    uncertainties: [`${roleId} uncertainty`],
    disagreements: roleId === "release" ? ["Independent review remains separate"] : [],
  };
}

function synthesized() {
  let state = createKickoff(briefing);
  for (const role of roles) {
    const result = recordKickoffContribution(state, contribution(role));
    if (!result.ok) throw new Error(result.code);
    state = result.state;
  }
  const result = recordKickoffSynthesis(state, {
    synthesisId: "synthesis_1",
    authorRoleId: "delivery",
    proposedGoal: "Build the manager attention office slice.",
    includedContributionIds: roles.map((role) => `contribution_${role}`),
    disagreementRegister: [{ roleId: "release", statement: "Independent review remains separate" }],
    unresolvedEvidenceGaps: ["Comprehension evidence"],
  });
  if (!result.ok) throw new Error(result.code);
  return result.state;
}
