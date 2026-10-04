/**
 * The posture record (workflow-proof W1, spec §4).
 *
 * Three layers, kept apart and never merged:
 *
 * - **requested**: what a caller asked `thread/start` for.
 * - **granted**: what the runtime reported back (the existing `SandboxPosture`, as read from
 *   `thread/start`). A difference from requested is a refusal that names the field (DF-043).
 * - **declared**: what the role could plausibly do, derived from the granted posture and the
 *   feature policy. It is a declaration of intent, not an observation: nothing here has watched
 *   the role act, so it can say "no", "possible" or "unknown" and never "yes" (DF-045, DF-046).
 *
 * This is a new record beside `runtimeBindingReportSchema`, not a change to it. The binding report
 * is persisted and fingerprinted, and altering it would invalidate recorded bindings.
 */
import { z } from "zod";

import { sandboxPostureSchema, type SandboxPosture } from "./runtime.js";

const nonEmpty = z.string().min(1);

export const requestedPostureSchema = z
  .object({
    // `danger-full-access` is deliberately not expressible (role-exercise.ts).
    sandboxMode: z.enum(["read-only", "workspace-write"]),
    approvalPolicy: nonEmpty,
    // CuckCode never asks for network access.
    networkAccess: z.literal(false),
    // `elevated` is deliberately not expressible: it needs host setup and has not been ruled.
    windowsSandbox: z.literal("unelevated").nullable(),
  })
  .strict();

export type RequestedPosture = z.infer<typeof requestedPostureSchema>;

export const capabilityStates = ["no", "possible", "unknown"] as const;
export type CapabilityState = (typeof capabilityStates)[number];

export const declaredCapabilitiesSchema = z
  .object({
    kind: z.literal("declared"),
    read: z.enum(capabilityStates),
    write: z.enum(capabilityStates),
    run: z.enum(capabilityStates),
    // Why each state was declared. A declaration with no stated basis is refused.
    basis: z.array(nonEmpty).min(1),
    // Always null: no run has observed the role. A future observed layer is a separate record.
    observed: z.null(),
  })
  .strict();

export type DeclaredCapabilities = z.infer<typeof declaredCapabilitiesSchema>;

export const postureDifferenceFields = [
  "sandbox.type",
  "sandbox.networkAccess",
  "approvalPolicy",
] as const;
export type PostureDifferenceField = (typeof postureDifferenceFields)[number];

export const postureDifferenceSchema = z
  .object({
    field: z.enum(postureDifferenceFields),
    requested: z.union([nonEmpty, z.boolean()]),
    granted: z.union([nonEmpty, z.boolean()]),
  })
  .strict();

export type PostureDifference = z.infer<typeof postureDifferenceSchema>;

export const postureRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    requested: requestedPostureSchema,
    granted: sandboxPostureSchema,
    declared: declaredCapabilitiesSchema,
    match: z.boolean(),
    differences: z.array(postureDifferenceSchema),
  })
  .strict()
  .refine((record) => record.match === (record.differences.length === 0), {
    message: "match must be true exactly when there are no differences",
  });

export type PostureRecord = Readonly<{
  schemaVersion: 1;
  requested: RequestedPosture;
  granted: SandboxPosture;
  declared: DeclaredCapabilities;
  match: boolean;
  differences: readonly PostureDifference[];
}>;
