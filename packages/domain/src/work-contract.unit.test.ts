import { describe, expect, it } from "vitest";

import { reduceWorkTruth } from "./work-truth.js";

const contract = () => ({
  outcome: "Implement slugify",
  exclusions: [],
  acceptanceCriteria: ["the test is green"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "RED then GREEN" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["turn cap"],
  definitionOfDone: "owner acceptance",
  contextRefs: [],
});

const created = (payload: Record<string, unknown>) => ({
  schemaVersion: 1,
  eventId: "event_created",
  projectId: "project_alpha",
  kind: "work.created",
  occurredAt: "2026-10-04T10:00:00.000Z",
  receivedAt: "2026-10-04T10:00:00.000Z",
  source: "manager",
  trust: "verified",
  payload,
});

describe("work.created with a contract", () => {
  it("stores a version 2 contract on the work item", () => {
    const state = reduceWorkTruth([
      created({
        payloadVersion: 2,
        workItemId: "work_slug",
        outcome: "Implement slugify",
        requiredEvidenceKinds: ["test-run"],
        contract: contract(),
      }),
    ]);
    expect(state.issues).toEqual([]);
    expect(state.workItems.work_slug?.contract).toEqual(contract());
  });

  it("keeps a version 1 item exactly as before: no contract key", () => {
    const state = reduceWorkTruth([
      created({ workItemId: "work_old", outcome: "x", requiredEvidenceKinds: ["browser"] }),
    ]);
    expect(state.issues).toEqual([]);
    expect(state.workItems.work_old).toBeDefined();
    expect("contract" in (state.workItems.work_old ?? {})).toBe(false);
  });

  it("reports a malformed version 2 payload and creates no item", () => {
    const state = reduceWorkTruth([
      created({
        payloadVersion: 2,
        workItemId: "work_bad",
        outcome: "x",
        requiredEvidenceKinds: ["test-run"],
        contract: { ...contract(), acceptanceCriteria: [] },
      }),
    ]);
    expect(state.issues.map(({ code }) => code)).toEqual(["MALFORMED_WORK_EVENT"]);
    expect(state.workItems.work_bad).toBeUndefined();
  });
});
