import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * The current test inventory for the Decision Notice component, read from the test files.
 *
 * Both the verification brief and the overclaim cross-check used to derive this from
 * `red-evidence.json`. That file is a recorded observation of one moment; it stopped being the
 * inventory the instant a test was added. Deriving the brief from it would have briefed the
 * reviewer on a false premise, and deriving the cross-check from it would have reported honest
 * citations of component tests as overclaims — the guard refusing material that works, again.
 *
 * One reader, used by both, so the brief and the guard cannot disagree about what exists.
 */
export const TEST_FILES = [
  "packages/domain/src/decision-notice.unit.test.ts",
  "apps/web/src/decision-notice.component.test.tsx",
] as const;

export type TestFileInventory = { file: string; titles: string[] };

export async function readTestInventory(root: string): Promise<TestFileInventory[]> {
  const inventory: TestFileInventory[] = [];
  for (const file of TEST_FILES) {
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
