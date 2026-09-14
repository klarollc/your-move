import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * C-08's two-run record, checked without re-running it.
 *
 * `npm run phase5:determinism` runs the whole capture twice and takes several minutes, which is not
 * something the gate should do on every invocation. What the gate does instead is check that the
 * record exists, says what it claims, and still describes the captures on disk — so a capture that
 * changed after the comparison makes this red rather than leaving a stale "identical" standing.
 */
const OUT = "docs/evidence/phase-5/browser";
const record = JSON.parse(readFileSync(resolve(OUT, "determinism.json"), "utf8"));

test("two complete capture runs produced identical artifacts", () => {
  assert.equal(record.identical, true, `differing: ${JSON.stringify(record.differing)}`);
  assert.deepEqual(record.differing, []);
  assert.deepEqual(record.presentInOnlyOneRun, []);
});

test("the comparison covered every capture, not a sample", () => {
  // Twenty states at two viewports, each with an image, an accessibility tree and a journey record.
  assert.ok(
    record.artifactsCompared >= 120,
    `only ${record.artifactsCompared} artifacts were compared`,
  );
});

test("every exclusion is named with its reason", () => {
  assert.ok(Array.isArray(record.excludedFromComparison));
  for (const excluded of record.excludedFromComparison) {
    assert.ok(excluded.file, "an exclusion has no file name");
    assert.ok(
      excluded.why && excluded.why.length > 20,
      `${excluded.file} is excluded without a stated reason`,
    );
  }
});

test("the record still describes the captures on disk", () => {
  // A determinism claim about artifacts that have since changed is a claim about nothing. Checking a
  // sample rather than all of them keeps the gate fast; a capture run rewrites every file at once,
  // so a stale record cannot hide behind the unchecked remainder.
  const sample = Object.entries(record.runA).slice(0, 12);
  assert.ok(sample.length > 0, "the record compared nothing");
  for (const [relative, digest] of sample) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(OUT, relative)))
      .digest("hex")
      .slice(0, 16);
    assert.equal(
      actual,
      digest,
      `${relative} changed since the determinism comparison; re-run npm run phase5:determinism`,
    );
  }
});
