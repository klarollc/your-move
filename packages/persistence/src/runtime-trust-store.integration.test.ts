import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openProjectStore } from "./project-store.js";
import { createRuntimeTrustStore } from "./runtime-trust-store.js";

const roots: string[] = [];
function root() {
  const value = mkdtempSync(join(tmpdir(), "cuckcode-runtime-trust-"));
  roots.push(value);
  return value;
}
afterEach(() => {
  for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});

const binding = {
  bindingId: "binding_1",
  agentId: "agent_1",
  adapterId: "codex",
  adapterVersion: "0.146.0",
  protocolVersion: "0.146.0",
  authMode: "chatgpt" as const,
  model: "configured-model",
  reasoningEffort: "medium",
  capabilityIds: ["edit"],
  toolIds: ["apply_patch"],
  permissionCeiling: ["project.read", "project.write"],
  sandboxPosture: {
    type: "readOnly",
    networkAccess: false,
    approvalPolicy: "never",
    multiAgentMode: "explicitRequestOnly",
  },
  materialFingerprint: "a".repeat(64),
  status: "candidate" as const,
};

describe("runtime trust persistence", () => {
  it("keeps CuckCode identity authoritative and versions material bindings", () => {
    const project = openProjectStore(root());
    const trust = createRuntimeTrustStore(project);
    trust.registerAgent({
      agentId: "agent_1",
      displayName: "Aster",
      createdAt: "2026-08-13T18:00:00.000Z",
    });
    trust.appendBinding({
      report: binding,
      providerIds: { account: "provider_account_1" },
      createdAt: "2026-08-13T18:01:00.000Z",
    });
    trust.recordQualification({
      qualificationId: "qualification_1",
      agentId: "agent_1",
      bindingId: "binding_1",
      roleId: "delivery-lead",
      suiteVersion: "1",
      status: "passed",
      evidenceHash: "b".repeat(64),
      recordedAt: "2026-08-13T18:02:00.000Z",
    });
    trust.appendBinding({
      report: {
        ...binding,
        bindingId: "binding_2",
        model: "changed-model",
        materialFingerprint: "c".repeat(64),
      },
      providerIds: { account: "provider_account_1" },
      createdAt: "2026-08-13T18:03:00.000Z",
    });

    expect(trust.agentTruth("agent_1")).toMatchObject({
      agentId: "agent_1",
      displayName: "Aster",
      currentBindingId: "binding_2",
      currentBindingStatus: "candidate",
      qualifications: [{ qualificationId: "qualification_1", effectiveStatus: "stale" }],
    });
    project.close();
  });

  it("rejects provider-ID impersonation and credential-bearing reports", () => {
    const project = openProjectStore(root());
    const trust = createRuntimeTrustStore(project);
    trust.registerAgent({
      agentId: "agent_1",
      displayName: "Aster",
      createdAt: "2026-08-13T18:00:00.000Z",
    });
    trust.registerAgent({
      agentId: "agent_2",
      displayName: "Birch",
      createdAt: "2026-08-13T18:00:00.000Z",
    });
    trust.appendBinding({
      report: binding,
      providerIds: { account: "provider_account_1" },
      createdAt: "2026-08-13T18:01:00.000Z",
    });

    expect(() =>
      trust.appendBinding({
        report: { ...binding, bindingId: "binding_2", agentId: "agent_2" },
        providerIds: { account: "provider_account_1" },
        createdAt: "2026-08-13T18:02:00.000Z",
      }),
    ).toThrow("PROVIDER_ID_IMPERSONATION");
    expect(() =>
      trust.appendBinding({
        report: { ...binding, bindingId: "binding_3", apiKey: "sk-secret-canary" } as never,
        providerIds: {},
        createdAt: "2026-08-13T18:02:00.000Z",
      }),
    ).toThrow("CREDENTIAL_DATA_FORBIDDEN");
    project.close();
  });

  it("preserves binding provenance across restart", () => {
    const projectRoot = root();
    let project = openProjectStore(projectRoot);
    let trust = createRuntimeTrustStore(project);
    trust.registerAgent({
      agentId: "agent_1",
      displayName: "Aster",
      createdAt: "2026-08-13T18:00:00.000Z",
    });
    trust.appendBinding({
      report: binding,
      providerIds: {},
      createdAt: "2026-08-13T18:01:00.000Z",
    });
    project.close();

    project = openProjectStore(projectRoot);
    trust = createRuntimeTrustStore(project);
    expect(trust.agentTruth("agent_1")).toMatchObject({
      currentBindingId: "binding_1",
      bindingVersion: 1,
    });
    project.close();
  });
});
