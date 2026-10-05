import { describe, expect, it } from "vitest";

import { stableStringify } from "./canonical-json.js";
import { replayProject } from "./replay.js";

const BASE = Date.parse("2026-10-05T12:00:00.000Z");
const at = (offsetMs: number) => new Date(BASE + offsetMs).toISOString();

const contract = (outcome: string) => ({
  outcome,
  exclusions: [],
  acceptanceCriteria: ["the focused test suite passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Run the focused tests" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["the turn cap is reached"],
  definitionOfDone: "the manager reviews recorded evidence",
  contextRefs: [],
  maxTurns: 4,
});

const manager = { actorType: "manager", actorId: "manager_nate" } as const;
const agent = { actorType: "agent", actorId: "agent_engineer" } as const;
const ASSIGNMENT = "role-assignment_engineer";
const WORK = "work_parser";

const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  offset: number,
  over: Record<string, unknown> = {},
) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  ...(payload.workItemId ? { workItemId: payload.workItemId } : {}),
  kind,
  occurredAt: at(offset),
  receivedAt: at(offset),
  source: "manager",
  trust: "verified",
  payload,
  ...over,
});

const assignedLog = () => [
  event(
    "event_agent_registered",
    "agent.registered",
    { agentId: "agent_engineer", capabilities: ["engineer"], health: "connected" },
    0,
    { source: "system" },
  ),
  event(
    "event_role_assigned",
    "role.assigned",
    {
      roleAssignmentId: ASSIGNMENT,
      roleId: "engineer",
      agentId: "agent_engineer",
      requiredCapabilities: ["engineer"],
    },
    1,
    { source: "system" },
  ),
  event(
    "event_created",
    "work.created",
    {
      payloadVersion: 3,
      workItemId: WORK,
      outcome: "Replace the parser",
      requiredEvidenceKinds: ["test-run"],
      contract: contract("Replace the parser"),
    },
    2,
  ),
  event(
    "event_ready",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 0, toState: "ready" },
    3,
  ),
  event(
    "event_assigned_state",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 1, toState: "assigned" },
    4,
  ),
  event("event_assigned", "work.assigned", { workItemId: WORK, roleAssignmentId: ASSIGNMENT }, 5),
];

const toReview = () => [
  event(
    "event_active",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 2, toState: "active" },
    9,
  ),
  event(
    "event_review",
    "work.transitioned",
    { workItemId: WORK, fromRevision: 3, toState: "review_requested" },
    10,
  ),
];

const asked = (id = "event_question", offset = 6) =>
  event(
    id,
    "work.question_asked",
    { workItemId: WORK, question: "Which parser behavior should remain compatible?" },
    offset,
    {
      source: "adapter",
      trust: "reported",
      actor: agent,
      roleAssignmentId: ASSIGNMENT,
    },
  );

const proposed = (
  proposalId = "rescope-proposal_parser-v2",
  expectedContractRevision = 1,
  offset = 7,
  id = "event_proposal",
) =>
  event(
    id,
    "work.rescope_proposed",
    {
      workItemId: WORK,
      proposalId,
      expectedContractRevision,
      contract: contract("Replace the parser and preserve quoted values"),
    },
    offset,
    {
      source: "adapter",
      trust: "reported",
      actor: agent,
      roleAssignmentId: ASSIGNMENT,
    },
  );

const declined = (proposalId = "rescope-proposal_parser-v2", offset = 8, id = "event_declined") =>
  event(
    id,
    "work.rescope_declined",
    {
      workItemId: WORK,
      proposalId,
      reason: "The proposed boundary drops a required compatibility case.",
    },
    offset,
    { source: "manager", trust: "verified", actor: manager },
  );

const sendBack = () =>
  event(
    "event_send_back",
    "work.ruling_recorded",
    {
      workItemId: WORK,
      rulingId: "ruling_send_back",
      decision: "send_back",
      sourceWorkRevision: 4,
      evidenceVersions: [],
      reason: "Show the compatibility test result.",
    },
    11,
  );

const disputed = (rulingId = "ruling_send_back", offset = 12, id = "event_dispute") =>
  event(
    id,
    "work.send_back_disputed",
    {
      workItemId: WORK,
      rulingId,
      statement: "The compatibility test result is already attached to the review.",
    },
    offset,
    {
      source: "adapter",
      trust: "reported",
      actor: agent,
      roleAssignmentId: ASSIGNMENT,
    },
  );

const acceptedRescope = (proposalId: string, offset: number) =>
  event(
    "event_rescope_approved",
    "work.rescoped",
    {
      workItemId: WORK,
      expectedContractRevision: 1,
      contractRevision: 2,
      contract: contract("Replace the parser and preserve quoted values"),
      proposalId,
    },
    offset,
    { source: "manager", trust: "verified", actor: manager },
  );

const speechActs = (log: readonly unknown[]) =>
  replayProject(log).work.workItems[WORK]?.speechActs ?? [];

describe("replayProject: agent-side speech acts", () => {
  it("replays attributable trail entries in deterministic order with source revisions", () => {
    const log = [
      ...assignedLog(),
      asked(),
      proposed(),
      declined(),
      ...toReview(),
      sendBack(),
      disputed(),
    ];
    const forward = stableStringify(replayProject(log).work);
    const reversed = stableStringify(replayProject([...log].reverse()).work);

    expect(reversed).toBe(forward);
    expect(speechActs(log)).toMatchObject([
      {
        kind: "work.question_asked",
        question: "Which parser behavior should remain compatible?",
        actor: agent,
        source: "adapter",
        trust: "reported",
        roleAssignmentId: ASSIGNMENT,
        sourceRevision: 7,
      },
      {
        kind: "work.rescope_proposed",
        proposalId: "rescope-proposal_parser-v2",
        status: "declined",
        dispositionEventId: "event_declined",
        actor: agent,
        trust: "reported",
        sourceRevision: 8,
      },
      {
        kind: "work.rescope_declined",
        proposalId: "rescope-proposal_parser-v2",
        reason: "The proposed boundary drops a required compatibility case.",
        actor: manager,
        source: "manager",
        trust: "verified",
        sourceRevision: 9,
      },
      {
        kind: "work.send_back_disputed",
        rulingId: "ruling_send_back",
        actor: agent,
        trust: "reported",
        sourceRevision: 13,
      },
    ]);
  });

  it("keeps the active agreement unchanged after a proposal and its decline", () => {
    const log = [...assignedLog(), proposed(), declined()];
    const work = replayProject(log).work;
    expect(work.workItems[WORK]).toMatchObject({
      contractRevision: 1,
      contract: { outcome: "Replace the parser" },
      contractHistory: [{ revision: 1, eventId: "event_created" }],
    });
    expect(speechActs(log).find((entry) => entry.kind === "work.rescope_proposed")).toMatchObject({
      status: "declined",
      dispositionEventId: "event_declined",
    });
    expect(work.issues).toEqual([]);
  });

  it("links manager approval to the open proposal and applies only the approved full contract", () => {
    const log = [...assignedLog(), proposed(), acceptedRescope("rescope-proposal_parser-v2", 12)];
    const work = replayProject(log).work;
    expect(work.workItems[WORK]).toMatchObject({
      contractRevision: 2,
      contract: { outcome: "Replace the parser and preserve quoted values" },
      contractHistory: [
        { revision: 1, eventId: "event_created" },
        { revision: 2, eventId: "event_rescope_approved" },
      ],
    });
    expect(speechActs(log).find((entry) => entry.kind === "work.rescope_proposed")).toMatchObject({
      status: "approved",
      dispositionEventId: "event_rescope_approved",
    });
    expect(work.issues).toEqual([]);
  });

  it("keeps stale proposals and competing dispositions historical without applying them", () => {
    const changed = event(
      "event_manager_rescope",
      "work.rescoped",
      {
        workItemId: WORK,
        expectedContractRevision: 1,
        contractRevision: 2,
        contract: contract("Manager changed scope first"),
      },
      10,
      { actor: manager },
    );
    const staleProposal = proposed("rescope-proposal_stale", 1, 11, "event_stale_proposal");
    const stale = replayProject([...assignedLog(), changed, staleProposal]).work;
    expect(stale.workItems[WORK]?.contract).toMatchObject({
      outcome: "Manager changed scope first",
    });
    expect(stale.issues.map(({ code }) => code)).toContain("WORK_SPEECH_ACT_STALE");

    const proposal = proposed("rescope-proposal_conflict", 1, 10, "event_conflict_proposal");
    const rejection = declined("rescope-proposal_conflict", 11, "event_conflict_declined");
    const competingApproval = acceptedRescope("rescope-proposal_conflict", 12);
    const conflicted = replayProject([
      ...assignedLog(),
      proposal,
      rejection,
      competingApproval,
    ]).work;
    expect(conflicted.workItems[WORK]?.contractRevision).toBe(1);
    expect(conflicted.workItems[WORK]?.contract?.outcome).toBe("Replace the parser");
    expect(conflicted.issues.map(({ code }) => code)).toContain(
      "WORK_SPEECH_ACT_DISPOSITION_CONFLICT",
    );
  });

  it("preserves the send-back ruling and dispute as separate contributions and refuses duplicates", () => {
    const base = [...assignedLog(), ...toReview(), sendBack()];
    const firstDispute = disputed();
    const duplicateDispute = disputed("ruling_send_back", 12, "event_dispute_duplicate");
    const log = [...base, firstDispute, duplicateDispute];
    const work = replayProject(log).work;
    expect(work.workItems[WORK]?.state).toBe("active");
    expect(work.rulings?.ruling_send_back).toMatchObject({
      decision: "send_back",
      withdrawn: false,
    });
    expect(
      speechActs(log).filter((entry) => entry.kind === "work.send_back_disputed"),
    ).toHaveLength(1);
    expect(work.issues.map(({ code }) => code)).toContain("WORK_SPEECH_ACT_DUPLICATE");
  });

  it("refuses agent contributions after role release or from another work assignment", () => {
    const released = event(
      "event_role_released",
      "role.released",
      { roleAssignmentId: ASSIGNMENT, reason: "Agent disconnected" },
      9,
      { source: "system" },
    );
    const afterRelease = replayProject([
      ...assignedLog(),
      released,
      asked("event_question_after_release", 10),
    ]).work;
    expect(afterRelease.workItems[WORK]?.speechActs).toBeUndefined();
    expect(afterRelease.issues.map(({ code }) => code)).toContain("WORK_SPEECH_ACT_UNAUTHORIZED");

    const wrongAssignment = event(
      "event_wrong_assignment_question",
      "work.question_asked",
      { workItemId: WORK, question: "Can I change the acceptance criteria?" },
      10,
      {
        source: "adapter",
        trust: "reported",
        actor: agent,
        roleAssignmentId: "role-assignment_other",
      },
    );
    const mismatched = replayProject([...assignedLog(), wrongAssignment]).work;
    expect(mismatched.workItems[WORK]?.speechActs).toBeUndefined();
    expect(mismatched.issues.map(({ code }) => code)).toContain("WORK_SPEECH_ACT_UNAUTHORIZED");
  });

  it("leaves evidence and check states unchanged while speech acts are replayed", () => {
    const evidence = event(
      "event_reported_evidence",
      "evidence.recorded",
      {
        evidenceId: "evidence_reported_test",
        workItemId: WORK,
        kind: "test-run",
        version: 1,
        result: "passed",
        note: "Agent-reported pass; awaiting verification.",
      },
      9,
      { source: "adapter", trust: "reported" },
    );
    const baseline = replayProject([...assignedLog(), evidence]).work;
    const withSpeech = replayProject([...assignedLog(), evidence, asked(), proposed()]).work;
    expect(withSpeech.evidence).toEqual(baseline.evidence);
    expect(withSpeech.evidenceHistory).toEqual(baseline.evidenceHistory);
    expect(withSpeech.workItems[WORK]?.state).toBe(baseline.workItems[WORK]?.state);
    expect(withSpeech.issues).toEqual([]);
  });

  it("refuses a second proposal with the same stable proposal ID", () => {
    const duplicate = proposed("rescope-proposal_same", 1, 12, "event_proposal_duplicate");
    const log = [
      ...assignedLog(),
      proposed("rescope-proposal_same", 1, 10, "event_proposal_first"),
      duplicate,
    ];
    const work = replayProject(log).work;
    expect(
      work.workItems[WORK]?.speechActs?.filter((entry) => entry.kind === "work.rescope_proposed"),
    ).toHaveLength(1);
    expect(work.issues.map(({ code }) => code)).toContain("WORK_SPEECH_ACT_DUPLICATE");
  });
});
