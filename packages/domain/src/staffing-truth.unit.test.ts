import { describe, expect, it } from "vitest";

import { reduceStaffingTruth } from "./staffing-truth.js";

const event = (eventId: string, kind: string, payload: Record<string, unknown>) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  kind,
  occurredAt: `2026-08-13T21:00:${eventId.slice(-2)}.000Z`,
  receivedAt: `2026-08-13T21:01:${eventId.slice(-2)}.000Z`,
  source: "system",
  trust: "verified",
  payload,
});

const registered = event("event_01", "agent.registered", {
  agentId: "agent_1",
  capabilities: ["typescript", "testing"],
  health: "connected",
});

describe("reduceStaffingTruth", () => {
  it("rejects a second active role for the same identity", () => {
    const result = reduceStaffingTruth([
      registered,
      event("event_02", "role.assigned", {
        roleAssignmentId: "role-assignment_1",
        roleId: "implementation-engineer",
        agentId: "agent_1",
        requiredCapabilities: ["typescript"],
      }),
      event("event_03", "role.assigned", {
        roleAssignmentId: "role-assignment_2",
        roleId: "test-engineer",
        agentId: "agent_1",
        requiredCapabilities: ["testing"],
      }),
    ]);

    expect(Object.keys(result.assignments)).toEqual(["role-assignment_1"]);
    expect(result.issues[0]?.code).toBe("AGENT_ALREADY_ASSIGNED");
  });

  it("rejects role assignment when a hard capability is missing", () => {
    const result = reduceStaffingTruth([
      registered,
      event("event_02", "role.assigned", {
        roleAssignmentId: "role-assignment_1",
        roleId: "visual-qa-reviewer",
        agentId: "agent_1",
        requiredCapabilities: ["visual-qa"],
      }),
    ]);

    expect(result.assignments).toEqual({});
    expect(result.issues[0]).toMatchObject({ code: "CAPABILITY_REQUIRED", agentId: "agent_1" });
  });

  it("cannot project disconnected or stale agents as active or qualified", () => {
    const result = reduceStaffingTruth([
      registered,
      event("event_02", "qualification.recorded", {
        qualificationId: "qualification_1",
        agentId: "agent_1",
        roleId: "implementation-engineer",
        checks: [{ checkId: "identity", category: "identity", mandatory: true, passed: true }],
        exceptions: [],
      }),
      event("event_03", "agent.presence_changed", {
        agentId: "agent_1",
        presence: "active",
        health: "disconnected",
      }),
    ]);

    expect(result.agents.agent_1).toMatchObject({
      presence: "unavailable",
      health: "disconnected",
    });
    expect(result.qualifications.qualification_1?.qualified).toBe(false);
    expect(result.issues[0]?.code).toBe("UNTRUTHFUL_AGENT_PRESENCE");
  });
});
