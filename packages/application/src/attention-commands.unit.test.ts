import { describe, expect, it } from "vitest";

import type { WorkspaceCommand } from "@cuckcode/contracts";

import { executeAttentionCommand } from "./attention-commands.js";

const command: WorkspaceCommand = {
  schemaVersion: 1,
  commandId: "command_attention_approve",
  projectId: "project_alpha",
  expectedRevision: 42,
  actor: { actorType: "manager", actorId: "manager_nater" },
  intent: "approve",
  targetEntityId: "agent_implementation_engineer",
  payload: {
    attentionId: "attention_graybox_review",
    reason: "The deterministic graybox slice meets the bounded review scope.",
  },
};

const current = {
  projectId: "project_alpha",
  revision: 42,
  freshness: "current" as const,
  connection: "connected" as const,
  attention: [
    {
      attentionId: "attention_graybox_review",
      entityId: "agent_implementation_engineer",
      causeEventId: "event_review_requested",
    },
  ],
};

describe("executeAttentionCommand", () => {
  it.each(["approve", "decline", "defer", "cancel", "redirect"] as const)(
    "returns an exact versioned agent-visible receipt for %s",
    (intent) => {
      const result = executeAttentionCommand({
        command: {
          ...command,
          commandId: `command_attention_${intent}`,
          intent,
          payload: {
            ...command.payload,
            ...(intent === "defer" ? { deferUntil: "2026-08-20" } : {}),
            ...(intent === "redirect" ? { redirectEntityId: "agent_delivery_lead" } : {}),
          },
        },
        current,
      });

      expect(result).toEqual({
        ok: true,
        receipt: {
          schemaVersion: 1,
          receiptId: `receipt_command_attention_${intent}`,
          commandId: `command_attention_${intent}`,
          projectId: "project_alpha",
          acceptedRevision: 42,
          resultingRevision: 43,
          attentionId: "attention_graybox_review",
          targetEntityId: "agent_implementation_engineer",
          causeEventId: "event_review_requested",
          actor: { actorType: "manager", actorId: "manager_nater" },
          disposition: intent,
          agentVisible: true,
          technicalScope: {
            expectedRevision: 42,
            correlationId: `command_attention_${intent}`,
          },
        },
      });
    },
  );

  it.each([
    [{ ...current, freshness: "stale" as const }, "ATTENTION_WORKSPACE_STALE"],
    [{ ...current, connection: "timeout" as const }, "ATTENTION_COMMAND_TIMEOUT"],
    [{ ...current, connection: "disconnected" as const }, "ATTENTION_COMMAND_DISCONNECTED"],
  ])("fails closed when the workspace is unavailable", (unavailable, code) => {
    expect(executeAttentionCommand({ command, current: unavailable })).toEqual({
      ok: false,
      code,
      retrySafe: true,
      requiredAction: "Refresh the current workspace before retrying this disposition.",
    });
  });

  it("rejects stale revisions, cross-target attention, non-manager authority, and missing intent scope", () => {
    expect(
      executeAttentionCommand({ command: { ...command, expectedRevision: 41 }, current }),
    ).toMatchObject({ ok: false, code: "WORKSPACE_COMMAND_STALE" });
    expect(
      executeAttentionCommand({
        command: { ...command, targetEntityId: "agent_test_engineer" },
        current,
      }),
    ).toMatchObject({ ok: false, code: "ATTENTION_TARGET_MISMATCH" });
    expect(
      executeAttentionCommand({
        command: { ...command, actor: { actorType: "agent", actorId: "agent_test_engineer" } },
        current,
      }),
    ).toMatchObject({ ok: false, code: "WORKSPACE_AUTHORITY_INVALID" });
    expect(
      executeAttentionCommand({
        command: { ...command, intent: "defer", payload: command.payload },
        current,
      }),
    ).toMatchObject({ ok: false, code: "ATTENTION_SCOPE_INVALID" });
  });
});
