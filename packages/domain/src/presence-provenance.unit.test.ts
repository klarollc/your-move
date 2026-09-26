import { describe, expect, it } from "vitest";

import { projectManagerAttention } from "./attention.js";
import { projectOfficeScene } from "./office-scene.js";
import { replayProject } from "./replay.js";
import { reduceStaffingTruth } from "./staffing-truth.js";

/** Phase 7-O Task 3: presence provenance, freshness, and attention carrying the decision detail. */
let clock = 0;
const event = (eventId: string, kind: string, payload: Record<string, unknown>, at?: string) => {
  clock += 1;
  const time = at ?? new Date(Date.parse("2026-09-25T20:00:00.000Z") + clock * 1000).toISOString();
  return {
    schemaVersion: 1,
    eventId,
    projectId: "project_alpha",
    kind,
    occurredAt: time,
    receivedAt: time,
    source: "system",
    trust: "verified",
    payload,
  };
};
const registered = (at?: string) =>
  event(
    "event_registered",
    "agent.registered",
    { agentId: "agent_test", capabilities: ["test-engineer"], health: "connected" },
    at,
  );
const assigned = () =>
  event("event_role", "role.assigned", {
    roleAssignmentId: "role-assignment_test",
    roleId: "test-engineer",
    agentId: "agent_test",
    requiredCapabilities: ["test-engineer"],
  });

describe("staffing keeps the event behind each agent's presence", () => {
  it("records the registering event and its time", () => {
    const at = "2026-09-25T20:10:00.000Z";
    const agent = reduceStaffingTruth([registered(at)]).agents.agent_test;
    expect(agent?.updatedByEventId).toBe("event_registered");
    expect(agent?.updatedAt).toBe(at);
  });

  it("moves to whichever event last changed presence or health", () => {
    const presence = event("event_presence", "agent.presence_changed", {
      agentId: "agent_test",
      presence: "active",
      health: "connected",
    });
    expect(
      reduceStaffingTruth([registered(), assigned()]).agents.agent_test?.updatedByEventId,
    ).toBe("event_role");
    const after = reduceStaffingTruth([registered(), assigned(), presence]).agents.agent_test;
    expect(after?.updatedByEventId).toBe("event_presence");
    expect(after?.updatedAt).toBe(presence.occurredAt);
    const released = reduceStaffingTruth([
      registered(),
      assigned(),
      event("event_release", "role.released", { roleAssignmentId: "role-assignment_test" }),
    ]).agents.agent_test;
    expect(released?.updatedByEventId).toBe("event_release");
  });

  it("does not move for an event that changed nothing", () => {
    const ignored = event("event_ignored", "agent.presence_changed", {
      agentId: "agent_test",
      presence: "active",
    });
    expect(reduceStaffingTruth([registered(), ignored]).agents.agent_test?.updatedByEventId).toBe(
      "event_registered",
    );
  });
});

describe("the office scene reports an agent's cause and freshness", () => {
  it("emits the provenance event and time, and freshness from that time", () => {
    const at = "2026-09-25T20:00:00.000Z";
    const snapshot = replayProject([registered(at)]);
    const agent = projectOfficeScene(snapshot, "2026-09-25T20:00:30.000Z").find(
      (descriptor) => descriptor.subjectType === "agent",
    );
    expect(agent).toMatchObject({
      causeEventId: "event_registered",
      updatedAt: at,
      freshness: "current",
    });
    const later = projectOfficeScene(snapshot, "2026-09-25T21:00:00.000Z").find(
      (descriptor) => descriptor.subjectType === "agent",
    );
    expect(later?.freshness).toBe("delayed");
  });

  it("never reports a disconnected agent as current, however recent its record", () => {
    const at = "2026-09-25T20:00:00.000Z";
    const snapshot = replayProject([
      registered(at),
      event(
        "event_drop",
        "agent.presence_changed",
        { agentId: "agent_test", presence: "idle", health: "disconnected" },
        "2026-09-25T20:00:05.000Z",
      ),
    ]);
    const agent = projectOfficeScene(snapshot, "2026-09-25T20:00:10.000Z").find(
      (descriptor) => descriptor.subjectType === "agent",
    );
    expect(agent?.causeEventId).toBe("event_drop");
    expect(agent?.freshness).toBe("unavailable");
  });

  it("reports a missing or unparseable time as unavailable, not delayed", () => {
    const snapshot = replayProject([
      event("event_work", "work.created", {
        workItemId: "work_x",
        outcome: "x",
        requiredEvidenceKinds: [],
      }),
    ]);
    const item = snapshot.work.workItems.work_x!;
    snapshot.work.workItems.work_x = { ...item, updatedAt: "not a time" };
    const work = projectOfficeScene(snapshot, "2026-09-25T20:00:30.000Z").find(
      (descriptor) => descriptor.subjectType === "work",
    );
    expect(work?.freshness).toBe("unavailable");
  });
});

describe("manager attention carries the decision detail", () => {
  const condition = {
    reasonCode: "awaiting_evidence",
    summary: "The Test Engineer needs the current browser evidence.",
    waitingOn: { kind: "manager" },
    requestedAction: { kind: "redirect", summary: "Redirect the evidence request or decline it." },
  };

  it("gives a work item's attention its condition and the role assignment holding it", () => {
    const events = [
      registered(),
      assigned(),
      event("event_work", "work.created", {
        workItemId: "work_evidence",
        outcome: "Provide browser evidence",
        requiredEvidenceKinds: ["browser"],
      }),
      event("event_bind", "work.assigned", {
        workItemId: "work_evidence",
        roleAssignmentId: "role-assignment_test",
      }),
      ...(["ready", "assigned", "active"] as const).map((toState, index) =>
        event(`event_t${index}`, "work.transitioned", {
          workItemId: "work_evidence",
          fromRevision: index,
          toState,
        }),
      ),
      event("event_block", "work.transitioned", {
        workItemId: "work_evidence",
        fromRevision: 3,
        toState: "blocked",
        payloadVersion: 2,
        condition,
      }),
    ];
    const [item] = projectManagerAttention(replayProject(events));
    expect(item).toMatchObject({
      subjectId: "work_evidence",
      reason: "blocked",
      causeEventId: "event_block",
      assignment: { roleAssignmentId: "role-assignment_test", eventId: "event_bind" },
      condition: { ...condition, eventId: "event_block", source: "system", trust: "verified" },
    });
  });

  it("gives attention without a recorded condition or assignment explicit nulls", () => {
    const events = [
      event("event_work", "work.created", {
        workItemId: "work_plain",
        outcome: "Plain",
        requiredEvidenceKinds: [],
      }),
      ...(["ready", "assigned", "active", "blocked"] as const).map((toState, index) =>
        event(`event_p${index}`, "work.transitioned", {
          workItemId: "work_plain",
          fromRevision: index,
          toState,
        }),
      ),
    ];
    const [item] = projectManagerAttention(replayProject(events));
    expect(item?.condition).toBeNull();
    expect(item?.assignment).toBeNull();
  });
});
