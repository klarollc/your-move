import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
const APPLICATION_ID = 0x4355434b;
const INITIAL_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS canonical_events(event_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, kind TEXT NOT NULL, canonical_json TEXT NOT NULL, content_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_records(knowledge_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, status TEXT NOT NULL, classification TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, provenance_json TEXT NOT NULL, revision INTEGER NOT NULL, source_hash TEXT, superseded_by TEXT, authorized INTEGER NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(knowledge_id UNINDEXED, project_id UNINDEXED, classification UNINDEXED, title, content);
CREATE TABLE IF NOT EXISTS content_manifests(record_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, relative_path TEXT NOT NULL, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL, content_hash TEXT NOT NULL, classification TEXT NOT NULL, manifest_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS packet_receipts(packet_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, status TEXT NOT NULL, packet_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notebook_entries(entry_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, agent_id TEXT NOT NULL, version INTEGER NOT NULL, enabled INTEGER NOT NULL, content TEXT NOT NULL, classification TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profile_entries(entry_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, version INTEGER NOT NULL, enabled INTEGER NOT NULL, content TEXT NOT NULL, promoted_by TEXT NOT NULL, created_at TEXT NOT NULL);
`;
const RUNTIME_TRUST_SQL = `
CREATE TABLE IF NOT EXISTS agents(agent_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runtime_bindings(binding_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(agent_id), binding_version INTEGER NOT NULL, material_fingerprint TEXT NOT NULL, status TEXT NOT NULL, report_json TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT, UNIQUE(agent_id, binding_version));
CREATE TABLE IF NOT EXISTS provider_identities(provider_kind TEXT NOT NULL, provider_id TEXT NOT NULL, agent_id TEXT NOT NULL REFERENCES agents(agent_id), PRIMARY KEY(provider_kind, provider_id));
CREATE TABLE IF NOT EXISTS admissions(admission_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(agent_id), binding_id TEXT NOT NULL REFERENCES runtime_bindings(binding_id), suite_version TEXT NOT NULL, status TEXT NOT NULL, evidence_hash TEXT NOT NULL, recorded_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runtime_qualifications(qualification_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(agent_id), binding_id TEXT NOT NULL REFERENCES runtime_bindings(binding_id), role_id TEXT NOT NULL, suite_version TEXT NOT NULL, status TEXT NOT NULL, evidence_hash TEXT NOT NULL, recorded_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS qualification_exceptions(exception_id TEXT PRIMARY KEY, qualification_id TEXT NOT NULL REFERENCES runtime_qualifications(qualification_id), check_id TEXT NOT NULL, scope_json TEXT NOT NULL, residual_risk TEXT NOT NULL, compensating_control TEXT NOT NULL, owner_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS trust_revocations(revocation_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(agent_id), binding_id TEXT, qualification_id TEXT, reason TEXT NOT NULL, recorded_at TEXT NOT NULL);
`;
const KICKOFF_SQL = `
CREATE TABLE IF NOT EXISTS kickoff_records(record_id TEXT PRIMARY KEY, kickoff_id TEXT NOT NULL, project_id TEXT NOT NULL, kind TEXT NOT NULL, revision INTEGER NOT NULL, canonical_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS kickoff_records_project_kickoff ON kickoff_records(project_id,kickoff_id,kind,record_id);
`;
const OPEN_QUESTION_SQL = `
CREATE TABLE IF NOT EXISTS open_questions(question_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, subject_kind TEXT NOT NULL, subject_id TEXT NOT NULL, author_kind TEXT NOT NULL, author_id TEXT NOT NULL, blocks_work INTEGER NOT NULL, canonical_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS open_questions_project_subject ON open_questions(project_id,subject_kind,subject_id);
CREATE TABLE IF NOT EXISTS question_dispositions(disposition_id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES open_questions(question_id), project_id TEXT NOT NULL, sequence INTEGER NOT NULL, canonical_json TEXT NOT NULL, UNIQUE(question_id,sequence));
CREATE INDEX IF NOT EXISTS question_dispositions_project_question ON question_dispositions(project_id,question_id,sequence);
`;
// DF-030 (owner ruling 2026-09-28): records written from here on say when they were recorded.
// Nullable, because rows written before this migration have no truthful time to backfill.
const RECORD_TIMES_SQL = `
ALTER TABLE kickoff_records ADD COLUMN recorded_at TEXT;
ALTER TABLE question_dispositions ADD COLUMN recorded_at TEXT;
`;
// DF-030, owner ruling 2026-09-29: a provider identity says when it was bound. Nullable for rows
// bound before this migration.
const PROVIDER_IDENTITY_TIMES_SQL = `
ALTER TABLE provider_identities ADD COLUMN recorded_at TEXT;
`;
const checksum = (text: string) => createHash("sha256").update(text).digest("hex");
function applyMigration(db: Database.Database, id: string, sql: string, appliedAt: string): void {
  if (id === "001_initial") db.exec(sql);
  const expected = checksum(sql);
  const row = db.prepare("SELECT checksum FROM schema_migrations WHERE id=?").get(id) as
    { checksum: string } | undefined;
  if (row && row.checksum !== expected) throw new Error("CUCKCODE_MIGRATION_CHECKSUM_MISMATCH");
  if (row) return;
  if (id !== "001_initial") db.exec(sql);
  db.prepare("INSERT INTO schema_migrations VALUES(?,?,?)").run(id, expected, appliedAt);
}
export function resolveProjectRoomPath(projectRoot: string, relativePath: string): string {
  const root = realpathSync(resolve(projectRoot));
  if (
    isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.split(/[\\/]/).includes("..")
  )
    throw new Error("CUCKCODE_PATH_OUTSIDE_PROJECT_ROOT");
  const candidate = resolve(root, relativePath);
  let existingAncestor = candidate;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  const resolvedCandidate = resolve(
    realpathSync(existingAncestor),
    relative(existingAncestor, candidate),
  );
  const rel = relative(root, resolvedCandidate);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("CUCKCODE_PATH_OUTSIDE_PROJECT_ROOT");
  return resolvedCandidate;
}
export type ProjectStore = {
  database: Database.Database;
  root: string;
  databasePath: string;
  schema(): {
    applicationId: number;
    userVersion: number;
    migrations: { id: string; checksum: string }[];
  };
  integrity(): string;
  hasTable(name: string): boolean;
  close(): void;
};
export function openProjectStore(
  projectRoot: string,
  options: { testMigrationSql?: string } = {},
): ProjectStore {
  const root = realpathSync(resolve(projectRoot));
  const stateDir = resolveProjectRoomPath(root, ".cuckcode/state");
  mkdirSync(stateDir, { recursive: true });
  for (const dir of ["artifacts", "evidence", "traces", "manifests"]) {
    mkdirSync(resolveProjectRoomPath(root, `.cuckcode/${dir}`), { recursive: true });
  }
  const db = new Database(join(stateDir, "cuckcode.sqlite"));
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma(`application_id = ${APPLICATION_ID}`);
    db.transaction(() => {
      applyMigration(db, "001_initial", INITIAL_SQL, "2026-08-13T00:00:00.000Z");
      applyMigration(db, "002_runtime_trust", RUNTIME_TRUST_SQL, "2026-08-13T18:00:00.000Z");
      applyMigration(db, "003_kickoff", KICKOFF_SQL, "2026-08-13T23:00:00.000Z");
      applyMigration(db, "004_open_question", OPEN_QUESTION_SQL, "2026-08-18T20:00:00.000Z");
      applyMigration(db, "005_record_times", RECORD_TIMES_SQL, "2026-09-28T22:00:00.000Z");
      applyMigration(
        db,
        "006_provider_identity_times",
        PROVIDER_IDENTITY_TIMES_SQL,
        "2026-09-29T20:00:00.000Z",
      );
      db.pragma("user_version = 6");
    })();
    if (options.testMigrationSql) db.transaction(() => db.exec(options.testMigrationSql!))();
  } catch (error) {
    db.close();
    throw error;
  }
  return {
    database: db,
    root,
    databasePath: join(stateDir, "cuckcode.sqlite"),
    schema() {
      return {
        applicationId: db.pragma("application_id", { simple: true }) as number,
        userVersion: db.pragma("user_version", { simple: true }) as number,
        migrations: db.prepare("SELECT id, checksum FROM schema_migrations ORDER BY id").all() as {
          id: string;
          checksum: string;
        }[],
      };
    },
    integrity() {
      return db.pragma("integrity_check", { simple: true }) as string;
    },
    hasTable(name: string) {
      return Boolean(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name),
      );
    },
    close() {
      db.close();
    },
  };
}
