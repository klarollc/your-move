import { checkObservedEvent, checkTurnBudget, type PolicyViolation } from "@cuckcode/domain";

import { ALLOWED_REQUEST_METHODS, CODEX_ARGS } from "./supervisor.js";

// The turn budget and the external-effect rule are provider-neutral — they encode D-25's shape and
// the semantic behavior map, not anything about Codex. They live in domain and are re-exported
// here so a caller has one import for the whole kickoff policy.
export { checkObservedEvent, checkTurnBudget };
export type { PolicyViolation };

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
