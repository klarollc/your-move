import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProjectStore } from "./project-store.js";
import {
  deliverFeedbackAtCheckpoint,
  hasCurrentContext,
  recordFeedback,
  recordPacketReceipt,
  reusableReconnectState,
} from "./receipt-store.js";
const roots: string[] = [];
const make = () => {
  const r = mkdtempSync(join(tmpdir(), "cuckcode-receipts-"));
  roots.push(r);
  return r;
};
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
describe("context reuse and feedback", () => {
  it("finds current permitted knowledge without redundant request", () => {
    const s = openProjectStore(make());
    recordPacketReceipt(s, {
      packetId: "packet_1",
      projectId: "project_alpha",
      runId: "run_1",
      snapshotId: "snap_1",
      status: "valid",
      knowledgeIds: ["knowledge_current"],
      qualificationId: "qualification_1",
      completedWorkIds: ["work_done"],
    });
    expect(hasCurrentContext(s, "run_1", "snap_1", "knowledge_current")).toBe(true);
    expect(reusableReconnectState(s, "run_1", "snap_1")).toMatchObject({
      qualificationId: "qualification_1",
      completedWorkIds: ["work_done"],
    });
    expect(reusableReconnectState(s, "run_1", "snap_stale")).toBeUndefined();
    s.close();
  });
  it("delivers attributable versioned feedback at checkpoint", () => {
    const s = openProjectStore(make());
    recordFeedback(s, {
      feedbackId: "feedback_1",
      projectId: "project_alpha",
      runId: "run_1",
      actorId: "manager_1",
      version: 2,
      content: "Revise evidence",
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    expect(deliverFeedbackAtCheckpoint(s, "run_1", "checkpoint_1")).toEqual([
      {
        feedbackId: "feedback_1",
        actorId: "manager_1",
        version: 2,
        content: "Revise evidence",
        checkpointId: "checkpoint_1",
        disposition: "delivered",
      },
    ]);
    expect(deliverFeedbackAtCheckpoint(s, "run_1", "checkpoint_2")).toEqual([]);
    s.close();
  });
});
