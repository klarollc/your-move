import { describe, expect, it } from "vitest";

import {
  permissionDecisionSchema,
  runtimeCorrelationSchema,
  runtimeRecordKinds,
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
    expect(
      runtimeCorrelationSchema.safeParse({
        bindingId: "binding_1",
        providerRunId: "run_1",
        providerRequestId: "notification_1",
      }).success,
    ).toBe(true);
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

describe("runtime record vocabulary", () => {
  it("declares the nine provider-independent kinds exactly once", () => {
    expect([...runtimeRecordKinds]).toEqual([
      "runtime.lifecycle",
      "runtime.message",
      "runtime.command",
      "runtime.file",
      "runtime.tool",
      "runtime.artifact",
      "runtime.usage",
      "runtime.approval",
      "runtime.error",
    ]);
  });

  it("accepts every declared kind and rejects anything outside the vocabulary", () => {
    for (const kind of runtimeRecordKinds) {
      expect(
        runtimeRecordSchema.safeParse({
          correlation: { bindingId: "b1", providerRunId: "r1", providerRequestId: "q1" },
          kind,
          summary: "normalized provider output",
        }).success,
      ).toBe(true);
    }

    expect(
      runtimeRecordSchema.safeParse({
        correlation: { bindingId: "b1", providerRunId: "r1", providerRequestId: "q1" },
        kind: "runtime.claude_specific",
        summary: "a provider inventing its own kind",
      }).success,
    ).toBe(false);
  });
});
