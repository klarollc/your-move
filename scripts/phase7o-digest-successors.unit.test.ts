import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { phase6ComparisonFixtureDigest, phase6ComparisonFixtureDigestV1 } from "@cuckcode/testing";
import { describe, expect, it } from "vitest";

import { renderComposition } from "./phase6-candidate-render.js";
import { RECONCILIATION_B_CLARITY } from "./phase6-candidate-styles.js";
import {
  GOLDEN_VIEWPORTS,
  goldenStateDigestV1,
  projectAllGoldenStates,
  sceneStateFrom,
} from "./phase6-golden-states.js";

/**
 * Phase 7-O plan P-1, owner-approved 2026-09-25. The Phase 7-O canonical additions change the
 * state the Phase 6 fingerprints cover. The frozen records are never edited. Instead:
 *
 * 1. Removing exactly the additions reproduces every frozen fingerprint (the reduction proof).
 * 2. The rendered captures, which the owner approved, are unchanged byte for byte in memory.
 * 3. The new fingerprints are pinned in a successor record, so drift in the new fields also fails.
 */
const ROOT = resolve(import.meta.dirname, "..");
const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(ROOT, path), "utf8")) as T;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

type FrozenGolden = {
  states: Array<{ id: string; digest: string; captures: Record<string, { sha256: string }> }>;
};
const frozenGolden = () =>
  read<FrozenGolden>("docs/evidence/phase-6/golden-states/golden-states.json");
const frozenComparison = () =>
  read<{ digest: string }>("docs/evidence/phase-6/comparison-fixture.json");
const SUCCESSOR = "docs/evidence/phase-6/digest-successors-phase-7-o.json";
type Successor = {
  comparison: { frozen: string; v1: string; v2: string };
  goldenStates: Array<{ id: string; frozen: string; v1: string; v2: string }>;
};

describe("Phase 6 fingerprints under the Phase 7-O additions (P-1)", () => {
  it("reproduces every frozen golden-state fingerprint once the additions are removed", () => {
    const frozen = new Map(frozenGolden().states.map((state) => [state.id, state.digest]));
    const projected = projectAllGoldenStates();
    expect(projected.map((entry) => entry.state.id)).toEqual([...frozen.keys()]);
    for (const entry of projected) {
      expect(goldenStateDigestV1(entry), entry.state.id).toBe(frozen.get(entry.state.id));
    }
  });

  it("changes every golden-state fingerprint when the additions are present", () => {
    const frozen = new Map(frozenGolden().states.map((state) => [state.id, state.digest]));
    for (const entry of projectAllGoldenStates()) {
      expect(entry.digest, entry.state.id).not.toBe(frozen.get(entry.state.id));
    }
  });

  it("renders every approved capture byte for byte as it was approved", () => {
    const frozen = new Map(frozenGolden().states.map((state) => [state.id, state.captures]));
    let compared = 0;
    for (const entry of projectAllGoldenStates()) {
      for (const [label, width, height] of GOLDEN_VIEWPORTS) {
        const rendered = renderComposition(
          RECONCILIATION_B_CLARITY,
          width,
          height,
          sceneStateFrom(entry),
        );
        expect(sha256(rendered), `${entry.state.id} ${label}`).toBe(
          frozen.get(entry.state.id)?.[label]?.sha256,
        );
        compared += 1;
      }
    }
    expect(compared).toBe(10);
  });

  it("pins the new fingerprints in a successor record beside the frozen ones", () => {
    expect(existsSync(resolve(ROOT, SUCCESSOR)), `${SUCCESSOR} is missing`).toBe(true);
    const successor = read<Successor>(SUCCESSOR);
    expect(successor.comparison).toEqual({
      frozen: frozenComparison().digest,
      v1: phase6ComparisonFixtureDigestV1(),
      v2: phase6ComparisonFixtureDigest(),
    });
    const frozen = new Map(frozenGolden().states.map((state) => [state.id, state.digest]));
    expect(successor.goldenStates).toEqual(
      projectAllGoldenStates().map((entry) => ({
        id: entry.state.id,
        frozen: frozen.get(entry.state.id),
        v1: goldenStateDigestV1(entry),
        v2: entry.digest,
      })),
    );
  });
});
