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
    threadId: id,
    turnId: id,
    itemId: id,
  })
  .strict();

export type RuntimeCorrelation = z.infer<typeof runtimeCorrelationSchema>;

export const runtimeIssueSchema = z
  .object({
    code: id,
    summary: safeText,
    retryable: z.boolean(),
    remediation: safeText.optional(),
  })
  .strict();

export type RuntimeIssue = z.infer<typeof runtimeIssueSchema>;

export const runtimeRecordSchema = z
  .object({
    correlation: runtimeCorrelationSchema,
    kind: z.enum([
      "runtime.lifecycle",
      "runtime.message",
      "runtime.command",
      "runtime.file",
      "runtime.tool",
      "runtime.artifact",
      "runtime.usage",
      "runtime.approval",
      "runtime.error",
    ]),
    summary: safeText,
  })
  .strict();

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

export type AdapterResult<T> =
  | { ok: true; value: T; correlation: RuntimeCorrelation }
  | { ok: false; issue: RuntimeIssue; retryable: boolean };

export interface RuntimeAdapter {
  connect(input: { agentId: string }): Promise<AdapterResult<RuntimeBindingReport>>;
  cancel(input: { correlation: RuntimeCorrelation }): Promise<AdapterResult<{ terminal: boolean }>>;
  disconnect(): Promise<void>;
}
