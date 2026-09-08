#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function normalizeVersion(version) {
  const match = String(version)
    .trim()
    .match(/^(?:v)?(\d+)(?:\.(\d+))?(?:\.(\d+))?/u);
  if (!match) {
    throw new Error(`Invalid version: ${version}`);
  }

  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareVersions(left, right) {
  const a = normalizeVersion(left);
  const b = normalizeVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) {
      return 1;
    }
    if (a[index] < b[index]) {
      return -1;
    }
  }

  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = comparator.match(/^(>=|>|<=|<|=)?\s*(\d+(?:\.\d+){0,2})$/u);
  if (!match) {
    throw new Error(`Unsupported engine comparator: ${comparator}`);
  }

  const operator = match[1] ?? "=";
  const expected = match[2];
  const comparison = compareVersions(version, expected);

  switch (operator) {
    case ">=":
      return comparison >= 0;
    case ">":
      return comparison > 0;
    case "<=":
      return comparison <= 0;
    case "<":
      return comparison < 0;
    case "=":
      return comparison === 0;
    default:
      throw new Error(`Unsupported engine operator: ${operator}`);
  }
}

export function satisfiesEngineRange(version, range) {
  return String(range)
    .trim()
    .split(/\s+/u)
    .every((comparator) => satisfiesComparator(version, comparator));
}

export function checkToolchain(engines, versions) {
  const errors = [];

  if (engines.node && !satisfiesEngineRange(versions.node, engines.node)) {
    errors.push(`Node ${versions.node} does not satisfy required range ${engines.node}.`);
  }

  if (engines.npm && !satisfiesEngineRange(versions.npm, engines.npm)) {
    errors.push(`npm ${versions.npm} does not satisfy required range ${engines.npm}.`);
  }

  return { ok: errors.length === 0, errors };
}

const NATIVE_PLATFORMS = new Set([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "linux",
  "openbsd",
  "openharmony",
  "sunos",
  "win32",
]);

const NATIVE_ARCHITECTURES = new Set([
  "arm",
  "arm64",
  "ia32",
  "loong64",
  "mips64el",
  "ppc64",
  "riscv64",
  "s390x",
  "x64",
]);

// A platform-tagged package name looks like "@esbuild/win32-x64",
// "@rolldown/binding-win32-x64-msvc", or "lightningcss-win32-x64-msvc". The family is everything
// before the platform token; the remainder carries the platform and, usually, the architecture.
export function parsePlatformPackage(name) {
  const scoped = name.startsWith("@");
  const separator = scoped ? name.indexOf("/") : -1;
  const scope = scoped ? name.slice(0, separator) : "";
  const bare = scoped ? name.slice(separator + 1) : name;

  const tokens = bare.split("-");
  const platformIndex = tokens.findIndex((token) => NATIVE_PLATFORMS.has(token));
  if (platformIndex === -1) {
    return null;
  }

  const prefix = tokens.slice(0, platformIndex).join("-");
  const family = [scope, prefix].filter(Boolean).join(scoped && prefix ? "/" : "");

  return {
    family: family || name,
    platform: tokens[platformIndex],
    arch: tokens.slice(platformIndex + 1).find((token) => NATIVE_ARCHITECTURES.has(token)) ?? null,
  };
}

// Verifies that every family of platform-specific packages present in the tree includes a build
// this machine can actually execute. Defect: on 2026-08-22 an install run from a Linux shell
// against the Windows working copy replaced three win32 builds with linux ones. The engine
// version check passed, and the failure surfaced days later as an unrelated-looking npm bug.
export function checkNativePlatform(packageNames, host) {
  const families = new Map();

  for (const name of packageNames) {
    const parsed = parsePlatformPackage(name);
    if (!parsed) {
      continue;
    }

    const entry = families.get(parsed.family) ?? { installed: [], satisfied: false };
    entry.installed.push(name);
    if (parsed.platform === host.platform && (parsed.arch === null || parsed.arch === host.arch)) {
      entry.satisfied = true;
    }
    families.set(parsed.family, entry);
  }

  const errors = [];
  for (const [family, entry] of families) {
    if (entry.satisfied) {
      continue;
    }
    errors.push(
      `${family} has no build for ${host.platform}-${host.arch}; installed: ${entry.installed.join(", ")}.`,
    );
  }

  return { ok: errors.length === 0, errors };
}

export function readInstalledPackageNames(nodeModulesDir) {
  let entries;
  try {
    entries = readdirSync(nodeModulesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    if (!entry.name.startsWith("@")) {
      names.push(entry.name);
      continue;
    }

    for (const scoped of readdirSync(join(nodeModulesDir, entry.name), { withFileTypes: true })) {
      if (scoped.isDirectory() && !scoped.name.startsWith(".")) {
        names.push(`${entry.name}/${scoped.name}`);
      }
    }
  }

  return names;
}

function currentNpmVersion() {
  const userAgent = process.env.npm_config_user_agent;
  const userAgentMatch = userAgent?.match(/npm\/(\d+\.\d+\.\d+)/u);
  if (userAgentMatch) {
    return userAgentMatch[1];
  }

  return execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
}

function main() {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const engines = packageJson.engines ?? {};
  const versions = {
    node: process.versions.node,
    npm: currentNpmVersion(),
  };
  const host = { platform: process.platform, arch: process.arch };
  const nodeModulesDir = join(
    dirname(fileURLToPath(new URL("../package.json", import.meta.url))),
    "node_modules",
  );

  const result = checkToolchain(engines, versions);
  const native = checkNativePlatform(readInstalledPackageNames(nodeModulesDir), host);

  if (!result.ok || !native.ok) {
    console.error("Toolchain check failed:");
    for (const error of [...result.errors, ...native.errors]) {
      console.error(`- ${error}`);
    }
    if (!result.ok) {
      console.error(
        "Use the Node/npm versions declared in package.json before running project verification.",
      );
    }
    if (!native.ok) {
      console.error(
        `Installed native builds do not match ${host.platform}-${host.arch}. Reinstall from this machine; an install run from another platform against this working copy replaces optional builds in place.`,
      );
    }
    process.exit(1);
  }

  console.log(
    `Toolchain OK: Node ${versions.node}, npm ${versions.npm}, native builds match ${host.platform}-${host.arch}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
