import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web document title uses the approved product name", async () => {
  const html = await readFile(new URL("../apps/web/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Your Move(?: — Work)?<\/title>/u);
});
