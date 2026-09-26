import { describe, expect, it } from "vitest";

import { reduceWorkTruth } from "./work-truth.js";

/** Phase 7-O Task 2: the work → role assignment relation and the retained condition. */
let clock = 0;
const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  source = "system",
  trust = "verified",
) => {
  clock += 1;
  // A real clock, not a formatted counter: past 59 a counter makes an invalid timestamp, and the
  // envelope parser then drops the event silently.
  const at = new Date(Date.parse("2026-09-25T20:00:00.000Z") + clock * 1000).toISOString();
  return {
    schemaVersion: 1,
    eventId,
    projectId: "project_alpha",
    kind,
    occurredAt: at,
    receivedAt: at,
    source,
    trust,
    payload,
  };
};

const ROLE = "role-assignment_test_engineer";
const staffing = () => [
  event("event_agent", "agent.registered", {
    agentId: "agent_test_engineer",
    capabilities: ["test-engineer"],
    health: "connected",
  }),
  event("event_role", "role.assigned", {
    roleAssignmentId: ROLE,
    roleId: "test-engineer",
    agentId: "agent_test_engineer",
    requiredCapabilities: ["test-engineer"],
  }),
];
const work = () => [
  event("event_work", "work.created", {
    workItemId: "work_evidence",
    outcome: "Provide current browser evidence",
    requiredEvidenceKinds: ["browser"],
  }),
];
const toActive = () =>
  (["ready", "assigned", "active"] as const).map((toState, index) =>
    event(`event_t${index}`, "work.transitioned", {
      workItemId: "work_evidence",
      fromRevision: index,
      toState,
    }),
  );
const assign = (id = "event_assign", roleAssignmentId = ROLE, workItemId = "work_evidence") =>
  event(id, "work.assigned", { workItemId, roleAssignmentId });
const condition = {
  reasonCode: "awaiting_evidence",
  summary: "The Test Engineer needs the current browser evidence.",
  waitingOn: { kind: "manager" },
  requestedAction: { kind: "redirect", summary: "Redirect the evidence request or decline it." },
};
const codes = (result: ReturnType<typeof reduceWorkTruth>) => result.issues.map(({ code }) => code);

describe("work → role assignment relation", () => {
  it("starts every work item unassigned and without a condition", () => {
    const item = reduceWorkTruth(work()).workItems.work_evidence;
    expect(item?.assignment).toBeNull();
    expect(item?.condition).toBeNull();
  });

  it("binds a work item to an active role assignment and records the event that did it", () => {
    const result = reduceWorkTruth([...staffing(), ...work(), assign()]);
    expect(result.workItems.work_evidence?.assignment).toEqual({
      roleAssignmentId: ROLE,
      eventId: "event_assign",
    });
    expect(result.issues).toEqual([]);
  });

  it("refuses an assignment to a role assignment that does not exist or is not yet active", () => {
    const early = reduceWorkTruth([...work(), assign(), ...staffing()]);
    expect(early.workItems.work_evidence?.assignment).toBeNull();
    expect(codes(early)).toEqual(["WORK_ASSIGNMENT_INVALID"]);
    const unknown = reduceWorkTruth([
      ...staffing(),
      ...work(),
      assign("event_assign", "role-assignment_nobody"),
    ]);
    expect(unknown.workItems.work_evidence?.assignment).toBeNull();
    expect(codes(unknown)).toEqual(["WORK_ASSIGNMENT_INVALID"]);
  });

  it("refuses an assignment for a work item that does not exist", () => {
    const result = reduceWorkTruth([...staffing(), assign("event_assign", ROLE, "work_missing")]);
    expect(codes(result)).toEqual(["WORK_ITEM_NOT_FOUND"]);
  });

  it("refuses a second assignment without a release and keeps the first", () => {
    const result = reduceWorkTruth([...staffing(), ...work(), assign(), assign("event_assign_2")]);
    expect(result.workItems.work_evidence?.assignment?.eventId).toBe("event_assign");
    expect(codes(result)).toEqual(["WORK_ALREADY_ASSIGNED"]);
  });

  it("releases only the assignment the work item actually holds", () => {
    const released = reduceWorkTruth([
      ...staffing(),
      ...work(),
      assign(),
      event("event_release", "work.released", {
        workItemId: "work_evidence",
        roleAssignmentId: ROLE,
      }),
    ]);
    expect(released.workItems.work_evidence?.assignment).toBeNull();
    expect(released.issues).toEqual([]);
    const wrong = reduceWorkTruth([
      ...staffing(),
      ...work(),
      assign(),
      event("event_release", "work.released", {
        workItemId: "work_evidence",
        roleAssignmentId: "role-assignment_other",
      }),
    ]);
    expect(wrong.workItems.work_evidence?.assignment?.roleAssignmentId).toBe(ROLE);
    expect(codes(wrong)).toEqual(["WORK_ASSIGNMENT_INVALID"]);
  });

  it("leaves work unassigned and flagged when its role assignment is released", () => {
    const result = reduceWorkTruth([
      ...staffing(),
      ...work(),
      assign(),
      event("event_role_release", "role.released", { roleAssignmentId: ROLE }),
    ]);
    expect(result.workItems.work_evidence?.assignment).toBeNull();
    expect(result.issues).toEqual([
      {
        code: "WORK_ORPHANED",
        eventId: "event_role_release",
        workItemId: "work_evidence",
        message: `role assignment ${ROLE} was released while it held this work`,
      },
    ]);
  });

  it("refuses a malformed assignment payload as a malformed work event", () => {
    const result = reduceWorkTruth([
      ...staffing(),
      ...work(),
      event("event_assign", "work.assigned", { workItemId: "work_evidence", agentId: "agent_x" }),
    ]);
    expect(result.workItems.work_evidence?.assignment).toBeNull();
    expect(codes(result)).toEqual(["MALFORMED_WORK_EVENT"]);
  });
});

describe("the retained transition condition", () => {
  it("keeps a version-2 condition with the event, source and trust that asserted it", () => {
    const result = reduceWorkTruth([
      ...work(),
      ...toActive(),
      event(
        "event_block",
        "work.transitioned",
        {
          workItemId: "work_evidence",
          fromRevision: 3,
          toState: "blocked",
          payloadVersion: 2,
          condition,
        },
        "adapter",
        "reported",
      ),
    ]);
    expect(result.workItems.work_evidence?.state).toBe("blocked");
    expect(result.workItems.work_evidence?.condition).toEqual({
      ...condition,
      eventId: "event_block",
      source: "adapter",
      trust: "reported",
    });
  });

  it("clears the condition on the next transition, and never invents one for version 1", () => {
    const blocked = event("event_block", "work.transitioned", {
      workItemId: "work_evidence",
      fromRevision: 3,
      toState: "blocked",
      payloadVersion: 2,
      condition,
    });
    const resumed = event("event_resume", "work.transitioned", {
      workItemId: "work_evidence",
      fromRevision: 4,
      toState: "active",
    });
    const cleared = reduceWorkTruth([...work(), ...toActive(), blocked, resumed]);
    expect(cleared.workItems.work_evidence?.condition).toBeNull();
    const v1 = reduceWorkTruth([
      ...work(),
      ...toActive(),
      event("event_block", "work.transitioned", {
        workItemId: "work_evidence",
        fromRevision: 3,
        toState: "blocked",
        blocker: "permission denied",
      }),
    ]);
    expect(v1.workItems.work_evidence?.state).toBe("blocked");
    expect(v1.workItems.work_evidence?.condition).toBeNull();
  });

  it("refuses a version-2 attention-raising transition without a condition and leaves state alone", () => {
    const result = reduceWorkTruth([
      ...work(),
      ...toActive(),
      event("event_block", "work.transitioned", {
        workItemId: "work_evidence",
        fromRevision: 3,
        toState: "blocked",
        payloadVersion: 2,
      }),
    ]);
    expect(result.workItems.work_evidence?.state).toBe("active");
    expect(result.workItems.work_evidence?.revision).toBe(3);
    expect(codes(result)).toEqual(["MALFORMED_WORK_EVENT"]);
  });
});
