import { describe, expect, it } from "vitest";

import type { CanonicalProjectSnapshot } from "./replay.js";
import { projectOfficeScene } from "./office-scene.js";

const base = (): CanonicalProjectSnapshot => ({
  schemaVersion: 1,
  project: { projectId: "project_alpha", name: "Alpha" },
  eventIds: [],
  work: { workItems: {}, evidence: {}, approvals: {}, issues: [] },
  staffing: { agents: {}, assignments: {}, qualifications: {}, issues: [] },
  knowledge: { records: {}, issues: [] },
  collaborations: {},
  replayIssues: [],
});

describe("projectOfficeScene", () => {
  it.each([
    ["active", "work_loop"],
    ["waiting_input", "attention_request"],
    ["blocked", "blocked_stationary"],
    ["review_requested", "review_station"],
    ["completed", "delivery_area"],
  ] as const)("maps %s work truth to %s without implying approval", (state, behavior) => {
    const snapshot = base();
    snapshot.work.workItems.work_notice = {
      workItemId: "work_notice",
      outcome: "Produce notice",
      state,
      revision: 1,
      requiredEvidenceKinds: [],
      updatedByEventId: "event_work",
      updatedAt: "2026-08-13T23:00:00.000Z",
      assignment: null,
      condition: null,
    };

    const descriptor = projectOfficeScene(snapshot, "2026-08-13T23:00:30.000Z")[0];
    expect(descriptor).toMatchObject({
      subjectId: "work_notice",
      state,
      behavior,
      causeEventId: "event_work",
      freshness: "current",
      approved: false,
    });
  });

  it("never emits active motion for non-active canonical state", () => {
    const snapshot = base();
    snapshot.work.workItems.work_notice = {
      workItemId: "work_notice",
      outcome: "Produce notice",
      state: "ready",
      revision: 1,
      requiredEvidenceKinds: [],
      updatedByEventId: "event_work",
      updatedAt: "2026-08-13T23:00:00.000Z",
      assignment: null,
      condition: null,
    };

    expect(projectOfficeScene(snapshot, "2026-08-13T23:00:30.000Z")[0]?.semanticMotion).toBe(false);
  });

  it("projects disconnected agents as unavailable, never idle or active", () => {
    const snapshot = base();
    snapshot.staffing.agents.agent_1 = {
      agentId: "agent_1",
      capabilities: [],
      health: "disconnected",
      presence: "unavailable",
    };

    expect(projectOfficeScene(snapshot, "2026-08-13T23:00:30.000Z")).toContainEqual(
      expect.objectContaining({
        subjectId: "agent_1",
        state: "unavailable",
        behavior: "offline",
        freshness: "unavailable",
      }),
    );
  });

  it("projects only active collaboration and handoff truth into shared zones", () => {
    const snapshot = base();
    snapshot.collaborations.collaboration_1 = {
      collaborationId: "collaboration_1",
      kind: "collaboration",
      participantIds: ["agent_1", "agent_2"],
      active: false,
      updatedByEventId: "event_closed",
      updatedAt: "2026-08-13T23:00:00.000Z",
    };
    snapshot.collaborations.collaboration_2 = {
      collaborationId: "collaboration_2",
      kind: "handoff",
      participantIds: ["agent_2", "agent_3"],
      active: true,
      updatedByEventId: "event_handoff",
      updatedAt: "2026-08-13T23:00:10.000Z",
    };

    const collaborations = projectOfficeScene(snapshot, "2026-08-13T23:00:30.000Z").filter(
      ({ subjectType }) => subjectType === "collaboration",
    );
    expect(collaborations).toHaveLength(1);
    expect(collaborations[0]).toMatchObject({
      subjectId: "collaboration_2",
      behavior: "handoff_transition",
      zone: "shared",
      causeEventId: "event_handoff",
    });
  });
});
