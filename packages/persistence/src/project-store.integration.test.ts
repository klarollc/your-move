import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProjectStore, resolveProjectRoomPath } from "./project-store.js";
const roots: string[] = [];
const root = () => {
  const value = mkdtempSync(join(tmpdir(), "cuckcode-p2-"));
  roots.push(value);
  return value;
};
afterEach(() => {
  for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});
describe("project store migrations", () => {
  it("creates the canonical project room and deterministic schema", () => {
    const store = openProjectStore(root());
    expect(store.schema()).toMatchObject({
      applicationId: 1129661259,
      userVersion: 2,
      migrations: [
        { id: "001_initial", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { id: "002_runtime_trust", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      ],
    });
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
