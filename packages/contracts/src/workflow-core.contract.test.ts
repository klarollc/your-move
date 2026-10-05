import { describe, expect, it } from "vitest";

import { eventKinds, parseProjectEvent } from "./events.js";
import { validateWorkCreatedPayload } from "./work-contract.js";

const coreEventValidatorsPath = "./work-contract-events.js";
const coreEventValidators: Record<string, unknown> | null = await import(coreEventValidatorsPath)
  .then((module) => module as unknown as Record<string, unknown>)
  .catch(() => null);
const evidenceValidatorsPath = "./work-payloads.js";
const evidenceValidators = (await import(evidenceValidatorsPath)) as unknown as Record<
  string,
  unknown
>;

const validate = (module: Record<string, unknown> | null, name: string, payload: unknown) => {
  const validator = module?.[name];
  if (typeof validator !== "function") return { ok: false, issues: [`${name} is not implemented`] };
  return (validator as (value: unknown) => { ok: boolean; issues?: string[] })(payload);
};

const workContract = (over: Record<string, unknown> = {}) => ({
  outcome: "Implement the bounded change",
  exclusions: [],
  acceptanceCriteria: ["the focused checks pass"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Focused test evidence" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["the turn budget is exhausted"],
  definitionOfDone: "the manager accepts verified evidence",
  contextRefs: [],
  ...over,
});

const versions = [
  { evidenceId: "evidence_build", version: 2 },
  { evidenceId: "evidence_test", version: 1 },
];

const event = (kind: string, payload: Record<string, unknown>, source = "manager") => ({
  schemaVersion: 1,
  eventId: "event_contract",
  projectId: "project_alpha",
  workItemId: "work_alpha",
  kind,
  occurredAt: "2026-10-04T12:00:00.000Z",
  receivedAt: "2026-10-04T12:00:00.000Z",
  source,
  trust: "verified",
  payload,
});

const createdV4Event = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  eventId: "event_work_created_v4",
  projectId: "project_alpha",
  workItemId: "work_contract_01",
  kind: "work.created",
  occurredAt: "2026-10-05T12:00:00.000Z",
  receivedAt: "2026-10-05T12:00:00.000Z",
  source: "manager",
  trust: "verified",
  actor: { actorType: "manager", actorId: "manager_nate" },
  payload: {
    payloadVersion: 4,
    workItemId: "work_contract_01",
    outcome: "Deliver the manager-approved outcome",
    requiredEvidenceKinds: ["test-run"],
    contract: workContract({ maxTurns: 5 }),
    contractDraft: {
      candidate: workContract({ outcome: "The agent's initial candidate", maxTurns: 4 }),
      provenance: {
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
      },
    },
  },
  ...over,
});

describe("approved workflow-core event vocabulary", () => {
  it("requires manager envelope attribution for contract-draft-backed work.created v4", () => {
    const valid = createdV4Event();
    expect(parseProjectEvent(valid)).toMatchObject({
      ok: true,
      value: {
        source: "manager",
        trust: "verified",
        actor: { actorType: "manager", actorId: "manager_nate" },
      },
    });

    for (const invalid of [
      { ...valid, actor: undefined },
      { ...valid, actor: { actorType: "agent", actorId: "agent_engineer" } },
      { ...valid, source: "adapter" },
      { ...valid, trust: "reported" },
    ]) {
      expect(parseProjectEvent(invalid).ok).toBe(false);
    }
  });

  it("retains actorless historical work.created v1-v3 envelope compatibility", () => {
    const legacy = event("work.created", {
      payloadVersion: 3,
      workItemId: "work_alpha",
      outcome: "Historical work",
      requiredEvidenceKinds: ["test-run"],
      contract: workContract({ maxTurns: 4 }),
    });
    expect(parseProjectEvent(legacy).ok).toBe(true);
  });

  it("adds only the approved canonical events, not derived or rejected prototype names", () => {
    for (const kind of [
      "work.turns_granted",
      "work.rescoped",
      "work.closed_incomplete",
      "work.ruling_recorded",
      "work.nudged",
      "work.nudge_suppressed",
      "ruling.withdrawn",
    ]) {
      expect(eventKinds).toContain(kind);
    }
    for (const kind of [
      "evidence.rejected",
      "work.turns_exhausted",
      "work.deferred",
      "work.resurfaced",
    ]) {
      expect(eventKinds).not.toContain(kind);
    }
  });

  it.each([
    ["work.turns_granted", { workItemId: "work_alpha", turnsGranted: 2, budgetRevision: 1 }],
    [
      "work.rescoped",
      {
        workItemId: "work_alpha",
        expectedContractRevision: 1,
        contractRevision: 2,
        contract: workContract({ maxTurns: 8 }),
      },
    ],
    ["work.closed_incomplete", { workItemId: "work_alpha", fromRevision: 4, reason: "Stopped" }],
    [
      "work.ruling_recorded",
      {
        workItemId: "work_alpha",
        rulingId: "ruling_alpha",
        decision: "accept",
        sourceWorkRevision: 5,
        evidenceVersions: versions,
      },
    ],
    [
      "work.nudged",
      {
        workItemId: "work_alpha",
        roleAssignmentId: "role-assignment_engineer",
        note: "Please report the current blocker.",
      },
    ],
    [
      "work.nudge_suppressed",
      {
        workItemId: "work_alpha",
        disposition: "snooze",
        until: "2026-10-06T12:00:00.000Z",
      },
    ],
    [
      "ruling.withdrawn",
      { workItemId: "work_alpha", rulingId: "ruling_alpha", evidenceVersions: versions },
    ],
  ])("parses a valid %s event and rejects malformed payloads", (kind, payload) => {
    expect(parseProjectEvent(event(kind, payload)).ok).toBe(true);
    const malformed = parseProjectEvent(event(kind, { ...payload, unexpected: true }));
    expect(malformed.ok ? null : malformed.error).toMatchObject({ reason: "invalid_envelope" });
  });

  it("validates positive turn grants and the budget revision they extend", () => {
    const valid = { workItemId: "work_alpha", turnsGranted: 3, budgetRevision: 1 };
    expect(validate(coreEventValidators, "validateWorkTurnsGrantedPayload", valid).ok).toBe(true);
    for (const [invalid, field] of [
      [{ ...valid, turnsGranted: 0 }, "turnsGranted"],
      [{ ...valid, turnsGranted: 1.5 }, "turnsGranted"],
      [{ ...valid, budgetRevision: 0 }, "budgetRevision"],
      [{ ...valid, budgetRevision: -1 }, "budgetRevision"],
      [{ ...valid, workItemId: "alpha" }, "workItemId"],
    ] as const) {
      expect(
        validate(coreEventValidators, "validateWorkTurnsGrantedPayload", invalid).issues,
      ).toContainEqual(expect.stringContaining(field));
    }
  });

  it("requires sequential rescope revisions and a positive budget", () => {
    const valid = {
      workItemId: "work_alpha",
      expectedContractRevision: 1,
      contractRevision: 2,
      contract: workContract({ maxTurns: 8 }),
    };
    expect(validate(coreEventValidators, "validateWorkRescopedPayload", valid).ok).toBe(true);
    expect(
      validate(coreEventValidators, "validateWorkRescopedPayload", {
        ...valid,
        contractRevision: 3,
      }).issues,
    ).toContainEqual(expect.stringContaining("contractRevision"));
    for (const maxTurns of [0, 1.5]) {
      expect(
        validate(coreEventValidators, "validateWorkRescopedPayload", {
          ...valid,
          contract: workContract({ maxTurns }),
        }).issues,
      ).toContainEqual(expect.stringContaining("maxTurns"));
    }
  });

  it("requires a current work revision and non-empty reason to close incomplete", () => {
    const valid = { workItemId: "work_alpha", fromRevision: 4, reason: "The cap was reached." };
    expect(validate(coreEventValidators, "validateWorkClosedIncompletePayload", valid).ok).toBe(
      true,
    );
    expect(
      validate(coreEventValidators, "validateWorkClosedIncompletePayload", {
        ...valid,
        reason: "  ",
      }).issues,
    ).toContainEqual(expect.stringContaining("reason"));
    expect(
      validate(coreEventValidators, "validateWorkClosedIncompletePayload", {
        ...valid,
        fromRevision: -1,
      }).issues,
    ).toContainEqual(expect.stringContaining("fromRevision"));
  });

  it("keeps ruling evidence snapshots sorted, unique, and version-bound", () => {
    const valid = {
      workItemId: "work_alpha",
      rulingId: "ruling_alpha",
      decision: "accept",
      sourceWorkRevision: 5,
      evidenceVersions: versions,
    };
    expect(validate(coreEventValidators, "validateWorkRulingRecordedPayload", valid).ok).toBe(true);
    expect(
      validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
        ...valid,
        evidenceVersions: [...versions].reverse(),
      }).issues,
    ).toContainEqual(expect.stringContaining("evidenceVersions"));
    expect(
      validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
        ...valid,
        evidenceVersions: [...versions, versions[0]],
      }).issues,
    ).toContainEqual(expect.stringContaining("evidenceVersions"));
    expect(
      validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
        ...valid,
        evidenceVersions: [{ evidenceId: "evidence_build", version: 0 }],
      }).issues,
    ).toContainEqual(expect.stringContaining("evidenceVersions"));
  });

  it("requires a reason for exception, send-back, and defer; defer also needs a UTC resurface time", () => {
    const base = {
      workItemId: "work_alpha",
      rulingId: "ruling_alpha",
      sourceWorkRevision: 5,
      evidenceVersions: versions,
    };
    for (const decision of ["accept_with_exception", "send_back", "defer"]) {
      expect(
        validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
          ...base,
          decision,
          reason: "A clear reason.",
        }).ok,
      ).toBe(decision === "defer" ? false : true);
      expect(
        validate(coreEventValidators, "validateWorkRulingRecordedPayload", { ...base, decision })
          .issues,
      ).toContainEqual(expect.stringContaining("reason"));
    }
    expect(
      validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
        ...base,
        decision: "defer",
        reason: "Wait for the dependency.",
        resurfaceAt: "2026-10-06T12:00:00.000Z",
      }).ok,
    ).toBe(true);
    expect(
      validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
        ...base,
        decision: "defer",
        reason: "Wait for the dependency.",
        resurfaceAt: "tomorrow",
      }).issues,
    ).toContainEqual(expect.stringContaining("resurfaceAt"));
    expect(
      validate(coreEventValidators, "validateWorkRulingRecordedPayload", {
        ...base,
        decision: "accept",
        resurfaceAt: "2026-10-06T12:00:00.000Z",
      }).issues,
    ).toContainEqual(expect.stringContaining("resurfaceAt"));
  });

  it("requires a named target assignment and a plain-language nudge note", () => {
    const valid = {
      workItemId: "work_alpha",
      roleAssignmentId: "role-assignment_engineer",
      note: "Please report the current blocker.",
    };
    expect(validate(coreEventValidators, "validateWorkNudgedPayload", valid).ok).toBe(true);
    expect(
      validate(coreEventValidators, "validateWorkNudgedPayload", {
        ...valid,
        roleAssignmentId: "agent_engineer",
      }).issues,
    ).toContainEqual(expect.stringContaining("roleAssignmentId"));
    expect(
      validate(coreEventValidators, "validateWorkNudgedPayload", { ...valid, note: " " }).issues,
    ).toContainEqual(expect.stringContaining("note"));
  });

  it("validates nudge suppression dispositions and absolute UTC expiry", () => {
    const valid = {
      workItemId: "work_alpha",
      disposition: "dismiss",
      until: "2026-10-07T12:00:00.000Z",
    };
    expect(validate(coreEventValidators, "validateWorkNudgeSuppressedPayload", valid).ok).toBe(
      true,
    );
    expect(
      validate(coreEventValidators, "validateWorkNudgeSuppressedPayload", {
        ...valid,
        disposition: "hide_forever",
      }).issues,
    ).toContainEqual(expect.stringContaining("disposition"));
    expect(
      validate(coreEventValidators, "validateWorkNudgeSuppressedPayload", {
        ...valid,
        until: "in two days",
      }).issues,
    ).toContainEqual(expect.stringContaining("until"));
  });

  it("withdraws only a stable ruling id and its canonical evidence snapshot", () => {
    const valid = {
      workItemId: "work_alpha",
      rulingId: "ruling_alpha",
      evidenceVersions: versions,
    };
    expect(validate(coreEventValidators, "validateRulingWithdrawnPayload", valid).ok).toBe(true);
    expect(
      validate(coreEventValidators, "validateRulingWithdrawnPayload", {
        ...valid,
        rulingId: "alpha",
      }).issues,
    ).toContainEqual(expect.stringContaining("rulingId"));
    expect(
      validate(coreEventValidators, "validateRulingWithdrawnPayload", {
        ...valid,
        evidenceVersions: [...versions].reverse(),
      }).issues,
    ).toContainEqual(expect.stringContaining("evidenceVersions"));
  });
});

describe("turn-budget and worktree-digest compatibility", () => {
  const legacyContract = workContract();
  const v1 = { workItemId: "work_legacy", outcome: "Legacy", requiredEvidenceKinds: ["test-run"] };

  it("keeps schema-v1 work.created payloads valid", () => {
    expect(validateWorkCreatedPayload(v1)).toMatchObject({ ok: true });
  });

  it("replays schema-v2 contracts without a turn budget unchanged", () => {
    const result = validateWorkCreatedPayload({
      payloadVersion: 2,
      ...v1,
      outcome: "Legacy bounded contract",
      contract: legacyContract,
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.contract).not.toHaveProperty("maxTurns");
  });

  it("requires a positive integer maxTurns only for schema-v3 work.created", () => {
    const payload = {
      payloadVersion: 3,
      ...v1,
      outcome: "New bounded contract",
      contract: workContract({ maxTurns: 6 }),
    };
    expect(validateWorkCreatedPayload(payload).ok).toBe(true);
    expect(validateWorkCreatedPayload({ ...payload, contract: legacyContract }).ok).toBe(false);
    expect(
      validateWorkCreatedPayload({ ...payload, contract: workContract({ maxTurns: 0 }) }).ok,
    ).toBe(false);
    expect(
      validateWorkCreatedPayload({ ...payload, contract: workContract({ maxTurns: 1.5 }) }).ok,
    ).toBe(false);
  });

  it("accepts old evidence without a worktree digest and validates new lowercase SHA-256 values", () => {
    const evidence = {
      evidenceId: "evidence_test",
      workItemId: "work_alpha",
      kind: "test-run",
      version: 1,
      result: "passed",
    };
    expect(validate(evidenceValidators, "validateEvidenceRecordedPayload", evidence).ok).toBe(true);
    expect(
      validate(evidenceValidators, "validateEvidenceRecordedPayload", {
        ...evidence,
        worktreeSha256: "a".repeat(64),
      }).ok,
    ).toBe(true);
    expect(
      validate(evidenceValidators, "validateEvidenceRecordedPayload", {
        ...evidence,
        worktreeSha256: "A".repeat(64),
      }).issues,
    ).toContainEqual(expect.stringContaining("worktreeSha256"));
    expect(
      validate(evidenceValidators, "validateEvidenceRecordedPayload", {
        ...evidence,
        worktreeSha256: "short",
      }).issues,
    ).toContainEqual(expect.stringContaining("worktreeSha256"));
  });
});
