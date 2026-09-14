import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * The current test inventory for the Phase 5 criteria, read from the test files.
 *
 * This derived from `red-evidence.json` once — a recorded observation of one moment, which stopped
 * being the inventory the instant a test was added. The fix was a hardcoded list of two files, and
 * on 2026-09-14 that list drifted in exactly the same way: `decision-notice-capture.unit.test.ts`
 * and the provenance tests were invisible to it, so the verification brief told the Test Engineer
 * that C-18 had no test at all.
 *
 * A list of files is the same mistake as a list of tests, one level up. So the files are found:
 * anything under the workspace whose test titles name a criterion is part of the inventory, and a
 * new test file joins it by following the naming convention rather than by being added here.
 *
 * One reader, used by both the brief and the overclaim cross-check, so they cannot disagree about
 * what exists.
 */
const TEST_FILE_PATTERN = /\.(?:unit|component|integration)\.test\.tsx?$/u;
const SKIP = new Set(["node_modules", "dist", ".git", ".restore", "test-results", "coverage"]);

/** A title that names a criterion is the convention; naming is how a test declares what it is for. */
const CRITERION_IN_TITLE = /\bit\(\s*"[^"]*\bC-\d{2}\b/u;

async function findTestFiles(root: string, relative = ""): Promise<string[]> {
  const here = relative === "" ? root : resolve(root, relative);
  const entries = await readdir(here, { withFileTypes: true }).catch(() => []);
  const found: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP.has(entry.name)) continue;
    const next = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...(await findTestFiles(root, next)));
    } else if (TEST_FILE_PATTERN.test(entry.name)) {
      const source = await readFile(resolve(root, next), "utf8").catch(() => "");
      if (CRITERION_IN_TITLE.test(source)) found.push(next);
    }
  }
  return found;
}

export type TestFileInventory = { file: string; titles: string[] };

export async function readTestInventory(root: string): Promise<TestFileInventory[]> {
  const inventory: TestFileInventory[] = [];
  for (const file of await findTestFiles(root)) {
    const source = await readFile(resolve(root, file), "utf8").catch(() => "");
    inventory.push({
      file,
      titles: [...source.matchAll(/\bit\(\s*"([^"]+)"/gu)].map((match) => match[1] ?? ""),
    });
  }
  return inventory;
}

/** Criterion ids that a test is named for. Naming is not coverage; this only says a test exists. */
export function criteriaWithATest(inventory: TestFileInventory[]): Set<string> {
  const found = new Set<string>();
  for (const entry of inventory) {
    for (const title of entry.titles) {
      for (const match of title.matchAll(/\bC-\d{2}\b/gu)) found.add(match[0]);
    }
  }
  return found;
}
