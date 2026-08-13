import { describe, expect, it } from "vitest";

import {
  createActionableError,
  normalizeCollaborationCommand,
  validateHandoff,
} from "./collaboration.js";

const command = {
  commandId: "collaboration_1",
  projectId: "project_alpha",
  actorId: "agent_1",
  action: "propose" as const,
  targetIds: ["work_notice"],
  summary: "Use deterministic fixtures.",
  requiredPermissions: ["project.read"],
};

describe("reciprocal collaboration contracts", () => {
  it("normalizes human and agent inputs to the same canonical command", () => {
    expect(normalizeCollaborationCommand("human", command)).toEqual(
      normalizeCollaborationCommand("agent", command),
    );
  });

  it("requires handoffs to preserve reconstructable work state", () => {
    const complete = {
      handoffId: "collaboration_handoff",
      fromAgentId: "agent_1",
      toAgentId: "agent_2",
      workItemId: "work_notice",
      decisions: [{ decisionId: "decision_1", summary: "Use the shared schema." }],
      openQuestions: [{ questionId: "question_1", text: "Is browser evidence required?" }],
      uncertainties: [{ uncertaintyId: "uncertainty_1", text: "Font availability is unknown." }],
      artifacts: [{ artifactId: "artifact_notice", version: 2 }],
      evidence: [{ evidenceId: "evidence_unit", version: 1 }],
      nextResponsibility: "Run browser verification.",
    };

    expect(validateHandoff(complete)).toEqual({ ok: true, value: complete });
    expect(validateHandoff({ ...complete, uncertainties: undefined })).toMatchObject({
      ok: false,
      error: { code: "INCOMPLETE_HANDOFF", missingFields: ["uncertainties"] },
    });
  });

  it("creates stable actionable error envelopes", () => {
    expect(
      createActionableError({
        code: "PERMISSION_REQUIRED",
        causeCategory: "authority",
        retrySafe: true,
        requiredAction: "Request project.write from the manager.",
        requiredAuthority: "project.write",
        affectedCanonicalIds: ["work_notice", "agent_1"],
        escalationRoute: "manager_attention",
      }),
    ).toEqual({
      code: "PERMISSION_REQUIRED",
      causeCategory: "authority",
      retrySafe: true,
      requiredAction: "Request project.write from the manager.",
      requiredAuthority: "project.write",
      affectedCanonicalIds: ["agent_1", "work_notice"],
      escalationRoute: "manager_attention",
    });
  });
});
