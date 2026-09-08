import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkNativePlatform,
  checkToolchain,
  readInstalledPackageNames,
  satisfiesEngineRange,
} from "./check-toolchain.mjs";

test("accepts versions inside the declared Node and npm engine ranges", () => {
  const result = checkToolchain(
    {
      node: ">=24.18.0 <25",
      npm: ">=11.16.0 <12",
    },
    {
      node: "24.18.0",
      npm: "11.16.0",
    },
  );

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects versions outside the declared engine ranges with actionable messages", () => {
  const result = checkToolchain(
    {
      node: ">=24.18.0 <25",
      npm: ">=11.16.0 <12",
    },
    {
      node: "26.7.0",
      npm: "12.0.2",
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "Node 26.7.0 does not satisfy required range >=24.18.0 <25.",
    "npm 12.0.2 does not satisfy required range >=11.16.0 <12.",
  ]);
});

test("supports the exact range form used by package engines", () => {
  assert.equal(satisfiesEngineRange("24.18.0", ">=24.18.0 <25"), true);
  assert.equal(satisfiesEngineRange("24.17.9", ">=24.18.0 <25"), false);
  assert.equal(satisfiesEngineRange("25.0.0", ">=24.18.0 <25"), false);
  assert.equal(satisfiesEngineRange("11.19.0", ">=11.16.0 <12"), true);
});

test("accepts a tree whose native bindings match the host platform and architecture", () => {
  const result = checkNativePlatform(
    [
      "vite",
      "@rolldown/binding-win32-x64-msvc",
      "@esbuild/win32-x64",
      "lightningcss-win32-x64-msvc",
    ],
    { platform: "win32", arch: "x64" },
  );

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects the tree that shipped Linux bindings to a Windows host (2026-08-22)", () => {
  const result = checkNativePlatform(
    ["vite", "@rolldown/binding-linux-x64-gnu", "@esbuild/linux-x64", "lightningcss-linux-x64-gnu"],
    { platform: "win32", arch: "x64" },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "@rolldown/binding has no build for win32-x64; installed: @rolldown/binding-linux-x64-gnu.",
    "@esbuild has no build for win32-x64; installed: @esbuild/linux-x64.",
    "lightningcss has no build for win32-x64; installed: lightningcss-linux-x64-gnu.",
  ]);
});

test("ignores packages that carry no platform tag", () => {
  const result = checkNativePlatform(["vite", "react", "better-sqlite3"], {
    platform: "win32",
    arch: "x64",
  });

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("tolerates foreign builds when the matching build is also present", () => {
  const result = checkNativePlatform(
    ["@rolldown/binding-win32-x64-msvc", "@rolldown/binding-linux-x64-gnu"],
    { platform: "win32", arch: "x64" },
  );

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects a right-platform wrong-architecture build", () => {
  const result = checkNativePlatform(["@rolldown/binding-win32-arm64-msvc"], {
    platform: "win32",
    arch: "x64",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "@rolldown/binding has no build for win32-x64; installed: @rolldown/binding-win32-arm64-msvc.",
  ]);
});

test("reads installed package names, including scoped packages, from a node_modules tree", () => {
  const root = mkdtempSync(join(tmpdir(), "cuckcode-toolchain-"));
  const nodeModules = join(root, "node_modules");
  mkdirSync(join(nodeModules, "lightningcss-win32-x64-msvc"), { recursive: true });
  mkdirSync(join(nodeModules, "vite"), { recursive: true });
  mkdirSync(join(nodeModules, "@rolldown", "binding-win32-x64-msvc"), { recursive: true });
  mkdirSync(join(nodeModules, ".bin"), { recursive: true });

  const names = readInstalledPackageNames(nodeModules);

  assert.deepEqual(names.sort(), [
    "@rolldown/binding-win32-x64-msvc",
    "lightningcss-win32-x64-msvc",
    "vite",
  ]);
});

test("returns nothing when there is no node_modules tree to read", () => {
  const root = mkdtempSync(join(tmpdir(), "cuckcode-toolchain-"));

  assert.deepEqual(readInstalledPackageNames(join(root, "node_modules")), []);
});
