import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storeContent } from "./content-store.js";
import { openProjectStore } from "./project-store.js";
import { createProjectBackup, exportProject, verifyProjectIntegrity } from "./recovery.js";

const roots: string[] = [];
const make = (label: string) => {
  const root = mkdtempSync(join(tmpdir(), `cuckcode-${label}-`));
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("project recovery", () => {
  it("creates no-overwrite backups and restores equivalent database and content", () => {
    const source = openProjectStore(make("recovery-source"));
    source.database
      .prepare("INSERT INTO canonical_events VALUES(?,?,?,?,?,?,?)")
      .run(
        "event_1",
        "project_alpha",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T00:00:01.000Z",
        "task.created",
        '{"eventId":"event_1"}',
        "event-hash",
      );
    const manifest = storeContent(source, {
      recordId: "artifact_1",
      projectId: "project_alpha",
      kind: "artifact",
      mediaType: "text/plain",
      classification: "project",
      bytes: Buffer.from("recoverable artifact"),
    });
    const backupRoot = join(make("recovery-target"), "backup");
    const receipt = createProjectBackup(source, backupRoot);
    expect(receipt.databaseIntegrity).toBe("ok");
    expect(receipt.contentFiles).toBe(1);
    expect(existsSync(receipt.manifestPath)).toBe(true);
    expect(() => createProjectBackup(source, backupRoot)).toThrow(
      "CUCKCODE_RECOVERY_DESTINATION_EXISTS",
    );
    source.close();

    const restored = openProjectStore(backupRoot);
    expect(restored.integrity()).toBe("ok");
    expect(
      restored.database.prepare("SELECT event_id FROM canonical_events").pluck().all(),
    ).toEqual(["event_1"]);
    expect(readFileSync(join(backupRoot, manifest.relativePath), "utf8")).toBe(
      "recoverable artifact",
    );
    expect(verifyProjectIntegrity(restored)).toMatchObject({
      databaseIntegrity: "ok",
      checkedContent: 1,
      contentDigest: manifest.contentHash,
    });
    restored.close();
  });

  it("exports a deterministic manifest and reports content corruption", () => {
    const source = openProjectStore(make("export-source"));
    const manifest = storeContent(source, {
      recordId: "evidence_1",
      projectId: "project_alpha",
      kind: "evidence",
      mediaType: "text/plain",
      classification: "project",
      bytes: Buffer.from("verified evidence"),
    });
    const exportRoot = join(make("export-target"), "export");
    const receipt = exportProject(source, exportRoot);
    const exportManifest = JSON.parse(readFileSync(receipt.manifestPath, "utf8")) as {
      formatVersion: number;
      content: { relativePath: string; contentHash: string }[];
    };
    expect(exportManifest.formatVersion).toBe(1);
    expect(exportManifest.content).toEqual([
      { relativePath: manifest.relativePath, contentHash: manifest.contentHash },
    ]);
    writeFileSync(join(source.root, manifest.relativePath), "corrupt");
    expect(() => verifyProjectIntegrity(source)).toThrow("CUCKCODE_CONTENT_HASH_MISMATCH");
    source.close();
  });
});
