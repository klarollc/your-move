import { describe, expect, it } from "vitest";

import { validateKickoffBriefing, validateKickoffContribution } from "./kickoff.js";

const roleIds = ["delivery", "design", "implementation", "test", "visual", "release"];

describe("D-25 kickoff contracts", () => {
  it("accepts one versioned equal briefing for exactly six distinct active roles", () => {
    expect(
      validateKickoffBriefing({
        schemaVersion: 1,
        kickoffId: "kickoff_1",
        projectId: "project_graybox",
        briefingVersion: 1,
        goal: "Choose the first project goal collaboratively.",
        constraints: ["No pre-charter implementation", "Evidence is required"],
        permissions: ["project.read", "collaboration.contribute"],
        evidenceFloor: ["test", "visual", "release"],
        knowledgeSnapshotId: "snapshot_42",
        managerNonNegotiables: ["Six attributable roles", "One revision maximum"],
        activeRoleIds: roleIds,
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects unequal, duplicate, missing-role, secret-bearing, and mutable briefing inputs", () => {
    const base = {
      schemaVersion: 1,
      kickoffId: "kickoff_1",
      projectId: "project_graybox",
      briefingVersion: 1,
      goal: "Collaborative goal",
      constraints: ["No implementation"],
      permissions: ["project.read"],
      evidenceFloor: ["test"],
      knowledgeSnapshotId: "snapshot_42",
      managerNonNegotiables: ["One round"],
      activeRoleIds: roleIds,
    };
    expect(validateKickoffBriefing({ ...base, activeRoleIds: roleIds.slice(0, 5) })).toEqual({
      ok: false,
      code: "KICKOFF_ROSTER_INVALID",
    });
    expect(
      validateKickoffBriefing({ ...base, activeRoleIds: [...roleIds.slice(0, 5), "design"] }),
    ).toEqual({
      ok: false,
      code: "KICKOFF_ROSTER_INVALID",
    });
    expect(
      validateKickoffBriefing({ ...base, permissions: ["authorization: bearer private"] }),
    ).toEqual({
      ok: false,
      code: "KICKOFF_SECRET_REJECTED",
    });
  });

  it("requires attributable proposal fields and the exact shared briefing version", () => {
    const contribution = {
      schemaVersion: 1,
      contributionId: "contribution_design_1",
      kickoffId: "kickoff_1",
      briefingVersion: 1,
      roleId: "design",
      agentId: "agent_design",
      kind: "proposal",
      goal: "Clarify the manager journey.",
      value: "Reduces technical translation cost.",
      risk: "May hide useful detail.",
      dependencies: ["Shared evidence model"],
      acceptanceCriteria: ["Five managers can locate attention"],
      evidenceNeeds: ["Comprehension evidence"],
      uncertainties: ["Final art direction is unapproved"],
      disagreements: ["Do not open the inspector by default"],
    };
    expect(
      validateKickoffContribution(contribution, { kickoffId: "kickoff_1", briefingVersion: 1 }),
    ).toMatchObject({ ok: true });
    expect(
      validateKickoffContribution(
        { ...contribution, briefingVersion: 2 },
        { kickoffId: "kickoff_1", briefingVersion: 1 },
      ),
    ).toEqual({ ok: false, code: "KICKOFF_BRIEFING_MISMATCH" });
    expect(
      validateKickoffContribution(
        { ...contribution, disagreements: undefined },
        { kickoffId: "kickoff_1", briefingVersion: 1 },
      ),
    ).toEqual({ ok: false, code: "KICKOFF_CONTRIBUTION_INVALID" });
  });
});
