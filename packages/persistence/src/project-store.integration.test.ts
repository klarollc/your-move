import { mkdtempSync, rmSync } from "node:fs";
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
      userVersion: 1,
      migrations: [{ id: "001_initial", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }],
    });
    expect(store.integrity()).toBe("ok");
    store.close();
  });
  it.each(["../outside", "C:\\outside", "/outside"])("rejects escaping path %s", (path) => {
    expect(() => resolveProjectRoomPath(root(), path)).toThrow(
      "CUCKCODE_PATH_OUTSIDE_PROJECT_ROOT",
    );
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
