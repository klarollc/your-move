import type { ProjectStore } from "./project-store.js";
export type StoredKnowledge = {
  knowledgeId: string;
  projectId: string;
  status: string;
  classification: string;
  title: string;
  content: string;
  provenance: { sourceId: string; version: number }[];
  revision: number;
  authorized: boolean;
  sourceHash?: string;
  supersededBy?: string;
};
export function upsertKnowledge(store: ProjectStore, record: StoredKnowledge): void {
  store.database.transaction(() => {
    store.database
      .prepare(
        `INSERT INTO knowledge_records(knowledge_id,project_id,status,classification,title,content,provenance_json,revision,source_hash,superseded_by,authorized) VALUES(@knowledgeId,@projectId,@status,@classification,@title,@content,@provenanceJson,@revision,@sourceHash,@supersededBy,@authorized) ON CONFLICT(knowledge_id) DO UPDATE SET status=excluded.status,classification=excluded.classification,title=excluded.title,content=excluded.content,provenance_json=excluded.provenance_json,revision=excluded.revision,source_hash=excluded.source_hash,superseded_by=excluded.superseded_by,authorized=excluded.authorized`,
      )
      .run({
        ...record,
        provenanceJson: JSON.stringify(record.provenance),
        sourceHash: record.sourceHash ?? null,
        supersededBy: record.supersededBy ?? null,
        authorized: record.authorized ? 1 : 0,
      });
    rebuildKnowledgeIndex(store, record.projectId);
  })();
}
export function rebuildKnowledgeIndex(store: ProjectStore, projectId: string): void {
  store.database.prepare("DELETE FROM knowledge_fts WHERE project_id=?").run(projectId);
  store.database
    .prepare(
      `INSERT INTO knowledge_fts(knowledge_id,project_id,classification,title,content) SELECT knowledge_id,project_id,classification,title,content FROM knowledge_records WHERE project_id=?`,
    )
    .run(projectId);
}
export function searchKnowledge(
  store: ProjectStore,
  input: { projectId: string; query: string; classifications: string[] },
): StoredKnowledge[] {
  if (input.classifications.length === 0) return [];
  const placeholders = input.classifications.map(() => "?").join(",");
  const rows = store.database
    .prepare(
      `SELECT k.* FROM knowledge_fts f JOIN knowledge_records k ON k.knowledge_id=f.knowledge_id WHERE f.project_id=? AND f.classification IN (${placeholders}) AND k.authorized=1 AND k.status IN ('authoritative','approved','provisional','contested') AND k.status NOT IN ('stale','rejected','superseded') AND knowledge_fts MATCH ? ORDER BY k.knowledge_id`,
    )
    .all(input.projectId, ...input.classifications, input.query) as Record<string, unknown>[];
  return rows.map((row) => ({
    knowledgeId: String(row.knowledge_id),
    projectId: String(row.project_id),
    status: String(row.status),
    classification: String(row.classification),
    title: String(row.title),
    content: String(row.content),
    provenance: JSON.parse(String(row.provenance_json)) as { sourceId: string; version: number }[],
    revision: Number(row.revision),
    authorized: Boolean(row.authorized),
    ...(row.source_hash ? { sourceHash: String(row.source_hash) } : {}),
    ...(row.superseded_by ? { supersededBy: String(row.superseded_by) } : {}),
  }));
}
