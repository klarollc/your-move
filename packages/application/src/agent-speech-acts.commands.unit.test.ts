import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { stableStringify } from "@cuckcode/domain";
import { executeWorkCommand, type WorkCommand } from "./work-commands.js";

const ROLE = "role-assignment_engineer";
const WORK = "work_parser";
const NOW = "2026-10-05T12:00:00.000Z";
const manager = { actorType: "manager" as const, actorId: "manager_nate" };
const agent = { actorType: "agent" as const, actorId: "agent_engineer" };
const trustedAgent = { agentId: "agent_engineer", roleAssignmentId: ROLE };

const contract = (outcome: string) => ({
  outcome,
  exclusions: [],
  acceptanceCriteria: ["the focused test passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Run parser checks" }],
  permissionCeiling: {
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "never",
    networkAccess: false as const,
    windowsSandbox: "unelevated" as const,
  },
  stopConditions: ["the turn cap is reached"],
  definitionOfDone: "the manager reviews test evidence",
  contextRefs: [],
  maxTurns: 4,
});

const draftContext = (draft: ReturnType<typeof contract>, revision: number) => ({
  authenticatedManagerSessionId: "session_manager_test",
  contractDraftReceipt: {
    kind: "codex-app-server",
    state: "fresh",
    receiptId: "draft-receipt_test",
    managerSessionId: "session_manager_test",
    projectId: "project_alpha",
    expectedRevision: revision,
    expiresAt: "2026-10-05T12:05:00.000Z",
    draft: {
      candidate: draft,
      provenance: {
        draftSource: "agent",
        draftId: "draft_test",
        procedureId: "contract-drafter-v1",
        procedureVersion: "1.0.0",
        procedureSha256: "b".repeat(64),
        runtime: "@openai/codex@0.157.1",
        model: "gpt-6.1-sol",
        providerSessionId: "thread_test",
        providerTurnId: "turn_test",
        requestSha256: "c".repeat(64),
        candidateSha256: createHash("sha256").update(stableStringify(draft)).digest("hex"),
      },
    },
  },
});

let timestamp = 0;
const event = (eventId: string, kind: string, payload: Record<string, unknown>) => {
  timestamp += 1;
  const occurredAt = new Date(
    Date.parse("2026-10-05T09:00:00.000Z") + timestamp * 1000,
  ).toISOString();
  return {
    schemaVersion: 1,
    eventId,
    projectId: "project_alpha",
    kind,
    occurredAt,
    receivedAt: occurredAt,
    source: "system",
    trust: "verified",
    payload,
  };
};

const staffing = () => [
  event("event_agent", "agent.registered", {
    agentId: "agent_engineer",
    capabilities: ["engineer"],
    health: "connected",
  }),
  event("event_role", "role.assigned", {
    roleAssignmentId: ROLE,
    roleId: "engineer",
    agentId: "agent_engineer",
    requiredCapabilities: ["engineer"],
  }),
];

const run = (
  log: readonly unknown[],
  intent: string,
  payload: Record<string, unknown>,
  over: Record<string, unknown> = {},
  auth: { agentId: string; roleAssignmentId: string } | null = trustedAgent,
) => {
  const command = {
    commandId: "speech_1",
    projectId: "project_alpha",
    expectedRevision: log.length,
    actor: manager,
    intent,
    workItemId: WORK,
    ...payload,
    ...over,
  } as unknown as WorkCommand;
  return executeWorkCommand({
    log,
    currentRevision: log.length,
    now: NOW,
    command,
    ...(auth ? { trustedContext: { authenticatedAgent: auth } } : {}),
  });
};

const assignedLog = () => {
  const initial = staffing();
  const created = executeWorkCommand({
    log: initial,
    currentRevision: initial.length,
    now: NOW,
    command: {
      commandId: "manager_create",
      projectId: "project_alpha",
      expectedRevision: initial.length,
      actor: manager,
      intent: "create",
      workItemId: WORK,
      contract: contract("Replace the parser"),
    },
    trustedContext: draftContext(contract("Agent draft for the parser"), initial.length) as never,
  });
  if (!created.ok) throw new Error("create fixture failed: " + created.code);
  const afterCreate = [...initial, ...created.events];
  const assigned = executeWorkCommand({
    log: afterCreate,
    currentRevision: afterCreate.length,
    now: NOW,
    command: {
      commandId: "manager_assign",
      projectId: "project_alpha",
      expectedRevision: afterCreate.length,
      actor: manager,
      intent: "assign",
      workItemId: WORK,
      roleAssignmentId: ROLE,
    },
  });
  if (!assigned.ok) throw new Error("assignment fixture failed: " + assigned.code);
  return [...afterCreate, ...assigned.events];
};

const reviewedLog = () => {
  const log = assignedLog();
  const start = Date.parse(NOW) + 20;
  return [
    ...log,
    {
      schemaVersion: 1,
      eventId: "event_active",
      projectId: "project_alpha",
      workItemId: WORK,
      kind: "work.transitioned",
      occurredAt: new Date(start).toISOString(),
      receivedAt: new Date(start).toISOString(),
      source: "system",
      trust: "verified",
      payload: { workItemId: WORK, fromRevision: 2, toState: "active" },
    },
    {
      schemaVersion: 1,
      eventId: "event_review",
      projectId: "project_alpha",
      workItemId: WORK,
      kind: "work.transitioned",
      occurredAt: new Date(start + 1).toISOString(),
      receivedAt: new Date(start + 1).toISOString(),
      source: "system",
      trust: "verified",
      payload: { workItemId: WORK, fromRevision: 3, toState: "review_requested" },
    },
  ];
};

describe("executeWorkCommand: agent speech acts", () => {
  it("binds actor and assignment from trusted runner context, ignoring request identity", () => {
    const log = assignedLog();
    const before = JSON.stringify(log);
    const result = run(
      log,
      "ask_question",
      { question: "Which parser behavior must remain compatible?" },
      {
        actor: { actorType: "agent", actorId: "agent_request_forgery" },
        commandId: "agent_question",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        intent: "ask_question",
        actorId: "agent_engineer",
        acceptedRevision: log.length,
        resultingRevision: log.length + 1,
        eventIds: ["event_agent_question_1"],
      },
      events: [
        {
          kind: "work.question_asked",
          source: "adapter",
          trust: "reported",
          actor: agent,
          roleAssignmentId: ROLE,
          payload: { workItemId: WORK, question: "Which parser behavior must remain compatible?" },
        },
      ],
      state: {
        workItems: {
          [WORK]: {
            state: "assigned",
            speechActs: [
              { kind: "work.question_asked", actor: agent, source: "adapter", trust: "reported" },
            ],
          },
        },
      },
    });
    expect(JSON.stringify(log)).toBe(before);
  });

  it("refuses missing, mismatched or released authenticated agent assignments", () => {
    const log = assignedLog();
    expect(
      run(log, "ask_question", { question: "Question" }, { commandId: "no_auth" }, null),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(
      run(
        log,
        "ask_question",
        { question: "Question" },
        { commandId: "wrong_agent" },
        { agentId: "agent_other", roleAssignmentId: ROLE },
      ),
    ).toMatchObject({ ok: false, code: "WORK_SPEECH_ACT_UNAUTHORIZED" });
    expect(
      run(
        log,
        "ask_question",
        { question: "Question" },
        { commandId: "wrong_assignment" },
        { agentId: "agent_engineer", roleAssignmentId: "role-assignment_other" },
      ),
    ).toMatchObject({ ok: false, code: "WORK_SPEECH_ACT_UNAUTHORIZED" });
  });

  it("keeps all manager-only commands unavailable in authenticated agent context", () => {
    const log = assignedLog();
    const managerCommands: Array<[string, Record<string, unknown>]> = [
      ["create", { contract: contract("New work") }],
      ["assign", { roleAssignmentId: ROLE }],
      ["record_evidence", { evidence: { kind: "test-run", result: "passed" } }],
      ["request_review", {}],
      ["record_ruling", { ruling: { decision: "send_back", reason: "Needs work" } }],
      ["decline_rescope", { proposalId: "rescope-proposal_x", reason: "No" }],
      [
        "rescope",
        {
          proposalId: "rescope-proposal_x",
          expectedContractRevision: 1,
          contract: contract("New"),
        },
      ],
      ["grant_turns", { turnsGranted: 2, budgetRevision: 1 }],
      ["close_incomplete", { reason: "Stopped" }],
      ["nudge", { roleAssignmentId: ROLE, note: "Check in" }],
      ["suppress_nudge", { disposition: "snooze" }],
      ["withdraw_ruling", { rulingId: "ruling_x" }],
    ];
    for (const [intent, payload] of managerCommands) {
      expect(run(log, intent, payload, { commandId: "agent_try_" + intent }), intent).toMatchObject(
        { ok: false, code: "NOT_AUTHORIZED" },
      );
    }
  });

  it("requires an authenticated principal for agent intents and rejects manager impersonation", () => {
    const log = assignedLog();
    expect(
      run(
        log,
        "ask_question",
        { question: "Question" },
        { commandId: "manager_question", actor: manager },
        null,
      ),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  });

  it("validates full proposals, current contract revisions, duplicate IDs, and stale log revisions", () => {
    const log = assignedLog();
    const good = contract("Preserve quoted values");
    const proposal = run(
      log,
      "propose_rescope",
      { proposalId: "rescope-proposal_parser-v2", expectedContractRevision: 1, contract: good },
      { commandId: "agent_proposal" },
    );
    expect(proposal).toMatchObject({
      ok: true,
      receipt: { intent: "propose_rescope", actorId: "agent_engineer" },
      events: [
        {
          kind: "work.rescope_proposed",
          source: "adapter",
          trust: "reported",
          actor: agent,
          roleAssignmentId: ROLE,
          payload: {
            proposalId: "rescope-proposal_parser-v2",
            expectedContractRevision: 1,
            contract: good,
          },
        },
      ],
    });
    if (!proposal.ok) return;
    const afterProposal = [...log, ...proposal.events];
    expect(
      run(
        afterProposal,
        "propose_rescope",
        { proposalId: "rescope-proposal_parser-v2", expectedContractRevision: 1, contract: good },
        { commandId: "agent_proposal_duplicate" },
      ),
    ).toMatchObject({ ok: false, code: "WORK_SPEECH_ACT_DUPLICATE" });
    expect(
      run(
        log,
        "propose_rescope",
        { proposalId: "rescope-proposal_stale", expectedContractRevision: 2, contract: good },
        { commandId: "agent_proposal_stale" },
      ),
    ).toMatchObject({ ok: false, code: "STALE_CONTRACT_REVISION" });
    expect(
      run(
        log,
        "propose_rescope",
        {
          proposalId: "rescope-proposal_invalid",
          expectedContractRevision: 1,
          contract: { ...good, acceptanceCriteria: [] },
        },
        { commandId: "agent_proposal_invalid" },
      ),
    ).toMatchObject({ ok: false, code: "CONTRACT_INVALID" });
    expect(
      run(
        log,
        "ask_question",
        { question: "Question" },
        { commandId: "agent_stale_revision", expectedRevision: log.length - 1 },
      ),
    ).toMatchObject({ ok: false, code: "STALE_REVISION" });
  });

  it("validates send-back disputes against the current ruling and permits one per ruling", () => {
    const log = reviewedLog();
    const sentBack = executeWorkCommand({
      log,
      currentRevision: log.length,
      now: NOW,
      command: {
        commandId: "manager_send_back",
        projectId: "project_alpha",
        expectedRevision: log.length,
        actor: manager,
        intent: "record_ruling",
        workItemId: WORK,
        ruling: { decision: "send_back", reason: "Attach the compatibility result." },
      },
    });
    expect(sentBack.ok).toBe(true);
    if (!sentBack.ok) return;
    const afterRuling = [...log, ...sentBack.events];
    const dispute = run(
      afterRuling,
      "dispute_send_back",
      { rulingId: "ruling_manager_send_back", statement: "The result is already attached." },
      { commandId: "agent_dispute" },
    );
    expect(dispute).toMatchObject({
      ok: true,
      events: [
        {
          kind: "work.send_back_disputed",
          actor: agent,
          source: "adapter",
          trust: "reported",
          payload: {
            rulingId: "ruling_manager_send_back",
            statement: "The result is already attached.",
          },
        },
      ],
    });
    if (!dispute.ok) return;
    expect(
      run(
        [...afterRuling, ...dispute.events],
        "dispute_send_back",
        { rulingId: "ruling_manager_send_back", statement: "I repeat the dispute." },
        { commandId: "agent_dispute_duplicate" },
      ),
    ).toMatchObject({ ok: false, code: "WORK_SPEECH_ACT_DUPLICATE" });
    expect(
      run(
        afterRuling,
        "dispute_send_back",
        { rulingId: "ruling_other", statement: "This is not the current ruling." },
        { commandId: "agent_dispute_stale" },
      ),
    ).toMatchObject({ ok: false, code: "WORK_SPEECH_ACT_REFERENCE_INVALID" });
  });

  it("records manager approval and decline as attributed proposal dispositions", () => {
    const log = assignedLog();
    const replacement = contract("Preserve quoted values and whitespace");
    const proposal = run(
      log,
      "propose_rescope",
      {
        proposalId: "rescope-proposal_approved",
        expectedContractRevision: 1,
        contract: replacement,
      },
      { commandId: "agent_proposal_for_approval" },
    );
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const proposedLog = [...log, ...proposal.events];
    const beforeApproval = JSON.stringify(proposedLog);
    const approval = run(
      proposedLog,
      "rescope",
      {
        proposalId: "rescope-proposal_approved",
        expectedContractRevision: 1,
        contract: replacement,
      },
      { commandId: "manager_approve_proposal", actor: manager },
      null,
    );
    expect(approval).toMatchObject({
      ok: true,
      events: [
        {
          kind: "work.rescoped",
          actor: manager,
          payload: { proposalId: "rescope-proposal_approved", contractRevision: 2 },
        },
      ],
      state: {
        workItems: {
          [WORK]: {
            contractRevision: 2,
            contract: { outcome: "Preserve quoted values and whitespace" },
            speechActs: [{ kind: "work.rescope_proposed", status: "approved" }],
          },
        },
      },
    });
    expect(JSON.stringify(proposedLog)).toBe(beforeApproval);

    const declineProposal = run(
      log,
      "propose_rescope",
      {
        proposalId: "rescope-proposal_declined",
        expectedContractRevision: 1,
        contract: replacement,
      },
      { commandId: "agent_proposal_for_decline" },
    );
    expect(declineProposal.ok).toBe(true);
    if (!declineProposal.ok) return;
    const decline = run(
      [...log, ...declineProposal.events],
      "decline_rescope",
      { proposalId: "rescope-proposal_declined", reason: "Keep the current acceptance wording." },
      { commandId: "manager_decline_proposal", actor: manager },
      null,
    );
    expect(decline).toMatchObject({
      ok: true,
      events: [
        {
          kind: "work.rescope_declined",
          source: "manager",
          trust: "verified",
          actor: manager,
          payload: {
            proposalId: "rescope-proposal_declined",
            reason: "Keep the current acceptance wording.",
          },
        },
      ],
      state: {
        workItems: {
          [WORK]: {
            contractRevision: 1,
            contract: { outcome: "Replace the parser" },
            speechActs: [
              { kind: "work.rescope_proposed", status: "declined" },
              {
                kind: "work.rescope_declined",
                reason: "Keep the current acceptance wording.",
              },
            ],
          },
        },
      },
    });
  });

  it("requires non-empty bounded question, dispute text and manager decline reasons", () => {
    const log = assignedLog();
    for (const question of [" ", "q".repeat(2001)]) {
      expect(
        run(log, "ask_question", { question }, { commandId: "bad_question_" + question.length }),
      ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    }
    for (const statement of [" ", "s".repeat(2001)]) {
      expect(
        run(
          reviewedLog(),
          "dispute_send_back",
          { rulingId: "ruling_missing", statement },
          { commandId: "bad_dispute_" + statement.length },
        ),
      ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    }
    expect(
      run(
        [
          ...log,
          {
            schemaVersion: 1,
            eventId: "event_test_proposal",
            projectId: "project_alpha",
            workItemId: WORK,
            kind: "work.rescope_proposed",
            occurredAt: "2026-10-05T12:01:00.000Z",
            receivedAt: "2026-10-05T12:01:00.000Z",
            source: "adapter",
            trust: "reported",
            actor: agent,
            roleAssignmentId: ROLE,
            payload: {
              workItemId: WORK,
              proposalId: "rescope-proposal_for_decline",
              expectedContractRevision: 1,
              contract: contract("Proposed"),
            },
          },
        ],
        "decline_rescope",
        { proposalId: "rescope-proposal_for_decline", reason: " " },
        { commandId: "manager_decline_empty", actor: manager },
        null,
      ),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
  });
});
