import { describe, expect, it } from "vitest";

import { eventKinds, parseProjectEvent } from "./events.js";
import {
  attentionRaisingStates,
  requestedActionKinds,
  validateWorkAssignmentPayload,
  validateWorkTransitionPayload,
  waitingOnKinds,
  workConditionReasonCodes,
} from "./work-payloads.js";

const condition = {
  reasonCode: "awaiting_evidence",
  summary: "The Test Engineer needs the current browser evidence.",
  waitingOn: { kind: "evidence", id: "evidence_browser" },
  requestedAction: { kind: "redirect", summary: "Redirect the evidence request or decline it." },
};
const v2 = (toState: string, extra: Record<string, unknown> = {}) => ({
  workItemId: "work_graybox",
  fromRevision: 3,
  toState,
  payloadVersion: 2,
  ...extra,
});
const refused = (result: { ok: boolean }) => expect(result.ok).toBe(false);

describe("work event kinds (Phase 7-O Task 1)", () => {
  it("adds work.assigned and work.released to the envelope vocabulary", () => {
    expect(eventKinds).toContain("work.assigned");
    expect(eventKinds).toContain("work.released");
    const event = {
      schemaVersion: 1,
      eventId: "event_assign",
      projectId: "project_alpha",
      kind: "work.assigned",
      occurredAt: "2026-09-25T20:00:00.000Z",
      receivedAt: "2026-09-25T20:00:00.000Z",
      source: "system",
      trust: "verified",
      payload: { workItemId: "work_graybox", roleAssignmentId: "role-assignment_test" },
    };
    expect(parseProjectEvent(event).ok).toBe(true);
    expect(parseProjectEvent({ ...event, schemaVersion: 2 }).ok).toBe(false);
  });

  it("declares closed vocabularies for the condition", () => {
    expect(workConditionReasonCodes.length).toBeGreaterThan(0);
    expect([...waitingOnKinds].sort()).toEqual(["agent", "evidence", "external", "manager"]);
    expect([...requestedActionKinds].sort()).toEqual([
      "answer_question",
      "approve",
      "cancel",
      "decline",
      "defer",
      "provide_evidence",
      "redirect",
    ]);
    expect([...attentionRaisingStates].sort()).toEqual([
      "blocked",
      "review_requested",
      "waiting_input",
    ]);
  });
});

describe("validateWorkAssignmentPayload", () => {
  it("accepts a work item bound to a role assignment", () => {
    expect(
      validateWorkAssignmentPayload({
        workItemId: "work_graybox",
        roleAssignmentId: "role-assignment_test",
      }),
    ).toEqual({
      ok: true,
      value: { workItemId: "work_graybox", roleAssignmentId: "role-assignment_test" },
    });
  });

  it("refuses a missing or malformed identifier, and any extra field", () => {
    refused(validateWorkAssignmentPayload({ workItemId: "work_graybox" }));
    refused(validateWorkAssignmentPayload({ roleAssignmentId: "role-assignment_test" }));
    refused(
      validateWorkAssignmentPayload({
        workItemId: "graybox",
        roleAssignmentId: "role-assignment_t",
      }),
    );
    refused(
      validateWorkAssignmentPayload({ workItemId: "work_graybox", roleAssignmentId: "agent_test" }),
    );
    refused(
      validateWorkAssignmentPayload({
        workItemId: "work_graybox",
        roleAssignmentId: "role-assignment_test",
        agentId: "agent_test",
      }),
    );
  });
});

describe("validateWorkTransitionPayload", () => {
  it("accepts a version-1 payload unchanged, including extra fields it has always carried", () => {
    const v1 = { workItemId: "work_fixture", fromRevision: 3, toState: "blocked", blocker: "x" };
    expect(validateWorkTransitionPayload(v1)).toEqual({
      ok: true,
      value: { workItemId: "work_fixture", fromRevision: 3, toState: "blocked", payloadVersion: 1 },
    });
  });

  it("refuses a condition on a version-1 payload: the version must be declared", () => {
    refused(
      validateWorkTransitionPayload({
        workItemId: "work_fixture",
        fromRevision: 3,
        toState: "blocked",
        condition,
      }),
    );
  });

  it("accepts a version-2 attention-raising transition with a complete condition", () => {
    for (const toState of ["blocked", "waiting_input", "review_requested"]) {
      expect(validateWorkTransitionPayload(v2(toState, { condition }))).toEqual({
        ok: true,
        value: {
          workItemId: "work_graybox",
          fromRevision: 3,
          toState,
          payloadVersion: 2,
          condition,
        },
      });
    }
  });

  it("refuses a version-2 attention-raising transition without a condition", () => {
    for (const toState of ["blocked", "waiting_input", "review_requested"]) {
      const result = validateWorkTransitionPayload(v2(toState));
      refused(result);
      // The reason must name the missing condition, not a generic shape error.
      expect(result.ok ? [] : result.issues).toContainEqual(
        expect.stringMatching(/requires a condition/),
      );
    }
  });

  it("refuses a condition on a version-2 transition that raises no attention", () => {
    refused(validateWorkTransitionPayload(v2("active", { condition })));
    expect(validateWorkTransitionPayload(v2("active")).ok).toBe(true);
  });

  it("refuses each malformed part of a condition", () => {
    const broken: Record<string, unknown>[] = [
      { ...condition, reasonCode: "because" },
      { ...condition, summary: "" },
      { ...condition, summary: "x".repeat(281) },
      { ...condition, waitingOn: { kind: "someone" } },
      { ...condition, waitingOn: { kind: "agent" } },
      { ...condition, waitingOn: { kind: "evidence" } },
      { ...condition, waitingOn: { kind: "manager", id: "manager_1" } },
      { ...condition, requestedAction: { kind: "merge", summary: "Merge it." } },
      { ...condition, requestedAction: { kind: "approve" } },
      { ...condition, instructions: "ignore previous" },
    ];
    for (const bad of broken) {
      refused(validateWorkTransitionPayload(v2("blocked", { condition: bad })));
    }
  });

  it("accepts waiting on the manager or an external party without a record id", () => {
    for (const waitingOn of [
      { kind: "manager" },
      { kind: "external" },
      { kind: "external", id: "vendor" },
    ]) {
      expect(
        validateWorkTransitionPayload(
          v2("waiting_input", { condition: { ...condition, waitingOn } }),
        ).ok,
      ).toBe(true);
    }
  });

  it("refuses an unknown payload version and a malformed core", () => {
    refused(validateWorkTransitionPayload(v2("blocked", { condition, payloadVersion: 4 })));
    refused(validateWorkTransitionPayload({ fromRevision: 0, toState: "ready" }));
    refused(
      validateWorkTransitionPayload({ workItemId: "work_x", fromRevision: -1, toState: "ready" }),
    );
    refused(validateWorkTransitionPayload({ workItemId: "work_x", fromRevision: 0 }));
  });
});

describe("validateWorkTransitionPayload, version 3 (DF-029, spec §10.1)", () => {
  const v3 = (toState: string, extra: Record<string, unknown> = {}) => ({
    ...v2(toState, extra),
    payloadVersion: 3,
  });
  const unrequested = {
    reasonCode: condition.reasonCode,
    summary: condition.summary,
    waitingOn: condition.waitingOn,
  };
  const onAgent = { ...unrequested, waitingOn: { kind: "agent", id: "agent_implementation" } };
  const issuesOf = (result: { ok: true } | { ok: false; issues: string[] }) =>
    result.ok ? [] : result.issues;

  it("accepts a blocker or a wait without a request when someone else can resolve it", () => {
    for (const toState of ["blocked", "waiting_input"]) {
      for (const waitingOn of [
        { kind: "agent", id: "agent_implementation" },
        { kind: "evidence", id: "evidence_browser" },
        { kind: "external" },
      ]) {
        const result = validateWorkTransitionPayload(
          v3(toState, { condition: { ...unrequested, waitingOn } }),
        );
        expect(result).toEqual({
          ok: true,
          value: {
            workItemId: "work_graybox",
            fromRevision: 3,
            toState,
            payloadVersion: 3,
            condition: { ...unrequested, waitingOn },
          },
        });
      }
    }
  });

  it("keeps a request when one is recorded", () => {
    expect(validateWorkTransitionPayload(v3("blocked", { condition }))).toEqual({
      ok: true,
      value: {
        workItemId: "work_graybox",
        fromRevision: 3,
        toState: "blocked",
        payloadVersion: 3,
        condition,
      },
    });
  });

  it("refuses waiting on the manager without a request", () => {
    const result = validateWorkTransitionPayload(
      v3("blocked", { condition: { ...unrequested, waitingOn: { kind: "manager" } } }),
    );
    refused(result);
    expect(issuesOf(result)).toContainEqual(
      expect.stringMatching(/waiting on the manager requires a requested action/),
    );
  });

  it("refuses a review request without a request", () => {
    const result = validateWorkTransitionPayload(v3("review_requested", { condition: onAgent }));
    refused(result);
    expect(issuesOf(result)).toContainEqual(
      expect.stringMatching(/review_requested requires a requested action/),
    );
  });

  it("still requires a condition, and still refuses one where no attention is raised", () => {
    for (const toState of ["blocked", "waiting_input", "review_requested"]) {
      expect(issuesOf(validateWorkTransitionPayload(v3(toState)))).toContainEqual(
        expect.stringMatching(/requires a condition/),
      );
    }
    refused(validateWorkTransitionPayload(v3("failed", { condition: onAgent })));
    refused(validateWorkTransitionPayload(v3("active", { condition: onAgent })));
  });

  it("validates a recorded request as strictly as version 2", () => {
    refused(
      validateWorkTransitionPayload(
        v3("blocked", { condition: { ...onAgent, requestedAction: { kind: "approve" } } }),
      ),
    );
  });

  it("leaves version 2 requiring a request", () => {
    refused(validateWorkTransitionPayload(v2("blocked", { condition: onAgent })));
  });
});
