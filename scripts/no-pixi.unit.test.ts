import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 7 Task 4 (plan Q-2; rulings R-1 to R-3). The office draws with SVG; Pixi is not carried
 * unused. No source imports it, no workspace declares it, and the lock file no longer resolves it.
 */
const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_ROOTS = ["apps", "packages", "fixtures", "scripts", "tests"];
const SKIP = new Set(["node_modules", "dist", "test-results", "playwright-report"]);
const SOURCE = /\.(?:[cm]?[jt]sx?)$/u;
const PIXI_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:pixi\.js|@pixi\/[^"']+)["']/u;

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(resolve(ROOT, directory), { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (SOURCE.test(entry.name)) files.push(path);
  }
  return files;
}

async function manifests(): Promise<string[]> {
  const found = ["package.json"];
  for (const parent of ["apps", "packages", "fixtures"]) {
    for (const entry of await readdir(resolve(ROOT, parent), { withFileTypes: true })) {
      if (entry.isDirectory()) found.push(`${parent}/${entry.name}/package.json`);
    }
  }
  return found;
}

describe("Pixi is gone", () => {
  it("is imported by no source file", async () => {
    const files = (await Promise.all(SOURCE_ROOTS.map(sourceFiles))).flat();
    // Not vacuous: the walk found the office's own sources.
    expect(files).toContain("apps/web/src/office-canvas.tsx");
    const importing = [];
    for (const file of files) {
      if (file === "scripts/no-pixi.unit.test.ts") continue;
      if (PIXI_IMPORT.test(await readFile(resolve(ROOT, file), "utf8"))) importing.push(file);
    }
    expect(importing).toEqual([]);
  });

  it("is declared by no workspace", async () => {
    const declaring = [];
    for (const manifest of await manifests()) {
      const parsed = JSON.parse(await readFile(resolve(ROOT, manifest), "utf8")) as Record<
        string,
        unknown
      >;
      for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
        const deps = (parsed[field] ?? {}) as Record<string, string>;
        if (Object.keys(deps).some((name) => name === "pixi.js" || name.startsWith("@pixi/")))
          declaring.push(`${manifest} ${field}`);
      }
    }
    expect(declaring).toEqual([]);
  });

  it("is resolved by nothing in the lock file", async () => {
    const lock = JSON.parse(await readFile(resolve(ROOT, "package-lock.json"), "utf8")) as {
      packages: Record<string, unknown>;
    };
    const paths = Object.keys(lock.packages);
    expect(paths.length).toBeGreaterThan(10);
    expect(paths.filter((path) => /node_modules\/(?:pixi\.js|@pixi\/)/u.test(path))).toEqual([]);
  });
});
