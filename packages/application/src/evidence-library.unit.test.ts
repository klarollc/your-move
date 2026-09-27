import { describe, expect, it } from "vitest";

import { projectBrowserLibrary } from "./evidence-library.js";

describe("projectBrowserLibrary", () => {
  it("keeps every knowledge lifecycle distinct and deterministic", () => {
    const statuses = [
      "authoritative",
      "approved",
      "provisional",
      "contested",
      "stale",
      "superseded",
      "rejected",
    ] as const;
    const result = projectBrowserLibrary({
      knowledge: statuses.toReversed().map((status) => ({
        knowledgeId: `knowledge_${status}`,
        status,
        title: `${status} record`,
        snippet: `${status} context`,
        revision: 3,
        originatingEntityId: "zone_library",
        authorized: true,
      })),
      evidence: [],
    });

    expect(result.knowledge.map(({ status }) => status)).toEqual(statuses);
    expect(new Set(result.knowledge.map(({ status }) => status))).toHaveLength(7);
  });

  it("never projects unauthorized titles/snippets, hidden reasoning, or secrets", () => {
    const result = projectBrowserLibrary({
      knowledge: [
        {
          knowledgeId: "knowledge_restricted",
          status: "approved",
          title: "Unauthorized roadmap title",
          snippet: "Unauthorized roadmap snippet",
          hiddenReasoning: "private chain of thought",
          revision: 1,
          originatingEntityId: "zone_library",
          authorized: false,
        },
        {
          knowledgeId: "knowledge_secret",
          status: "contested",
          title: "Token sk-not-for-browser",
          snippet: "authorization: bearer private",
          hiddenReasoning: "another private trace",
          revision: 2,
          originatingEntityId: "zone_library",
          authorized: true,
        },
      ],
      evidence: [],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Unauthorized roadmap");
    expect(serialized).not.toContain("chain of thought");
    expect(serialized).not.toContain("sk-not-for-browser");
    expect(serialized).not.toContain("bearer private");
    expect(result.knowledge).toEqual([
      {
        knowledgeId: "knowledge_secret",
        status: "contested",
        title: "Restricted record",
        snippet: "Sensitive content withheld from this browser session.",
        revision: 2,
        originatingEntityId: "zone_library",
      },
    ]);
  });

  it("separates test, visual, and release evidence while keeping complete distinct from approved", () => {
    const result = projectBrowserLibrary({
      knowledge: [],
      evidence: [
        {
          evidenceId: "evidence_release",
          kind: "release",
          status: "pending",
          summary: "Release review has not started.",
          version: 1,
          revision: 42,
          originatingEntityId: "zone_delivery",
          authorized: true,
        },
        {
          evidenceId: "evidence_visual",
          kind: "visual",
          status: "approved",
          summary: "Graybox composition accepted for this gate.",
          version: 1,
          revision: 42,
          originatingEntityId: "zone_review",
          authorized: true,
        },
        {
          evidenceId: "evidence_test",
          kind: "test",
          status: "complete",
          summary: "Automated checks completed; manager approval remains separate.",
          version: 1,
          revision: 42,
          originatingEntityId: "agent_test_engineer",
          authorized: true,
        },
      ],
    });

    expect(result.evidence.map(({ kind }) => kind)).toEqual(["test", "visual", "release"]);
    expect(result.evidence[0]).toMatchObject({ status: "complete", approved: false });
    expect(result.evidence[1]).toMatchObject({ status: "approved", approved: true });
    expect(result.evidence.every(({ originatingEntityId }) => Boolean(originatingEntityId))).toBe(
      true,
    );
  });
});
