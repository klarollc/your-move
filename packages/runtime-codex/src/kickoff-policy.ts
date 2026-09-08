import type { NormalizedRuntimeEvent } from "@cuckcode/contracts";

import { ALLOWED_REQUEST_METHODS, CODEX_ARGS } from "./supervisor.js";

export type PolicyViolation = Readonly<{
  code:
    | "SPAWN_ARGS_NOT_EXACT"
    | "METHOD_NOT_ALLOWED"
    | "EXTERNAL_EFFECT_OBSERVED"
    | "TURN_BUDGET_EXCEEDED";
  detail: string;
}>;

/**
 * A text-only kickoff produces conversation, lifecycle transitions and usage reports. It produces
 * no command, no file change, no tool call and no artifact. These kinds are not merely
 * unexpected — observing one means the configuration that was supposed to prevent it did not, so
 * the run stops rather than recording the effect as ordinary work.
 *
 * `runtime.approval` is deliberately absent: a permission request arriving is information, and
 * D-25 reserves the decision for the manager. Stopping on observation would conflate someone
 * asking with something happening. `runtime.error` is likewise a report, not an effect.
 */
const EXTERNAL_EFFECT_KINDS: ReadonlySet<NormalizedRuntimeEvent["kind"]> = new Set([
  "runtime.command",
  "runtime.file",
  "runtime.tool",
  "runtime.artifact",
]);

const MAX_TURNS = 13;
const MAX_CONTRIBUTIONS = 6;
const MAX_SYNTHESES = 1;
const MAX_REVISIONS = 6;

/**
 * Exact sequence equality, not set membership. An argument list compared as a set accepts a
 * reordering, and reordering is how an unexpected flag reaches a position where it takes effect.
 */
export function checkSpawnArgs(args: readonly string[]): PolicyViolation | undefined {
  const expected: readonly string[] = CODEX_ARGS;
  const exact =
    args.length === expected.length && args.every((value, index) => value === expected[index]);
  if (exact) return undefined;
  return {
    code: "SPAWN_ARGS_NOT_EXACT",
    detail: `expected exactly [${expected.join(" ")}], received [${args.join(" ")}]`,
  };
}

export function checkRequestMethod(method: string): PolicyViolation | undefined {
  if (ALLOWED_REQUEST_METHODS.has(method)) return undefined;
  return {
    code: "METHOD_NOT_ALLOWED",
    detail: `method ${method} is not on the kickoff allow-list`,
  };
}

export function checkObservedEvent(
  event: Pick<NormalizedRuntimeEvent, "kind" | "phase">,
): PolicyViolation | undefined {
  if (!EXTERNAL_EFFECT_KINDS.has(event.kind)) return undefined;
  return {
    code: "EXTERNAL_EFFECT_OBSERVED",
    detail: `observed ${event.kind} at ${event.phase}; a text-only kickoff produces none`,
  };
}

export function checkTurnBudget(
  counts: Readonly<{ contributions: number; syntheses: number; revisions: number }>,
): PolicyViolation | undefined {
  const total = counts.contributions + counts.syntheses + counts.revisions;
  const breaches: string[] = [];
  if (counts.contributions > MAX_CONTRIBUTIONS)
    breaches.push(`contributions ${counts.contributions}`);
  if (counts.syntheses > MAX_SYNTHESES) breaches.push(`syntheses ${counts.syntheses}`);
  if (counts.revisions > MAX_REVISIONS) breaches.push(`revisions ${counts.revisions}`);
  if (total > MAX_TURNS) breaches.push(`total ${total}`);
  if (breaches.length === 0) return undefined;
  return {
    code: "TURN_BUDGET_EXCEEDED",
    detail: `${breaches.join(", ")} exceeds the D-25 budget of ${MAX_CONTRIBUTIONS} contributions, ${MAX_SYNTHESES} synthesis and ${MAX_REVISIONS} revisions within ${MAX_TURNS} turns`,
  };
}
