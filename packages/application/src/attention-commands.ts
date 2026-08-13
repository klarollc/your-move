import {
  validateWorkspaceCommand,
  type WorkspaceCommand,
  type WorkspaceIssueCode,
} from "@cuckcode/contracts";

const attentionIntents = ["approve", "decline", "defer", "cancel", "redirect"] as const;
type AttentionIntent = (typeof attentionIntents)[number];

type AttentionContext = Readonly<{
  projectId: string;
  revision: number;
  freshness: "current" | "stale";
  connection: "connected" | "timeout" | "disconnected";
  attention: ReadonlyArray<
    Readonly<{
      attentionId: string;
      entityId: string;
      causeEventId: string;
    }>
  >;
}>;

export type AttentionCommandReceipt = Readonly<{
  schemaVersion: 1;
  receiptId: string;
  commandId: string;
  projectId: string;
  acceptedRevision: number;
  resultingRevision: number;
  attentionId: string;
  targetEntityId: string;
  causeEventId: string;
  actor: WorkspaceCommand["actor"];
  disposition: AttentionIntent;
  agentVisible: true;
  technicalScope: Readonly<{ expectedRevision: number; correlationId: string }>;
}>;

type AttentionCommandFailureCode =
  | WorkspaceIssueCode
  | "ATTENTION_WORKSPACE_STALE"
  | "ATTENTION_COMMAND_TIMEOUT"
  | "ATTENTION_COMMAND_DISCONNECTED"
  | "ATTENTION_NOT_FOUND"
  | "ATTENTION_TARGET_MISMATCH"
  | "ATTENTION_SCOPE_INVALID";

type AttentionCommandResult =
  | Readonly<{ ok: true; receipt: AttentionCommandReceipt }>
  | Readonly<{
      ok: false;
      code: AttentionCommandFailureCode;
      retrySafe?: true;
      requiredAction?: string;
    }>;

export function executeAttentionCommand(input: Readonly<{
  command: WorkspaceCommand;
  current: AttentionContext;
}>): AttentionCommandResult {
  if (input.current.freshness !== "current") return unavailable("ATTENTION_WORKSPACE_STALE");
  if (input.current.connection === "timeout") return unavailable("ATTENTION_COMMAND_TIMEOUT");
  if (input.current.connection === "disconnected") {
    return unavailable("ATTENTION_COMMAND_DISCONNECTED");
  }

  const validation = validateWorkspaceCommand(input.command, input.current);
  if (!validation.ok) return { ok: false, code: validation.code };
  if (!isAttentionIntent(validation.value.intent)) {
    return { ok: false, code: "ATTENTION_SCOPE_INVALID" };
  }

  const attentionId = validation.value.payload.attentionId;
  if (typeof attentionId !== "string" || attentionId.length === 0) {
    return { ok: false, code: "ATTENTION_SCOPE_INVALID" };
  }
  const attention = input.current.attention.find((item) => item.attentionId === attentionId);
  if (!attention) return { ok: false, code: "ATTENTION_NOT_FOUND" };
  if (attention.entityId !== validation.value.targetEntityId) {
    return { ok: false, code: "ATTENTION_TARGET_MISMATCH" };
  }
  if (
    (validation.value.intent === "defer" && !nonEmpty(validation.value.payload.deferUntil)) ||
    (validation.value.intent === "redirect" && !nonEmpty(validation.value.payload.redirectEntityId))
  ) {
    return { ok: false, code: "ATTENTION_SCOPE_INVALID" };
  }

  return {
    ok: true,
    receipt: {
      schemaVersion: 1,
      receiptId: `receipt_${validation.value.commandId}`,
      commandId: validation.value.commandId,
      projectId: validation.value.projectId,
      acceptedRevision: input.current.revision,
      resultingRevision: input.current.revision + 1,
      attentionId,
      targetEntityId: validation.value.targetEntityId,
      causeEventId: attention.causeEventId,
      actor: validation.value.actor,
      disposition: validation.value.intent,
      agentVisible: true,
      technicalScope: {
        expectedRevision: validation.value.expectedRevision,
        correlationId: validation.value.commandId,
      },
    },
  };
}

function isAttentionIntent(value: string): value is AttentionIntent {
  return attentionIntents.some((intent) => intent === value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function unavailable(code: AttentionCommandFailureCode): AttentionCommandResult {
  return {
    ok: false,
    code,
    retrySafe: true,
    requiredAction: "Refresh the current workspace before retrying this disposition.",
  };
}
