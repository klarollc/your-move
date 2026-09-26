import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PHASE_7O_ADDITIONS,
  phase6ComparisonFixtureDigest,
  phase6ComparisonFixtureDigestV1,
} from "@cuckcode/testing";

import { goldenStateDigestV1, projectAllGoldenStates } from "./phase6-golden-states.js";

/**
 * Writes the Phase 6 digest successor record (Phase 7-O plan P-1). Owner-run: it writes evidence.
 *
 *   npm run phase7o:successors:write
 *
 * Without `--write` it only reports whether the committed record is current. It refuses to write
 * at all unless every fingerprint, with the Phase 7-O additions removed, still equals its frozen
 * Phase 6 value: a successor is only recorded alongside a passing reduction proof.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-6/digest-successors-phase-7-o.json");
const write = process.argv.includes("--write");

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(resolve(ROOT, path), "utf8")) as T;

const frozenComparison = await readJson<{ digest: string }>(
  "docs/evidence/phase-6/comparison-fixture.json",
);
const frozenGolden = await readJson<{ states: Array<{ id: string; digest: string }> }>(
  "docs/evidence/phase-6/golden-states/golden-states.json",
);
const frozenById = new Map(frozenGolden.states.map((state) => [state.id, state.digest]));

const comparison = {
  frozen: frozenComparison.digest,
  v1: phase6ComparisonFixtureDigestV1(),
  v2: phase6ComparisonFixtureDigest(),
};
const goldenStates = projectAllGoldenStates().map((entry) => ({
  id: entry.state.id,
  frozen: frozenById.get(entry.state.id) ?? null,
  v1: goldenStateDigestV1(entry),
  v2: entry.digest,
}));

const failures = [
  ...(comparison.v1 === comparison.frozen ? [] : ["comparison"]),
  ...goldenStates.filter((state) => state.v1 !== state.frozen).map((state) => state.id),
];
if (failures.length > 0) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, code: "REDUCTION_PROOF_FAILED", failures })}\n`,
  );
  process.exit(1);
}

const record = {
  schema: "cuckcode.phase6-digest-successors.v1",
  ruling: "tasks/phase-7-o-plan.md, decision P-1, owner-approved 2026-09-25",
  why: "Phase 7-O adds canonical fields that the Phase 6 fingerprints cover. The frozen records are not edited. Each v1 value below is the current projection with exactly the listed additions removed, and equals its frozen value; each v2 value is the current projection in full.",
  removedForV1: PHASE_7O_ADDITIONS,
  comparison,
  goldenStates,
};
const text = `${JSON.stringify(record, null, 2)}\n`;

if (write) {
  await writeFile(OUT, text, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, mode: "write", path: OUT })}\n`);
} else {
  let current: string;
  try {
    current = await readFile(OUT, "utf8");
  } catch {
    current = "";
  }
  const ok = current === text;
  process.stdout.write(`${JSON.stringify({ ok, mode: "check", current: ok })}\n`);
  if (!ok) process.exit(1);
}
