import { describe, expect, it } from "vitest";

import {
  applyPermissionDecision,
  consumePermission,
  createRuntimeControlState,
  disconnectRuntime,
  reconcileRuntime,
  recordCancellationTerminal,
  requestCancellation,
  requestPermission,
} from "./runtime-controls.js";

const correlation = {
  bindingId: "binding_1",
  providerRunId: "run_1",
  providerRequestId: "request_1",
  threadId: "thread_1",
  turnId: "turn_1",
  itemId: "item_1",
};

function state() {
  return createRuntimeControlState({
    bindingFingerprint: "binding-fingerprint",
    capabilityFingerprint: "capability-fingerprint",
    permissionFingerprint: "permission-fingerprint",
    contextHash: "context-hash",
    eventCursor: 12,
  });
}

describe("runtime controls", () => {
  it("allows an exact permission once and rejects replay", () => {
    const requested = requestPermission(state(), {
      requestId: "permission_1",
      correlation,
      operation: "project.write",
      resource: "C:/synthetic/project/file.ts",
      expiresAt: 20,
    });
    const decided = applyPermissionDecision(requested, {
      requestId: "permission_1",
      correlation,
      decision: "allow_once",
      decidedBy: "manager_1",
      decidedAt: 10,
    });

    const first = consumePermission(decided, {
      requestId: "permission_1",
      correlation,
      operation: "project.write",
      resource: "C:/synthetic/project/file.ts",
      at: 11,
    });
    const replay = consumePermission(first.state, {
      requestId: "permission_1",
      correlation,
      operation: "project.write",
      resource: "C:/synthetic/project/file.ts",
      at: 12,
    });

    expect(first.allowed).toBe(true);
    expect(replay).toMatchObject({ allowed: false, reason: "DECISION_ALREADY_USED" });
  });

  it("denies stale, timed-out, disconnected, and cancelled actions", () => {
    const requested = requestPermission(state(), {
      requestId: "permission_1",
      correlation,
      operation: "project.write",
      resource: "C:/synthetic/project/file.ts",
      expiresAt: 20,
    });
    const stale = applyPermissionDecision(requested, {
      requestId: "permission_1",
      correlation: { ...correlation, turnId: "other_turn" },
      decision: "allow_once",
      decidedBy: "manager_1",
      decidedAt: 10,
    });
    expect(stale.issues.at(-1)?.code).toBe("STALE_PERMISSION_DECISION");

    const timedOut = consumePermission(requested, {
      requestId: "permission_1",
      correlation,
      operation: "project.write",
      resource: "C:/synthetic/project/file.ts",
      at: 21,
    });
    expect(timedOut.reason).toBe("PERMISSION_EXPIRED");

    expect(disconnectRuntime(requested).actionsBlocked).toBe(true);
    const cancelling = requestCancellation(requested, correlation);
    expect(cancelling.actionsBlocked).toBe(true);
    expect(recordCancellationTerminal(cancelling, correlation).cancelled).toBe(true);
  });

  it("resumes only after every continuity fact reconciles", () => {
    const disconnected = disconnectRuntime(state());
    const mismatch = reconcileRuntime(disconnected, {
      bindingFingerprint: "different-binding",
      capabilityFingerprint: "capability-fingerprint",
      permissionFingerprint: "permission-fingerprint",
      contextHash: "context-hash",
      eventCursor: 12,
    });
    expect(mismatch).toMatchObject({ connected: false, actionsBlocked: true });
    expect(mismatch.issues.at(-1)?.code).toBe("RECOVERY_RECONCILIATION_FAILED");

    const recovered = reconcileRuntime(disconnected, {
      bindingFingerprint: "binding-fingerprint",
      capabilityFingerprint: "capability-fingerprint",
      permissionFingerprint: "permission-fingerprint",
      contextHash: "context-hash",
      eventCursor: 12,
    });
    expect(recovered).toMatchObject({ connected: true, actionsBlocked: false });
  });
});
