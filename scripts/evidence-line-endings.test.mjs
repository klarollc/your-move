import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { crViolations, listEvidenceFiles } from "./evidence-line-endings.mjs";

const ROOT = resolve(".");
const bytes = (text) => Buffer.from(text, "utf8");

test("a text file with a CR byte is named", () => {
  assert.deepEqual(
    crViolations([
      { path: "docs/evidence/a.md", bytes: bytes("one\r\ntwo\n") },
      { path: "docs/evidence/b.json", bytes: bytes('{"ok":true}\n') },
    ]),
    ["docs/evidence/a.md"],
  );
});

test("a lone CR counts, not only CRLF", () => {
  assert.deepEqual(crViolations([{ path: "docs/evidence/c.md", bytes: bytes("one\rtwo") }]), [
    "docs/evidence/c.md",
  ]);
});

test("binary files are skipped, by declared type and by a NUL byte", () => {
  assert.deepEqual(
    crViolations([
      { path: "docs/evidence/shot.png", bytes: Buffer.from([0x89, 0x50, 0x0d, 0x0a]) },
      { path: "docs/evidence/blob.bin", bytes: Buffer.from([0x00, 0x0d, 0x0a]) },
    ]),
    [],
  );
});

test("the file list covers the evidence tree", () => {
  const files = listEvidenceFiles(ROOT);
  assert.ok(files.includes("docs/evidence/dogfood-register.md"));
  assert.ok(files.includes("docs/evidence/provenance.jsonl"));
  assert.ok(files.every((path) => path.startsWith("docs/evidence/")));
});

test("no evidence file carries a CR byte, so a clean checkout verifies the same bytes (DF-026)", () => {
  const found = crViolations(
    listEvidenceFiles(ROOT).map((path) => ({ path, bytes: readFileSync(join(ROOT, path)) })),
  );
  assert.deepEqual(found, []);
});
