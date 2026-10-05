import { describe, expect, it } from "vitest";

import { executeWorkCommand, type WorkCommand } from "./work-commands.js";

const PROJECT = "project_alpha";
const WORK = "work_alpha";
const NOW = "2026-10-04T12:00:00.000Z";
const DIGEST = "a".repeat(64);
const contract = (over: Record<string, unknown> = {}) => ({
  outcome: "Complete the bounded change",
  exclusions: [],
  acceptanceCriteria: ["verified test evidence passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Run the focused tests" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["turn cap reached"],
  definitionOfDone: "manager rules on checked evidence",
  contextRefs: [],
  maxTurns: 3,
  ...over,
});

const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  seconds: number,
  source = "manager",
) => {
  const at = new Date(Date.parse(NOW) + seconds * 1000).toISOString();
  return {
    schemaVersion: 1,
    eventId,
    projectId: PROJECT,
    workItemId: WORK,
    kind,
    occurredAt: at,
    receivedAt: at,
    source,
    trust: "verified",
    payload,
  };
};

const reviewLog = () => [
  event(
    "event_create",
    "work.created",
    {
      payloadVersion: 3,
      workItemId: WORK,
      outcome: "Complete the bounded change",
      requiredEvidenceKinds: ["test-run"],
      contract: contract(),
    },
    0,
  ),
  event(
    "event_ready",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 0, toState: "ready" },
    1,
  ),
  event(
    "event_assigned",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 1, toState: "assigned" },
    2,
  ),
  event(
    "event_active",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 2, toState: "active" },
    3,
  ),
  event(
    "event_review",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 3, toState: "review_requested" },
    4,
  ),
  event(
    "event_evidence",
    "evidence.recorded",
    {
      evidenceId: "evidence_tests",
      workItemId: WORK,
      kind: "test-run",
      version: 1,
      result: "passed",
      worktreeSha256: DIGEST,
    },
    5,
  ),
];

const command = (intent: string, over: Record<string, unknown> = {}) =>
  ({
    commandId: "ruling_1",
    projectId: PROJECT,
    expectedRevision: reviewLog().length,
    actor: { actorType: "manager", actorId: "manager_nate" },
    intent,
    workItemId: WORK,
    ...over,
  }) as WorkCommand;

const run = (
  log: readonly unknown[],
  cmd: WorkCommand,
  trustedContext?: { worktreeSha256?: string },
) =>
  executeWorkCommand({
    log,
    currentRevision: log.length,
    now: NOW,
    command: cmd,
    ...(trustedContext === undefined ? {} : { trustedContext }),
  } as Parameters<typeof executeWorkCommand>[0]);

describe("workflow-core manager commands", () => {
  it("records a ruling from replayed evidence, returns a receipt, and does not accept browser attestations", () => {
    const log = reviewLog();
    expect(
      run(
        log,
        command("record_ruling", {
          ruling: { decision: "accept" },
          evidenceVersions: [{ evidenceId: "evidence_client_claim", version: 99 }],
        }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    const result = run(log, command("record_ruling", { ruling: { decision: "accept" } }), {
      worktreeSha256: DIGEST,
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      kind: "work.ruling_recorded",
      payload: {
        decision: "accept",
        sourceWorkRevision: 4,
        evidenceVersions: [{ evidenceId: "evidence_tests", version: 1 }],
      },
    });
    expect(result.state.workItems[WORK]?.state).toBe("verified");
    expect(result.receipt).toMatchObject({
      intent: "record_ruling",
      acceptedRevision: log.length,
      resultingRevision: log.length + 1,
      eventIds: [result.events[0]?.eventId],
    });
  });

  it("requires a non-empty reason for exception acceptance and send-back, and a reason plus future UTC time for defer", () => {
    const log = reviewLog();
    expect(
      run(
        log,
        command("record_ruling", { ruling: { decision: "accept_with_exception", reason: "   " } }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    expect(
      run(log, command("record_ruling", { ruling: { decision: "send_back" } }), {
        worktreeSha256: DIGEST,
      }),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    expect(
      run(log, command("record_ruling", { ruling: { decision: "defer", reason: "Wait" } }), {
        worktreeSha256: DIGEST,
      }),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    expect(
      run(
        log,
        command("record_ruling", {
          ruling: { decision: "defer", reason: "Wait", resurfaceAt: NOW },
        }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
  });

  it("requires a fresh matching trusted worktree digest for ordinary acceptance", () => {
    const log = reviewLog();
    expect(run(log, command("record_ruling", { ruling: { decision: "accept" } }))).toMatchObject({
      ok: false,
      code: "WORKTREE_DIGEST_MISSING",
    });
    expect(
      run(log, command("record_ruling", { ruling: { decision: "accept" } }), {
        worktreeSha256: "b".repeat(64),
      }),
    ).toMatchObject({ ok: false, code: "WORKTREE_DIGEST_MISMATCH" });
    expect(
      run(log, command("record_ruling", { ruling: { decision: "accept" } }), {
        worktreeSha256: DIGEST,
      }).ok,
    ).toBe(true);
  });

  it("requires explicit positive turn grants, the current budget revision, and a bounded current contract", () => {
    const log = reviewLog();
    expect(run(log, command("grant_turns", { turnsGranted: 0, budgetRevision: 1 }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
    expect(run(log, command("grant_turns", { turnsGranted: 2, budgetRevision: 99 }))).toMatchObject(
      { ok: false, code: "TURN_BUDGET_INVALID" },
    );
    expect(run(log, command("rescope", { contract: contract({ maxTurns: 0 }) }))).toMatchObject({
      ok: false,
      code: "CONTRACT_INVALID",
    });
    const granted = run(log, command("grant_turns", { turnsGranted: 7, budgetRevision: 1 }));
    expect(granted).toMatchObject({ ok: true, receipt: { intent: "grant_turns" } });
    if (granted.ok) expect(granted.state.workItems[WORK]?.turnBudget?.effectiveMaxTurns).toBe(10);
  });

  it("records a full re-scope and refuses a stale contract revision", () => {
    const log = reviewLog();
    const result = run(
      log,
      command("rescope", {
        expectedContractRevision: 1,
        contract: contract({ outcome: "Complete the revised change", maxTurns: 4 }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      events: [{ kind: "work.rescoped" }],
      receipt: { intent: "rescope" },
    });
    if (result.ok)
      expect(result.state.workItems[WORK]).toMatchObject({
        contractRevision: 2,
        contract: { outcome: "Complete the revised change" },
      });
    expect(
      run(
        log,
        command("rescope", {
          expectedContractRevision: 99,
          contract: contract({ outcome: "Stale change" }),
        }),
      ),
    ).toMatchObject({ ok: false, code: "STALE_CONTRACT_REVISION" });
  });

  it("closes incomplete work with an explicit reason and records suppression from the event time", () => {
    const log = reviewLog();
    expect(
      run(log, command("close_incomplete", { reason: "The agreed turn cap was reached." })),
    ).toMatchObject({
      ok: true,
      state: { workItems: { work_alpha: { state: "closed_incomplete" } } },
    });
    expect(run(log, command("close_incomplete", { reason: "  " }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
    const suppressed = run(log, command("suppress_nudge", { disposition: "snooze" }));
    expect(suppressed).toMatchObject({ ok: true, events: [{ kind: "work.nudge_suppressed" }] });
    if (suppressed.ok) {
      const event = suppressed.events[0] as { occurredAt: string; payload: { until: string } };
      expect(Date.parse(event.payload.until) - Date.parse(event.occurredAt)).toBe(2 * 86_400_000);
    }
  });

  it("withdraws a ruling through a second manager command and receipt", () => {
    const log = reviewLog();
    const accepted = run(log, command("record_ruling", { ruling: { decision: "accept" } }), {
      worktreeSha256: DIGEST,
    });
    if (!accepted.ok) throw new Error(`setup failed: ${accepted.code}`);
    const afterAccept = [...log, ...accepted.events];
    const withdrawn = run(
      afterAccept,
      command("withdraw_ruling", {
        commandId: "undo_accept",
        expectedRevision: afterAccept.length,
        rulingId: "ruling_ruling_1",
      }),
    );
    expect(withdrawn).toMatchObject({
      ok: true,
      events: [{ kind: "ruling.withdrawn" }],
      receipt: { intent: "withdraw_ruling" },
      state: { workItems: { work_alpha: { state: "review_requested" } } },
    });
  });

  it("rejects stale revisions, agent actors, duplicate command IDs, and invalid trusted digests", () => {
    const log = reviewLog();
    expect(
      run(
        log,
        command("record_ruling", {
          expectedRevision: log.length - 1,
          ruling: { decision: "accept" },
        }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(
      run(
        log,
        command("record_ruling", {
          actor: { actorType: "agent", actorId: "agent_worker" },
          ruling: { decision: "accept" },
        }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(
      run(log, command("record_ruling", { ruling: { decision: "accept" } }), {
        worktreeSha256: "not-a-digest",
      }),
    ).toMatchObject({ ok: false, code: "WORKTREE_DIGEST_INVALID" });
    const duplicate = [...log, event("event_replay_1", "project.created", { name: "Alpha" }, 6)];
    expect(
      run(
        duplicate,
        command("record_ruling", {
          commandId: "replay",
          expectedRevision: duplicate.length,
          ruling: { decision: "accept" },
        }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "COMMAND_ID_DUPLICATE" });
  });

  it("does not allow a browser evidence payload to choose or forge a worktree digest", () => {
    const log = reviewLog();
    expect(
      run(
        log,
        command("record_evidence", {
          evidence: { kind: "test-run", result: "passed", worktreeSha256: DIGEST },
        }),
        { worktreeSha256: DIGEST },
      ),
    ).toMatchObject({ ok: false, code: "EVIDENCE_INVALID" });
  });

  it("returns no partial candidate list when any candidate fails canonical replay", () => {
    const log = [
      event(
        "event_create",
        "work.created",
        {
          payloadVersion: 3,
          workItemId: WORK,
          outcome: "Complete the bounded change",
          requiredEvidenceKinds: ["test-run"],
          contract: contract(),
        },
        0,
      ),
    ];
    const result = run(
      log,
      command("assign", {
        roleAssignmentId: "role-assignment_missing",
        expectedRevision: log.length,
      }),
    );
    expect(result).toMatchObject({ ok: false, code: "WORK_ASSIGNMENT_INVALID" });
    if (!result.ok) expect("events" in result).toBe(false);
  });
});
