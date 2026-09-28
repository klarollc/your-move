import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openProjectStore, type ProjectStore } from "./project-store.js";
import {
  listOpenQuestions,
  listQuestionDispositions,
  storeOpenQuestion,
  storeQuestionDisposition as storeDispositionAt,
} from "./open-question-store.js";

// DF-030 (P-4): storing now requires a recorded time; these tests are about content, so every
// write uses one fixed time.
const storeQuestionDisposition = (
  target: ProjectStore,
  projectId: string,
  disposition: Parameters<typeof storeDispositionAt>[2],
) => storeDispositionAt(target, projectId, disposition, { recordedAt: "2026-09-28T22:00:00.000Z" });

let store: ProjectStore | undefined;
afterEach(() => {
  store?.close();
  store = undefined;
});

const question = {
  schemaVersion: 1 as const,
  questionId: "question_1",
  projectId: "project_graybox",
  subject: { kind: "work_item" as const, id: "work_42" },
  authorKind: "agent" as const,
  authorId: "agent_test",
  roleId: "test",
  raisedByEventId: "event_108",
  raisedAt: "2026-08-18T09:00:00.000Z",
  question: "Is the layout evidence rewritten on every visual run?",
  whyItMatters: "It backs an approved measurement decision.",
  confidence: "likely" as const,
  wouldBeResolvedBy: ["Comparing capture output paths against committed evidence"],
  evidenceRefs: ["evidence_defect_register"],
  blocksWork: false,
};

describe("open-question canonical persistence", () => {
  it("persists an attributable question and its ordered dispositions across restart", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-oq-"));
    mkdirSync(root, { recursive: true });
    store = openProjectStore(root);

    storeOpenQuestion(store, question);
    storeQuestionDisposition(store, "project_graybox", {
      dispositionId: "d1",
      questionId: "question_1",
      authorKind: "agent",
      authorId: "agent_design",
      disposition: "answered",
      reason: "Agent reading of the capture spec.",
      evidenceRefs: [],
    });
    storeQuestionDisposition(store, "project_graybox", {
      dispositionId: "d2",
      questionId: "question_1",
      authorKind: "manager",
      authorId: "manager_nate",
      disposition: "accepted_risk",
      reason: "Known, tolerated until the graybox gate.",
      evidenceRefs: ["evidence_defect_register"],
    });

    store.close();
    store = openProjectStore(root);

    const questions = listOpenQuestions(store, "project_graybox");
    expect(questions).toHaveLength(1);
    expect(questions[0]?.questionId).toBe("question_1");
    expect(questions[0]?.blocksWork).toBe(false);
    expect(questions[0]?.subject).toEqual({ kind: "work_item", id: "work_42" });
    expect(questions[0]?.confidence).toBe("likely");

    const dispositions = listQuestionDispositions(store, "project_graybox", "question_1");
    expect(dispositions.map((d) => d.dispositionId)).toEqual(["d1", "d2"]);
    expect(dispositions.map((d) => d.authorKind)).toEqual(["agent", "manager"]);
    expect(dispositions[1]?.reason).toContain("tolerated");
  });

  it("rejects a conflicting reuse of an immutable record id", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-oq-"));
    store = openProjectStore(root);
    storeOpenQuestion(store, question);
    expect(() =>
      storeOpenQuestion(store!, { ...question, question: "A different question entirely." }),
    ).toThrow("OPEN_QUESTION_RECORD_CONFLICT");
  });

  it("treats an identical record re-store as idempotent regardless of key order", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-oq-"));
    store = openProjectStore(root);
    storeOpenQuestion(store, question);
    // Same values, different key order. Canonical serialization must not read this as a conflict.
    const reordered = {
      blocksWork: question.blocksWork,
      evidenceRefs: question.evidenceRefs,
      wouldBeResolvedBy: question.wouldBeResolvedBy,
      confidence: question.confidence,
      whyItMatters: question.whyItMatters,
      question: question.question,
      raisedByEventId: question.raisedByEventId,
      raisedAt: question.raisedAt,
      roleId: question.roleId,
      authorId: question.authorId,
      authorKind: question.authorKind,
      subject: { id: question.subject.id, kind: question.subject.kind },
      projectId: question.projectId,
      questionId: question.questionId,
      schemaVersion: question.schemaVersion,
    };
    expect(() => storeOpenQuestion(store!, reordered)).not.toThrow();
    expect(listOpenQuestions(store, "project_graybox")).toHaveLength(1);
  });

  it("isolates questions and dispositions by project", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-oq-"));
    store = openProjectStore(root);
    storeOpenQuestion(store, question);
    storeOpenQuestion(store, {
      ...question,
      questionId: "question_beta",
      projectId: "project_beta",
    });
    storeQuestionDisposition(store, "project_beta", {
      dispositionId: "d_beta",
      questionId: "question_beta",
      authorKind: "manager",
      authorId: "manager_nate",
      disposition: "rejected",
      reason: "Out of scope for beta.",
      evidenceRefs: [],
    });

    expect(listOpenQuestions(store, "project_graybox").map((q) => q.questionId)).toEqual([
      "question_1",
    ]);
    expect(listQuestionDispositions(store, "project_graybox", "question_1")).toEqual([]);
    expect(listQuestionDispositions(store, "project_beta", "question_beta")).toHaveLength(1);
  });

  it("applies migration 004 and advances the schema version", () => {
    const root = mkdtempSync(join(tmpdir(), "cuckcode-oq-"));
    store = openProjectStore(root);
    const schema = store.schema();
    expect(schema.migrations.map(({ id }) => id)).toContain("004_open_question");
    expect(schema.userVersion).toBe(schema.migrations.length);
    expect(store.hasTable("open_questions")).toBe(true);
    expect(store.hasTable("question_dispositions")).toBe(true);
  });
});
