import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const surfaceFiles = [
  "apps/web/src/work-list.tsx",
  "apps/web/src/work-list-page.tsx",
  "apps/web/src/work-list-model.ts",
];
const forbidden = [
  "office-canvas",
  "office-scene-adapter",
  "office-scene",
  "ui-system",
  "isometric",
];

test("Surface B list and projection stay independent of the office scene", async () => {
  for (const path of surfaceFiles) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    for (const dependency of forbidden) {
      assert.equal(source.includes(dependency), false, `${path} must not depend on ${dependency}`);
    }
  }
});
