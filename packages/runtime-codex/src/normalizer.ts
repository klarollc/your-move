import { createHash } from "node:crypto";

import {
  runtimeCorrelationSchema,
  type NormalizationContext,
  type NormalizedRuntimeEvent,
} from "@cuckcode/contracts";
import { stableStringify } from "@cuckcode/domain";

// The event vocabulary is the contract's, not this package's. A second adapter must be able to
// produce these without depending on the Codex package (C-1 finding F2).
export type { NormalizationContext, NormalizedRuntimeEvent };

export function normalizeCodexEvent(
  input: unknown,
  context: NormalizationContext,
):
  | { ok: true; event: NormalizedRuntimeEvent }
  | {
      ok: false;
      issue: {
        code: "UNSUPPORTED_PROVIDER_EVENT" | "MALFORMED_PROVIDER_EVENT";
        retryable: false;
      };
    } {
  if (!isRecord(input) || typeof input.method !== "string" || !isRecord(input.params))
    return malformed();
  const mapped = mapMethod(input.method, input.params);
  if (mapped === "unsupported")
    return { ok: false, issue: { code: "UNSUPPORTED_PROVIDER_EVENT", retryable: false } };
  if (!mapped) return malformed();
  const correlationCandidate = {
    bindingId: context.bindingId,
    providerRunId: context.providerRunId,
    providerRequestId: context.providerRequestId,
    ...(mapped.threadId ? { threadId: mapped.threadId } : {}),
    ...(mapped.turnId ? { turnId: mapped.turnId } : {}),
    ...(mapped.itemId ? { itemId: mapped.itemId } : {}),
  };
  const correlation = runtimeCorrelationSchema.safeParse(correlationCandidate);
  if (!correlation.success) return malformed();
  const base = {
    kind: mapped.kind,
    phase: mapped.phase,
    canonicalImpact: "reported_only" as const,
    correlation: correlation.data,
    projectId: context.projectId,
    workItemId: context.workItemId,
    roleId: context.roleId,
    sequence: context.sequence,
  };
  return {
    ok: true,
    // C-1 F6: the project's one canonicalizer, not a private copy.
    event: { ...base, evidenceHash: sha256(stableStringify(base)) },
  };
}

function mapMethod(
  method: string,
  params: Record<string, unknown>,
):
  | {
      kind: NormalizedRuntimeEvent["kind"];
      phase: string;
      threadId?: string;
      turnId?: string;
      itemId?: string;
    }
  | "unsupported"
  | undefined {
  if (method === "thread/started") {
    const thread = record(params.thread);
    const threadId = text(thread?.id);
    return threadId ? { kind: "runtime.lifecycle", phase: "thread.started", threadId } : undefined;
  }
  if (method === "turn/started" || method === "turn/completed") {
    const turn = record(params.turn);
    const threadId = text(params.threadId);
    const turnId = text(turn?.id);
    return threadId && turnId
      ? {
          kind: "runtime.lifecycle",
          phase: method.replace("/", "."),
          threadId,
          turnId,
        }
      : undefined;
  }
  if (method === "item/started" || method === "item/completed") {
    const item = record(params.item);
    const threadId = text(params.threadId);
    const turnId = text(params.turnId);
    const itemId = text(item?.id);
    const itemType = text(item?.type);
    if (!threadId || !turnId || !itemId || !itemType) return undefined;
    return {
      kind: itemKind(itemType),
      phase: method.replace("/", "."),
      threadId,
      turnId,
      itemId,
    };
  }
  if (method === "thread/tokenUsage/updated") {
    const threadId = text(params.threadId);
    return threadId ? { kind: "runtime.usage", phase: "usage.updated", threadId } : undefined;
  }
  if (method === "error") {
    const threadId = text(params.threadId);
    const turnId = text(params.turnId);
    // C-1 F4: Codex reports whether it will retry. Keep that fact; never guess it.
    const phase =
      params.willRetry === true
        ? "runtime.error.will_retry"
        : params.willRetry === false
          ? "runtime.error.final"
          : "runtime.error.retry_unreported";
    return {
      kind: "runtime.error",
      phase,
      ...(threadId ? { threadId } : {}),
      ...(turnId ? { turnId } : {}),
    };
  }
  return "unsupported";
}

function itemKind(type: string): NormalizedRuntimeEvent["kind"] {
  if (["agentMessage", "userMessage", "reasoning"].includes(type)) return "runtime.message";
  if (type === "commandExecution") return "runtime.command";
  if (type === "fileChange") return "runtime.file";
  if (["mcpToolCall", "dynamicToolCall", "collabAgentToolCall"].includes(type))
    return "runtime.tool";
  return "runtime.artifact";
}

function malformed() {
  return {
    ok: false as const,
    issue: { code: "MALFORMED_PROVIDER_EVENT" as const, retryable: false as const },
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
