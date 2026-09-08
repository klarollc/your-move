import { describe, expect, it } from "vitest";

import { buildBindingReport, type BindingExpectation, type HandshakeFacts } from "./binding.js";

const expected: BindingExpectation = {
  requestedModel: "gpt-5.6-luna",
  expectedAuthMode: "chatgpt",
  protocolVersion: "0.146.0",
  promotedSourceSha256: "source-delivery-lead",
  promotedOverlaySha256: "overlay-delivery-lead",
};

function facts(overrides: Partial<HandshakeFacts> = {}): HandshakeFacts {
  return {
    agentId: "agent_0",
    bindingId: "binding_0",
    roleId: "delivery-lead",
    userAgent: "codex-cli 0.146.0 (windows)",
    authMode: "chatgpt",
    reportedModel: "gpt-5.6-luna",
    toolIds: [],
    permissionCeiling: [],
    ...overrides,
  };
}

describe("codex binding report", () => {
  it("builds a candidate report when every fact matches what was approved", () => {
    const result = buildBindingReport(facts(), expected);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.status).toBe("candidate");
    expect(result.report.model).toBe("gpt-5.6-luna");
    expect(result.report.authMode).toBe("chatgpt");
    expect(result.report.protocolVersion).toBe("0.146.0");
    expect(result.report.materialFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("records the model the runtime reported, not the one requested", () => {
    // Same requested model, different reported one. The report must never echo the request.
    const drifted = buildBindingReport(facts({ reportedModel: "gpt-5.6-sol" }), expected);
    expect(drifted.ok).toBe(false);
    if (drifted.ok) return;
    expect(drifted.failure.code).toBe("MODEL_DRIFT");
    expect(drifted.failure.detail).toContain("gpt-5.6-sol");
  });

  it("stops when the runtime authenticated differently than approved", () => {
    const result = buildBindingReport(facts({ authMode: "api_key_managed" }), expected);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe("AUTH_MODE_DRIFT");
  });

  it("stops when the handshake reports a different protocol version than the pin", () => {
    const result = buildBindingReport(
      facts({ userAgent: "codex-cli 0.147.0 (windows)" }),
      expected,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe("PROTOCOL_DRIFT");
  });

  it("refuses a binding whose session exposes any tool surface", () => {
    const result = buildBindingReport(facts({ toolIds: ["shell"] }), expected);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe("TOOL_SURFACE_PRESENT");
    expect(result.failure.detail).toContain("shell");
  });

  it("never reports an empty tool list it did not observe", () => {
    // The failure path above is what makes the success path meaningful: toolIds: [] in a report
    // means the session was observed to expose none, not that nobody looked.
    const result = buildBindingReport(facts({ permissionCeiling: ["files.write"] }), expected);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe("TOOL_SURFACE_PRESENT");
  });

  it("rejects incomplete handshake facts rather than defaulting them", () => {
    const result = buildBindingReport(facts({ reportedModel: "" }), expected);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe("FACTS_INCOMPLETE");
  });

  it("fingerprints the same facts identically and different facts differently", () => {
    const first = buildBindingReport(facts(), expected);
    const again = buildBindingReport(facts(), expected);
    const otherRole = buildBindingReport(
      facts({ roleId: "release-reviewer", agentId: "agent_5", bindingId: "binding_5" }),
      { ...expected, promotedSourceSha256: "source-release-reviewer" },
    );

    expect(first.ok && again.ok && otherRole.ok).toBe(true);
    if (!first.ok || !again.ok || !otherRole.ok) return;
    expect(first.report.materialFingerprint).toBe(again.report.materialFingerprint);
    expect(first.report.materialFingerprint).not.toBe(otherRole.report.materialFingerprint);
  });

  it("binds the fingerprint to the promoted contract, not only to the session", () => {
    const first = buildBindingReport(facts(), expected);
    const differentContract = buildBindingReport(facts(), {
      ...expected,
      promotedOverlaySha256: "overlay-changed",
    });

    expect(first.ok && differentContract.ok).toBe(true);
    if (!first.ok || !differentContract.ok) return;
    // Same live session, different promoted contract. If the fingerprint ignored the contract, a
    // binding could survive a promotion change that it was never approved against.
    expect(first.report.materialFingerprint).not.toBe(differentContract.report.materialFingerprint);
  });
});
