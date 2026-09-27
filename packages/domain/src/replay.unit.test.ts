import { describe, expect, it } from "vitest";

import { stableStringify } from "./canonical-json.js";
import { replayProject } from "./replay.js";

const event = (
  sequence: number,
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  ...(kind.startsWith("work.") ? { workItemId: "work_notice" } : {}),
  kind,
  occurredAt: `2026-08-13T23:00:${String(sequence).padStart(2, "0")}.000Z`,
  receivedAt: `2026-08-13T23:01:${String(sequence).padStart(2, "0")}.000Z`,
  source: "system",
  trust: "verified",
  payload,
});

const fixture = [
  event(1, "event_01", "project.created", { name: "Alpha" }),
  event(2, "event_02", "work.created", {
    workItemId: "work_notice",
    outcome: "Produce a verified notice",
    requiredEvidenceKinds: [],
  }),
  event(3, "event_03", "work.transitioned", {
    workItemId: "work_notice",
    fromRevision: 0,
    toState: "ready",
  }),
];

describe("replayProject", () => {
  it("produces byte-equivalent snapshots for every permutation of an equivalent log", () => {
    const forward = stableStringify(replayProject(fixture));
    const reverse = stableStringify(replayProject([...fixture].reverse()));
    const rotated = stableStringify(replayProject([fixture[1], fixture[2], fixture[0]]));

    expect(new Set([forward, reverse, rotated]).size).toBe(1);
  });

  it("quarantines conflicting duplicate events so they cannot invent progress", () => {
    const conflicting = {
      ...fixture[2],
      payload: { workItemId: "work_notice", fromRevision: 0, toState: "active" },
    };
    const snapshot = replayProject([...fixture, conflicting]);

    expect(snapshot.work.workItems.work_notice?.state).toBe("draft");
    expect(snapshot.replayIssues[0]?.code).toBe("DUPLICATE_EVENT_CONFLICT");
  });

  it("retains stale revisions as issues without regressing or advancing state", () => {
    const stale = event(4, "event_04", "work.transitioned", {
      workItemId: "work_notice",
      fromRevision: 0,
      toState: "assigned",
    });
    const snapshot = replayProject([...fixture, stale]);

    expect(snapshot.work.workItems.work_notice?.state).toBe("ready");
    expect(snapshot.work.issues[0]?.code).toBe("INVALID_WORK_TRANSITION");
  });

  it("does not mutate caller-owned event arrays or payloads", () => {
    const input = structuredClone(fixture);
    const before = stableStringify(input);

    replayProject(input);

    expect(stableStringify(input)).toBe(before);
  });

  // Phase 7-O Task 9, owner ruling (a): a handoff keeps its direction and work item, so the office
  // can show a cue only for a handoff the log records. Collaborations are unchanged.
  it("keeps a recorded handoff's direction and work item, and adds nothing to collaborations", () => {
    const handoff = {
      handoffId: "handoff_slice",
      participantIds: ["agent_visual", "agent_implementation"],
      fromAgentId: "agent_implementation",
      toAgentId: "agent_visual",
      workItemId: "work_notice",
    };
    const snapshot = replayProject([
      ...fixture,
      event(4, "event_04", "handoff.recorded", handoff),
      event(5, "event_05", "collaboration.recorded", {
        collaborationId: "collaboration_round",
        participantIds: ["agent_visual", "agent_implementation"],
      }),
    ]);
    expect(snapshot.collaborations.handoff_slice).toMatchObject({
      kind: "handoff",
      participantIds: ["agent_implementation", "agent_visual"],
      handoff: {
        fromAgentId: "agent_implementation",
        toAgentId: "agent_visual",
        workItemId: "work_notice",
      },
      updatedByEventId: "event_04",
    });
    expect(snapshot.collaborations.collaboration_round).not.toHaveProperty("handoff");
  });
});
