import { stableStringify } from "@cuckcode/domain";

import type { ProjectStore } from "./project-store.js";
import { validRecordTime, type RecordTime } from "./record-time.js";

type KickoffRecordKind =
  "briefing" | "contribution" | "synthesis" | "revision" | "charter" | "disposition";

export type StoredKickoffRecord = Readonly<{
  recordId: string;
  kickoffId: string;
  projectId: string;
  kind: KickoffRecordKind;
  revision: number;
  payload: unknown;
  /** When the record was stored; null for rows written before recorded times existed. */
  recordedAt: string | null;
}>;

/**
 * Canonical serialization, not raw JSON.stringify. Two records with identical values but
 * different key order are the same record, and re-storing one must be idempotent rather than
 * reported as a conflict. Matches event-store and open-question-store.
 */
export function storeKickoffRecord(
  store: ProjectStore,
  record: Omit<StoredKickoffRecord, "recordedAt">,
  time: RecordTime,
): void {
  const recordedAt = validRecordTime(time);
  const canonicalJson = stableStringify(record.payload);
  const existing = store.database
    .prepare("SELECT canonical_json FROM kickoff_records WHERE record_id=?")
    .get(record.recordId) as { canonical_json: string } | undefined;
  if (existing) {
    if (existing.canonical_json !== canonicalJson) throw new Error("KICKOFF_RECORD_CONFLICT");
    return;
  }
  store.database
    .prepare(
      "INSERT INTO kickoff_records(record_id,kickoff_id,project_id,kind,revision,canonical_json,recorded_at) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      record.recordId,
      record.kickoffId,
      record.projectId,
      record.kind,
      record.revision,
      canonicalJson,
      recordedAt,
    );
}

export function listKickoffRecords(
  store: ProjectStore,
  projectId: string,
  kickoffId: string,
): StoredKickoffRecord[] {
  return (
    store.database
      .prepare(
        "SELECT record_id,kickoff_id,project_id,kind,revision,canonical_json,recorded_at FROM kickoff_records WHERE project_id=? AND kickoff_id=? ORDER BY kind,record_id",
      )
      .all(projectId, kickoffId) as Array<Record<string, unknown>>
  ).map((row) => ({
    recordId: String(row.record_id),
    kickoffId: String(row.kickoff_id),
    projectId: String(row.project_id),
    kind: row.kind as KickoffRecordKind,
    revision: Number(row.revision),
    payload: JSON.parse(String(row.canonical_json)) as unknown,
    recordedAt: row.recorded_at === null ? null : String(row.recorded_at),
  }));
}
