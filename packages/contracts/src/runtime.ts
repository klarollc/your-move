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

export const runtimeBindingReportSchema = z
  .object({
    bindingId: id,
    agentId: id,
    adapterId: id,
    adapterVersion: id,
    protocolVersion: id,
    authMode: z.enum(["chatgpt", "api_key_managed", "none"]),
    model: id,
    capabilityIds: z.array(id),
    toolIds: z.array(id),
    permissionCeiling: z.array(id),
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
