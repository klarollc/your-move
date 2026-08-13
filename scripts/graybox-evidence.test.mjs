import assert from "node:assert/strict";
import test from "node:test";

import { validateGrayboxEvidenceManifest } from "./validate-graybox-evidence.mjs";

const validManifest = {
  schemaVersion: 1,
  phase: 4,
  evidenceClass: "rendered_graybox",
  fidelity: "graybox",
  promotionStatus: "candidate",
  ownerDecision: "pending_graybox_review",
  fixtureId: "fixture_default_office",
  viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

test("accepts candidate graybox evidence without making an art-direction claim", () => {
  assert.deepEqual(validateGrayboxEvidenceManifest(validManifest), {
    ok: true,
    value: validManifest,
  });
});

test("rejects every promotion or high-fidelity claim on graybox evidence", () => {
  const prohibited = [
    { promotionStatus: "active" },
    { fidelity: "high_fidelity" },
    { evidenceClass: "golden_state" },
    { ownerDecision: "art_direction_approved" },
  ];

  for (const claim of prohibited) {
    assert.deepEqual(validateGrayboxEvidenceManifest({ ...validManifest, ...claim }), {
      ok: false,
      code: "GRAYBOX_PROMOTION_FORBIDDEN",
    });
  }
});

test("rejects malformed, wrong-phase, and secret-bearing graybox manifests", () => {
  for (const manifest of [
    { ...validManifest, schemaVersion: 2 },
    { ...validManifest, phase: 5 },
    { ...validManifest, fixtureId: "" },
    { ...validManifest, apiKey: "sk-canary-secret" },
  ]) {
    const result = validateGrayboxEvidenceManifest(manifest);
    assert.equal(result.ok, false);
  }
});
