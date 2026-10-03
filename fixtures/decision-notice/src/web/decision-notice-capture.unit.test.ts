import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CAPTURE_STATES } from "./decision-notice-capture.js";

/**
 * The capture set and the surface contract must name the same states.
 *
 * This is the guard the register keeps asking for: the contract is the authority, the capture
 * surface is a call site, and nothing else in the repository would notice if the Product Designer's
 * inventory gained a state and the camera did not. Reading the contract from disk rather than
 * restating it here is the whole point — a fixture copy of the list would agree with itself forever.
 */
const contract = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "docs/evidence/phase-5/surface-contract/surface-contract.json"),
    "utf8",
  ),
) as { requiredStates: string[]; contract: { stateInventory: Array<{ id: string }> } };

describe("Phase 5 capture surface", () => {
  it("C-19: offers exactly the states the surface contract requires, and no others", () => {
    expect(Object.keys(CAPTURE_STATES).sort()).toStrictEqual([...contract.requiredStates].sort());
  });

  it("C-19: the contract's own two state lists agree with each other", () => {
    expect(contract.contract.stateInventory.map((entry) => entry.id).sort()).toStrictEqual(
      [...contract.requiredStates].sort(),
    );
  });
});
