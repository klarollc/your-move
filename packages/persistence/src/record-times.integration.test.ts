import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { listKickoffRecords, storeKickoffRecord } from "./kickoff-store.js";
import {
  listQuestionDispositionRecords,
  storeOpenQuestion,
  storeQuestionDisposition,
} from "./open-question-store.js";
import { openProjectStore, type ProjectStore } from "./project-store.js";

/**
 * DF-007 follow-up and DF-030 (owner ruling 2026-09-28). Every stored record kind says when it was
 * recorded, or is exempted here with a reason. The tables are read from the real schema, so a new
 * table cannot be missed: it fails until it has a time column or an exemption.
 */
const TIME_COLUMNS = ["occurred_at", "received_at", "created_at", "recorded_at", "applied_at"];

const EXEMPT: Readonly<Record<string, string>> = {
  open_questions:
    "The time is raisedAt inside canonical_json, required by validateOpenQuestion; asserted below.",
  knowledge_records:
    "A projection of knowledge.recorded and knowledge.status_changed events, which carry occurred_at.",
  content_manifests: "DF-030: no recorded time; exempted by owner ruling 2026-09-28, not fixed.",
  packet_receipts: "DF-030: no recorded time; exempted by owner ruling 2026-09-28, not fixed.",
  provider_identities:
    "DF-030: an identity mapping with no recorded time; exempted pending an owner ruling.",
};

let store: ProjectStore | undefined;
afterEach(() => store?.close());

function tables(target: ProjectStore): string[] {
  return (
    target.database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knowledge_fts%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

function columns(target: ProjectStore, table: string): string[] {
  return (
    target.database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((row) => row.name);
}

describe("every stored record kind says when it was recorded", () => {
  it("reads a real schema with the expected tables", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    const found = tables(store);
    expect(found.length).toBeGreaterThanOrEqual(15);
    expect(found).toContain("kickoff_records");
    expect(found).toContain("question_dispositions");
  });

  it("gives every table a time column or a stated exemption", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    const missing = tables(store).filter(
      (table) =>
        !(table in EXEMPT) && !columns(store!, table).some((name) => TIME_COLUMNS.includes(name)),
    );
    expect(missing).toStrictEqual([]);
  });

  it("exempts only tables that exist and truly lack a time column", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    const all = tables(store);
    for (const table of Object.keys(EXEMPT)) {
      expect(all, `${table} is exempted but does not exist`).toContain(table);
      expect(
        columns(store, table).some((name) => TIME_COLUMNS.includes(name)),
        `${table} is exempted but has a time column`,
      ).toBe(false);
    }
  });
});

const RECORDED_AT = "2026-09-28T22:00:00.000Z";
const kickoffRecord = {
  recordId: "contribution_release",
  kickoffId: "kickoff_1",
  projectId: "project_times",
  kind: "contribution" as const,
  revision: 1,
  payload: { roleId: "release" },
};
const question = {
  schemaVersion: 1 as const,
  questionId: "question_1",
  projectId: "project_times",
  subject: { kind: "work_item" as const, id: "work_1" },
  authorKind: "agent" as const,
  authorId: "agent_release",
  raisedByEventId: "event_question_1",
  raisedAt: "2026-09-28T21:00:00.000Z",
  question: "Which review applies?",
  whyItMatters: "It decides the evidence floor.",
  confidence: "speculative" as const,
  wouldBeResolvedBy: ["manager_local"],
  evidenceRefs: [],
  blocksWork: true,
};
const disposition = {
  dispositionId: "disposition_1",
  questionId: "question_1",
  authorKind: "manager" as const,
  authorId: "manager_local",
  disposition: "answered" as const,
  reason: "The release review applies.",
  evidenceRefs: [],
};

describe("kickoff records and question dispositions carry their recorded time", () => {
  it("stores and reads back a kickoff record's recorded time", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    storeKickoffRecord(store, kickoffRecord, { recordedAt: RECORDED_AT });
    expect(listKickoffRecords(store, "project_times", "kickoff_1")[0]?.recordedAt).toBe(
      RECORDED_AT,
    );
  });

  it("stores and reads back a question disposition's recorded time", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    storeOpenQuestion(store, question);
    storeQuestionDisposition(store, "project_times", disposition, { recordedAt: RECORDED_AT });
    const records = listQuestionDispositionRecords(store, "project_times", "question_1");
    expect(records).toStrictEqual([{ disposition, recordedAt: RECORDED_AT }]);
  });

  it("refuses a time that is not a UTC timestamp", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    expect(() => storeKickoffRecord(store!, kickoffRecord, { recordedAt: "yesterday" })).toThrow(
      "RECORD_TIME_INVALID",
    );
    storeOpenQuestion(store, question);
    expect(() =>
      storeQuestionDisposition(store!, "project_times", disposition, { recordedAt: "" }),
    ).toThrow("RECORD_TIME_INVALID");
  });

  it("keeps the first recorded time when the same record is stored again", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    storeKickoffRecord(store, kickoffRecord, { recordedAt: RECORDED_AT });
    storeKickoffRecord(store, kickoffRecord, { recordedAt: "2026-09-29T00:00:00.000Z" });
    expect(listKickoffRecords(store, "project_times", "kickoff_1")[0]?.recordedAt).toBe(
      RECORDED_AT,
    );
  });

  it("reads a row written before recorded times existed as not recorded, never a made-up time", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    store.database
      .prepare(
        "INSERT INTO kickoff_records(record_id,kickoff_id,project_id,kind,revision,canonical_json) VALUES(?,?,?,?,?,?)",
      )
      .run("legacy_1", "kickoff_1", "project_times", "contribution", 1, "{}");
    expect(listKickoffRecords(store, "project_times", "kickoff_1")[0]?.recordedAt).toBeNull();
  });

  it("keeps an open question's time in its stored JSON", () => {
    store = openProjectStore(mkdtempSync(join(tmpdir(), "cuckcode-times-")));
    storeOpenQuestion(store, question);
    const row = store.database
      .prepare("SELECT canonical_json FROM open_questions WHERE question_id=?")
      .get("question_1") as { canonical_json: string };
    expect(JSON.parse(row.canonical_json).raisedAt).toBe(question.raisedAt);
  });
});
