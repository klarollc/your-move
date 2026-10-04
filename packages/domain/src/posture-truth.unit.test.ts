import { describe, expect, it } from "vitest";

import { replayProject } from "./replay.js";
import { reduceWorkTruth } from "./work-truth.js";

const posture = (type = "workspaceWrite", match = true) => ({
  schemaVersion: 1,
  requested: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  granted: {
    type,
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
  match,
  differences: match ? [] : [{ field: "sandbox.type", requested: "workspaceWrite", granted: type }],
});

const base = {
  schemaVersion: 1,
  projectId: "project_alpha",
  source: "adapter",
  trust: "verified",
} as const;

const created = {
  ...base,
  eventId: "event_created",
  workItemId: "work_slug",
  kind: "work.created",
  occurredAt: "2026-10-04T10:00:00.000Z",
  receivedAt: "2026-10-04T10:00:00.000Z",
  source: "manager",
  payload: { workItemId: "work_slug", outcome: "Implement slugify", requiredEvidenceKinds: [] },
};

const recorded = (
  id: string,
  at: string,
  runId: string,
  value: unknown = posture(),
  extra: Record<string, unknown> = {},
) => ({
  ...base,
  eventId: id,
  workItemId: "work_slug",
  kind: "posture.recorded",
  occurredAt: at,
  receivedAt: at,
  payload: { workItemId: "work_slug", runId, posture: value, ...extra },
});

describe("posture truth", () => {
  it("keeps the full history per work item, in canonical event order", () => {
    // The later event is listed first: order comes from the timestamps, not the array.
    const state = replayProject([
      created,
      recorded("event_p2", "2026-10-04T12:00:00.000Z", "run_2", posture("readOnly", false)),
      recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1"),
    ]).work;
    expect(state.issues).toEqual([]);
    const history = state.postures?.work_slug ?? [];
    expect(history.map((entry) => entry.runId)).toEqual(["run_1", "run_2"]);
    expect(history.map((entry) => entry.eventId)).toEqual(["event_p1", "event_p2"]);
    expect(history[0]?.posture.match).toBe(true);
    expect(history[1]?.posture.granted.type).toBe("readOnly");
    expect(history[1]?.recordedAt).toBe("2026-10-04T12:00:00.000Z");
  });

  it("exposes the history through the canonical snapshot", () => {
    const snapshot = replayProject([
      created,
      recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1"),
    ]);
    expect(snapshot.work.postures?.work_slug).toHaveLength(1);
  });

  it("leaves a log without postures projecting exactly as before", () => {
    expect(reduceWorkTruth([created]).postures).toBeUndefined();
  });

  it("never changes a work item's state or revision", () => {
    const without = reduceWorkTruth([created]);
    const withPosture = reduceWorkTruth([
      created,
      recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1"),
    ]);
    expect(withPosture.workItems.work_slug).toEqual(without.workItems.work_slug);
  });

  it("refuses a posture event that tries to supply state, and records nothing", () => {
    const state = reduceWorkTruth([
      created,
      recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1", posture(), {
        toState: "completed",
      }),
    ]);
    expect(state.issues.map((i) => i.code)).toEqual(["MALFORMED_WORK_EVENT"]);
    expect(state.issues[0]?.message).toContain("toState");
    expect(state.workItems.work_slug?.state).toBe("draft");
    expect(state.postures?.work_slug ?? []).toEqual([]);
  });

  it("refuses a posture for a work item that does not exist", () => {
    const state = reduceWorkTruth([recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1")]);
    expect(state.issues.map((i) => i.code)).toEqual(["WORK_ITEM_NOT_FOUND"]);
    expect(state.postures).toBeUndefined();
  });

  it("refuses a posture the runner did not measure: source adapter and trust verified only", () => {
    for (const patch of [
      { source: "manager" },
      { source: "reviewer" },
      { trust: "reported" },
      { trust: "inferred" },
    ]) {
      const state = reduceWorkTruth([
        created,
        { ...recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1"), ...patch },
      ]);
      expect(state.issues.map((i) => i.code)).toEqual(["MALFORMED_WORK_EVENT"]);
      expect(state.postures?.work_slug ?? []).toEqual([]);
    }
  });

  it("refuses a payload whose work item id differs from the envelope's", () => {
    const event = recorded("event_p1", "2026-10-04T11:00:00.000Z", "run_1");
    const state = reduceWorkTruth([created, { ...event, workItemId: "work_other" }]);
    expect(state.issues.map((i) => i.code)).toEqual(["MALFORMED_WORK_EVENT"]);
  });
});
