import { createHash } from "node:crypto";

import type { RuntimeBindingReport, SandboxPosture } from "@cuckcode/contracts";
import { stableStringify } from "@cuckcode/domain";

import { ALLOWED_REQUEST_METHODS } from "./supervisor.js";

const ADAPTER_ID = "codex-app-server";

export type HandshakeFacts = Readonly<{
  agentId: string;
  bindingId: string;
  roleId: string;
  userAgent: string;
  authMode: "chatgpt" | "api_key_managed" | "none";
  reportedModel: string;
  /** null means the runtime reported no effort, not that nobody asked. */
  reportedReasoningEffort: string | null;
  /** null means this adapter does not enumerate a tool surface. [] means it enumerated none. */
  toolIds: readonly string[] | null;
  permissionCeiling: readonly string[];
  sandboxPosture: SandboxPosture;
}>;

export type BindingExpectation = Readonly<{
  requestedModel: string;
  expectedReasoningEffort: string | null;
  expectedAuthMode: "chatgpt" | "api_key_managed" | "none";
  protocolVersion: string;
  promotedSourceSha256: string;
  promotedOverlaySha256: string;
}>;

export type BindingFailure = Readonly<{
  code:
    | "MODEL_DRIFT"
    | "EFFORT_DRIFT"
    | "AUTH_MODE_DRIFT"
    | "PROTOCOL_DRIFT"
    | "TOOL_SURFACE_PRESENT"
    | "FACTS_INCOMPLETE";
  detail: string;
}>;

/**
 * Narrows observed App Server handshake responses into the facts a binding needs. Requested model
 * or effort are intentionally absent from this input: a missing runtime report must fail here,
 * rather than making a later comparison read the request back to itself.
 */
export function collectHandshakeFacts(input: {
  agentId: string;
  bindingId: string;
  roleId: string;
  userAgent: string;
  auth: { ok: true; mode: "chatgpt" | "api_key_managed" } | { ok: false; code: "AUTH_REQUIRED" };
  threadStart: unknown;
}): HandshakeFacts {
  const start = record(input.threadStart);
  const sandbox = record(start?.sandbox);
  const model = text(start?.model);
  const effort = nullableText(start?.reasoningEffort);
  const sandboxType = text(sandbox?.type);
  const approvalPolicy = text(start?.approvalPolicy);
  const multiAgentMode = text(start?.multiAgentMode);
  if (
    input.auth.ok === false ||
    !model ||
    effort === undefined ||
    !sandboxType ||
    typeof sandbox?.networkAccess !== "boolean" ||
    !approvalPolicy ||
    !multiAgentMode
  ) {
    throw new Error("HANDSHAKE_FACTS_INCOMPLETE");
  }
  return {
    agentId: input.agentId,
    bindingId: input.bindingId,
    roleId: input.roleId,
    userAgent: input.userAgent,
    authMode: input.auth.mode,
    reportedModel: model,
    reportedReasoningEffort: effort,
    // The observed Codex protocol names no tool enumeration. null preserves that fact; [] would
    // falsely claim the adapter looked and found nothing.
    toolIds: null,
    permissionCeiling: [],
    sandboxPosture: {
      type: sandboxType,
      networkAccess: sandbox.networkAccess,
      approvalPolicy,
      multiAgentMode,
    },
  };
}

/**
 * Builds the trust report for one agent binding from facts the runtime actually reported.
 *
 * Nothing here echoes what was requested. The model, the auth mode and the protocol version are
 * read back and compared against the approved packet; a difference stops the binding before any
 * turn is spent, because "which model produced this" belongs in every record afterwards.
 *
 * `toolIds: []` in a returned report means the session was observed to expose none — the
 * TOOL_SURFACE_PRESENT branch is what makes the empty list mean something rather than meaning
 * nobody looked.
 *
 * The fingerprint covers the promoted contract digests as well as the session. A binding must not
 * survive a promotion change it was never approved against, and that relationship lives between
 * two records that each look correct alone.
 */
export function buildBindingReport(
  facts: HandshakeFacts,
  expected: BindingExpectation,
): { ok: true; report: RuntimeBindingReport } | { ok: false; failure: BindingFailure } {
  const required = [
    facts.agentId,
    facts.bindingId,
    facts.roleId,
    facts.userAgent,
    facts.reportedModel,
    expected.requestedModel,
    expected.protocolVersion,
    expected.promotedSourceSha256,
    expected.promotedOverlaySha256,
  ];
  if (required.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    return {
      ok: false,
      failure: {
        code: "FACTS_INCOMPLETE",
        detail: `${facts.roleId || "unknown role"} did not report every fact a binding needs`,
      },
    };
  }

  if (!facts.userAgent.includes(expected.protocolVersion)) {
    return {
      ok: false,
      failure: {
        code: "PROTOCOL_DRIFT",
        detail: `handshake reported "${facts.userAgent}", which does not carry the pinned ${expected.protocolVersion}`,
      },
    };
  }

  if (facts.authMode !== expected.expectedAuthMode) {
    return {
      ok: false,
      failure: {
        code: "AUTH_MODE_DRIFT",
        detail: `runtime authenticated as ${facts.authMode}; the packet approved ${expected.expectedAuthMode}`,
      },
    };
  }

  if (facts.reportedModel !== expected.requestedModel) {
    return {
      ok: false,
      failure: {
        code: "MODEL_DRIFT",
        detail: `runtime reported ${facts.reportedModel}; ${expected.requestedModel} was requested for ${facts.roleId}`,
      },
    };
  }

  if (facts.reportedReasoningEffort !== expected.expectedReasoningEffort) {
    return {
      ok: false,
      failure: {
        code: "EFFORT_DRIFT",
        detail: `runtime ran at ${facts.reportedReasoningEffort ?? "an unreported effort"}; ${
          expected.expectedReasoningEffort ?? "an unreported effort"
        } was approved for ${facts.roleId}`,
      },
    };
  }

  const surface = [...(facts.toolIds ?? []), ...facts.permissionCeiling];
  if (surface.length > 0) {
    return {
      ok: false,
      failure: {
        code: "TOOL_SURFACE_PRESENT",
        detail: `${facts.roleId} exposes ${surface.join(", ")}; a text-only kickoff binding must expose none`,
      },
    };
  }

  const material = {
    adapterId: ADAPTER_ID,
    agentId: facts.agentId,
    authMode: facts.authMode,
    bindingId: facts.bindingId,
    model: facts.reportedModel,
    permissionCeiling: [...facts.permissionCeiling],
    promotedOverlaySha256: expected.promotedOverlaySha256,
    promotedSourceSha256: expected.promotedSourceSha256,
    protocolVersion: expected.protocolVersion,
    // How the model was configured and what the session was confined to are part of what was
    // approved. A binding must not survive a change to either with an unchanged fingerprint.
    reasoningEffort: facts.reportedReasoningEffort,
    roleId: facts.roleId,
    sandboxPosture: facts.sandboxPosture,
    toolIds: facts.toolIds === null ? null : [...facts.toolIds],
    userAgent: facts.userAgent,
  };

  return {
    ok: true,
    report: {
      bindingId: facts.bindingId,
      agentId: facts.agentId,
      adapterId: ADAPTER_ID,
      adapterVersion: versionOf(facts.userAgent) ?? expected.protocolVersion,
      protocolVersion: expected.protocolVersion,
      authMode: facts.authMode,
      model: facts.reportedModel,
      // The methods this binding is permitted to call, taken from the supervisor's own allow-list
      // rather than restated here.
      capabilityIds: [...ALLOWED_REQUEST_METHODS].sort(),
      reasoningEffort: facts.reportedReasoningEffort,
      toolIds: facts.toolIds === null ? null : [...facts.toolIds],
      permissionCeiling: [...facts.permissionCeiling],
      sandboxPosture: facts.sandboxPosture,
      materialFingerprint: createHash("sha256").update(stableStringify(material)).digest("hex"),
      status: "candidate",
    },
  };
}

function versionOf(userAgent: string): string | undefined {
  return /\d+\.\d+\.\d+/u.exec(userAgent)?.[0];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return text(value);
}
