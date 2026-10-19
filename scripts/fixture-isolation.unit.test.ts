import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { reachableModules } from "./phase5-side-effect-review.ts";

/**
 * Phase 5 fixture removal, Task 2 (spec R-3; D-24 named the deviation). Nothing the production
 * office loads may reach the Decision Notice fixture: no module under `fixtures/`, and no file
 * named `decision-notice*`, from the web entry or from the domain package's public index.
 *
 * The walker is the one C-11 uses. Every workspace, fixtures included, is mapped by its manifest,
 * so an import of the fixture package by name is followed rather than treated as external.
 */
const ROOT = resolve(import.meta.dirname, "..");

async function workspaceMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const parent of ["packages", "fixtures"]) {
    for (const entry of await readdir(resolve(ROOT, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = `${parent}/${entry.name}`;
      const manifest = JSON.parse(
        await readFile(resolve(ROOT, directory, "package.json"), "utf8"),
      ) as { name: string; exports?: Record<string, string | Record<string, string>> };
      // A conditional entry's "default" is the source entry; this walk follows source.
      const exported = manifest.exports?.["."];
      const main =
        (typeof exported === "string" ? exported : exported?.default) ?? "./src/index.ts";
      map.set(manifest.name, `${directory}/${main.replace(/^\.\//u, "")}`);
    }
  }
  return map;
}

const isFixture = (file: string) =>
  file.startsWith("fixtures/") || /(^|\/)decision-notice[^/]*$/u.test(file);

describe("the production office does not reach the Decision Notice fixture", () => {
  it.each(["apps/web/src/main.tsx", "packages/domain/src/index.ts"])("from %s", async (entry) => {
    const reached = await reachableModules(ROOT, [entry], await workspaceMap());
    // Not vacuous: the walk resolved everything it met and went beyond its entry.
    expect(reached.unreadable).toEqual([]);
    expect(reached.modules.length).toBeGreaterThan(5);
    expect(reached.modules.filter(isFixture)).toEqual([]);
  });
});
