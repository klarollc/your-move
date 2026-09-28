import assert from "node:assert/strict";
import test from "node:test";

import { importedPackages, readWorkspaces, undeclaredImports } from "./workspace-imports.mjs";

const workspace = (overrides) => ({
  name: "@cuckcode/web",
  dir: "apps/web",
  declared: ["@cuckcode/domain"],
  references: ["packages/domain"],
  imports: [{ file: "apps/web/src/a.ts", name: "@cuckcode/domain" }],
  ...overrides,
});
const domain = {
  name: "@cuckcode/domain",
  dir: "packages/domain",
  declared: [],
  references: [],
  imports: [],
};
const contracts = { ...domain, name: "@cuckcode/contracts", dir: "packages/contracts" };

test("finds value, type-only, re-export and dynamic imports, and ignores other scopes", () => {
  const text = [
    'import { a } from "@cuckcode/domain";',
    'import type { B } from "@cuckcode/contracts";',
    'export { c } from "@cuckcode/application";',
    'const d = await import("@cuckcode/ui-system");',
    'import "@cuckcode/testing/setup";',
    'import e from "@other/domain";',
  ].join("\n");
  assert.deepEqual(importedPackages(text), [
    "@cuckcode/application",
    "@cuckcode/contracts",
    "@cuckcode/domain",
    "@cuckcode/testing",
    "@cuckcode/ui-system",
  ]);
});

test("a declared, referenced import is clean", () => {
  assert.deepEqual(undeclaredImports([workspace({}), domain]), []);
});

test("an import missing from package.json is reported with its file", () => {
  const found = undeclaredImports([workspace({ declared: [] }), domain]);
  assert.deepEqual(found, [
    {
      workspace: "@cuckcode/web",
      file: "apps/web/src/a.ts",
      name: "@cuckcode/domain",
      missing: "package.json",
    },
  ]);
});

test("an import missing from tsconfig references is reported", () => {
  const found = undeclaredImports([workspace({ references: [] }), domain]);
  assert.deepEqual(found, [
    {
      workspace: "@cuckcode/web",
      file: "apps/web/src/a.ts",
      name: "@cuckcode/domain",
      missing: "tsconfig references",
    },
  ]);
});

test("a reference to the wrong package does not satisfy the import", () => {
  const found = undeclaredImports([
    workspace({ references: ["packages/contracts"] }),
    domain,
    contracts,
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].missing, "tsconfig references");
});

test("a workspace importing itself is not a dependency", () => {
  assert.deepEqual(
    undeclaredImports([
      { ...domain, imports: [{ file: "packages/domain/src/x.ts", name: "@cuckcode/domain" }] },
    ]),
    [],
  );
});

test("an import of a package that is not a workspace is reported", () => {
  const found = undeclaredImports([
    workspace({ imports: [{ file: "apps/web/src/a.ts", name: "@cuckcode/gone" }] }),
    domain,
  ]);
  assert.deepEqual(found, [
    {
      workspace: "@cuckcode/web",
      file: "apps/web/src/a.ts",
      name: "@cuckcode/gone",
      missing: "workspace",
    },
  ]);
});

test("the repository has no undeclared workspace import", async () => {
  const workspaces = await readWorkspaces(process.cwd());
  assert.ok(workspaces.length >= 10, `read ${workspaces.length} workspaces`);
  assert.ok(
    workspaces.some((entry) => entry.imports.length > 0),
    "no imports were read at all",
  );
  assert.deepEqual(undeclaredImports(workspaces), []);
});
