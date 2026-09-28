import type { OpenQuestion, QuestionDisposition } from "@cuckcode/contracts";
import { stableStringify } from "@cuckcode/domain";

import type { ProjectStore } from "./project-store.js";
import { validRecordTime, type RecordTime } from "./record-time.js";

/**
 * Canonical serialization, not raw JSON.stringify. Two records with identical values but
 * different key order are the same record, and re-storing one must be idempotent rather than
 * reported as a conflict.
 */
function canonical(value: unknown): string {
  return stableStringify(value);
}

function assertNoConflict(existing: string | undefined, incoming: string): boolean {
  if (existing === undefined) return false;
  if (existing !== incoming) throw new Error("OPEN_QUESTION_RECORD_CONFLICT");
  return true;
}

export function storeOpenQuestion(store: ProjectStore, question: OpenQuestion): void {
  const canonicalJson = canonical(question);
  const existing = store.database
    .prepare("SELECT canonical_json FROM open_questions WHERE question_id=?")
    .get(question.questionId) as { canonical_json: string } | undefined;
  if (assertNoConflict(existing?.canonical_json, canonicalJson)) return;
  store.database
    .prepare("INSERT INTO open_questions VALUES(?,?,?,?,?,?,?,?)")
    .run(
      question.questionId,
      question.projectId,
      question.subject.kind,
      question.subject.id,
      question.authorKind,
      question.authorId,
      question.blocksWork ? 1 : 0,
      canonicalJson,
    );
}

export function storeQuestionDisposition(
  store: ProjectStore,
  projectId: string,
  disposition: QuestionDisposition,
  time: RecordTime,
): void {
  const recordedAt = validRecordTime(time);
  const canonicalJson = canonical(disposition);
  const existing = store.database
    .prepare("SELECT canonical_json FROM question_dispositions WHERE disposition_id=?")
    .get(disposition.dispositionId) as { canonical_json: string } | undefined;
  if (assertNoConflict(existing?.canonical_json, canonicalJson)) return;
  // Explicit sequence rather than insertion rowid, so disposition order is a stored fact and
  // survives any future reindex or migration.
  const next = store.database
    .prepare(
      "SELECT COALESCE(MAX(sequence),0)+1 AS next FROM question_dispositions WHERE question_id=?",
    )
    .get(disposition.questionId) as { next: number };
  store.database
    .prepare(
      "INSERT INTO question_dispositions(disposition_id,question_id,project_id,sequence,canonical_json,recorded_at) VALUES(?,?,?,?,?,?)",
    )
    .run(
      disposition.dispositionId,
      disposition.questionId,
      projectId,
      next.next,
      canonicalJson,
      recordedAt,
    );
}

export function listOpenQuestions(store: ProjectStore, projectId: string): OpenQuestion[] {
  return (
    store.database
      .prepare("SELECT canonical_json FROM open_questions WHERE project_id=? ORDER BY question_id")
      .all(projectId) as Array<{ canonical_json: string }>
  ).map((row) => JSON.parse(row.canonical_json) as OpenQuestion);
}

export function listQuestionDispositions(
  store: ProjectStore,
  projectId: string,
  questionId: string,
): QuestionDisposition[] {
  return (
    store.database
      .prepare(
        "SELECT canonical_json FROM question_dispositions WHERE project_id=? AND question_id=? ORDER BY sequence",
      )
      .all(projectId, questionId) as Array<{ canonical_json: string }>
  ).map((row) => JSON.parse(row.canonical_json) as QuestionDisposition);
}

export type QuestionDispositionRecord = Readonly<{
  disposition: QuestionDisposition;
  recordedAt: string | null;
}>;

/** Dispositions in order, each with when it was recorded (null before DF-030). */
export function listQuestionDispositionRecords(
  store: ProjectStore,
  projectId: string,
  questionId: string,
): QuestionDispositionRecord[] {
  return (
    store.database
      .prepare(
        "SELECT canonical_json,recorded_at FROM question_dispositions WHERE project_id=? AND question_id=? ORDER BY sequence",
      )
      .all(projectId, questionId) as Array<{ canonical_json: string; recorded_at: string | null }>
  ).map((row) => ({
    disposition: JSON.parse(row.canonical_json) as QuestionDisposition,
    recordedAt: row.recorded_at,
  }));
}
