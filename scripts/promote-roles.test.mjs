import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyPromotionRecord,
  planPromotion,
  planRevocation,
  promotedRoleIds,
} from "./promote-roles.mjs";

const NOW = "2026-09-08T21:00:00.000Z";
const PACKET = "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md";

const ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
];

function manifest(overrides = {}) {
  return {
    commit: "ebe9c99acb5c96f9468de368d8bead775387d1a7",
    roles: ROLE_IDS.map((roleId) => ({
      roleId,
      sourceSha256: `source-${roleId}`,
      overlaySha256: `overlay-${roleId}`,
      status: "candidate",
      executable: false,
    })),
    ...overrides,
  };
}

function request(roleIds = ROLE_IDS, mutate = () => {}) {
  const entries = roleIds.map((roleId) => ({
    roleId,
    sourceSha256: `source-${roleId}`,
    overlaySha256: `overlay-${roleId}`,
  }));
  mutate(entries);
  return entries;
}

test("promotes all six roles when every digest matches the manifest", () => {
  const result = planPromotion({
    manifest: manifest(),
    requested: request(),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(promotedRoleIds(result.record, manifest()), ROLE_IDS);
  for (const entry of result.record.promotions) {
    assert.equal(entry.promotedAt, NOW);
    assert.equal(entry.packetRef, PACKET);
    assert.equal(entry.revokedAt, null);
  }
});

test("refuses a partial promotion request and promotes nothing", () => {
  const result = planPromotion({
    manifest: manifest(),
    requested: request(ROLE_IDS.slice(0, 5)),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  assert.deepEqual(result, { ok: false, code: "PROMOTION_INCOMPLETE" });
});

test("blocks the whole promotion on a single digest mismatch, leaving nothing promoted", () => {
  const result = planPromotion({
    manifest: manifest(),
    requested: request(ROLE_IDS, (entries) => {
      entries[3].overlaySha256 = "overlay-drifted";
    }),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "PROMOTION_DRIFT");
  assert.deepEqual(result.drifted, ["test-engineer"]);
  assert.equal(result.record, undefined);
});

test("refuses a role the manifest does not carry", () => {
  const result = planPromotion({
    manifest: manifest(),
    requested: [
      ...request(ROLE_IDS.slice(1)),
      { roleId: "ghost-role", sourceSha256: "s", overlaySha256: "o" },
    ],
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLE_NOT_IN_MANIFEST");
});

test("a promoted role stops counting as promoted once its digests drift", () => {
  const promoted = planPromotion({
    manifest: manifest(),
    requested: request(),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });
  assert.equal(promoted.ok, true);

  const drifted = manifest();
  drifted.roles[2].sourceSha256 = "source-changed-upstream";

  // Fails closed. A contract version that changed after promotion was never the version the
  // owner promoted, and nothing should have to remember to revoke it.
  assert.deepEqual(
    promotedRoleIds(promoted.record, drifted),
    ROLE_IDS.filter((roleId) => roleId !== "implementation-engineer"),
  );
});

test("revocation removes a role from the promoted set and records why", () => {
  const promoted = planPromotion({
    manifest: manifest(),
    requested: request(),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  const revoked = planRevocation({
    record: promoted.record,
    roleIds: ["release-reviewer"],
    now: "2026-09-09T09:00:00.000Z",
    reason: "Kickoff complete; independent review returns to candidate.",
  });

  assert.equal(revoked.ok, true);
  assert.deepEqual(
    promotedRoleIds(revoked.record, manifest()),
    ROLE_IDS.filter((roleId) => roleId !== "release-reviewer"),
  );

  const entry = revoked.record.promotions.find((item) => item.roleId === "release-reviewer");
  assert.equal(entry.revokedAt, "2026-09-09T09:00:00.000Z");
  assert.match(entry.revokedReason, /independent review/u);
});

test("revoking a role that was never promoted is an error, not a silent success", () => {
  const result = planRevocation({
    record: emptyPromotionRecord(),
    roleIds: ["release-reviewer"],
    now: NOW,
    reason: "nothing to revoke",
  });

  // The error names which role, matching ROLE_NOT_IN_MANIFEST and PROMOTION_DRIFT. Asserting the
  // roleId is a stronger claim than the bare shape this test originally made.
  assert.deepEqual(result, { ok: false, code: "NOT_PROMOTED", roleId: "release-reviewer" });
});

test("revocation requires a stated reason", () => {
  const promoted = planPromotion({
    manifest: manifest(),
    requested: request(),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  assert.deepEqual(
    planRevocation({
      record: promoted.record,
      roleIds: ["release-reviewer"],
      now: NOW,
      reason: "  ",
    }),
    { ok: false, code: "REVOCATION_REASON_REQUIRED" },
  );
});

test("re-promoting an already promoted role is idempotent, not a duplicate", () => {
  const first = planPromotion({
    manifest: manifest(),
    requested: request(),
    record: emptyPromotionRecord(),
    now: NOW,
    packetRef: PACKET,
  });

  const second = planPromotion({
    manifest: manifest(),
    requested: request(),
    record: first.record,
    now: "2026-09-10T10:00:00.000Z",
    packetRef: PACKET,
  });

  assert.equal(second.ok, true);
  assert.equal(second.record.promotions.length, ROLE_IDS.length);
  // The original promotion time survives; re-approving does not rewrite when it happened.
  assert.equal(
    second.record.promotions.find((item) => item.roleId === "delivery-lead").promotedAt,
    NOW,
  );
});
