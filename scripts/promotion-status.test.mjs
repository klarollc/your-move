import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { readPromotedStatus } from "./promotion-status.mjs";

const ROLES_ROOT = resolve(import.meta.dirname, "..", "roles");

/**
 * The promoted set is derived from the artifacts a role actually runs under. After Decision Q2 that
 * is `roles/authored/<id>.json`, not the superseded `roles/manifest.json` import. A status command
 * joined against the wrong manifest reports an empty promoted set while six roles are promoted,
 * which is a gate reporting closed while it is open.
 */
test("promotion status derives the promoted set from the authored artifacts", async () => {
  const status = await readPromotedStatus(ROLES_ROOT);

  assert.equal(status.ok, true);
  assert.equal(status.of, 6);
  assert.deepEqual(
    [...status.promoted].sort(),
    [
      "delivery-lead",
      "implementation-engineer",
      "product-designer",
      "release-reviewer",
      "test-engineer",
      "visual-qa-reviewer",
    ],
    "all six authored roles were promoted by the owner on 2026-09-14 and none were revoked",
  );
});

test("promotion status names the source it derived from", async () => {
  const status = await readPromotedStatus(ROLES_ROOT);

  // A report that cannot say what it read is the defect this test exists for.
  assert.equal(status.source, "roles/authored");
});

test("a digest that drifts from the promoted artifact drops out of the promoted set", async () => {
  const status = await readPromotedStatus(ROLES_ROOT, {
    manifestOverride: {
      commit: "synthetic",
      roles: [
        { roleId: "delivery-lead", contentSha256: "drifted-since-promotion" },
        { roleId: "test-engineer", contentSha256: "drifted-since-promotion" },
      ],
    },
  });

  assert.deepEqual(
    status.promoted,
    [],
    "fails closed when the artifact is not the promoted version",
  );
  assert.equal(status.of, 2);
});
