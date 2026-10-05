/**
 * The bounded work contract (workflow-proof W3, spec §5, D-26).
 *
 * A work item that a manager assigns carries a contract: outcome, exclusions, acceptance criteria,
 * dependencies, evidence obligations, a permission ceiling, stop conditions and a definition of
 * done, plus the digests of any files inlined for the role (R-1).
 *
 * `work.created` gains `payloadVersion: 2`, which carries the contract. Version 1 (no version
 * field, no contract) keeps its exact meaning so every recorded log still replays.
 */
import { z } from "zod";

import { requestedPostureSchema } from "./posture.js";
import type { WorkPayloadResult } from "./work-payloads.js";

const nonEmpty = z.string().min(1);

const workContractFields = {
    outcome: nonEmpty,
    exclusions: z.array(nonEmpty),
    acceptanceCriteria: z.array(nonEmpty).min(1),
    dependencies: z.array(nonEmpty),
    evidenceObligations: z
      .array(z.object({ kind: nonEmpty, description: nonEmpty }).strict())
      .min(1)
      .refine((items) => new Set(items.map((item) => item.kind)).size === items.length, {
        message: "evidence kinds must be unique",
      }),
    // The ceiling is a requested posture: it cannot express full access or network.
    permissionCeiling: requestedPostureSchema,
    stopConditions: z.array(nonEmpty).min(1),
    definitionOfDone: nonEmpty,
    contextRefs: z.array(
      z.object({ path: nonEmpty, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    ),
  };

/** Historical schema-v2 contracts stay byte-for-byte compatible and have no turn cap. */
export const legacyWorkContractSchema = z.object(workContractFields).strict();

/** Current read model permits old contracts whose turn cap was never recorded. */
export const workContractSchema = legacyWorkContractSchema.extend({
  maxTurns: z.number().int().positive().optional(),
});

/** New bounded work and every rescope must carry a positive, explicit turn cap. */
export const boundedWorkContractSchema = legacyWorkContractSchema.extend({
  maxTurns: z.number().int().positive(),
});

export type WorkContract = z.infer<typeof workContractSchema>;
export type BoundedWorkContract = z.infer<typeof boundedWorkContractSchema>;

export type WorkCreatedPayload = Readonly<{
  workItemId: string;
  outcome: string;
  requiredEvidenceKinds: readonly string[];
  contract?: WorkContract;
}>;

const WORK_ITEM_ID = /^work_[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function validateWorkCreatedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkCreatedPayload> {
  const version = "payloadVersion" in payload ? payload.payloadVersion : 1;
  if (version !== 1 && version !== 2 && version !== 3) {
    return { ok: false, issues: [`unsupported work.created payloadVersion ${String(version)}`] };
  }
  const issues: string[] = [];
  const { workItemId, outcome, requiredEvidenceKinds } = payload;
  if (typeof workItemId !== "string" || !WORK_ITEM_ID.test(workItemId)) {
    issues.push("workItemId is missing or malformed");
  }
  if (typeof outcome !== "string" || outcome.length === 0) issues.push("outcome is missing");
  const kindsOk =
    Array.isArray(requiredEvidenceKinds) &&
    requiredEvidenceKinds.every((kind) => typeof kind === "string");
  if (!kindsOk) issues.push("requiredEvidenceKinds must be an array of strings");
  if (version === 1) {
    if ("contract" in payload) issues.push("contract requires payloadVersion 2");
    return issues.length > 0
      ? { ok: false, issues }
      : {
          ok: true,
          value: {
            workItemId: workItemId as string,
            outcome: outcome as string,
            requiredEvidenceKinds: requiredEvidenceKinds as string[],
          },
        };
  }
  if (payload.contract === undefined) {
    issues.push("contract is required at payloadVersion 2");
    return { ok: false, issues };
  }
  const parsed =
    version === 3
      ? boundedWorkContractSchema.safeParse(payload.contract)
      : legacyWorkContractSchema.safeParse(payload.contract);
  if (!parsed.success) {
    for (const found of parsed.error.issues) {
      issues.push(`contract.${found.path.join(".") || "(root)"}: ${found.message}`);
    }
    return { ok: false, issues };
  }
  if (kindsOk) {
    const wanted = parsed.data.evidenceObligations.map((item) => item.kind);
    const given = requiredEvidenceKinds as string[];
    const same =
      wanted.length === given.length && wanted.every((kind, index) => kind === given[index]);
    if (!same) {
      issues.push("requiredEvidenceKinds must equal the contract's evidence obligation kinds");
    }
  }
  if (version === 3) {
    const extra = Object.keys(payload).filter(
      (key) =>
        !["payloadVersion", "workItemId", "outcome", "requiredEvidenceKinds", "contract"].includes(
          key,
        ),
    );
    if (extra.length > 0) issues.push(`unexpected fields: ${extra.sort().join(", ")}`);
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: workItemId as string,
      outcome: outcome as string,
      requiredEvidenceKinds: requiredEvidenceKinds as string[],
      contract: parsed.data,
    },
  };
}
