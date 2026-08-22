#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  const result = checkToolchain(engines, versions);

  if (!result.ok) {
    console.error("Toolchain check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    console.error(
      "Use the Node/npm versions declared in package.json before running project verification.",
    );
    process.exit(1);
  }

  console.log(`Toolchain OK: Node ${versions.node}, npm ${versions.npm}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
