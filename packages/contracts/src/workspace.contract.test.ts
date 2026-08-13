import { describe, expect, it } from "vitest";

import { validateWorkspaceCommand, validateWorkspaceReadModel } from "./workspace.js";

const readModel = {
  schemaVersion: 1,
  revision: 7,
  projectId: "project_fixture",
  generatedAt: "2026-08-13T18:00:00.000Z",
  projectBar: {
    projectName: "Decision Notice",
    outcome: "Choose the bounded initial charter",
    runtimeHealth: "connected",
  },
  entities: [
    {
      entityId: "agent_delivery",
      entityType: "agent",
      label: "Delivery Lead",
      state: "waiting",
      zone: "manager_attention",
      behavior: "attention_request",
      causeEventId: "event_007",
      updatedAt: "2026-08-13T17:59:00.000Z",
      freshness: "current",
      domTwinId: "office-agent_delivery",
      canvasTwinId: "scene-agent_delivery",
      actionable: {
        summary: "Needs the manager to choose a scope boundary.",
        requiredAction: "Review the scope question.",
        requiredAuthority: "manager",
        evidenceIds: ["evidence_scope"],
      },
    },
  ],
  attention: [
    {
      attentionId: "attention_scope",
      entityId: "agent_delivery",
      reason: "waiting_input",
      priority: 10,
      causeEventId: "event_007",
    },
  ],
};

describe("workspace read-model contract", () => {
  it("accepts canonical entities with stable DOM and canvas twins", () => {
    expect(validateWorkspaceReadModel(readModel)).toEqual({ ok: true, value: readModel });
  });

  it("rejects missing twin, cause, freshness, and cross-entity attention references", () => {
    const invalidModels = [
      { ...readModel, entities: [{ ...readModel.entities[0], domTwinId: "" }] },
      { ...readModel, entities: [{ ...readModel.entities[0], causeEventId: null }] },
      { ...readModel, entities: [{ ...readModel.entities[0], freshness: "unknown" }] },
      { ...readModel, attention: [{ ...readModel.attention[0], entityId: "agent_missing" }] },
    ];

    for (const invalid of invalidModels) {
      expect(validateWorkspaceReadModel(invalid)).toEqual({
        ok: false,
        code: "WORKSPACE_READ_MODEL_INVALID",
      });
    }
  });
});

describe("workspace command contract", () => {
  it("accepts an exact manager command against the current project revision", () => {
    const command = {
      schemaVersion: 1,
      commandId: "command_select_delivery",
      projectId: "project_fixture",
      expectedRevision: 7,
      actor: { actorType: "manager", actorId: "manager_owner" },
      intent: "select_entity",
      targetEntityId: "agent_delivery",
      payload: {},
    };

    expect(
      validateWorkspaceCommand(command, { projectId: "project_fixture", revision: 7 }),
    ).toEqual({ ok: true, value: command });
  });

  it("fails closed for stale, cross-project, secret-bearing, or provider-authored manager commands", () => {
    const base = {
      schemaVersion: 1,
      commandId: "command_fixture",
      projectId: "project_fixture",
      expectedRevision: 7,
      actor: { actorType: "manager", actorId: "manager_owner" },
      intent: "select_entity",
      targetEntityId: "agent_delivery",
      payload: {},
    };
    const cases = [
      [{ ...base, expectedRevision: 6 }, "WORKSPACE_COMMAND_STALE"],
      [{ ...base, projectId: "project_other" }, "WORKSPACE_PROJECT_MISMATCH"],
      [{ ...base, payload: { apiKey: "sk-canary" } }, "WORKSPACE_COMMAND_SECRET"],
      [
        { ...base, actor: { actorType: "provider", actorId: "codex" }, intent: "approve" },
        "WORKSPACE_AUTHORITY_INVALID",
      ],
    ] as const;

    for (const [command, code] of cases) {
      expect(
        validateWorkspaceCommand(command, { projectId: "project_fixture", revision: 7 }),
      ).toEqual({ ok: false, code });
    }
  });
});
