import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProjectStore, resolveProjectRoomPath } from "./project-store.js";
const roots: string[] = [];
const openStores: { close(): void }[] = [];
const root = () => {
  const value = mkdtempSync(join(tmpdir(), "cuckcode-p2-"));
  roots.push(value);
  return value;
};
// Close every store before removing its directory. An assertion that throws before an inline
// close() would otherwise leave SQLite holding the file, and Windows reports the leak as an
// EPERM in cleanup instead of the assertion that actually failed.
afterEach(() => {
  for (const store of openStores.splice(0)) {
    try {
      store.close();
    } catch {
      // Already closed by the test body.
    }
  }
  for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});
describe("project store migrations", () => {
  it("creates the canonical project room and deterministic schema", () => {
    const store = openProjectStore(root());
    openStores.push(store);
    const schema = store.schema();
    // The enumeration is deliberate. Adding a migration must be a conscious update to this list,
    // so unintended schema drift fails here.
    expect(schema).toMatchObject({
      applicationId: 1129661259,
      userVersion: 6,
      migrations: [
        { id: "001_initial", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { id: "002_runtime_trust", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { id: "003_kickoff", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { id: "004_open_question", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
        // DF-030 (P-4): recorded times for kickoff records and question dispositions.
        { id: "005_record_times", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
        // DF-030 (P-4): provider identities record when they were bound.
        {
          id: "006_provider_identity_times",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
    });
    // Structural invariant: the pragma and the applied migration list cannot drift apart, even
    // if a future migration is added without updating the enumeration above.
    expect(schema.userVersion).toBe(schema.migrations.length);
    expect(store.integrity()).toBe("ok");
    store.close();
  });
  it.each(["../outside", "C:\\outside", "/outside"])("rejects escaping path %s", (path) => {
    expect(() => resolveProjectRoomPath(root(), path)).toThrow(
      "CUCKCODE_PATH_OUTSIDE_PROJECT_ROOT",
    );
  });
  it("rejects an existing junction that resolves outside the project root", () => {
    const projectRoot = root();
    const outsideRoot = root();
    symlinkSync(outsideRoot, join(projectRoot, "escape"), "junction");
    expect(() => resolveProjectRoomPath(projectRoot, "escape/secret.txt")).toThrow(
      "CUCKCODE_PATH_OUTSIDE_PROJECT_ROOT",
    );
  });
  it("rejects a changed historical migration checksum and releases the database", () => {
    const projectRoot = root();
    const store = openProjectStore(projectRoot);
    const databasePath = store.databasePath;
    store.close();
    const database = new Database(databasePath);
    database
      .prepare("UPDATE schema_migrations SET checksum='changed' WHERE id='001_initial'")
      .run();
    database.close();
    expect(() => openProjectStore(projectRoot)).toThrow("CUCKCODE_MIGRATION_CHECKSUM_MISMATCH");
    expect(() => rmSync(projectRoot, { recursive: true, force: true })).not.toThrow();
    roots.splice(roots.indexOf(projectRoot), 1);
  });
  it("rolls back a failed migration", () => {
    const projectRoot = root();
    expect(() =>
      openProjectStore(projectRoot, { testMigrationSql: "CREATE TABLE doomed(id); INVALID SQL" }),
    ).toThrow();
    const store = openProjectStore(projectRoot);
    expect(store.hasTable("doomed")).toBe(false);
    store.close();
  });
});
