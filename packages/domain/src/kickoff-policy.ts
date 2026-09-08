import type { NormalizedRuntimeEvent } from "@cuckcode/contracts";

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

export const MAX_TURNS = 13;
export const MAX_CONTRIBUTIONS = 6;
export const MAX_SYNTHESES = 1;
export const MAX_REVISIONS = 6;

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
