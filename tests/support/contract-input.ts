import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The sanctioned way for a spec to *read* an owner-ruled contract out of the evidence tree.
 *
 * `evidence-immutability.test.mjs` forbids any spec from naming `docs/evidence`, because a browser
 * suite that writes there rewrites owner-reviewed artifacts on every run. Reading is not that
 * failure — a spec that reads the focus contract or the journey list is doing exactly what those
 * documents exist for — but the guard is written as a string match, and relaxing it to tell reads
 * from writes would make it weaker in a way nobody would notice later.
 *
 * So there are two doors instead of one looser rule: this one reads contracts, `evidence-output.ts`
 * writes captures, and everything else still may not name the tree at all.
 */
export function readPhase5Contract<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), "docs", "evidence", "phase-5", "surface-contract", fileName),
      "utf8",
    ),
  ) as T;
}
