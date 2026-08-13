import { describe, expect, it } from "vitest";
import {
  determineInitialKnowledgeStatus,
  knowledgeLifecycleStatuses,
  parsePersistenceRecord,
} from "./index.js";

describe("Phase 2 persistence contracts", () => {
  it("includes approved as a manager-controlled state distinct from authoritative", () => {
    expect(knowledgeLifecycleStatuses).toContain("approved");
    expect(determineInitialKnowledgeStatus("adapter", "approved")).toEqual({
      status: "provisional",
      issue: "AGENT_FINDING_REQUIRES_PROMOTION",
    });
    expect(determineInitialKnowledgeStatus("manager", "approved")).toEqual({ status: "approved" });
  });

  it.each(["../escape.txt", "C:\\escape.txt", "/escape.txt"])(
    "rejects unsafe relative path %s",
    (relativePath) => {
      expect(
        parsePersistenceRecord({
          schemaVersion: 1,
          recordType: "artifact",
          recordId: "artifact_1",
          projectId: "project_1",
          relativePath,
          contentHash: "a".repeat(64),
          provenance: [{ sourceId: "artifact_source", version: 1 }],
        }),
      ).toMatchObject({ ok: false, error: { code: "INVALID_PERSISTENCE_RECORD" } });
    },
  );

  it("rejects hidden reasoning and missing provenance", () => {
    expect(
      parsePersistenceRecord({
        schemaVersion: 1,
        recordType: "hidden-reasoning",
        recordId: "artifact_1",
        projectId: "project_1",
        relativePath: "artifacts/a.txt",
        contentHash: "a".repeat(64),
        provenance: [],
      }),
    ).toMatchObject({ ok: false });
  });
});
