import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootPackageUrl = new URL("../package.json", import.meta.url);

test("root package declares the approved private npm workspaces", async () => {
  const packageJson = JSON.parse(await readFile(rootPackageUrl, "utf8"));

  assert.equal(packageJson.private, true);
  assert.deepEqual(packageJson.workspaces, ["apps/*", "packages/*", "fixtures/*"]);
});

test("root package exposes every approved Phase 0 verification command", async () => {
  const packageJson = JSON.parse(await readFile(rootPackageUrl, "utf8"));
  const requiredScripts = [
    "format:check",
    "lint",
    "typecheck",
    "test:unit",
    "test:integration",
    "test:contract",
    "test:e2e",
    "test:a11y",
    "test:visual",
    "build",
    "verify",
  ];

  for (const script of requiredScripts) {
    assert.equal(typeof packageJson.scripts?.[script], "string", `${script} is missing`);
  }
});
