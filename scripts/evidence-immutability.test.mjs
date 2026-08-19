import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const testRoot = "tests";
const sanctionedHelper = join("tests", "support", "evidence-output.ts");
const committedEvidence = "docs/evidence";

function specFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? specFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

// Accepted-phase evidence is immutable once its owner gate closes. A browser suite that writes
// straight into docs/evidence rewrites owner-reviewed artifacts on every run, and the change is
// visible only as an unexplained dirty working tree. Defect D4-P-003, and D4-P-001 before it.
test("no browser spec writes directly into committed evidence", () => {
  const offenders = specFiles(testRoot)
    .filter((path) => path !== sanctionedHelper)
    .filter((path) => readFileSync(path, "utf8").includes(committedEvidence));
  assert.deepEqual(
    offenders,
    [],
    `Specs must route captures through ${sanctionedHelper}:\n${offenders.join("\n")}`,
  );
});

test("the sanctioned helper defaults to ephemeral output and gates regeneration explicitly", () => {
  const helper = readFileSync(sanctionedHelper, "utf8");
  assert.match(helper, /CUCKCODE_REGENERATE_EVIDENCE/u, "regeneration must be explicitly gated");
  assert.match(helper, /outputPath/u, "the default must be the ephemeral test output directory");
});
