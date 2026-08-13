import { describe, expect, it } from "vitest";

import {
  permissionDecisionSchema,
  runtimeCorrelationSchema,
  runtimeRecordSchema,
} from "./runtime.js";

const correlation = {
  bindingId: "binding_1",
  providerRunId: "run_1",
  providerRequestId: "request_1",
  threadId: "thread_1",
  turnId: "turn_1",
  itemId: "item_1",
};

describe("runtime trust contracts", () => {
  it("rejects an event without the required runtime correlation", () => {
    expect(runtimeCorrelationSchema.safeParse({ bindingId: "binding_1" }).success).toBe(false);
    expect(runtimeCorrelationSchema.safeParse(correlation).success).toBe(true);
  });

  it("rejects secret-bearing runtime records", () => {
    expect(
      runtimeRecordSchema.safeParse({
        correlation,
        kind: "runtime.error",
        summary: "Authorization: Bearer sk-cuckcode-secret-canary",
      }).success,
    ).toBe(false);
  });

  it("rejects provider-authored permission decisions", () => {
    expect(
      permissionDecisionSchema.safeParse({
        requestId: "permission_1",
        correlation,
        decision: "allow_once",
        decidedBy: { kind: "provider", id: "codex" },
        decidedAt: "2026-08-13T17:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
