import { describe, expect, it } from "vitest";

import { determineInitialKnowledgeStatus, knowledgeLifecycleStatuses } from "./knowledge.js";

describe("knowledge contracts", () => {
  it("defines every inspectable lifecycle status", () => {
    expect(knowledgeLifecycleStatuses).toEqual([
      "provisional",
      "authoritative",
      "contested",
      "rejected",
      "stale",
      "superseded",
    ]);
  });

  it("prevents agent-authored findings from self-promoting", () => {
    expect(determineInitialKnowledgeStatus("adapter", "authoritative")).toEqual({
      status: "provisional",
      issue: "AGENT_FINDING_REQUIRES_PROMOTION",
    });
    expect(determineInitialKnowledgeStatus("manager", "authoritative")).toEqual({
      status: "authoritative",
    });
  });
});
