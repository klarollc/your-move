import { describe, expect, it } from "vitest";

import {
  buildBindingReport,
  collectHandshakeFacts,
  type BindingExpectation,
  type HandshakeFacts,
} from "./binding.js";

const posture = {
  type: "readOnly",
  networkAccess: false,
  approvalPolicy: "never",
  multiAgentMode: "explicitRequestOnly",
} as const;

const expected: BindingExpectation = {
  requestedModel: "gpt-5.6-luna",
  expectedReasoningEffort: "medium",
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
    reportedReasoningEffort: "medium",
    toolIds: [],
    permissionCeiling: [],
    sandboxPosture: posture,
    ...overrides,
  };
}

describe("codex binding report", () => {
  it("collects facts only from observed handshake responses", () => {
    expect(
      collectHandshakeFacts({
        agentId: "agent_0",
        bindingId: "binding_0",
        roleId: "delivery-lead",
        userAgent: "codex-cli 0.146.0 (windows)",
        auth: { ok: true, mode: "chatgpt" },
        threadStart: {
          model: "gpt-5.6-luna",
          reasoningEffort: "medium",
          sandbox: { type: "readOnly", networkAccess: false },
          approvalPolicy: "never",
          multiAgentMode: "explicitRequestOnly",
          instructionSources: ["C:/controlled/AGENTS.md"],
        },
      }),
    ).toEqual(facts({ toolIds: null }));
  });
  it("builds a candidate report when every fact matches what was approved", () => {
    const result = buildBindingReport(facts(), expected);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.status).toBe("candidate");
    expect(result.report.model).toBe("gpt-5.6-luna");
    expect(result.report.authMode).toBe("chatgpt");
    expect(result.report.protocolVersion).toBe("0.146.0");
    expect(result.report.reasoningEffort).toBe("medium");
    expect(result.report.sandboxPosture).toEqual(posture);
    expect(result.report.materialFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("builds a binding from an authored role's reviewed content digest", () => {
    const authored = {
      requestedModel: "gpt-5.6-luna",
      expectedReasoningEffort: "medium",
      expectedAuthMode: "chatgpt",
      protocolVersion: "0.146.0",
      promotedContentSha256: "authored-delivery-lead-v1",
    } satisfies BindingExpectation;

    const result = buildBindingReport(facts(), authored);
    const changed = buildBindingReport(facts(), {
      ...authored,
      promotedContentSha256: "authored-delivery-lead-v2",
    });

    expect(result.ok && changed.ok).toBe(true);
    if (!result.ok || !changed.ok) return;
    expect(result.report.materialFingerprint).not.toBe(changed.report.materialFingerprint);
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
  it("records how the model was configured, not only which model it was", () => {
    // DF-008: two runs of the same model at different efforts produced identical reports. The
    // runtime volunteers the effort at thread/start, and the owner chose it deliberately, so a
    // record that cannot express it cannot distinguish an approved run from an unapproved one.
    const drifted = buildBindingReport(facts({ reportedReasoningEffort: "high" }), expected);

    expect(drifted.ok).toBe(false);
    if (drifted.ok) return;
    expect(drifted.failure.code).toBe("EFFORT_DRIFT");
    expect(drifted.failure.detail).toContain("high");
  });

  it("accepts a runtime that reports no effort without inventing one", () => {
    const result = buildBindingReport(facts({ reportedReasoningEffort: null }), {
      ...expected,
      expectedReasoningEffort: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // null is a statement that the runtime said nothing, which is different from a default.
    expect(result.report.reasoningEffort).toBeNull();
  });

  it("distinguishes a tool surface it could not enumerate from one observed to be empty", () => {
    const unenumerable = buildBindingReport(facts({ toolIds: null }), expected);
    const observedEmpty = buildBindingReport(facts({ toolIds: [] }), expected);

    expect(unenumerable.ok && observedEmpty.ok).toBe(true);
    if (!unenumerable.ok || !observedEmpty.ok) return;
    // The Codex adapter enumerates nothing anywhere in its handshake, so claiming [] would assert
    // an observation nobody made. null says so; [] keeps meaning "looked, found none".
    expect(unenumerable.report.toolIds).toBeNull();
    expect(observedEmpty.report.toolIds).toEqual([]);
  });

  it("records what the session was confined to, not only what it exposed", () => {
    const result = buildBindingReport(facts(), expected);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // permissionCeiling means capability beyond baseline; the posture means the bounds the runtime
    // reported. An empty ceiling is only meaningful next to a posture that says what was enforced.
    expect(result.report.permissionCeiling).toEqual([]);
    expect(result.report.sandboxPosture.networkAccess).toBe(false);
    expect(result.report.sandboxPosture.type).toBe("readOnly");
  });

  it("binds the fingerprint to the effort and the posture, not only to the model", () => {
    const base = buildBindingReport(facts(), expected);
    const looserPosture = buildBindingReport(
      facts({ sandboxPosture: { ...posture, networkAccess: true } }),
      expected,
    );
    const otherEffort = buildBindingReport(facts({ reportedReasoningEffort: "low" }), {
      ...expected,
      expectedReasoningEffort: "low",
    });

    expect(base.ok && looserPosture.ok && otherEffort.ok).toBe(true);
    if (!base.ok || !looserPosture.ok || !otherEffort.ok) return;
    // A session granted network access is not the session that was approved, and a binding must
    // not survive that change with an unchanged fingerprint.
    expect(base.report.materialFingerprint).not.toBe(looserPosture.report.materialFingerprint);
    expect(base.report.materialFingerprint).not.toBe(otherEffort.report.materialFingerprint);
  });
});
