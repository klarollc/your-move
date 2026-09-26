import { describe, expect, it } from "vitest";

import type { KickoffBriefing, RuntimeBindingReport } from "@cuckcode/contracts";

import { runPreflightedKickoff, type PreparedKickoffBinding } from "./kickoff-harness.js";

const ROLE_IDS = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
];

const briefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_harness",
  projectId: "project_harness",
  briefingVersion: 1,
  goal: "Exercise the bounded kickoff machinery.",
  constraints: ["No implementation"],
  permissions: ["project.read"],
  evidenceFloor: ["unit"],
  knowledgeSnapshotId: "snapshot_harness",
  managerNonNegotiables: ["No external effects"],
  activeRoleIds: ROLE_IDS,
};

function bindings(): PreparedKickoffBinding[] {
  return ROLE_IDS.map((roleId, index) => {
    const agentId = `agent_${index}`;
    const bindingId = `binding_${index}`;
    const contentSha256 = `content-${roleId}`;
    return {
      displayName: `Role ${index}`,
      createdAt: "2026-09-12T00:00:00.000Z",
      providerIds: { account: `account_${index}` },
      report: report(agentId, bindingId),
      candidate: {
        roleId,
        agentId,
        bindingId,
        qualified: true,
        roleContractVersion: `content:${contentSha256}`,
        evaluatedAt: 1000,
        exceptionExpiries: [],
      },
    };
  });
}

function report(agentId: string, bindingId: string): RuntimeBindingReport {
  return {
    bindingId,
    agentId,
    adapterId: "fake-runtime",
    adapterVersion: "1.0.0",
    protocolVersion: "1.0.0",
    authMode: "chatgpt",
    model: "fake-model",
    reasoningEffort: "medium",
    capabilityIds: [],
    toolIds: [],
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
}

function promoted() {
  return ROLE_IDS.map((roleId) => ({ roleId, contentSha256: `content-${roleId}` }));
}

describe("preflighted kickoff harness", () => {
  it("records all six candidate bindings but never asks a runtime turn when preflight fails", async () => {
    const registered: string[] = [];
    const appended: string[] = [];
    const asked: string[] = [];

    const result = await runPreflightedKickoff({
      briefing,
      preparedBindings: bindings(),
      promoted: [],
      now: 2000,
      maxQualificationAgeMs: 10_000,
      synthesisRoleId: "delivery-lead",
      trustStore: {
        registerAgent: ({ agentId }) => registered.push(agentId),
        appendBinding: ({ report }) => appended.push(report.bindingId),
      },
      runTurn: async (request) => {
        asked.push(request.roleId);
        return { ok: false, code: "UNEXPECTED", detail: "preflight should have stopped first" };
      },
    });

    expect(registered).toHaveLength(6);
    expect(appended).toHaveLength(6);
    expect(asked).toEqual([]);
    expect(result).toMatchObject({
      status: "preflight_failed",
      failures: expect.arrayContaining([expect.objectContaining({ code: "ROLE_NOT_PROMOTED" })]),
    });
  });

  it("hands a passing, persisted roster to the bounded kickoff runner", async () => {
    const asked: string[] = [];

    const result = await runPreflightedKickoff({
      briefing,
      preparedBindings: bindings(),
      promoted: promoted(),
      now: 2000,
      maxQualificationAgeMs: 10_000,
      synthesisRoleId: "delivery-lead",
      trustStore: { registerAgent: () => {}, appendBinding: () => {} },
      runTurn: async (request) => {
        asked.push(request.roleId);
        return { ok: false, code: "FIXTURE_FAILURE", detail: "deterministic fixture stop" };
      },
    });

    expect(result).toMatchObject({ status: "completed", result: { turnsUsed: 6 } });
    expect(asked).toEqual(ROLE_IDS);
  });

  it("refuses a report that names a different runtime binding than the preflight candidate", async () => {
    const prepared = bindings();
    const implementation = prepared.at(2);
    if (!implementation) throw new Error("FIXTURE_ROLE_MISSING");
    prepared.splice(2, 1, {
      ...implementation,
      report: { ...implementation.report, bindingId: "binding_from_another_session" },
    });
    const appended: string[] = [];
    const asked: string[] = [];

    const result = await runPreflightedKickoff({
      briefing,
      preparedBindings: prepared,
      promoted: promoted(),
      now: 2000,
      maxQualificationAgeMs: 10_000,
      synthesisRoleId: "delivery-lead",
      trustStore: {
        registerAgent: () => {},
        appendBinding: ({ report }) => appended.push(report.bindingId),
      },
      runTurn: async (request) => {
        asked.push(request.roleId);
        return { ok: false, code: "UNEXPECTED", detail: "mismatch should stop first" };
      },
    });

    expect(result).toMatchObject({ status: "binding_mismatch" });
    expect(appended).toEqual([]);
    expect(asked).toEqual([]);
  });
});
