import { describe, expect, it } from "vitest";

import {
  permissionDecisionSchema,
  runtimeBindingReportSchema,
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

/** Drops one key, so a test can show a report that cannot say a particular thing. */
function without(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const remaining = { ...value };
  delete remaining[key];
  return remaining;
}

describe("runtime binding report", () => {
  const report = {
    bindingId: "binding_1",
    agentId: "agent_1",
    adapterId: "codex-app-server",
    adapterVersion: "0.146.0",
    protocolVersion: "0.146.0",
    authMode: "chatgpt",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    capabilityIds: ["thread/start"],
    // Deliberately the enumerable-and-empty case: valid before and after this change, so the
    // tests below fail on the field each one is about rather than on this one.
    toolIds: [],
    // FU-3: what an enumeration observed, beside toolIds rather than inside it. Codex can list MCP
    // servers but not its native tools, so filling toolIds would claim a completeness nobody saw.
    observedMcpServers: [],
    permissionCeiling: [],
    sandboxPosture: {
      type: "readOnly",
      networkAccess: false,
      approvalPolicy: "never",
      multiAgentMode: "explicitRequestOnly",
    },
    materialFingerprint: "a".repeat(64),
    status: "candidate",
  };

  it("accepts a report that says how the model was configured and what bounded it", () => {
    // A guard, not RED evidence: this shape parses before and after the change.
    expect(runtimeBindingReportSchema.safeParse(report).success).toBe(true);
  });

  it("refuses a report that cannot say how the model was configured", () => {
    // DF-008. The runtime reports reasoningEffort and the owner chooses it, so a report without
    // the field describes a run that cannot be told apart from one at a different effort.
    expect(runtimeBindingReportSchema.safeParse(without(report, "reasoningEffort")).success).toBe(
      false,
    );
  });

  it("refuses a report that cannot say what the session was confined to", () => {
    expect(runtimeBindingReportSchema.safeParse(without(report, "sandboxPosture")).success).toBe(
      false,
    );
  });

  it("lets a tool list be unenumerable, but not absent or malformed", () => {
    expect(runtimeBindingReportSchema.safeParse({ ...report, toolIds: null }).success).toBe(true);
    expect(runtimeBindingReportSchema.safeParse({ ...report, toolIds: [] }).success).toBe(true);
    expect(runtimeBindingReportSchema.safeParse(without(report, "toolIds")).success).toBe(false);
    expect(runtimeBindingReportSchema.safeParse({ ...report, toolIds: "none" }).success).toBe(
      false,
    );
  });

  it("says which MCP servers the session started, with null for not enumerated", () => {
    const apps = { name: "codex_apps", status: "connected", toolNames: ["github_search"] };
    const parse = (value: unknown) => runtimeBindingReportSchema.safeParse(value).success;
    expect(parse({ ...report, observedMcpServers: null })).toBe(true);
    expect(parse({ ...report, observedMcpServers: [] })).toBe(true);
    expect(parse({ ...report, observedMcpServers: [apps] })).toBe(true);
    expect(parse(without(report, "observedMcpServers"))).toBe(false);
    expect(parse({ ...report, observedMcpServers: [{ ...apps, name: "" }] })).toBe(false);
    expect(parse({ ...report, observedMcpServers: [{ ...apps, tools: {} }] })).toBe(false);
    expect(parse({ ...report, observedMcpServers: [without(apps, "toolNames")] })).toBe(false);
  });

  it("refuses a posture that is missing the bound it is there to state", () => {
    const partial = without(report.sandboxPosture, "networkAccess");
    expect(
      runtimeBindingReportSchema.safeParse({ ...report, sandboxPosture: partial }).success,
    ).toBe(false);
  });
});
