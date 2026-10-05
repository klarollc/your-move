import { executeWorkCommand, type WorkCommand } from "@cuckcode/application";
import type { BoundedWorkContract } from "@cuckcode/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  CONTRACT_DRAFTER_MODEL,
  CONTRACT_DRAFTER_PROCEDURE_ID,
  CONTRACT_DRAFTER_RUNTIME,
  createContractDraftService,
  type ContractDraftSessionAdapter,
} from "./contract-draft-service.js";
import { stableStringify } from "@cuckcode/domain";
import { createHash } from "node:crypto";

const NOW = "2026-10-05T12:00:00.000Z";
const candidate: BoundedWorkContract = {
  outcome: "Implement slugify",
  exclusions: ["Do not change unrelated routes"],
  acceptanceCriteria: ["slugify.test.ts passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Run the focused test" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["Stop if the focused test fails"],
  definitionOfDone: "The test passes and the diff is reviewed",
  contextRefs: [],
  maxTurns: 3,
};

const capture = (
  over: Partial<Awaited<ReturnType<ContractDraftSessionAdapter["capture"]>>> = {},
) => ({
  providerSessionId: "provider_session_1",
  providerTurnId: "provider_turn_1",
  status: "completed" as const,
  assistantText: JSON.stringify(candidate),
  ...over,
});

const fakeAdapter = (
  run: ContractDraftSessionAdapter["capture"] = async () => capture(),
): ContractDraftSessionAdapter => ({ kind: "test-fake", capture: run });

const request = {
  managerSessionId: "manager_session_1",
  projectId: "project_alpha",
  expectedRevision: 7,
  description: "Add a slug helper and prove it with a focused test.",
};

describe("contract draft session service", () => {
  it("pins the approved procedure, model, and Codex runtime regardless of adapter input", async () => {
    const adapter = fakeAdapter(
      vi.fn(async (input) => {
        expect(input.procedureId).toBe(CONTRACT_DRAFTER_PROCEDURE_ID);
        expect(input.model).toBe(CONTRACT_DRAFTER_MODEL);
        expect(input.runtime).toBe(CONTRACT_DRAFTER_RUNTIME);
        expect(input.procedure).toContain("contract-drafter-v1");
        return capture();
      }),
    );
    const service = createContractDraftService({
      mode: "test",
      adapter,
      now: () => NOW,
      createId: () => "draft_test_1",
    });

    const result = await service.create(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate).toEqual(candidate);
    expect(result.provenance).toMatchObject({
      draftId: "draft_test_1",
      procedureId: "contract-drafter-v1",
      runtime: "@openai/codex@0.157.1",
      model: "gpt-6.1-sol",
      providerSessionId: "provider_session_1",
      providerTurnId: "provider_turn_1",
    });
    expect(result.provenance.requestSha256).toBe(
      createHash("sha256")
        .update(stableStringify({ description: request.description }))
        .digest("hex"),
    );
    expect(result.provenance.candidateSha256).toBe(
      createHash("sha256").update(stableStringify(candidate)).digest("hex"),
    );
    expect(result.provenance.procedureSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("binds the candidate only to the completed captured assistant turn", async () => {
    const adapter = fakeAdapter(async () =>
      capture({ providerTurnId: "turn_other", status: "failed" }),
    );
    const service = createContractDraftService({
      mode: "test",
      adapter,
      now: () => NOW,
      createId: () => "draft_test_2",
    });

    await expect(service.create(request)).resolves.toMatchObject({
      ok: false,
      code: "CONTRACT_DRAFT_CAPTURE_INVALID",
    });
  });

  it("refuses a capture that omits either provider session or turn identity", async () => {
    const service = createContractDraftService({
      mode: "test",
      adapter: fakeAdapter(async () => capture({ providerTurnId: "" })),
      now: () => NOW,
      createId: () => "draft_test_capture_missing_id",
    });

    await expect(service.create(request)).resolves.toMatchObject({
      ok: false,
      code: "CONTRACT_DRAFT_CAPTURE_INVALID",
    });
    expect(service.pendingReceiptCount).toBe(0);
  });

  it("refuses a captured assistant response that is not a bounded contract", async () => {
    const service = createContractDraftService({
      mode: "test",
      adapter: fakeAdapter(async () =>
        capture({ assistantText: JSON.stringify({ ...candidate, maxTurns: 0 }) }),
      ),
      now: () => NOW,
      createId: () => "draft_test_3",
    });

    await expect(service.create(request)).resolves.toMatchObject({
      ok: false,
      code: "CONTRACT_DRAFT_SCHEMA_INVALID",
    });
  });

  it("fails closed on malformed output without a receipt or template fallback", async () => {
    const service = createContractDraftService({
      mode: "test",
      adapter: fakeAdapter(async () => capture({ assistantText: "not json" })),
      now: () => NOW,
      createId: vi.fn(() => "draft_test_4"),
    });

    await expect(service.create(request)).resolves.toMatchObject({ ok: false });
    expect(service.pendingReceiptCount).toBe(0);
  });

  it("does not fall back or issue a receipt after timeout or provider failure", async () => {
    const adapter = fakeAdapter(
      vi.fn(async () => {
        throw new Error("TURN_HARD_TIMEOUT");
      }),
    );
    const service = createContractDraftService({
      mode: "test",
      adapter,
      now: () => NOW,
      createId: () => "draft_test_5",
    });

    await expect(service.create(request)).resolves.toMatchObject({
      ok: false,
      code: "CONTRACT_DRAFT_SESSION_FAILED",
    });
    expect(adapter.capture).toHaveBeenCalledTimes(1);
    expect(service.pendingReceiptCount).toBe(0);
  });

  it("isolates fake receipts from production command authorization", async () => {
    const service = createContractDraftService({
      mode: "test",
      adapter: fakeAdapter(),
      now: () => NOW,
      createId: () => "draft_test_6",
    });
    const result = await service.create(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resolved = service.resolveForCommand(result.receiptHandle, request);
    expect(resolved).toMatchObject({ kind: "test-fake", testOnly: true });

    const command: WorkCommand = {
      commandId: "cmd_fake_draft",
      projectId: request.projectId,
      expectedRevision: request.expectedRevision,
      actor: { actorType: "manager", actorId: "manager_nate" },
      intent: "create",
      workItemId: "work_fake_draft",
      contract: candidate,
    };
    const outcome = executeWorkCommand({
      log: [],
      currentRevision: request.expectedRevision,
      now: NOW,
      command,
      trustedContext: {
        authenticatedManagerSessionId: request.managerSessionId,
        contractDraftReceipt: resolved as never,
      },
    });

    expect(outcome).toMatchObject({ ok: false, code: "CONTRACT_DRAFT_RECEIPT_SOURCE" });
  });

  it("refuses to install the fake adapter outside explicit test mode", () => {
    expect(() =>
      createContractDraftService({
        mode: "production",
        adapter: fakeAdapter(),
        now: () => NOW,
        createId: () => "draft_test_7",
      }),
    ).toThrow("CONTRACT_DRAFT_TEST_ADAPTER_FORBIDDEN");
  });

  it("binds a transient receipt to the manager, project, revision, and expiry", async () => {
    let now = NOW;
    const service = createContractDraftService({
      mode: "test",
      adapter: fakeAdapter(),
      now: () => now,
      createId: () => "draft_test_bound_receipt",
    });
    const result = await service.create(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      service.resolveForCommand(result.receiptHandle, {
        ...request,
        managerSessionId: "another_manager_session",
      }),
    ).toBeUndefined();
    expect(
      service.resolveForCommand(result.receiptHandle, { ...request, projectId: "project_other" }),
    ).toBeUndefined();
    expect(
      service.resolveForCommand(result.receiptHandle, { ...request, expectedRevision: 8 }),
    ).toBeUndefined();

    now = "2026-10-05T12:10:00.000Z";
    expect(service.resolveForCommand(result.receiptHandle, request)).toBeUndefined();
  });
});
