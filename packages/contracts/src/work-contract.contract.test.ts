import { describe, expect, it } from "vitest";

import { validateWorkCreatedPayload, workContractSchema } from "./work-contract.js";

const contract = () => ({
  outcome: "Implement slugify so the pre-written test passes",
  exclusions: ["no other files", "no new dependencies"],
  acceptanceCriteria: ["the test is green when run by the owner"],
  dependencies: [],
  evidenceObligations: [
    { kind: "test-run", description: "RED then GREEN, owner-run" },
    { kind: "git-status", description: "worktree status after each turn" },
  ],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["posture mismatch", "turn cap"],
  definitionOfDone: "owner acceptance through the surface under test",
  contextRefs: [{ path: "src/slugify.ts", sha256: "a".repeat(64) }],
});

const refusal = (value: unknown) => {
  const result = workContractSchema.safeParse(value);
  return result.success ? null : result.error.issues.map((i) => i.path.join(".")).join(",");
};

describe("work contract (D-26)", () => {
  it("accepts a complete contract", () => {
    expect(workContractSchema.safeParse(contract()).success).toBe(true);
  });

  it.each([
    "outcome",
    "exclusions",
    "acceptanceCriteria",
    "dependencies",
    "evidenceObligations",
    "permissionCeiling",
    "stopConditions",
    "definitionOfDone",
    "contextRefs",
  ])("refuses a contract missing %s, naming the field", (field) => {
    const value: Record<string, unknown> = contract();
    delete value[field];
    expect(refusal(value)).toContain(field);
  });

  it("refuses empty acceptance criteria and empty stop conditions", () => {
    expect(refusal({ ...contract(), acceptanceCriteria: [] })).toContain("acceptanceCriteria");
    expect(refusal({ ...contract(), stopConditions: [] })).toContain("stopConditions");
  });

  it("refuses empty evidence obligations and duplicate evidence kinds", () => {
    expect(refusal({ ...contract(), evidenceObligations: [] })).toContain("evidenceObligations");
    const dup = { kind: "test-run", description: "again" };
    expect(refusal({ ...contract(), evidenceObligations: [dup, dup] })).toContain(
      "evidenceObligations",
    );
  });

  it("refuses an unknown field", () => {
    expect(refusal({ ...contract(), extra: true })).not.toBeNull();
  });

  it("refuses a permission ceiling that asks for full access or network", () => {
    const ceiling = contract().permissionCeiling;
    expect(
      refusal({
        ...contract(),
        permissionCeiling: { ...ceiling, sandboxMode: "danger-full-access" },
      }),
    ).toContain("permissionCeiling");
    expect(
      refusal({ ...contract(), permissionCeiling: { ...ceiling, networkAccess: true } }),
    ).toContain("permissionCeiling");
  });

  it("refuses a context reference with a malformed digest", () => {
    expect(refusal({ ...contract(), contextRefs: [{ path: "a.ts", sha256: "nope" }] })).toContain(
      "contextRefs",
    );
  });
});

describe("work.created payload", () => {
  const v1 = { workItemId: "work_a", outcome: "x", requiredEvidenceKinds: ["browser"] };

  it("keeps version 1 (no version field, no contract) valid", () => {
    const result = validateWorkCreatedPayload(v1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.contract).toBeUndefined();
  });

  it("accepts version 2 with a contract whose evidence kinds match", () => {
    const result = validateWorkCreatedPayload({
      payloadVersion: 2,
      workItemId: "work_a",
      outcome: contract().outcome,
      requiredEvidenceKinds: ["test-run", "git-status"],
      contract: contract(),
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.contract?.definitionOfDone).toBe(contract().definitionOfDone);
  });

  it("refuses version 2 without a contract", () => {
    const result = validateWorkCreatedPayload({ ...v1, payloadVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(" ")).toContain("contract");
  });

  it("refuses version 2 whose requiredEvidenceKinds differ from the contract's", () => {
    const result = validateWorkCreatedPayload({
      payloadVersion: 2,
      workItemId: "work_a",
      outcome: contract().outcome,
      requiredEvidenceKinds: ["browser"],
      contract: contract(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(" ")).toContain("requiredEvidenceKinds");
  });

  it("refuses an unsupported payload version", () => {
    const result = validateWorkCreatedPayload({ ...v1, payloadVersion: 9 });
    expect(result.ok).toBe(false);
  });
});
