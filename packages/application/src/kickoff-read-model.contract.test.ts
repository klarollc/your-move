import { describe, expect, it } from "vitest";

import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import { createKickoff, recordKickoffContribution, recordKickoffSynthesis } from "@cuckcode/domain";

import { projectKickoffReadModel } from "./kickoff-read-model.js";

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
  managerNonNegotiables: ["Six roles", "One revision"],
  activeRoleIds: roles,
};

describe("reciprocal kickoff read model", () => {
  it("gives manager and all six agents the same scope, constraints, permissions, conflicts, evidence, and disposition", () => {
    const model = projectKickoffReadModel(synthesized());
    expect(model.manager.entries).toHaveLength(6);
    expect(model.manager.disagreements).toContainEqual({
      roleId: "release",
      statement: "Independent review remains separate",
    });
    expect(model.manager.transcriptRequired).toBe(false);
    expect(model.agents).toHaveLength(6);
    for (const record of model.agents) {
      expect(record.scope).toEqual(model.shared.scope);
      expect(record.constraints).toEqual(model.shared.constraints);
      expect(record.permissions).toEqual(model.shared.permissions);
      expect(record.conflicts).toEqual(model.shared.conflicts);
      expect(record.evidenceRequirements).toEqual(model.shared.evidenceRequirements);
      expect(record.disposition).toEqual(model.shared.disposition);
    }
  });

  it("retains attributable questions/declines and exposes explicit manager edit diffs", () => {
    let state = createKickoff(briefing);
    for (const role of roles) {
      const result = recordKickoffContribution(
        state,
        contribution(
          role,
          role === "visual" ? "question" : role === "release" ? "decline" : "proposal",
        ),
      );
      if (!result.ok) throw new Error(result.code);
      state = result.state;
    }
    const model = projectKickoffReadModel(state, {
      managerDraft: { goal: "Original collaborative goal", scope: ["Attention", "Library"] },
      managerEdit: { goal: "Narrow first goal", scope: ["Attention"] },
    });
    expect(model.manager.entries.find(({ roleId }) => roleId === "visual")).toMatchObject({
      kind: "question",
      agentId: "agent_visual",
    });
    expect(model.manager.entries.find(({ roleId }) => roleId === "release")).toMatchObject({
      kind: "decline",
      agentId: "agent_release",
    });
    expect(model.manager.editDiff).toEqual([
      { field: "goal", before: "Original collaborative goal", after: "Narrow first goal" },
      { field: "scope", before: ["Attention", "Library"], after: ["Attention"] },
    ]);
  });
});

function synthesized() {
  let state = createKickoff(briefing);
  for (const role of roles) {
    const result = recordKickoffContribution(state, contribution(role, "proposal"));
    if (!result.ok) throw new Error(result.code);
    state = result.state;
  }
  const synthesis = recordKickoffSynthesis(state, {
    synthesisId: "synthesis_1",
    authorRoleId: "delivery",
    proposedGoal: "Build a manager-comprehensible office.",
    includedContributionIds: roles.map((role) => `contribution_${role}`),
    disagreementRegister: [{ roleId: "release", statement: "Independent review remains separate" }],
    unresolvedEvidenceGaps: ["Comprehension study"],
  });
  if (!synthesis.ok) throw new Error(synthesis.code);
  return synthesis.state;
}

function contribution(roleId: string, kind: KickoffContribution["kind"]): KickoffContribution {
  return {
    schemaVersion: 1,
    contributionId: `contribution_${roleId}`,
    kickoffId: "kickoff_1",
    briefingVersion: 1,
    roleId,
    agentId: `agent_${roleId}`,
    kind,
    goal: `${roleId} goal`,
    value: `${roleId} value`,
    risk: `${roleId} risk`,
    dependencies: ["Shared context"],
    acceptanceCriteria: ["Evidence recorded"],
    evidenceNeeds: ["test"],
    uncertainties: ["One uncertainty"],
    disagreements: roleId === "release" ? ["Independent review remains separate"] : [],
  };
}
