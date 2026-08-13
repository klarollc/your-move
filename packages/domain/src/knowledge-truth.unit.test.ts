import { describe, expect, it } from "vitest";

import { reduceKnowledgeTruth, selectCurrentKnowledge } from "./knowledge-truth.js";

const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  source: "manager" | "adapter" | "system" = "adapter",
) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  kind,
  occurredAt: `2026-08-13T22:00:${eventId.slice(-2)}.000Z`,
  receivedAt: `2026-08-13T22:01:${eventId.slice(-2)}.000Z`,
  source,
  trust: "verified",
  payload,
});

const finding = event("event_01", "knowledge.recorded", {
  knowledgeId: "knowledge_api",
  statement: "The adapter preserves cancellation correlation.",
  provenance: { sourceId: "artifact_adapter-test", sourceVersion: 4 },
  requestedStatus: "authoritative",
  authorized: true,
});

describe("knowledge truth", () => {
  it("retains an agent finding as provisional until an explicit manager promotion", () => {
    const provisional = reduceKnowledgeTruth([finding]);
    expect(provisional.records.knowledge_api?.status).toBe("provisional");
    expect(selectCurrentKnowledge(provisional)).toEqual([]);
    expect(provisional.issues[0]?.code).toBe("AGENT_FINDING_REQUIRES_PROMOTION");

    const promoted = reduceKnowledgeTruth([
      finding,
      event(
        "event_02",
        "knowledge.status_changed",
        { knowledgeId: "knowledge_api", toStatus: "authoritative", fromRevision: 0 },
        "manager",
      ),
    ]);
    expect(selectCurrentKnowledge(promoted).map(({ knowledgeId }) => knowledgeId)).toEqual([
      "knowledge_api",
    ]);
  });

  it("keeps stale, rejected, and superseded records inspectable but not current", () => {
    const lifecycle = ["stale", "rejected", "superseded"] as const;
    for (const toStatus of lifecycle) {
      const state = reduceKnowledgeTruth([
        event(
          "event_01",
          "knowledge.recorded",
          {
            knowledgeId: "knowledge_policy",
            statement: "External effects are denied by default.",
            provenance: { sourceId: "artifact_mdd", sourceVersion: 1 },
            requestedStatus: "authoritative",
            authorized: true,
          },
          "manager",
        ),
        event(
          "event_02",
          "knowledge.status_changed",
          {
            knowledgeId: "knowledge_policy",
            toStatus,
            fromRevision: 0,
            ...(toStatus === "superseded" ? { supersededBy: "knowledge_policy_v2" } : {}),
          },
          toStatus === "stale" ? "system" : "manager",
        ),
      ]);

      expect(state.records.knowledge_policy?.status).toBe(toStatus);
      expect(selectCurrentKnowledge(state)).toEqual([]);
    }
  });

  it("never exposes unauthorized records as current knowledge", () => {
    const state = reduceKnowledgeTruth([
      event(
        "event_01",
        "knowledge.recorded",
        {
          knowledgeId: "knowledge_private",
          statement: "Private project detail.",
          provenance: { sourceId: "artifact_private", sourceVersion: 1 },
          requestedStatus: "authoritative",
          authorized: false,
        },
        "manager",
      ),
    ]);

    expect(state.records.knowledge_private?.authorized).toBe(false);
    expect(selectCurrentKnowledge(state)).toEqual([]);
  });
});
