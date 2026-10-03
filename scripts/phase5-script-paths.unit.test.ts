import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 5 fixture removal, Task 6 (plan D-3). The Phase 5 tool scripts run outside `verify`, so a
 * path they name can go stale with nothing to notice: the fixture move left five pointing at files
 * that no longer existed. Every repository path a Phase 5 script names as a plain string literal
 * must exist. Template literals with `${…}` are not checked; they name files chosen at run time.
 */
const ROOT = resolve(import.meta.dirname, "..");
const PATH_LITERAL =
  /["'`]((?:apps|packages|fixtures|tests|scripts|docs|roles)\/[^"'`\s${}]+\.[A-Za-z0-9]+)["'`]/gu;

describe("Phase 5 tool scripts name only paths that exist", async () => {
  const scripts = (await readdir(resolve(ROOT, "scripts")))
    .filter((name) => name.includes("phase5") && !name.includes(".test."))
    .filter((name) => /\.(?:ts|mjs)$/u.test(name))
    .sort();

  it("finds the Phase 5 scripts, so an empty sweep cannot pass", () => {
    expect(scripts.length).toBeGreaterThan(10);
  });

  it("every named path exists", async () => {
    const missing: string[] = [];
    let named = 0;
    for (const name of scripts) {
      const source = await readFile(resolve(ROOT, "scripts", name), "utf8");
      for (const [, path] of source.matchAll(PATH_LITERAL)) {
        named += 1;
        if (!existsSync(resolve(ROOT, path!))) missing.push(`scripts/${name}: ${path}`);
      }
    }
    expect(named).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
