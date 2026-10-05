import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The project position record (DF-001 to DF-003; spec
 * docs/proposals/2026-09-28-project-position-record.md, approved 2026-09-28). position.json is
 * primary for state and authority; the checklists stay primary for results. These checks keep the
 * two consistent and turn the record's freezes into guards.
 */
export const WORKSTREAM_STATES = [
  "proposed",
  "specified",
  "approved",
  "in_progress",
  "complete",
  "accepted",
  "closed",
  "superseded",
];
export const TASK_STATES = [
  "proposed",
  "approved",
  "authorized",
  "in_progress",
  "done",
  "pending_owner",
  "accepted",
  "blocked",
  "superseded",
];
const CHECKED = new Set(["done", "accepted"]);
const FINISHED_WORKSTREAMS = new Set(["complete", "accepted", "closed", "superseded"]);

/** Checklist tasks as { id, checked }, in either of the repository's two checklist styles. */
export function checklistTasks(text) {
  return [...text.matchAll(/^- \[( |x)\] (?:\*\*)?Task ([0-9]+[a-z]?)\b/gmu)].map((match) => ({
    id: match[2],
    checked: match[1] === "x",
  }));
}

/** Everything wrong with the record's shape and its agreement with the checklists, as messages. */
export function recordProblems(record, readChecklist) {
  const problems = [];
  if (record.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  const ids = new Set();
  for (const stream of record.workstreams ?? []) {
    if (ids.has(stream.id)) problems.push(`${stream.id}: listed twice`);
    ids.add(stream.id);
    if (!WORKSTREAM_STATES.includes(stream.state))
      problems.push(`${stream.id}: state ${stream.state}`);
    for (const task of stream.tasks ?? []) {
      if (!TASK_STATES.includes(task.state))
        problems.push(`${stream.id}:${task.id}: state ${task.state}`);
      if (CHECKED.has(task.state) && !task.gate) {
        problems.push(`${stream.id}:${task.id}: done without a gate`);
      }
      if (task.gate && !/^[0-9a-f]{7,40}$/u.test(String(task.gate.verify))) {
        problems.push(`${stream.id}:${task.id}: gate.verify is not a commit`);
      }
      if (task.state === "blocked" && !task.resolver)
        problems.push(`${stream.id}:${task.id}: blocked without a resolver`);
    }
    if (!stream.checklist) continue;
    const listed = checklistTasks(readChecklist(stream.checklist));
    if (listed.length === 0) problems.push(`${stream.id}: ${stream.checklist} has no tasks`);
    if (!stream.tasks) {
      if (!FINISHED_WORKSTREAMS.has(stream.state))
        problems.push(`${stream.id}: an unfinished workstream needs task rows`);
      for (const task of listed.filter((entry) => !entry.checked)) {
        problems.push(`${stream.id}:${task.id}: unchecked in a ${stream.state} workstream`);
      }
      continue;
    }
    const rows = new Map(stream.tasks.map((task) => [task.id, task]));
    for (const task of listed) {
      const row = rows.get(task.id);
      if (!row) problems.push(`${stream.id}:${task.id}: in the checklist, not in the record`);
      else if (task.checked !== CHECKED.has(row.state)) {
        problems.push(
          `${stream.id}:${task.id}: checklist ${task.checked ? "[x]" : "[ ]"}, record ${row.state}`,
        );
      }
    }
    for (const id of rows.keys()) {
      if (!listed.some((task) => task.id === id))
        problems.push(`${stream.id}:${id}: in the record, not in the checklist`);
    }
  }
  return problems;
}

/** Every commit the record cites: task gates and freeze starts. */
export function citedCommits(record) {
  const commits = [];
  for (const stream of record.workstreams ?? []) {
    for (const task of stream.tasks ?? []) if (task.gate) commits.push(task.gate.verify);
  }
  for (const freeze of record.authority?.freezes ?? []) commits.push(freeze.since);
  return commits;
}

export function taskState(record, reference) {
  const [streamId, taskId] = reference.split(":");
  return record.workstreams
    ?.find((stream) => stream.id === streamId)
    ?.tasks?.find((task) => task.id === taskId)?.state;
}

export const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

export function readRecord(path = "position.json") {
  return JSON.parse(readFileSync(path, "utf8"));
}
