import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Phase 7-O Task 10 (spec §8.7): the run preamble records the answer key's SHA-256, so the key
 * cannot drift during the three-day interval without this failing inside `verify`.
 */
const DIR = "docs/evidence/phase-7-o/comprehension";

export function preambleDigest(protocol) {
  const match = /^Answer key SHA-256: `([0-9a-f]{64})`$/mu.exec(protocol);
  return match ? match[1] : undefined;
}

test("the preamble names one SHA-256", () => {
  assert.equal(preambleDigest("Answer key SHA-256: `" + "a".repeat(64) + "`"), "a".repeat(64));
  assert.equal(preambleDigest("Answer key SHA-256: abc"), undefined);
});

test("the preamble's SHA-256 is the committed answer key's", () => {
  const recorded = preambleDigest(readFileSync(`${DIR}/protocol.md`, "utf8"));
  assert.ok(recorded, "protocol.md has no 'Answer key SHA-256' line");
  const actual = createHash("sha256")
    .update(readFileSync(`${DIR}/answer-key.md`))
    .digest("hex");
  assert.equal(recorded, actual);
});
