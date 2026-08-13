import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProjectStore } from "./project-store.js";
import { rebuildKnowledgeIndex, searchKnowledge, upsertKnowledge } from "./knowledge-store.js";
const roots: string[] = [];
const make = () => {
  const r = mkdtempSync(join(tmpdir(), "cuckcode-knowledge-"));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
const record = (id: string, status = "approved", classification = "team") => ({
  knowledgeId: id,
  projectId: "project_alpha",
  status,
  classification,
  title: `Title ${id}`,
  content: `shared cancellation fact ${id}`,
  provenance: [{ sourceId: "artifact_mdd", version: 1 }],
  revision: 0,
  authorized: true,
});
describe("knowledge store", () => {
  it("filters access and lifecycle before returning FTS results", () => {
    const s = openProjectStore(make());
    upsertKnowledge(s, record("knowledge_public"));
    upsertKnowledge(s, record("knowledge_secret", "approved", "restricted"));
    upsertKnowledge(s, record("knowledge_stale", "stale"));
    expect(
      searchKnowledge(s, {
        projectId: "project_alpha",
        query: "cancellation",
        classifications: ["team"],
      }).map((r) => r.knowledgeId),
    ).toEqual(["knowledge_public"]);
    s.close();
  });
  it("rebuilds byte-equivalent query output", () => {
    const s = openProjectStore(make());
    upsertKnowledge(s, record("knowledge_b"));
    upsertKnowledge(s, record("knowledge_a"));
    const before = JSON.stringify(
      searchKnowledge(s, {
        projectId: "project_alpha",
        query: "cancellation",
        classifications: ["team"],
      }),
    );
    rebuildKnowledgeIndex(s, "project_alpha");
    const after = JSON.stringify(
      searchKnowledge(s, {
        projectId: "project_alpha",
        query: "cancellation",
        classifications: ["team"],
      }),
    );
    expect(after).toBe(before);
    s.close();
  });
});
