import { createHash } from "node:crypto";

import type { RuntimeBindingReport } from "@cuckcode/contracts";
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
  toolIds: readonly string[];
  permissionCeiling: readonly string[];
}>;

export type BindingExpectation = Readonly<{
  requestedModel: string;
  expectedAuthMode: "chatgpt" | "api_key_managed" | "none";
  protocolVersion: string;
  promotedSourceSha256: string;
  promotedOverlaySha256: string;
}>;

export type BindingFailure = Readonly<{
  code:
    | "MODEL_DRIFT"
    | "AUTH_MODE_DRIFT"
    | "PROTOCOL_DRIFT"
    | "TOOL_SURFACE_PRESENT"
    | "FACTS_INCOMPLETE";
  detail: string;
}>;

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

  const surface = [...facts.toolIds, ...facts.permissionCeiling];
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
    promotedOverlaySha256: expected.promotedOverlaySha256,
    promotedSourceSha256: expected.promotedSourceSha256,
    protocolVersion: expected.protocolVersion,
    roleId: facts.roleId,
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
      toolIds: [...facts.toolIds],
      permissionCeiling: [...facts.permissionCeiling],
      materialFingerprint: createHash("sha256").update(stableStringify(material)).digest("hex"),
      status: "candidate",
    },
  };
}

function versionOf(userAgent: string): string | undefined {
  return /\d+\.\d+\.\d+/u.exec(userAgent)?.[0];
}
