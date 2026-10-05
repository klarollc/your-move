import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  checklistTasks,
  citedCommits,
  git,
  readRecord,
  recordProblems,
  taskState,
} from "./position-record.mjs";

const read = (path) => readFileSync(path, "utf8");

test("reads both checklist styles", () => {
  assert.deepEqual(checklistTasks("- [x] Task 9f (approved)\n- [ ] **Task 14 — Owner-run**\n"), [
    { id: "9f", checked: true },
    { id: "14", checked: false },
  ]);
});

test("refuses a done task without a gate, a checked box the record calls open, and a missing row", () => {
  const record = {
    schemaVersion: 1,
    workstreams: [
      {
        id: "X",
        state: "in_progress",
        checklist: "x.md",
        tasks: [
          { id: "1", state: "done" },
          { id: "2", state: "authorized" },
        ],
      },
    ],
  };
  const problems = recordProblems(record, () => "- [x] Task 1\n- [x] Task 2\n- [ ] Task 3\n");
  assert.deepEqual(problems, [
    "X:1: done without a gate",
    "X:2: checklist [x], record authorized",
    "X:3: in the checklist, not in the record",
  ]);
});

test("the position record agrees with every checklist it names", () => {
  assert.deepEqual(recordProblems(readRecord(), read), []);
});

test("records superseded work as superseded, without counting it as complete", () => {
  const record = {
    schemaVersion: 1,
    workstreams: [
      {
        id: "X",
        state: "superseded",
        checklist: "x.md",
        tasks: [{ id: "1", state: "superseded" }],
      },
    ],
  };
  assert.deepEqual(
    recordProblems(record, () => "- [ ] Task 1 — superseded by the current spec\n"),
    [],
  );
});

test("every commit the record cites exists", () => {
  for (const commit of citedCommits(readRecord())) {
    assert.doesNotThrow(
      () => git(["cat-file", "-e", `${commit}^{commit}`]),
      `${commit} is not a commit`,
    );
  }
});

test("the record is not older than the checklists it summarizes", () => {
  const record = readRecord();
  const checklists = record.workstreams.flatMap((stream) =>
    stream.checklist ? [stream.checklist] : [],
  );
  const newestChecklist = git(["log", "-1", "--format=%H", "--", ...checklists]);
  const newestRecord = git(["log", "-1", "--format=%H", "--", "position.json"]);
  assert.ok(newestRecord, "position.json has never been committed");
  assert.doesNotThrow(
    () => git(["merge-base", "--is-ancestor", newestChecklist, newestRecord]),
    `a checklist changed in ${newestChecklist.slice(0, 7)} after the record last changed`,
  );
});

test("nothing touches a frozen path before its freeze ends", () => {
  const record = readRecord();
  for (const freeze of record.authority.freezes) {
    if (["done", "accepted"].includes(taskState(record, freeze.until))) continue;
    const committed = git([
      "log",
      "--format=%h %s",
      `${freeze.since}..HEAD`,
      "--",
      ...freeze.paths,
    ]);
    assert.equal(committed, "", `committed under a freeze until ${freeze.until}: ${committed}`);
    const uncommitted = git(["status", "--porcelain", "--", ...freeze.paths]);
    assert.equal(
      uncommitted,
      "",
      `uncommitted under a freeze until ${freeze.until}: ${uncommitted}`,
    );
  }
});
