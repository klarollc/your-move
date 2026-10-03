import { describe, expect, it } from "vitest";

import { OFFICE_SHELL_STATES } from "./office-fixtures/index.js";
import { dispositionRefusal } from "./office-model.js";

/**
 * Phase 7-O Task 9h (owner-approved 2026-09-28). A manager disposition is refused only where
 * current state is unknown or no decision can be recorded, each with its own reason. Every other
 * state is current, and the attention it shows asks for exactly that decision.
 */
const REFUSED: Readonly<Record<string, string>> = {
  stale: "Refresh the current workspace before recording a disposition.",
  offline: "The runtime is unavailable. Reconnect before recording a disposition.",
  loading: "The workspace is still loading. Responses open once it is current.",
  error: "The workspace could not be read. Retry it before recording a disposition.",
  restart:
    "The runtime restarted and its health is being checked. Restore current state before recording a disposition.",
};

describe("dispositionRefusal", () => {
  it("covers every shell state, so a new state cannot be left unruled", () => {
    const ruled = new Set([
      ...Object.keys(REFUSED),
      "ready",
      "empty",
      "partial",
      "permission-denied",
      "missing-artifact",
      "test-failure",
      "reviewer-disagreement",
      "conflict",
      "cancelled",
      "render-error",
      "rate-limit",
      "budget-limit",
    ]);
    expect([...OFFICE_SHELL_STATES].sort()).toStrictEqual([...ruled].sort());
  });

  it.each(OFFICE_SHELL_STATES.map((state) => [state, REFUSED[state]] as const))(
    "%s → %s",
    (state, expected) => {
      expect(dispositionRefusal(state)).toBe(expected);
    },
  );
});
