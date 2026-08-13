import { describe, expect, it } from "vitest";
import { applyKnowledgeChange, reachSafeCheckpoint, type RunSyncState } from "./propagation.js";
const runs = (): RunSyncState[] => [
  {
    runId: "run_1",
    projectId: "project_alpha",
    workItemId: "work_1",
    packetId: "packet_old",
    snapshotId: "snap_1",
    status: "active",
    pendingChanges: [],
  },
  {
    runId: "run_2",
    projectId: "project_alpha",
    workItemId: "work_2",
    packetId: "packet_other",
    snapshotId: "snap_1",
    status: "active",
    pendingChanges: [],
  },
];
describe("knowledge propagation", () => {
  it("routes only intersecting scope and immediately pauses critical changes", () => {
    const result = applyKnowledgeChange(runs(), {
      changeId: "change_1",
      projectId: "project_alpha",
      workItemIds: ["work_1"],
      critical: true,
      kind: "permission",
    });
    expect(result[0]).toMatchObject({
      status: "paused",
      packetValid: false,
      pendingChanges: ["change_1"],
    });
    expect(result[1]).toMatchObject({ status: "active", pendingChanges: [] });
  });
  it("labels noncritical stale output until checkpoint refresh", () => {
    const changed = applyKnowledgeChange(runs(), {
      changeId: "change_2",
      projectId: "project_alpha",
      workItemIds: ["work_1"],
      critical: false,
      kind: "knowledge",
    });
    expect(changed[0]).toMatchObject({
      status: "active",
      packetValid: true,
      outputLabel: "stale_snapshot",
      promotionAllowed: false,
    });
    const refreshed = reachSafeCheckpoint(changed[0]!, {
      ok: true,
      packetId: "packet_new",
      snapshotId: "snap_2",
      acknowledgedChanges: ["change_2"],
    });
    expect(refreshed).toMatchObject({
      status: "active",
      packetId: "packet_new",
      packetValid: true,
      pendingChanges: [],
      promotionAllowed: true,
    });
  });
  it("turns refresh failure into explicit waiting state", () => {
    const changed = applyKnowledgeChange(runs(), {
      changeId: "change_1",
      projectId: "project_alpha",
      workItemIds: ["work_1"],
      critical: true,
      kind: "scope",
    });
    expect(
      reachSafeCheckpoint(changed[0]!, { ok: false, reason: "budget_exceeded" }),
    ).toMatchObject({ status: "waiting", packetValid: false, blockedReason: "budget_exceeded" });
  });
});
