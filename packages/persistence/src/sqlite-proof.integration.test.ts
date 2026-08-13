import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runSqliteProof } from "./sqlite-proof.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("Phase 0 SQLite proof", () => {
  it("proves the approved local persistence capabilities", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "cuckcode-sqlite-proof-"));
    temporaryRoots.push(projectRoot);

    const report = await runSqliteProof({ projectRoot });

    expect(report.databasePath.startsWith(projectRoot)).toBe(true);
    expect(report.sqliteVersion).toMatch(/^3\./);
    expect(report.fts5Enabled).toBe(true);
    expect(report.foreignKeysEnabled).toBe(true);
    expect(report.applicationId).toBe(0x4355434b);
    expect(report.userVersion).toBe(1);
    expect(report.transactionRollbackPreserved).toBe(true);
    expect(report.fts5Match).toBe("Shared project knowledge");
    expect(report.integrityCheck).toBe("ok");
    expect(report.backupRowCount).toBe(1);
    expect(report.interruptedWriterExitCode).toBe(91);
    expect(report.interruptedWriteRowCount).toBe(0);
    expect(report.recoveredIntegrityCheck).toBe("ok");
  });

  it("rejects a database path outside the approved project root", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "cuckcode-sqlite-root-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "cuckcode-sqlite-outside-"));
    temporaryRoots.push(projectRoot, outsideRoot);

    await expect(
      runSqliteProof({ projectRoot, databasePath: join(outsideRoot, "escape.sqlite") }),
    ).rejects.toThrowError("CUCKCODE_SQLITE_PATH_OUTSIDE_PROJECT_ROOT");
  });
});
