import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildAuthoredManifest } from "./promote-authored-roles.mjs";

test("builds a promotion manifest from the actual authored role bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "cuckcode-authored-"));
  const authoredDirectory = join(root, "authored");
  await mkdir(authoredDirectory);
  await writeFile(join(authoredDirectory, "delivery-lead.json"), '{"roleId":"delivery-lead"}\n');
  await writeFile(join(authoredDirectory, "test-engineer.json"), '{"roleId":"test-engineer"}\n');

  const manifest = await buildAuthoredManifest({ authoredDirectory, commit: "35596d8" });

  assert.equal(manifest.commit, "35596d8");
  assert.deepEqual(
    manifest.roles.map((role) => role.roleId),
    ["delivery-lead", "test-engineer"],
  );
  assert.match(manifest.roles[0].contentSha256, /^[a-f0-9]{64}$/u);
});
