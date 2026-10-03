import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DECISION_NOTICE_ENTRY_POINTS,
  acceptedPathOf,
  reachableModules,
  scanModule,
} from "./phase5-side-effect-review.ts";

/**
 * Phase 5 fixture removal, Task 5 (R-4 as corrected by the plan; D-1). The accepted C-11 review is
 * frozen. The code it describes now lives in the fixture workspace, and reaches less: it imports
 * its model directly instead of through the `@cuckcode/domain` barrel. So the successor is held to
 * this: every module it reaches was reached when C-11 was accepted (under the declared path map),
 * it imports no external package the accepted review did not, and it has no finding.
 *
 * Computed from the code, not read from the successor file, so it holds before the owner writes
 * that file; the builder's check inside `verify` keeps the file equal to the code.
 */
const ROOT = resolve(import.meta.dirname, "..");

type Review = {
  modules: string[];
  externalPackagesImported: string[];
  findings: Record<string, unknown[]>;
};

// No workspace is mapped: the fixture imports none, so any `@cuckcode/*` import it gains is
// reported as an external package and fails the second test, with no copy of the workspace list.
const NO_WORKSPACES = new Map<string, string>();

describe("the C-11 successor stays within what was accepted (R-4)", async () => {
  const accepted = JSON.parse(
    await readFile(resolve(ROOT, "docs/evidence/phase-5/side-effect-review.json"), "utf8"),
  ) as Review;
  const reached = await reachableModules(ROOT, [...DECISION_NOTICE_ENTRY_POINTS], NO_WORKSPACES);

  it("reaches only modules the accepted review reached", () => {
    expect(reached.unreadable).toEqual([]);
    expect(reached.modules.length).toBeGreaterThanOrEqual(DECISION_NOTICE_ENTRY_POINTS.length);
    const outside = reached.modules
      .map(acceptedPathOf)
      .filter((m) => !accepted.modules.includes(m));
    expect(outside).toEqual([]);
  });

  it("imports no external package the accepted review did not", () => {
    const added = reached.external.filter((p) => !accepted.externalPackagesImported.includes(p));
    expect(added).toEqual([]);
  });

  it("has no finding, as the accepted review had none", async () => {
    expect(Object.values(accepted.findings).flat()).toEqual([]);
    const found: string[] = [];
    for (const file of reached.modules) {
      const scan = scanModule(file, await readFile(resolve(ROOT, file), "utf8"));
      for (const hit of scan.hits) found.push(`${file}:${hit.line} ${hit.category} ${hit.name}`);
    }
    expect(found).toEqual([]);
  });
});
