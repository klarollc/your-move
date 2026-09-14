import { describe, expect, it } from "vitest";

import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import { createKickoff } from "@cuckcode/domain";

import { executeKickoffCommand } from "./kickoff-commands.js";

const roles = ["delivery", "design", "implementation", "test", "visual", "release"];
const briefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_1",
  projectId: "project_graybox",
  briefingVersion: 1,
  goal: "Choose collaboratively.",
  constraints: ["No pre-charter work"],
  permissions: ["collaboration.contribute"],
  evidenceFloor: ["test", "visual", "release"],
  knowledgeSnapshotId: "snapshot_42",
  managerNonNegotiables: ["One revision"],
  activeRoleIds: roles,
};

describe("executeKickoffCommand", () => {
  it("returns exact versioned receipts and keeps implementation blocked during contribution", () => {
    const result = executeKickoffCommand({
      state: createKickoff(briefing),
      currentRevision: 8,
      synthesisRoleId: "delivery",
      command: {
        commandId: "command_contribute_design",
        expectedRevision: 8,
        actor: { actorType: "agent", actorId: "agent_design" },
        intent: "contribute",
        payload: contribution("design"),
      },
    });
    expect(result).toMatchObject({
      ok: true,
      state: { phase: "contribution", implementationAllowed: false },
      receipt: {
        receiptId: "receipt_command_contribute_design",
        acceptedRevision: 8,
        resultingRevision: 9,
        intent: "contribute",
        actorId: "agent_design",
        kickoffId: "kickoff_1",
        implementationAllowed: false,
      },
    });
  });

  it("fails closed for stale commands and manager-only dispositions", () => {
    const state = createKickoff(briefing);
    expect(
      executeKickoffCommand({
        state,
        currentRevision: 8,
        synthesisRoleId: "delivery",
        command: {
          commandId: "command_stale",
          expectedRevision: 7,
          actor: { actorType: "agent", actorId: "agent_design" },
          intent: "contribute",
          payload: contribution("design"),
        },
      }),
    ).toEqual({
      ok: false,
      code: "KICKOFF_COMMAND_STALE",
      retrySafe: true,
      requiredAction: "Refresh the kickoff record before retrying.",
    });
    expect(
      executeKickoffCommand({
        state,
        currentRevision: 8,
        synthesisRoleId: "delivery",
        command: {
          commandId: "command_approve",
          expectedRevision: 8,
          actor: { actorType: "agent", actorId: "agent_design" },
          intent: "approve_charter",
          payload: {},
        },
      }),
    ).toEqual({ ok: false, code: "KICKOFF_MANAGER_AUTHORITY_REQUIRED" });
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
    kind: "proposal",
    goal: `${roleId} goal`,
    value: `${roleId} value`,
    risk: `${roleId} risk`,
    dependencies: ["Shared context"],
    acceptanceCriteria: ["Evidence recorded"],
    evidenceNeeds: ["test"],
    uncertainties: [],
    disagreements: [],
  };
}
