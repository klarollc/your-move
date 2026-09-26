import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { findPinViolations, listGuardedFiles } from "./codex-pin-guard.mjs";

const ROOT = resolve(".");
const pin = JSON.parse(readFileSync(join(ROOT, "packages/runtime-codex/package.json"), "utf8"))
  .devDependencies["@openai/codex"];
const bundle = (version) => join(ROOT, "packages/runtime-codex/protocol", version, "manifest.json");
const context = (overrides = {}) => ({
  pin,
  bundleManifest: existsSync(bundle(pin)) ? JSON.parse(readFileSync(bundle(pin), "utf8")) : null,
  ...overrides,
});
const rules = (violations) => violations.map((violation) => violation.rule).sort();

test("a Codex version literal in source is a second copy of the pin", () => {
  const found = findPinViolations(
    [{ path: "scripts/run-something.ts", text: 'expected: { protocolVersion: "0.146.0" }' }],
    context(),
  );
  assert.deepEqual(rules(found), ["version-literal"]);
  assert.equal(found[0].path, "scripts/run-something.ts");
  assert.equal(found[0].line, 1);
});

test("an escaped version inside a regular expression is a copy too", () => {
  const found = findPinViolations(
    [{ path: "packages/runtime-codex/src/supervisor.ts", text: "x\n/0\\.146\\.0/u.test(ua)" }],
    context(),
  );
  assert.deepEqual(rules(found), ["version-literal"]);
  assert.equal(found[0].line, 2);
});

test("tests may name versions, because a comparison needs two", () => {
  const found = findPinViolations(
    [
      { path: "packages/runtime-codex/src/binding.unit.test.ts", text: '"codex-cli 0.147.0"' },
      { path: "scripts/protocol-codex.test.mjs", text: '"0.146.0"' },
    ],
    context(),
  );
  assert.deepEqual(found, []);
});

test("the desktop app's binary is refused everywhere, tests included", () => {
  // Assembled from parts so this file does not itself hold the path it refuses.
  const desktop = ["Programs", "OpenAI", "Codex"];
  const found = findPinViolations(
    [
      {
        path: "packages/runtime-codex/src/codex-live.integration.test.ts",
        text: `"C:/Users/nater/AppData/Local/${desktop.join("/")}/bin/codex.exe"`,
      },
      { path: "scripts/run-x.ts", text: `C:\\\\${desktop.join("\\\\")}\\\\bin` },
    ],
    context(),
  );
  assert.deepEqual(rules(found), ["desktop-binary", "desktop-binary"]);
});

test("the pinned version must have its schema bundle, stating the same version", () => {
  assert.deepEqual(rules(findPinViolations([], context({ bundleManifest: null }))), [
    "bundle-missing",
  ]);
  assert.deepEqual(
    rules(findPinViolations([], context({ bundleManifest: { version: "0.0.1" } }))),
    ["bundle-version-mismatch"],
  );
});

test("the guarded file list covers source and skips generated and vendored trees", () => {
  const files = listGuardedFiles(ROOT);
  assert.ok(files.includes("packages/runtime-codex/src/supervisor.ts"));
  assert.ok(files.includes("scripts/phase4-kickoff-session.ts"));
  assert.ok(files.includes("packages/runtime-codex/src/fixtures/fake-app-server.mjs"));
  assert.ok(files.every((path) => !path.includes("node_modules/") && !path.includes("/dist/")));
  assert.ok(files.every((path) => !path.startsWith("packages/runtime-codex/protocol/")));
});

test("this repository holds exactly one Codex pin", () => {
  const files = listGuardedFiles(ROOT).map((path) => ({
    path,
    text: readFileSync(join(ROOT, path), "utf8"),
  }));
  const found = findPinViolations(files, context());
  assert.deepEqual(
    found.map((violation) => `${violation.rule} ${violation.path}:${violation.line}`),
    [],
  );
});
