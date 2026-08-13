import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { ProjectStore } from "./project-store.js";
export type ContentManifest = {
  recordId: string;
  projectId: string;
  kind: "artifact" | "evidence";
  relativePath: string;
  mediaType: string;
  byteSize: number;
  contentHash: string;
  classification: string;
};
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
export function storeContent(
  store: ProjectStore,
  input: {
    recordId: string;
    projectId: string;
    kind: "artifact" | "evidence";
    mediaType: string;
    classification: string;
    bytes: Buffer;
  },
): ContentManifest {
  const contentHash = hash(input.bytes);
  const relativePath = `.cuckcode/${input.kind}s/${contentHash.slice(0, 2)}/${contentHash}`;
  const absolute = join(store.root, relativePath);
  const existing = store.database
    .prepare("SELECT manifest_json FROM content_manifests WHERE record_id=?")
    .get(input.recordId) as { manifest_json: string } | undefined;
  if (existing) {
    const manifest = JSON.parse(existing.manifest_json) as ContentManifest;
    if (manifest.contentHash !== contentHash) throw new Error("CUCKCODE_MANIFEST_COLLISION");
    return manifest;
  }
  mkdirSync(dirname(absolute), { recursive: true });
  if (!existsSync(absolute)) {
    const temporary = `${absolute}.tmp-${input.recordId}`;
    try {
      writeFileSync(temporary, input.bytes, { flag: "wx" });
      renameSync(temporary, absolute);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  const manifest = {
    recordId: input.recordId,
    projectId: input.projectId,
    kind: input.kind,
    relativePath,
    mediaType: input.mediaType,
    byteSize: input.bytes.byteLength,
    contentHash,
    classification: input.classification,
  };
  store.database
    .prepare("INSERT INTO content_manifests VALUES(?,?,?,?,?,?,?,?,?)")
    .run(
      input.recordId,
      input.projectId,
      input.kind,
      relativePath,
      input.mediaType,
      input.bytes.byteLength,
      contentHash,
      input.classification,
      JSON.stringify(manifest),
    );
  return manifest;
}
export function readContent(
  store: ProjectStore,
  recordId: string,
): { manifest: ContentManifest; bytes: Buffer } {
  const row = store.database
    .prepare("SELECT manifest_json FROM content_manifests WHERE record_id=?")
    .get(recordId) as { manifest_json: string } | undefined;
  if (!row) throw new Error("CUCKCODE_MANIFEST_MISSING");
  const manifest = JSON.parse(row.manifest_json) as ContentManifest;
  const path = join(store.root, manifest.relativePath);
  if (!existsSync(path)) throw new Error("CUCKCODE_CONTENT_MISSING");
  const bytes = readFileSync(path);
  if (hash(bytes) !== manifest.contentHash || bytes.byteLength !== manifest.byteSize)
    throw new Error("CUCKCODE_CONTENT_HASH_MISMATCH");
  return { manifest, bytes };
}
