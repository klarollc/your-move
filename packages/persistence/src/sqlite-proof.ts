import { mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const APPLICATION_ID = 0x4355434b;

type SqliteProofOptions = {
  projectRoot: string;
  databasePath?: string;
};

export type SqliteProofReport = {
  applicationId: number;
  backupRowCount: number;
  databasePath: string;
  foreignKeysEnabled: boolean;
  fts5Enabled: boolean;
  fts5Match: string;
  integrityCheck: string;
  interruptedWriteRowCount: number;
  interruptedWriterExitCode: number | null;
  recoveredIntegrityCheck: string;
  sqliteVersion: string;
  transactionRollbackPreserved: boolean;
  userVersion: number;
};

function assertInsideProjectRoot(projectRoot: string, candidatePath: string): void {
  const pathFromRoot = relative(projectRoot, candidatePath);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    throw new Error("CUCKCODE_SQLITE_PATH_OUTSIDE_PROJECT_ROOT");
  }
}

export async function runSqliteProof({
  projectRoot,
  databasePath,
}: SqliteProofOptions): Promise<SqliteProofReport> {
  const resolvedRoot = resolve(projectRoot);
  const resolvedDatabasePath = resolve(
    databasePath ?? join(resolvedRoot, ".cuckcode-proof", "state", "proof.sqlite"),
  );
  assertInsideProjectRoot(resolvedRoot, resolvedDatabasePath);
  mkdirSync(resolve(resolvedDatabasePath, ".."), { recursive: true });

  const database = new Database(resolvedDatabasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma(`application_id = ${APPLICATION_ID}`);
  database.pragma("user_version = 1");
  database.exec(`
    CREATE TABLE knowledge_records (
      id INTEGER PRIMARY KEY,
      content TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE knowledge_search USING fts5(content);
    CREATE TABLE transaction_probe (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE interrupted_write_probe (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    database.transaction(() => {
      database.prepare("INSERT INTO transaction_probe(value) VALUES (?)").run("rolled back");
      throw new Error("CUCKCODE_EXPECTED_ROLLBACK");
    })();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "CUCKCODE_EXPECTED_ROLLBACK") throw error;
  }

  database
    .prepare("INSERT INTO knowledge_records(content) VALUES (?)")
    .run("Shared project knowledge");
  database
    .prepare("INSERT INTO knowledge_search(content) VALUES (?)")
    .run("Shared project knowledge");

  const backupPath = join(resolvedRoot, ".cuckcode-proof", "backup.sqlite");
  await database.backup(backupPath);

  const sqliteVersion = database.prepare("SELECT sqlite_version() AS version").get() as {
    version: string;
  };
  const fts5Enabled = database
    .prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled")
    .get() as { enabled: number };
  const fts5Match = database
    .prepare("SELECT content FROM knowledge_search WHERE knowledge_search MATCH 'project'")
    .get() as { content: string };
  const rollbackCount = database
    .prepare("SELECT count(*) AS count FROM transaction_probe")
    .get() as {
    count: number;
  };
  const integrity = database.pragma("integrity_check", { simple: true }) as string;
  const foreignKeys = database.pragma("foreign_keys", { simple: true }) as number;
  const applicationId = database.pragma("application_id", { simple: true }) as number;
  const userVersion = database.pragma("user_version", { simple: true }) as number;
  database.close();

  const backup = new Database(backupPath, { readonly: true });
  const backupCount = backup.prepare("SELECT count(*) AS count FROM knowledge_records").get() as {
    count: number;
  };
  backup.close();

  const crashWriterPath = fileURLToPath(
    new URL("../../../scripts/sqlite-crash-writer.mjs", import.meta.url),
  );
  const interruptedWriter = spawnSync(process.execPath, [crashWriterPath, resolvedDatabasePath], {
    cwd: resolvedRoot,
    encoding: "utf8",
    windowsHide: true,
  });

  const recovered = new Database(resolvedDatabasePath);
  const interruptedCount = recovered
    .prepare("SELECT count(*) AS count FROM interrupted_write_probe")
    .get() as { count: number };
  const recoveredIntegrity = recovered.pragma("integrity_check", { simple: true }) as string;
  recovered.close();

  return {
    applicationId,
    backupRowCount: backupCount.count,
    databasePath: resolvedDatabasePath,
    foreignKeysEnabled: foreignKeys === 1,
    fts5Enabled: fts5Enabled.enabled === 1,
    fts5Match: fts5Match.content,
    integrityCheck: integrity,
    interruptedWriteRowCount: interruptedCount.count,
    interruptedWriterExitCode: interruptedWriter.status,
    recoveredIntegrityCheck: recoveredIntegrity,
    sqliteVersion: sqliteVersion.version,
    transactionRollbackPreserved: rollbackCount.count === 0,
    userVersion,
  };
}
