import { describe, expect, it } from "vitest";

import { validateWorkCreatedPayload, workContractSchema } from "./work-contract.js";

const contract = (over: Record<string, unknown> = {}) => ({
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
  ...over,
});

const draftProvenance = (over: Record<string, unknown> = {}) => ({
  draftId: "draft_contract_01",
  procedureId: "contract-drafter-v1",
  procedureVersion: "1.0.0",
  procedureSha256: "b".repeat(64),
  runtime: "@openai/codex@0.157.1",
  model: "gpt-6.1-sol",
  providerSessionId: "thread_contract_01",
  providerTurnId: "turn_contract_01",
  requestSha256: "c".repeat(64),
  candidateSha256: "d".repeat(64),
  ...over,
});

const createdV4 = (over: Record<string, unknown> = {}) => ({
  payloadVersion: 4,
  workItemId: "work_contract_01",
  outcome: "Deliver the manager-approved outcome",
  requiredEvidenceKinds: ["test-run", "git-status"],
  contract: contract({
    outcome: "Deliver the manager-approved outcome",
    maxTurns: 5,
  }),
  contractDraft: {
    candidate: contract({
      outcome: "Draft outcome from the bounded assistant turn",
      maxTurns: 4,
    }),
    provenance: draftProvenance(),
  },
  ...over,
});

const createdV4WithAgentSource = (over: Record<string, unknown> = {}) => {
  const prior = createdV4();
  return {
    ...prior,
    contractDraft: {
      ...prior.contractDraft,
      provenance: draftProvenance({ draftSource: "agent" }),
    },
    ...over,
  };
};

const createdV4WithManagerSource = (over: Record<string, unknown> = {}) => ({
  ...createdV4(),
  contractDraft: { provenance: { draftSource: "manager" } },
  ...over,
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

  it("accepts the explicit v4 agent variant with a distinct candidate and source provenance", () => {
    const result = validateWorkCreatedPayload(createdV4WithAgentSource());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const draft = result.value.contractDraft;
    expect(draft && "candidate" in draft ? draft.candidate.outcome : undefined).toBe(
      "Draft outcome from the bounded assistant turn",
    );
    expect(result.value.contract?.outcome).toBe("Deliver the manager-approved outcome");
    expect(draft && "candidate" in draft ? draft.candidate : undefined).not.toEqual(
      result.value.contract,
    );
    expect(draft?.provenance).toEqual(draftProvenance({ draftSource: "agent" }));
  });

  it("accepts the strict manager variant without candidate or provider session fields", () => {
    const result = validateWorkCreatedPayload(createdV4WithManagerSource());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractDraft).toEqual({ provenance: { draftSource: "manager" } });
    }
  });

  it("replays the exact existing v4 agent shape with complete candidate and provenance", () => {
    const result = validateWorkCreatedPayload(createdV4());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const draft = result.value.contractDraft;
      expect(draft && "candidate" in draft ? draft.candidate.outcome : undefined).toBe(
        "Draft outcome from the bounded assistant turn",
      );
      expect(draft?.provenance).toEqual(draftProvenance());
    }
  });

  it("rejects mixed, partial, ambiguous, and extra-field v4 source variants", () => {
    const agent = createdV4WithAgentSource();
    const manager = createdV4WithManagerSource();
    const legacy = createdV4();
    for (const invalid of [
      { ...agent, contractDraft: undefined },
      { ...agent, contractDraft: { candidate: agent.contractDraft.candidate } },
      {
        ...agent,
        contractDraft: { ...agent.contractDraft, candidate: { outcome: "partial" } },
      },
      {
        ...agent,
        contractDraft: {
          ...agent.contractDraft,
          provenance: draftProvenance({ draftSource: "agent", procedureSha256: "invalid" }),
        },
      },
      {
        ...agent,
        contractDraft: {
          ...agent.contractDraft,
          provenance: draftProvenance({ draftSource: "agent", model: "gpt-6-astra" }),
        },
      },
      {
        ...agent,
        contractDraft: {
          ...agent.contractDraft,
          provenance: draftProvenance({ draftSource: "agent", unexpected: "browser claim" }),
        },
      },
      {
        ...manager,
        contractDraft: {
          candidate: contract({ maxTurns: 3 }),
          provenance: { draftSource: "manager" },
        },
      },
      {
        ...manager,
        contractDraft: {
          provenance: { draftSource: "manager", providerSessionId: "forged-session" },
        },
      },
      {
        ...agent,
        contractDraft: {
          provenance: draftProvenance({ draftSource: "agent" }),
        },
      },
      {
        ...agent,
        contractDraft: {
          candidate: agent.contractDraft.candidate,
          provenance: draftProvenance({ draftSource: "agent", providerTurnId: undefined }),
        },
      },
      {
        ...legacy,
        contractDraft: {
          candidate: legacy.contractDraft.candidate,
          provenance: draftProvenance({ providerTurnId: undefined }),
        },
      },
      {
        ...manager,
        contractDraft: {
          provenance: { draftSource: "agent" },
          browserClaim: true,
        },
      },
      {
        ...manager,
        contractDraft: { provenance: { draftSource: "unknown" } },
      },
    ]) {
      expect(validateWorkCreatedPayload(invalid).ok).toBe(false);
    }
  });

  it("keeps v1-v3 payload meaning unchanged and refuses draft fields on v3", () => {
    const v2 = {
      ...v1,
      payloadVersion: 2,
      requiredEvidenceKinds: ["test-run", "git-status"],
      contract: contract(),
    };
    const v3 = {
      ...v1,
      payloadVersion: 3,
      requiredEvidenceKinds: ["test-run", "git-status"],
      contract: contract({ maxTurns: 5 }),
    };
    expect(validateWorkCreatedPayload(v1)).toMatchObject({ ok: true, value: v1 });
    expect(validateWorkCreatedPayload(v2)).toMatchObject({
      ok: true,
      value: {
        workItemId: v2.workItemId,
        outcome: v2.outcome,
        requiredEvidenceKinds: v2.requiredEvidenceKinds,
        contract: contract(),
      },
    });
    expect(validateWorkCreatedPayload(v3)).toMatchObject({
      ok: true,
      value: {
        workItemId: v3.workItemId,
        outcome: v3.outcome,
        requiredEvidenceKinds: v3.requiredEvidenceKinds,
        contract: contract({ maxTurns: 5 }),
      },
    });
    expect(validateWorkCreatedPayload({ ...v3, contractDraft: createdV4().contractDraft }).ok).toBe(
      false,
    );
  });
});
