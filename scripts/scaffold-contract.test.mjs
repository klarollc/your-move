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

// A git worktree created inside the repository (e.g. `.worktrees/<branch>`) is a full second copy
// of the tree. On 2026-09-25 one doubled the unit suite from 413 tests to 810, so `verify` was
// reporting two branches at once. Every tool that walks the tree must skip it.
const WORKTREES = ".worktrees";

test("vitest excludes nested worktrees in every project", async () => {
  const source = await readFile(new URL("../vitest.config.ts", import.meta.url), "utf8");
  const excludes = [...source.matchAll(/exclude:\s*\[([^\]]*)\]/g)].map((match) => match[1]);
  assert.ok(excludes.length >= 4, "expected an exclude list in each vitest project");
  for (const list of excludes) {
    assert.ok(
      list.includes(`"**/${WORKTREES}/**"`),
      `a vitest project does not exclude ${WORKTREES}`,
    );
  }
});

test("eslint ignores nested worktrees", async () => {
  const { default: config } = await import(new URL("../eslint.config.mjs", import.meta.url));
  const ignores = config.flatMap((entry) => entry.ignores ?? []);
  assert.ok(ignores.includes(`${WORKTREES}/**`), `eslint does not ignore ${WORKTREES}`);
});

test("prettier ignores nested worktrees", async () => {
  const lines = (await readFile(new URL("../.prettierignore", import.meta.url), "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim());
  assert.ok(lines.includes(`${WORKTREES}/`), `.prettierignore does not ignore ${WORKTREES}`);
});
