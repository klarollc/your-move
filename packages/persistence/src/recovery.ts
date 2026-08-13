import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { readContent, type ContentManifest } from "./content-store.js";
import type { ProjectStore } from "./project-store.js";

export type IntegrityReceipt = {
  databaseIntegrity: "ok";
  checkedContent: number;
  contentDigest: string;
};
export type RecoveryReceipt = IntegrityReceipt & {
  mode: "backup" | "export";
  databasePath: string;
  databaseHash: string;
  contentFiles: number;
  manifestPath: string;
};

type ManifestRow = { manifest_json: string };
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const contentDigest = (hashes: string[]) => {
  if (hashes.length === 1) return hashes[0]!;
  return sha256(hashes.join("\n"));
};
const manifestRows = (store: ProjectStore) =>
  store.database
    .prepare("SELECT manifest_json FROM content_manifests ORDER BY relative_path, record_id")
    .all() as ManifestRow[];

export function verifyProjectIntegrity(store: ProjectStore): IntegrityReceipt {
  const databaseIntegrity = store.integrity();
  if (databaseIntegrity !== "ok")
    throw new Error(`CUCKCODE_DATABASE_INTEGRITY:${databaseIntegrity}`);
  const manifests = manifestRows(store).map(
    (row) => JSON.parse(row.manifest_json) as ContentManifest,
  );
  const hashes = manifests.map((manifest) => {
    const verified = readContent(store, manifest.recordId).manifest;
    if (verified.relativePath !== manifest.relativePath)
      throw new Error("CUCKCODE_MANIFEST_PATH_MISMATCH");
    return verified.contentHash;
  });
  return {
    databaseIntegrity: "ok",
    checkedContent: hashes.length,
    contentDigest: contentDigest(hashes),
  };
}

function snapshot(
  store: ProjectStore,
  destination: string,
  mode: "backup" | "export",
): RecoveryReceipt {
  if (existsSync(destination)) throw new Error("CUCKCODE_RECOVERY_DESTINATION_EXISTS");
  const integrity = verifyProjectIntegrity(store);
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const temporary = mkdtempSync(join(parent, ".cuckcode-snapshot-"));
  try {
    const databaseRelativePath = ".cuckcode/state/cuckcode.sqlite";
    const databasePath = join(temporary, databaseRelativePath);
    mkdirSync(dirname(databasePath), { recursive: true });
    const escapedDatabasePath = databasePath.replaceAll("'", "''");
    store.database.exec(`VACUUM INTO '${escapedDatabasePath}'`);
    const content = manifestRows(store)
      .map((row) => JSON.parse(row.manifest_json) as ContentManifest)
      .map((manifest) => {
        const verified = readContent(store, manifest.recordId);
        const target = join(temporary, manifest.relativePath);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(store.root, manifest.relativePath), target);
        return {
          relativePath: manifest.relativePath,
          contentHash: verified.manifest.contentHash,
        };
      });
    const snapshotManifest = {
      formatVersion: 1,
      mode,
      database: {
        relativePath: databaseRelativePath,
        contentHash: sha256(readFileSync(databasePath)),
      },
      content,
      schema: store.schema(),
      integrity,
    };
    const manifestRelativePath = `.cuckcode/manifests/${mode}.json`;
    const temporaryManifestPath = join(temporary, manifestRelativePath);
    mkdirSync(dirname(temporaryManifestPath), { recursive: true });
    writeFileSync(temporaryManifestPath, `${JSON.stringify(snapshotManifest, null, 2)}\n`, {
      flag: "wx",
    });
    renameSync(temporary, destination);
    return {
      ...integrity,
      mode,
      databasePath: join(destination, databaseRelativePath),
      databaseHash: snapshotManifest.database.contentHash,
      contentFiles: content.length,
      manifestPath: join(destination, manifestRelativePath),
    };
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

export function createProjectBackup(store: ProjectStore, destination: string): RecoveryReceipt {
  return snapshot(store, destination, "backup");
}
export function exportProject(store: ProjectStore, destination: string): RecoveryReceipt {
  return snapshot(store, destination, "export");
}
