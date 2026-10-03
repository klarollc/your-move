import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const styleDir = "apps/web/src";
const globalStylesheet = "global.css";
// The Decision Notice fixture left the office bundle (Phase 5 fixture removal) but still loads
// the office's global stylesheet, so its own sheets stay under the same rule.
const surfaceDirs = [styleDir, "fixtures/decision-notice/src/web"];

// Selectors that escape their surface. A stylesheet imported by one component must not restyle
// the document, because bundlers merge every imported sheet into one cascade and the winner
// becomes an accident of module order. Defect D4-V2-001 records what that already cost.
const escapingSelector =
  /^\s*(?::root\b|\*\s*[,{]|html\b|body\b|button\s*[,{:]|a\s*[,{:]|h[1-6]\s*[,{:]|ul\s*[,{:]|li\s*[,{:]|p\s*[,{:]|dl\s*[,{:]|dt\s*[,{:]|dd\s*[,{:])/u;

function surfaceStylesheets() {
  return surfaceDirs
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((name) => name.endsWith(".css") && !(dir === styleDir && name === globalStylesheet))
        .map((name) => join(dir, name)),
    )
    .sort();
}

test("only the shared global stylesheet may declare document-wide selectors", () => {
  const offenders = [];
  for (const name of surfaceStylesheets()) {
    const lines = readFileSync(name, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (escapingSelector.test(line)) offenders.push(`${name}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `Surface stylesheets must scope their rules:\n${offenders.join("\n")}`,
  );
});

test("the shared global stylesheet exists and owns the document backdrop", () => {
  const global = readFileSync(join(styleDir, globalStylesheet), "utf8");
  assert.match(global, /:root\s*\{/u, "global.css must declare the document root");
  assert.match(global, /background:\s*#e3e3df/u, "the approved graybox backdrop must be explicit");
});
