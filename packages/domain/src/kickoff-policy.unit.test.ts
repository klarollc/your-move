import { describe, expect, it } from "vitest";

import { checkObservedEvent, checkTurnBudget } from "./kickoff-policy.js";

function event(kind: string) {
  return {
    kind,
    phase: "item.completed",
  } as unknown as Parameters<typeof checkObservedEvent>[0];
}

describe("observed effect policy", () => {
  it("accepts the event kinds a text-only kickoff produces", () => {
    for (const kind of ["runtime.lifecycle", "runtime.message", "runtime.usage"]) {
      expect(checkObservedEvent(event(kind))).toBeUndefined();
    }
  });

  it("stops the run on any observed command, file, or tool effect", () => {
    for (const kind of ["runtime.command", "runtime.file", "runtime.tool"]) {
      const violation = checkObservedEvent(event(kind));
      expect(violation?.code).toBe("EXTERNAL_EFFECT_OBSERVED");
      expect(violation?.detail).toContain(kind);
    }
  });

  it("treats an artifact as an external effect, since a text-only turn produces none", () => {
    expect(checkObservedEvent(event("runtime.artifact"))?.code).toBe("EXTERNAL_EFFECT_OBSERVED");
  });

  it("does not treat an approval request as an effect, but does not permit acting on it", () => {
    // A permission request arriving is information. It is the manager's to decide, and D-25
    // forbids the provider deciding. Observing one must not itself stop the run.
    expect(checkObservedEvent(event("runtime.approval"))).toBeUndefined();
  });
});

describe("turn budget", () => {
  it("permits the D-25 shape exactly", () => {
    expect(checkTurnBudget({ contributions: 6, syntheses: 1, revisions: 6 })).toBeUndefined();
  });

  it("permits an under-filled round, because an unused revision is not a violation", () => {
    expect(checkTurnBudget({ contributions: 6, syntheses: 1, revisions: 0 })).toBeUndefined();
  });

  it("rejects a fourteenth turn", () => {
    expect(checkTurnBudget({ contributions: 6, syntheses: 1, revisions: 7 })?.code).toBe(
      "TURN_BUDGET_EXCEEDED",
    );
  });

  it("rejects more than one synthesis even within the total", () => {
    expect(checkTurnBudget({ contributions: 5, syntheses: 2, revisions: 5 })?.code).toBe(
      "TURN_BUDGET_EXCEEDED",
    );
  });
});
