import type { ProjectStore } from "./project-store.js";

const kinds = [
  "briefing",
  "contribution",
  "synthesis",
  "revision",
  "charter",
  "disposition",
] as const;
type KickoffRecordKind = (typeof kinds)[number];

export type StoredKickoffRecord = Readonly<{
  recordId: string;
  kickoffId: string;
  projectId: string;
  kind: KickoffRecordKind;
  revision: number;
  payload: unknown;
}>;

export function storeKickoffRecord(store: ProjectStore, record: StoredKickoffRecord): void {
  const canonicalJson = JSON.stringify(record.payload);
  const existing = store.database
    .prepare("SELECT canonical_json FROM kickoff_records WHERE record_id=?")
    .get(record.recordId) as { canonical_json: string } | undefined;
  if (existing) {
    if (existing.canonical_json !== canonicalJson) throw new Error("KICKOFF_RECORD_CONFLICT");
    return;
  }
  store.database
    .prepare("INSERT INTO kickoff_records VALUES(?,?,?,?,?,?)")
    .run(
      record.recordId,
      record.kickoffId,
      record.projectId,
      record.kind,
      record.revision,
      canonicalJson,
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
        "SELECT record_id,kickoff_id,project_id,kind,revision,canonical_json FROM kickoff_records WHERE project_id=? AND kickoff_id=? ORDER BY kind,record_id",
      )
      .all(projectId, kickoffId) as Array<Record<string, unknown>>
  ).map((row) => ({
    recordId: String(row.record_id),
    kickoffId: String(row.kickoff_id),
    projectId: String(row.project_id),
    kind: row.kind as KickoffRecordKind,
    revision: Number(row.revision),
    payload: JSON.parse(String(row.canonical_json)) as unknown,
  }));
}
