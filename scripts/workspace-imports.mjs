import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Housekeeping item 5 (approved 2026-09-08, authorized 2026-09-28). Every `@cuckcode/*` package a
 * workspace imports must be declared in its `package.json` and referenced from its
 * `tsconfig.json`. Workspace symlinks resolve an undeclared import anyway, so `verify` passed on
 * two such imports on 2026-09-09.
 */

/**
 * Each import of another workspace that is not declared in `package.json`, or not referenced from
 * `tsconfig.json` (when the workspace has one), or names no workspace at all.
 */
export function undeclaredImports(workspaces) {
  const dirOf = new Map(workspaces.map((entry) => [entry.name, entry.dir]));
  const found = [];
  for (const entry of workspaces) {
    for (const { file, name } of entry.imports) {
      if (name === entry.name) continue;
      const report = (missing) => found.push({ workspace: entry.name, file, name, missing });
      if (!dirOf.has(name)) {
        report("workspace");
        continue;
      }
      if (!entry.declared.includes(name)) report("package.json");
      if (entry.references !== null && !entry.references.includes(dirOf.get(name))) {
        report("tsconfig references");
      }
    }
  }
  return found;
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](@cuckcode\/[a-z0-9-]+)/gu;

/** The `@cuckcode/*` package names a source text imports, type-only imports included. */
export function importedPackages(text) {
  return [...new Set([...text.matchAll(IMPORT)].map((match) => match[1]))].sort();
}

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory())
        return entry.name === "node_modules" || entry.name === "dist" ? [] : sourceFiles(full);
      return /\.(?:ts|tsx|mts|js|mjs)$/u.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

/** Reads every workspace under `apps/`, `packages/` and `fixtures/` from the repository root. */
export async function readWorkspaces(root) {
  const workspaces = [];
  for (const group of ["apps", "packages", "fixtures"]) {
    const dirs = await readdir(path.join(root, group), { withFileTypes: true }).catch(() => []);
    for (const entry of dirs.filter((dirent) => dirent.isDirectory())) {
      const dir = path.join(root, group, entry.name);
      const pkg = JSON.parse(
        await readFile(path.join(dir, "package.json"), "utf8").catch(() => "null"),
      );
      if (!pkg) continue;
      const tsconfigText = await readFile(path.join(dir, "tsconfig.json"), "utf8").catch(
        () => null,
      );
      const tsconfig = tsconfigText ? JSON.parse(tsconfigText.replace(/^\s*\/\/.*$/gmu, "")) : null;
      const imports = [];
      for (const file of await sourceFiles(path.join(dir, "src"))) {
        for (const name of importedPackages(await readFile(file, "utf8"))) {
          imports.push({ file: path.relative(root, file).replaceAll("\\", "/"), name });
        }
      }
      workspaces.push({
        name: pkg.name,
        dir: path.relative(root, dir).replaceAll("\\", "/"),
        declared: Object.keys({
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
        }),
        references:
          tsconfig === null
            ? null
            : (tsconfig.references ?? []).map((reference) =>
                path.relative(root, path.join(dir, reference.path)).replaceAll("\\", "/"),
              ),
        imports,
      });
    }
  }
  return workspaces;
}
