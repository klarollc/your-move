import { describe, expect, it } from "vitest";

import { visualQaOverclaims } from "./phase5-visual-qa-crosscheck.js";

/**
 * The cross-check that decides whether a Visual QA annotation claimed more than it could see.
 *
 * It is extracted and tested because it got this wrong once, in the direction this project finds
 * hardest to notice: it reported an honest annotation as an overclaim. Pass 2 marked all twenty
 * states `partial` and stated, for every one of them, that visual fidelity was unverified. The guard
 * required at least one state to carry the exact value `cannot-tell-without-seeing` and, finding
 * none, accused a reviewer that had deferred appearance on every single state.
 *
 * A guard that is exact inside a boundary nobody examined — here, the boundary is the assumption
 * that honesty has exactly one spelling.
 */

const unreachable = new Set(["validation-reason-too-long"]);

const annotation = (
  stateAnnotations: Array<{ stateId: string; contractSatisfied: string; gap?: string }>,
) => ({ stateAnnotations });

describe("visual QA cross-check", () => {
  it("accepts an annotation that defers appearance by marking every state partial", () => {
    // Pass 2's actual shape. Every state partial, every visual judgement withheld in the gap text.
    const value = annotation(
      ["pending", "acknowledged", "deferred"].map((stateId) => ({
        stateId,
        contractSatisfied: "partial",
        gap: "visual fidelity is unverified; only the accessibility tree was supplied",
      })),
    );

    expect(visualQaOverclaims(value, unreachable)).toEqual([]);
  });

  it("accepts an annotation that defers appearance with the explicit value", () => {
    // Pass 1's actual shape. Both spellings are honest and both are accepted.
    const value = annotation([
      { stateId: "pending", contractSatisfied: "cannot-tell-without-seeing" },
      { stateId: "acknowledged", contractSatisfied: "partial" },
    ]);

    expect(visualQaOverclaims(value, unreachable)).toEqual([]);
  });

  it("refuses a state claimed fully satisfied, because appearance is part of the contract", () => {
    // `yes` asserts the visual treatment is satisfied too, and no accessibility tree can establish
    // that. This is the claim the cross-check exists to catch.
    const value = annotation([
      { stateId: "pending", contractSatisfied: "yes" },
      { stateId: "acknowledged", contractSatisfied: "partial" },
    ]);

    expect(visualQaOverclaims(value, unreachable)).toEqual([
      "pending annotated fully satisfied, which asserts a visual treatment no accessibility tree can establish",
    ]);
  });

  it("refuses any claim at all about a state the build cannot enter", () => {
    const value = annotation([
      { stateId: "validation-reason-too-long", contractSatisfied: "partial" },
    ]);

    expect(visualQaOverclaims(value, unreachable)).toEqual([
      "validation-reason-too-long annotated partial though the build cannot enter that state at all",
    ]);
  });
});
