import { z } from "zod";

// Internal bounded-work contract (D-26 fields, R2 subset). Validated server-side only.
// The owner never sees this shape; they see the prose rendering below.
const line = z.string().trim().min(1).max(300);

export const boundedContractSchema = z
  .object({
    outcome: z.string().trim().min(1).max(600),
    scope: z.array(line).min(1).max(10),
    exclusions: z.array(line).max(10),
    acceptanceCriteria: z.array(line).min(1).max(10),
    // R2 is draft-only: nothing executes until R3. The ceiling is fixed, not user-chosen.
    permissionCeiling: z.literal("draft_only"),
  })
  .strict();

export type BoundedContract = z.infer<typeof boundedContractSchema>;

export type ContractParseResult =
  { ok: true; contract: BoundedContract } | { ok: false; code: "CONTRACT_DRAFT_INVALID" };

// Accepts model output that may be wrapped in a Markdown code fence, then validates it strictly.
export function parseContractDraft(raw: string): ContractParseResult {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let candidate: unknown;
  try {
    candidate = JSON.parse(unfenced);
  } catch {
    return { ok: false, code: "CONTRACT_DRAFT_INVALID" };
  }
  const parsed = boundedContractSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, code: "CONTRACT_DRAFT_INVALID" };
  return { ok: true, contract: parsed.data };
}

// Plain-language rendering for the owner. Contains no braces, brackets, keys, or identifiers.
export type ProseDraft = {
  achieve: string;
  inScope: string[];
  outOfScope: string[];
  doneWhen: string[];
};

export function renderProse(contract: BoundedContract): ProseDraft {
  return {
    achieve: contract.outcome,
    inScope: contract.scope,
    outOfScope: contract.exclusions,
    doneWhen: contract.acceptanceCriteria,
  };
}
