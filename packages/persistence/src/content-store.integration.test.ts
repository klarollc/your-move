import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProjectStore } from "./project-store.js";
import { readContent, storeContent } from "./content-store.js";
const roots: string[] = [];
const make = () => {
  const r = mkdtempSync(join(tmpdir(), "cuckcode-content-"));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
describe("content store", () => {
  it("stores verified content and deduplicates identical bytes", () => {
    const s = openProjectStore(make());
    const input = {
      recordId: "artifact_1",
      projectId: "project_alpha",
      kind: "artifact" as const,
      mediaType: "text/plain",
      classification: "project",
      bytes: Buffer.from("hello"),
    };
    const a = storeContent(s, input);
    const b = storeContent(s, { ...input, recordId: "artifact_2" });
    expect(a.contentHash).toBe(b.contentHash);
    expect(readContent(s, "artifact_1").bytes.toString()).toBe("hello");
    s.close();
  });
  it("detects content tampering", () => {
    const s = openProjectStore(make());
    const manifest = storeContent(s, {
      recordId: "evidence_1",
      projectId: "project_alpha",
      kind: "evidence",
      mediaType: "text/plain",
      classification: "project",
      bytes: Buffer.from("proof"),
    });
    writeFileSync(join(s.root, manifest.relativePath), "tampered");
    expect(() => readContent(s, "evidence_1")).toThrow("CUCKCODE_CONTENT_HASH_MISMATCH");
    s.close();
  });
  it("does not overwrite a stable ID with different content", () => {
    const s = openProjectStore(make());
    storeContent(s, {
      recordId: "artifact_1",
      projectId: "project_alpha",
      kind: "artifact",
      mediaType: "text/plain",
      classification: "project",
      bytes: Buffer.from("one"),
    });
    expect(() =>
      storeContent(s, {
        recordId: "artifact_1",
        projectId: "project_alpha",
        kind: "artifact",
        mediaType: "text/plain",
        classification: "project",
        bytes: Buffer.from("two"),
      }),
    ).toThrow("CUCKCODE_MANIFEST_COLLISION");
    s.close();
  });
});
