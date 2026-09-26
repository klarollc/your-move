import { z } from "zod";

const id = z.string().trim().min(1).max(256);
const safeText = z
  .string()
  .trim()
  .min(1)
  .max(8_192)
  .refine(
    (value) =>
      !/(?:authorization\s*:\s*bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|sk-[a-z0-9_-]{8,})/iu.test(
        value,
      ),
    "secret-bearing text is forbidden",
  );

export const runtimeCorrelationSchema = z
  .object({
    bindingId: id,
    providerRunId: id,
    providerRequestId: id,
    threadId: id.optional(),
    turnId: id.optional(),
    itemId: id.optional(),
  })
  .strict();

export type RuntimeCorrelation = z.infer<typeof runtimeCorrelationSchema>;

/**
 * The provider-independent record vocabulary. Declared once, here, and derived from by every
 * adapter. It previously existed twice — as this enum and again inside the Codex package's
 * normalizer — with nothing keeping the two equal (C-1 finding F2).
 */
export const runtimeRecordKinds = [
  "runtime.lifecycle",
  "runtime.message",
  "runtime.command",
  "runtime.file",
  "runtime.tool",
  "runtime.artifact",
  "runtime.usage",
  "runtime.approval",
  "runtime.error",
] as const;

export type RuntimeRecordKind = (typeof runtimeRecordKinds)[number];

export const runtimeRecordSchema = z
  .object({
    correlation: runtimeCorrelationSchema,
    kind: z.enum(runtimeRecordKinds),
    summary: safeText,
  })
  .strict();

/**
 * What every adapter normalizes provider output into. Provider-neutral by construction: the
 * `kind` union is the schema's, not a copy of it.
 */
export type NormalizationContext = {
  bindingId: string;
  providerRunId: string;
  providerRequestId: string;
  projectId: string;
  workItemId: string;
  roleId: string;
  sequence: number;
};

export type NormalizedRuntimeEvent = {
  kind: RuntimeRecordKind;
  phase: string;
  canonicalImpact: "reported_only";
  correlation: RuntimeCorrelation;
  projectId: string;
  workItemId: string;
  roleId: string;
  sequence: number;
  evidenceHash: string;
};

export const permissionDecisionSchema = z
  .object({
    requestId: id,
    correlation: runtimeCorrelationSchema,
    decision: z.enum(["allow_once", "deny"]),
    decidedBy: z.object({ kind: z.literal("manager"), id }).strict(),
    decidedAt: z.iso.datetime(),
  })
  .strict();

/**
 * What the runtime reported the session is confined to. These are bounds, not exposures: a
 * read-only sandbox with no network is the safe state, not a capability the session holds. The
 * distinction matters because `permissionCeiling` means the opposite — things exposed beyond the
 * baseline — and conflating the two would either refuse every binding or quietly loosen later.
 *
 * Observed at thread/start by the Task 17c-1 probe. See
 * docs/evidence/phase-4/live-kickoff/probe-2026-09-11-codex-facts.md.
 */
export const sandboxPostureSchema = z
  .object({
    type: id,
    networkAccess: z.boolean(),
    approvalPolicy: id,
    multiAgentMode: id,
  })
  .strict();

export type SandboxPosture = z.infer<typeof sandboxPostureSchema>;

/**
 * One MCP server a session was observed to start, as enumerated after thread/start (FU-3).
 * `status` is the runtime's connection state, or its auth state when no connection state exists.
 */
export const observedMcpServerSchema = z
  .object({
    name: id,
    status: id,
    toolNames: z.array(id),
  })
  .strict();

export type ObservedMcpServer = z.infer<typeof observedMcpServerSchema>;

export const runtimeBindingReportSchema = z
  .object({
    bindingId: id,
    agentId: id,
    adapterId: id,
    adapterVersion: id,
    protocolVersion: id,
    authMode: z.enum(["chatgpt", "api_key_managed", "none"]),
    model: id,
    // Required, and nullable rather than optional. null is a statement that the runtime reported
    // no effort; an absent field would be a report that cannot say, which is the DF-008 gap.
    reasoningEffort: id.nullable(),
    capabilityIds: z.array(id),
    // null means this adapter does not enumerate a tool surface. [] means it enumerated one and
    // found it empty. Collapsing them would let "nobody looked" read as "nothing is exposed".
    toolIds: z.array(id).nullable(),
    // What an MCP enumeration observed, beside toolIds rather than inside it (FU-3): Codex lists
    // MCP servers but not its native tools, so this is exactly what was seen and no more. null
    // means not enumerated; [] means enumerated and none started.
    observedMcpServers: z.array(observedMcpServerSchema).nullable(),
    permissionCeiling: z.array(id),
    sandboxPosture: sandboxPostureSchema,
    materialFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    status: z.literal("candidate"),
  })
  .strict();

export type RuntimeBindingReport = z.infer<typeof runtimeBindingReportSchema>;

// RuntimeAdapter, AdapterResult and RuntimeIssue were removed on 2026-09-08. They formed a closed
// cluster that referred only to itself: no implementation, no consumer, and no way to start a turn
// or receive events, so the operation an adapter exists to perform lived outside the interface.
// The runtime boundary is defined when the first real consumer needs one, derived from what that
// consumer requires rather than from one provider's shape.
// See docs/evidence/runtime/c1-provider-neutrality-review.md and c2b-what-is-runtimeadapter-for.md.
