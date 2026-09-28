import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Housekeeping item 4 (owner-approved 2026-09-28): the dogfood register has a promotion path, and
 * its status index is checked against the entries themselves, so an entry cannot be added without
 * a status and a status cannot outlive its entry.
 */
export const STATUSES = ["open", "ruled", "fixed", "graduated", "closed"];

export function entryIds(text) {
  return [...text.matchAll(/^### (DF-\d{3}) —/gmu)].map((match) => match[1]);
}

export function indexRows(text) {
  const start = text.indexOf("## Status index");
  if (start < 0) return [];
  const end = text.indexOf("\n## ", start + 1);
  const section = text.slice(start, end < 0 ? undefined : end);
  return [...section.matchAll(/^\| (DF-\d{3}) \| ([a-z]+) \|/gmu)].map((match) => ({
    id: match[1],
    status: match[2],
  }));
}

test("reads entries and index rows", () => {
  const sample = "## Status index\n\n| DF-001 | open | x |\n\n## Entries\n\n### DF-001 — A\n";
  assert.deepEqual(entryIds(sample), ["DF-001"]);
  assert.deepEqual(indexRows(sample), [{ id: "DF-001", status: "open" }]);
});

test("every register entry has exactly one index row with a known status", () => {
  const text = readFileSync("docs/evidence/dogfood-register.md", "utf8");
  const entries = entryIds(text);
  const rows = indexRows(text);
  assert.ok(entries.length >= 29, `read ${entries.length} entries`);
  assert.deepEqual(
    rows.map((row) => row.id),
    [...new Set(rows.map((row) => row.id))],
    "an entry is indexed twice",
  );
  assert.deepEqual([...rows.map((row) => row.id)].sort(), [...entries].sort());
  for (const row of rows) assert.ok(STATUSES.includes(row.status), `${row.id}: ${row.status}`);
});
