import { describe, expect, it } from "vitest";

import { eventKinds, parseProjectEvent } from "./events.js";
import { validatePostureRecordedPayload } from "./posture-event.js";

const posture = {
  schemaVersion: 1,
  requested: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  granted: {
    type: "workspaceWrite",
    networkAccess: false,
    approvalPolicy: "never",
    multiAgentMode: "explicitRequestOnly",
  },
  declared: {
    kind: "declared",
    read: "no",
    write: "possible",
    run: "no",
    basis: ["shell_tool is disabled by the feature policy"],
    observed: null,
  },
  match: true,
  differences: [],
};

const payload = (over: Record<string, unknown> = {}) => ({
  workItemId: "work_slug",
  runId: "run_1",
  posture,
  ...over,
});

describe("posture.recorded (workflow-proof W6a)", () => {
  it("is part of the event vocabulary and parses as an envelope", () => {
    expect(eventKinds).toContain("posture.recorded");
    const parsed = parseProjectEvent({
      schemaVersion: 1,
      eventId: "event_posture",
      projectId: "project_alpha",
      workItemId: "work_slug",
      kind: "posture.recorded",
      occurredAt: "2026-10-04T10:00:00.000Z",
      receivedAt: "2026-10-04T10:00:00.000Z",
      source: "adapter",
      trust: "verified",
      payload: payload(),
    });
    expect(parsed.ok).toBe(true);
  });

  it("accepts a work item id, a run id and a full posture record", () => {
    const result = validatePostureRecordedPayload(payload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.workItemId).toBe("work_slug");
      expect(result.value.runId).toBe("run_1");
      expect(result.value.posture.granted.type).toBe("workspaceWrite");
    }
  });

  it("refuses a missing or malformed work item id and a missing run id", () => {
    expect(validatePostureRecordedPayload(payload({ workItemId: "slug" })).ok).toBe(false);
    expect(validatePostureRecordedPayload(payload({ workItemId: undefined })).ok).toBe(false);
    expect(validatePostureRecordedPayload(payload({ runId: "" })).ok).toBe(false);
    expect(validatePostureRecordedPayload(payload({ runId: undefined })).ok).toBe(false);
  });

  it("refuses an invalid posture record, including a match flag that contradicts the differences", () => {
    expect(
      validatePostureRecordedPayload(payload({ posture: { ...posture, match: false } })).ok,
    ).toBe(false);
    expect(validatePostureRecordedPayload(payload({ posture: undefined })).ok).toBe(false);
    expect(validatePostureRecordedPayload(payload({ posture: { schemaVersion: 1 } })).ok).toBe(
      false,
    );
  });

  it("refuses any field that could carry state or other claims", () => {
    for (const extra of [{ toState: "completed" }, { state: "active" }, { verdict: "done" }]) {
      const result = validatePostureRecordedPayload(payload(extra));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.join(" ")).toContain(Object.keys(extra)[0]);
    }
  });
});
