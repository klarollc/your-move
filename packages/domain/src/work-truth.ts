import {
  parseProjectEvent,
  validateWorkAssignmentPayload,
  validateWorkCreatedPayload,
  validatePostureRecordedPayload,
  validateWorkTransitionPayload,
  validateWorkTurnsGrantedPayload,
  validateWorkRescopedPayload,
  validateWorkClosedIncompletePayload,
  validateWorkRulingRecordedPayload,
  validateWorkNudgedPayload,
  validateWorkNudgeSuppressedPayload,
  validateRulingWithdrawnPayload,
  validateWorkQuestionAskedPayload,
  validateWorkRescopeProposedPayload,
  validateWorkRescopeDeclinedPayload,
  validateWorkSendBackDisputedPayload,
  type PostureRecord,
  type ProjectEvent,
  type WorkConditionV3,
  type WorkContract,
  type ContractDraftRecord,
  type EvidenceVersionRef,
} from "@cuckcode/contracts";

import { applyStaffingEvent, createStaffingTruth, type StaffingTruth } from "./staffing-truth.js";
import { stableStringify } from "./canonical-json.js";

export type WorkState =
  | "draft"
  | "ready"
  | "assigned"
  | "active"
  | "review_requested"
  | "verified"
  | "completed"
  | "waiting_input"
  | "blocked"
  | "failed"
  | "paused"
  | "cancelled"
  | "verified_with_exception"
  | "closed_incomplete";

/** The role assignment that holds a work item, and the event that bound it (spec §3.1). */
export type WorkAssignmentTruth = { roleAssignmentId: string; eventId: string };

/**
 * Why a work item is blocked, waiting or under review, as asserted by a version-2 or version-3
 * transition (spec §3.2, §10.1). A version-3 condition may carry no request: someone other than the
 * manager resolves it. `source` and `trust` come from that event's envelope: the summary is a recorded claim
 * by whoever emitted it, never system truth.
 */
export type WorkConditionTruth = WorkConditionV3 & {
  eventId: string;
  source: ProjectEvent["source"];
  trust: ProjectEvent["trust"];
};

export type WorkItemTruth = {
  workItemId: string;
  outcome: string;
  state: WorkState;
  revision: number;
  requiredEvidenceKinds: string[];
  updatedByEventId: string;
  updatedAt: string;
  assignment: WorkAssignmentTruth | null;
  condition: WorkConditionTruth | null;
  /** The D-26 work contract, present only for a work item created with a version-2 payload. */
  contract?: WorkContract;
  /** The original agent candidate and server-bound source receipt, present only for payload v4. */
  contractDraft?: ContractDraftRecord;
  contractRevision?: number;
  contractHistory?: ContractRevisionTruth[];
  turnBudget?: TurnBudgetTruth;
  resurface?: ResurfaceTruth;
  nudgeSuppression?: NudgeSuppressionTruth;
  nudges?: NudgeTruth[];
  currentRulingId?: string;
  speechActs?: WorkSpeechActTruth[];
};

type WorkSpeechActBase = Readonly<{
  eventId: string;
  workItemId: string;
  occurredAt: string;
  sourceRevision: number;
  source: ProjectEvent["source"];
  trust: ProjectEvent["trust"];
  actor: NonNullable<ProjectEvent["actor"]>;
  roleAssignmentId?: string;
}>;

export type WorkSpeechActTruth =
  | (WorkSpeechActBase & { kind: "work.question_asked"; question: string })
  | (WorkSpeechActBase & {
      kind: "work.rescope_proposed";
      proposalId: string;
      expectedContractRevision: number;
      contract: WorkContract;
      status: "open" | "approved" | "declined";
      dispositionEventId?: string;
    })
  | (WorkSpeechActBase & {
      kind: "work.rescope_declined";
      proposalId: string;
      reason: string;
    })
  | (WorkSpeechActBase & {
      kind: "work.send_back_disputed";
      rulingId: string;
      statement: string;
    });

type WorkSpeechActContent =
  | { kind: "work.question_asked"; question: string }
  | {
      kind: "work.rescope_proposed";
      proposalId: string;
      expectedContractRevision: number;
      contract: WorkContract;
      status: "open" | "approved" | "declined";
    }
  | { kind: "work.rescope_declined"; proposalId: string; reason: string }
  | { kind: "work.send_back_disputed"; rulingId: string; statement: string };

export type ContractRevisionTruth = {
  revision: number;
  eventId: string;
  contract: WorkContract;
};

export type TurnBudgetTruth = {
  budgetRecorded: boolean;
  budgetRevision: number;
  baseMaxTurns: number | null;
  grantedTurns: number;
  effectiveMaxTurns: number | null;
  usedTurns: number | null;
  remainingTurns: number | null;
  exhausted: boolean | null;
  countComplete: boolean;
};

export type ResurfaceTruth = {
  at: string;
  due: boolean | null;
  projectedAt: string | null;
  eventId: string;
};

export type NudgeSuppressionTruth = {
  disposition: "snooze" | "dismiss";
  until: string;
  eventId: string;
};

export type NudgeTruth = {
  eventId: string;
  roleAssignmentId: string;
  note: string;
  recordedAt: string;
};

export type EvidenceTruth = {
  evidenceId: string;
  workItemId: string;
  kind: string;
  version: number;
  result: "passed" | "failed";
  eventId: string;
  source: ProjectEvent["source"];
  trust: ProjectEvent["trust"];
  providerRunId?: string;
  worktreeSha256?: string;
  contractRevisionAtRecord?: number;
  applicableContractRevisions?: number[];
};

export type RulingTruth = {
  rulingId: string;
  workItemId: string;
  decision: "accept" | "accept_with_exception" | "send_back" | "defer";
  evidenceVersions: EvidenceVersionRef[];
  previousState: WorkState;
  previousCondition: WorkConditionTruth | null;
  eventId: string;
  recordedAt: string;
  sourceWorkRevision: number;
  withdrawn: boolean;
  withdrawnByEventId?: string;
  reason?: string;
  note?: string;
  resurfaceAt?: string;
};

/** One posture read back for a run (W6a). Never carries state; history is kept, in canonical order. */
export type PostureTruth = {
  runId: string;
  posture: PostureRecord;
  eventId: string;
  recordedAt: string;
};

export type ApprovalTruth = {
  approvalId: string;
  workItemId: string;
  actor: "manager";
  artifactId: string;
  artifactVersion: number;
  evidenceVersions: { evidenceId: string; version: number }[];
  eventId: string;
};

export type WorkTruthIssue = {
  code:
    | "MALFORMED_WORK_EVENT"
    | "WORK_ITEM_NOT_FOUND"
    | "INVALID_WORK_TRANSITION"
    | "VERIFICATION_EVIDENCE_MISSING"
    | "UNAUTHORIZED_APPROVAL"
    | "INVALID_APPROVAL"
    | "WORK_ASSIGNMENT_INVALID"
    | "WORK_ALREADY_ASSIGNED"
    | "WORK_ORPHANED"
    | "EVIDENCE_VERSION_INVALID"
    | "UNAUTHORIZED_WORK_DECISION"
    | "WORK_CONTRACT_REVISION_INVALID"
    | "TURN_BUDGET_INVALID"
    | "INVALID_WORK_RULING"
    | "INVALID_NUDGE"
    | "INVALID_NUDGE_SUPPRESSION"
    | "RULING_WITHDRAWAL_REFUSED"
    | "WORK_SPEECH_ACT_UNAUTHORIZED"
    | "WORK_SPEECH_ACT_STALE"
    | "WORK_SPEECH_ACT_DUPLICATE"
    | "WORK_SPEECH_ACT_DISPOSITION_CONFLICT"
    | "WORK_SPEECH_ACT_REFERENCE_INVALID";
  eventId: string;
  workItemId?: string;
  message: string;
};

export type WorkTruthState = {
  workItems: Record<string, WorkItemTruth>;
  evidence: Record<string, EvidenceTruth>;
  evidenceHistory?: Record<string, EvidenceTruth[]>;
  rulings?: Record<string, RulingTruth>;
  approvals: Record<string, ApprovalTruth>;
  /**
   * Posture history per work item, oldest first (W6a). Present only once a posture is recorded, so
   * a log without one projects exactly as before (the Phase 6 fingerprints cover this state).
   */
  postures?: Record<string, PostureTruth[]>;
  issues: WorkTruthIssue[];
};

const transitions: Record<WorkState, readonly WorkState[]> = {
  draft: ["ready", "cancelled"],
  ready: ["assigned", "cancelled"],
  assigned: ["active", "waiting_input", "blocked", "failed", "paused", "cancelled"],
  active: ["review_requested", "waiting_input", "blocked", "failed", "paused", "cancelled"],
  review_requested: ["verified", "active", "blocked", "failed", "cancelled"],
  verified: ["completed", "active", "cancelled"],
  verified_with_exception: ["active", "cancelled"],
  completed: [],
  waiting_input: ["active", "blocked", "failed", "paused", "cancelled"],
  blocked: ["active", "failed", "paused", "cancelled"],
  failed: ["active", "cancelled"],
  paused: ["active", "cancelled"],
  cancelled: [],
  closed_incomplete: [],
};

export function reduceWorkTruth(
  input: readonly unknown[],
  options: Readonly<{ asOf?: string }> = {},
): WorkTruthState {
  const state: WorkTruthState = { workItems: {}, evidence: {}, approvals: {}, issues: [] };
  // Work assignment is valid only against staffing as it stood at that point in the log, so
  // staffing is replayed alongside, through its own reducer, and never re-derived here.
  const staffing = createStaffingTruth();

  for (const [index, candidate] of input.entries()) {
    const parsed = parseProjectEvent(candidate);
    if (!parsed.ok) continue;
    const event = parsed.value;
    const sourceRevision = index + 1;
    applyStaffingEvent(staffing, event);
    if (event.kind === "work.created") createWorkItem(state, event);
    if (event.kind === "evidence.recorded") recordEvidence(state, event);
    if (event.kind === "posture.recorded") recordPosture(state, event);
    if (event.kind === "work.transitioned") transitionWorkItem(state, event);
    if (event.kind === "approval.recorded") recordApproval(state, event);
    if (event.kind === "work.assigned") assignWork(state, event, staffing);
    if (event.kind === "work.released") releaseWork(state, event);
    if (event.kind === "role.released") orphanReleasedWork(state, event, staffing);
    if (event.kind === "work.rescoped") rescopeWork(state, event);
    if (event.kind === "work.turns_granted") grantTurns(state, event);
    if (event.kind === "work.closed_incomplete") closeIncomplete(state, event);
    if (event.kind === "work.ruling_recorded") recordRuling(state, event);
    if (event.kind === "ruling.withdrawn") withdrawRuling(state, event);
    if (event.kind === "work.nudged") recordNudge(state, event);
    if (event.kind === "work.nudge_suppressed") suppressNudge(state, event);
    if (event.kind === "work.question_asked")
      recordQuestion(state, event, staffing, sourceRevision);
    if (event.kind === "work.rescope_proposed")
      recordRescopeProposal(state, event, staffing, sourceRevision);
    if (event.kind === "work.rescope_declined") recordRescopeDecline(state, event, sourceRevision);
    if (event.kind === "work.send_back_disputed")
      recordSendBackDispute(state, event, staffing, sourceRevision);
  }

  deriveWorkSummaries(state, input, options.asOf);

  return state;
}

function createWorkItem(state: WorkTruthState, event: ProjectEvent): void {
  // Version 2 carries the historical contract; version 3 adds a turn cap; v4 binds a draft receipt.
  if (event.payload.payloadVersion !== undefined) {
    const parsed = validateWorkCreatedPayload(event.payload);
    if (!parsed.ok) {
      issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
      return;
    }
    const { workItemId, outcome, requiredEvidenceKinds, contract, contractDraft } = parsed.value;
    state.workItems[workItemId] = {
      workItemId,
      outcome,
      state: "draft",
      revision: 0,
      requiredEvidenceKinds: [...requiredEvidenceKinds],
      updatedByEventId: event.eventId,
      updatedAt: event.occurredAt,
      assignment: null,
      condition: null,
      ...(contract ? { contract } : {}),
      ...(contractDraft ? { contractDraft } : {}),
      ...(contract
        ? {
            contractRevision: 1,
            contractHistory: [{ revision: 1, eventId: event.eventId, contract }],
            turnBudget: initialTurnBudget(contract.maxTurns),
          }
        : {}),
    };
    return;
  }
  const workItemId = stringField(event.payload, "workItemId");
  const outcome = stringField(event.payload, "outcome");
  const requiredEvidenceKinds = stringArrayField(event.payload, "requiredEvidenceKinds");
  if (!workItemId || !outcome || !requiredEvidenceKinds) {
    issue(state, "MALFORMED_WORK_EVENT", event, "work.created payload is incomplete");
    return;
  }
  state.workItems[workItemId] = {
    workItemId,
    outcome,
    state: "draft",
    revision: 0,
    requiredEvidenceKinds,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
    assignment: null,
    condition: null,
  };
}

/** Labels only validated provenance; the exact legacy v4 agent shape remains explicitly compatible. */
export function workContractDraftSource(
  record: ContractDraftRecord | undefined,
): "agent" | "manager" | "not_recorded" {
  if (!record) return "not_recorded";
  if ("draftSource" in record.provenance) return record.provenance.draftSource;
  return "agent";
}

function recordEvidence(state: WorkTruthState, event: ProjectEvent): void {
  const evidenceId = stringField(event.payload, "evidenceId");
  const workItemId = stringField(event.payload, "workItemId");
  const kind = stringField(event.payload, "kind");
  const version = integerField(event.payload, "version");
  const result = event.payload.result;
  if (
    !evidenceId ||
    !workItemId ||
    !kind ||
    version === undefined ||
    (result !== "passed" && result !== "failed")
  ) {
    issue(
      state,
      "MALFORMED_WORK_EVENT",
      event,
      "evidence.recorded payload is incomplete",
      workItemId,
    );
    return;
  }
  state.evidence[evidenceId] = {
    evidenceId,
    workItemId,
    kind,
    version,
    result,
    eventId: event.eventId,
    source: event.source,
    trust: event.trust,
    ...(event.providerRunId ? { providerRunId: event.providerRunId } : {}),
    ...(typeof event.payload.worktreeSha256 === "string"
      ? { worktreeSha256: event.payload.worktreeSha256 }
      : {}),
    ...(state.workItems[workItemId]?.contractRevision !== undefined
      ? {
          contractRevisionAtRecord: state.workItems[workItemId]!.contractRevision,
          applicableContractRevisions: [state.workItems[workItemId]!.contractRevision!],
        }
      : {}),
  };
  const item = state.workItems[workItemId];
  if (item) {
    const history = ((state.evidenceHistory ??= {})[workItemId] ??= []);
    history.push(state.evidence[evidenceId]!);
  }
}

function recordPosture(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validatePostureRecordedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const { workItemId, runId, posture } = parsed.value;
  if (event.workItemId !== undefined && event.workItemId !== workItemId) {
    issue(
      state,
      "MALFORMED_WORK_EVENT",
      event,
      "posture.recorded payload names a different work item than the envelope",
      workItemId,
    );
    return;
  }
  // A posture is a fact the runner measured. Anything else is a claim and may not be recorded here.
  if (event.source !== "adapter" || event.trust !== "verified") {
    issue(
      state,
      "MALFORMED_WORK_EVENT",
      event,
      "posture.recorded must come from source adapter with trust verified",
      workItemId,
    );
    return;
  }
  if (!state.workItems[workItemId]) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", workItemId);
    return;
  }
  ((state.postures ??= {})[workItemId] ??= []).push({
    runId,
    posture,
    eventId: event.eventId,
    recordedAt: event.occurredAt,
  });
}

function transitionWorkItem(state: WorkTruthState, event: ProjectEvent): void {
  const workItemId = stringField(event.payload, "workItemId");
  const fromRevision = integerField(event.payload, "fromRevision");
  const toState = stringField(event.payload, "toState") as WorkState | undefined;
  const item = workItemId ? state.workItems[workItemId] : undefined;
  if (!workItemId || !item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", workItemId);
    return;
  }
  const contract = validateWorkTransitionPayload(event.payload);
  if (!contract.ok && ("payloadVersion" in event.payload || "condition" in event.payload)) {
    issue(state, "MALFORMED_WORK_EVENT", event, contract.issues.join("; "), workItemId);
    return;
  }
  const condition =
    contract.ok && contract.value.payloadVersion !== 1 && contract.value.condition
      ? {
          ...contract.value.condition,
          eventId: event.eventId,
          source: event.source,
          trust: event.trust,
        }
      : null;
  if (fromRevision !== item.revision || !toState || !transitions[item.state].includes(toState)) {
    issue(
      state,
      "INVALID_WORK_TRANSITION",
      event,
      fromRevision !== item.revision
        ? `expected revision ${item.revision}, received ${String(fromRevision)}`
        : `${item.state} cannot transition to ${String(toState)}`,
      workItemId,
    );
    return;
  }
  if (toState === "verified") {
    const passedKinds = new Set(
      Object.values(state.evidence)
        .filter((record) => record.workItemId === workItemId && record.result === "passed")
        .map((record) => record.kind),
    );
    const missing = item.requiredEvidenceKinds.filter((kind) => !passedKinds.has(kind));
    if (missing.length > 0) {
      issue(
        state,
        "VERIFICATION_EVIDENCE_MISSING",
        event,
        `missing passed evidence: ${missing.sort().join(", ")}`,
        workItemId,
      );
      return;
    }
  }
  state.workItems[workItemId] = {
    ...item,
    state: toState,
    revision: item.revision + 1,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
    condition,
  };
}

function assignWork(state: WorkTruthState, event: ProjectEvent, staffing: StaffingTruth): void {
  const contract = validateWorkAssignmentPayload(event.payload);
  if (!contract.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, contract.issues.join("; "));
    return;
  }
  const { workItemId, roleAssignmentId } = contract.value;
  const item = state.workItems[workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", workItemId);
    return;
  }
  if (!staffing.assignments[roleAssignmentId]) {
    issue(
      state,
      "WORK_ASSIGNMENT_INVALID",
      event,
      `role assignment ${roleAssignmentId} is not active`,
      workItemId,
    );
    return;
  }
  if (item.assignment) {
    issue(
      state,
      "WORK_ALREADY_ASSIGNED",
      event,
      `work is held by ${item.assignment.roleAssignmentId}; release it first`,
      workItemId,
    );
    return;
  }
  state.workItems[workItemId] = {
    ...item,
    assignment: { roleAssignmentId, eventId: event.eventId },
  };
}

function releaseWork(state: WorkTruthState, event: ProjectEvent): void {
  const contract = validateWorkAssignmentPayload(event.payload);
  if (!contract.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, contract.issues.join("; "));
    return;
  }
  const { workItemId, roleAssignmentId } = contract.value;
  const item = state.workItems[workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", workItemId);
    return;
  }
  if (item.assignment?.roleAssignmentId !== roleAssignmentId) {
    issue(
      state,
      "WORK_ASSIGNMENT_INVALID",
      event,
      `work is not held by ${roleAssignmentId}`,
      workItemId,
    );
    return;
  }
  state.workItems[workItemId] = { ...item, assignment: null };
}

/** Work held by a role assignment staffing has just released is left unassigned and flagged. */
function orphanReleasedWork(
  state: WorkTruthState,
  event: ProjectEvent,
  staffing: StaffingTruth,
): void {
  for (const item of Object.values(state.workItems)) {
    const held = item.assignment?.roleAssignmentId;
    if (!held || staffing.assignments[held]) continue;
    state.workItems[item.workItemId] = { ...item, assignment: null };
    issue(
      state,
      "WORK_ORPHANED",
      event,
      `role assignment ${held} was released while it held this work`,
      item.workItemId,
    );
  }
}

function recordApproval(state: WorkTruthState, event: ProjectEvent): void {
  if (event.source !== "manager") {
    issue(state, "UNAUTHORIZED_APPROVAL", event, "only an explicit manager event can approve");
    return;
  }
  const approvalId = stringField(event.payload, "approvalId");
  const workItemId = stringField(event.payload, "workItemId");
  const artifactId = stringField(event.payload, "artifactId");
  const artifactVersion = integerField(event.payload, "artifactVersion");
  const evidenceVersions = evidenceVersionField(event.payload, "evidenceVersions");
  if (
    !approvalId ||
    !workItemId ||
    !artifactId ||
    artifactVersion === undefined ||
    !evidenceVersions
  ) {
    issue(
      state,
      "INVALID_APPROVAL",
      event,
      "approval must bind artifact and evidence versions",
      workItemId,
    );
    return;
  }
  state.approvals[approvalId] = {
    approvalId,
    workItemId,
    actor: "manager",
    artifactId,
    artifactVersion,
    evidenceVersions: [...evidenceVersions].sort((a, b) =>
      a.evidenceId.localeCompare(b.evidenceId),
    ),
    eventId: event.eventId,
  };
}

function initialTurnBudget(maxTurns: number | undefined): TurnBudgetTruth {
  return {
    budgetRecorded: maxTurns !== undefined,
    budgetRevision: maxTurns === undefined ? 0 : 1,
    baseMaxTurns: maxTurns ?? null,
    grantedTurns: 0,
    effectiveMaxTurns: maxTurns ?? null,
    usedTurns: 0,
    remainingTurns: maxTurns ?? null,
    exhausted: maxTurns === undefined ? null : false,
    countComplete: true,
  };
}

function managerEvent(event: ProjectEvent): boolean {
  return event.source === "manager" && event.trust === "verified";
}

function rescopeWork(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateWorkRescopedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  if (!managerEvent(event)) {
    issue(
      state,
      "UNAUTHORIZED_WORK_DECISION",
      event,
      "only a verified manager may re-scope work",
      data.workItemId,
    );
    return;
  }
  const proposal = data.proposalId ? findProposal(state, data.proposalId) : undefined;
  if (data.proposalId) {
    if (
      event.actor?.actorType !== "manager" ||
      !proposal ||
      proposal.workItemId !== data.workItemId ||
      proposal.status !== "open"
    ) {
      issue(
        state,
        "WORK_SPEECH_ACT_DISPOSITION_CONFLICT",
        event,
        "linked rescope approval requires one open proposal for this work item",
        data.workItemId,
      );
      return;
    }
    if (
      proposal.expectedContractRevision !== data.expectedContractRevision ||
      stableStringify(proposal.contract) !== stableStringify(data.contract)
    ) {
      issue(
        state,
        "WORK_SPEECH_ACT_STALE",
        event,
        "the proposal revision or full replacement contract does not match the approval",
        data.workItemId,
      );
      return;
    }
  }
  if (
    !item.contract ||
    item.contractRevision !== data.expectedContractRevision ||
    data.contractRevision !== data.expectedContractRevision + 1 ||
    item.state === "active"
  ) {
    issue(
      state,
      "WORK_CONTRACT_REVISION_INVALID",
      event,
      item.state === "active"
        ? "work cannot be re-scoped while active"
        : `expected contract revision ${String(item.contractRevision)}, received ${data.expectedContractRevision}`,
      data.workItemId,
    );
    return;
  }
  const nextContract = data.contract;
  const previousObligations = item.contract.evidenceObligations;
  const unchangedKinds = new Set(
    nextContract.evidenceObligations
      .filter((next) =>
        previousObligations.some(
          (previous) => previous.kind === next.kind && previous.description === next.description,
        ),
      )
      .map(({ kind }) => kind),
  );
  for (const evidence of state.evidenceHistory?.[data.workItemId] ?? []) {
    if (unchangedKinds.has(evidence.kind)) {
      evidence.applicableContractRevisions = sortedUnique([
        ...(evidence.applicableContractRevisions ?? []),
        data.contractRevision,
      ]);
    }
  }
  const history = [
    ...(item.contractHistory ?? []),
    {
      revision: data.contractRevision,
      eventId: event.eventId,
      contract: nextContract,
    },
  ];
  const maxTurns = nextContract.maxTurns;
  const currentBudget = item.turnBudget ?? initialTurnBudget(item.contract.maxTurns);
  const budget: TurnBudgetTruth = {
    ...currentBudget,
    budgetRecorded: maxTurns !== undefined,
    budgetRevision: currentBudget.budgetRevision + 1,
    baseMaxTurns: maxTurns ?? null,
    effectiveMaxTurns: maxTurns === undefined ? null : maxTurns + currentBudget.grantedTurns,
  };
  state.workItems[data.workItemId] = {
    ...item,
    outcome: nextContract.outcome,
    requiredEvidenceKinds: nextContract.evidenceObligations.map(({ kind }) => kind),
    contract: nextContract,
    contractRevision: data.contractRevision,
    contractHistory: history,
    turnBudget: budget,
    revision: item.revision + 1,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
    condition: null,
  };
  if (proposal) updateProposalDisposition(state, proposal, "approved", event.eventId);
}

function recordQuestion(
  state: WorkTruthState,
  event: ProjectEvent,
  staffing: StaffingTruth,
  sourceRevision: number,
): void {
  const parsed = validateWorkQuestionAskedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const item = state.workItems[parsed.value.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", parsed.value.workItemId);
    return;
  }
  if (!authorizedAssignedAgent(event, item, staffing)) {
    issue(
      state,
      "WORK_SPEECH_ACT_UNAUTHORIZED",
      event,
      "the authenticated agent must hold this work item's active role assignment",
      parsed.value.workItemId,
    );
    return;
  }
  addSpeechAct(state, item, event, sourceRevision, {
    kind: "work.question_asked",
    question: parsed.value.question,
  });
}

function recordRescopeProposal(
  state: WorkTruthState,
  event: ProjectEvent,
  staffing: StaffingTruth,
  sourceRevision: number,
): void {
  const parsed = validateWorkRescopeProposedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  if (!authorizedAssignedAgent(event, item, staffing)) {
    issue(
      state,
      "WORK_SPEECH_ACT_UNAUTHORIZED",
      event,
      "the authenticated agent must hold this work item's active role assignment",
      data.workItemId,
    );
    return;
  }
  if (!item.contract || item.contractRevision !== data.expectedContractRevision) {
    issue(
      state,
      "WORK_SPEECH_ACT_STALE",
      event,
      "proposal expected contract revision " +
        data.expectedContractRevision +
        ", current is " +
        String(item.contractRevision),
      data.workItemId,
    );
    return;
  }
  if (findProposal(state, data.proposalId)) {
    issue(
      state,
      "WORK_SPEECH_ACT_DUPLICATE",
      event,
      "proposalId has already been used",
      data.workItemId,
    );
    return;
  }
  addSpeechAct(state, item, event, sourceRevision, {
    kind: "work.rescope_proposed",
    proposalId: data.proposalId,
    expectedContractRevision: data.expectedContractRevision,
    contract: data.contract,
    status: "open",
  });
}

function recordRescopeDecline(
  state: WorkTruthState,
  event: ProjectEvent,
  sourceRevision: number,
): void {
  const parsed = validateWorkRescopeDeclinedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  const proposal = findProposal(state, data.proposalId);
  if (!managerEvent(event) || event.actor?.actorType !== "manager") {
    issue(
      state,
      "UNAUTHORIZED_WORK_DECISION",
      event,
      "only an attributed manager may decline a rescope proposal",
      data.workItemId,
    );
    return;
  }
  if (!proposal || proposal.workItemId !== data.workItemId || proposal.status !== "open") {
    issue(
      state,
      "WORK_SPEECH_ACT_DISPOSITION_CONFLICT",
      event,
      "decline requires one open proposal for this work item",
      data.workItemId,
    );
    return;
  }
  updateProposalDisposition(state, proposal, "declined", event.eventId);
  addSpeechAct(state, state.workItems[data.workItemId]!, event, sourceRevision, {
    kind: "work.rescope_declined",
    proposalId: data.proposalId,
    reason: data.reason,
  });
}

function recordSendBackDispute(
  state: WorkTruthState,
  event: ProjectEvent,
  staffing: StaffingTruth,
  sourceRevision: number,
): void {
  const parsed = validateWorkSendBackDisputedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  if (!authorizedAssignedAgent(event, item, staffing)) {
    issue(
      state,
      "WORK_SPEECH_ACT_UNAUTHORIZED",
      event,
      "the authenticated agent must hold this work item's active role assignment",
      data.workItemId,
    );
    return;
  }
  const ruling = state.rulings?.[data.rulingId];
  if (
    !ruling ||
    ruling.workItemId !== data.workItemId ||
    ruling.decision !== "send_back" ||
    ruling.withdrawn ||
    item.currentRulingId !== data.rulingId
  ) {
    issue(
      state,
      "WORK_SPEECH_ACT_REFERENCE_INVALID",
      event,
      "dispute must reference the current non-withdrawn send-back ruling for this work item",
      data.workItemId,
    );
    return;
  }
  if (findDispute(state, data.rulingId)) {
    issue(
      state,
      "WORK_SPEECH_ACT_DUPLICATE",
      event,
      "this send-back ruling already has an agent dispute",
      data.workItemId,
    );
    return;
  }
  addSpeechAct(state, item, event, sourceRevision, {
    kind: "work.send_back_disputed",
    rulingId: data.rulingId,
    statement: data.statement,
  });
}

function authorizedAssignedAgent(
  event: ProjectEvent,
  item: WorkItemTruth,
  staffing: StaffingTruth,
): boolean {
  const assignmentId = event.roleAssignmentId;
  const actor = event.actor;
  return Boolean(
    actor?.actorType === "agent" &&
    assignmentId &&
    item.assignment?.roleAssignmentId === assignmentId &&
    staffing.assignments[assignmentId]?.agentId === actor.actorId,
  );
}

function addSpeechAct(
  state: WorkTruthState,
  item: WorkItemTruth,
  event: ProjectEvent,
  sourceRevision: number,
  content: WorkSpeechActContent,
): void {
  const actor = event.actor;
  if (!actor) return;
  const record = {
    eventId: event.eventId,
    workItemId: item.workItemId,
    occurredAt: event.occurredAt,
    sourceRevision,
    source: event.source,
    trust: event.trust,
    actor,
    ...(event.roleAssignmentId ? { roleAssignmentId: event.roleAssignmentId } : {}),
    ...content,
  } as WorkSpeechActTruth;
  state.workItems[item.workItemId] = {
    ...item,
    speechActs: [...(item.speechActs ?? []), record].sort(
      (left, right) => left.sourceRevision - right.sourceRevision,
    ),
  };
}

function findProposal(
  state: WorkTruthState,
  proposalId: string,
): Extract<WorkSpeechActTruth, { kind: "work.rescope_proposed" }> | undefined {
  for (const item of Object.values(state.workItems)) {
    const proposal = item.speechActs?.find(
      (entry): entry is Extract<WorkSpeechActTruth, { kind: "work.rescope_proposed" }> =>
        entry.kind === "work.rescope_proposed" && entry.proposalId === proposalId,
    );
    if (proposal) return proposal;
  }
  return undefined;
}

function findDispute(
  state: WorkTruthState,
  rulingId: string,
): Extract<WorkSpeechActTruth, { kind: "work.send_back_disputed" }> | undefined {
  return Object.values(state.workItems)
    .flatMap((item) => item.speechActs ?? [])
    .find(
      (entry): entry is Extract<WorkSpeechActTruth, { kind: "work.send_back_disputed" }> =>
        entry.kind === "work.send_back_disputed" && entry.rulingId === rulingId,
    );
}

function updateProposalDisposition(
  state: WorkTruthState,
  proposal: Extract<WorkSpeechActTruth, { kind: "work.rescope_proposed" }>,
  status: "approved" | "declined",
  eventId: string,
): void {
  const item = state.workItems[proposal.workItemId];
  if (!item?.speechActs) return;
  state.workItems[proposal.workItemId] = {
    ...item,
    speechActs: item.speechActs.map((entry) =>
      entry.eventId === proposal.eventId && entry.kind === "work.rescope_proposed"
        ? { ...entry, status, dispositionEventId: eventId }
        : entry,
    ),
  };
}

function grantTurns(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateWorkTurnsGrantedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  const budget = item.turnBudget;
  if (!managerEvent(event)) {
    issue(
      state,
      "UNAUTHORIZED_WORK_DECISION",
      event,
      "only a verified manager may grant turns",
      data.workItemId,
    );
    return;
  }
  if (!budget?.budgetRecorded || data.budgetRevision !== budget.budgetRevision) {
    issue(
      state,
      "TURN_BUDGET_INVALID",
      event,
      `expected budget revision ${String(budget?.budgetRevision)}, received ${data.budgetRevision}`,
      data.workItemId,
    );
    return;
  }
  state.workItems[data.workItemId] = {
    ...item,
    turnBudget: {
      ...budget,
      budgetRevision: budget.budgetRevision + 1,
      grantedTurns: budget.grantedTurns + data.turnsGranted,
      effectiveMaxTurns: budget.effectiveMaxTurns! + data.turnsGranted,
    },
    revision: item.revision + 1,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
  };
}

function closeIncomplete(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateWorkClosedIncompletePayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const { workItemId, fromRevision } = parsed.value;
  const item = state.workItems[workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", workItemId);
    return;
  }
  if (
    !managerEvent(event) ||
    item.revision !== fromRevision ||
    transitions[item.state].length === 0
  ) {
    issue(
      state,
      "INVALID_WORK_TRANSITION",
      event,
      "close-incomplete requires a current non-terminal work revision and verified manager",
      workItemId,
    );
    return;
  }
  state.workItems[workItemId] = {
    ...item,
    state: "closed_incomplete",
    revision: item.revision + 1,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
    condition: null,
  };
}

function recordRuling(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateWorkRulingRecordedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  if (!managerEvent(event)) {
    issue(
      state,
      "UNAUTHORIZED_WORK_DECISION",
      event,
      "only a verified manager may record a ruling",
      data.workItemId,
    );
    return;
  }
  if (state.rulings?.[data.rulingId]) {
    issue(state, "INVALID_WORK_RULING", event, "rulingId has already been used", data.workItemId);
    return;
  }
  if (item.revision !== data.sourceWorkRevision) {
    issue(
      state,
      "INVALID_WORK_RULING",
      event,
      `expected work revision ${item.revision}, received ${data.sourceWorkRevision}`,
      data.workItemId,
    );
    return;
  }
  const currentVersions = currentEvidenceVersions(state, data.workItemId);
  if (!sameEvidenceVersions(currentVersions, data.evidenceVersions)) {
    issue(
      state,
      "INVALID_WORK_RULING",
      event,
      "ruling evidenceVersions must match the latest recorded evidence snapshot",
      data.workItemId,
    );
    return;
  }
  if (data.decision === "defer" && Date.parse(data.resurfaceAt!) <= Date.parse(event.occurredAt)) {
    issue(
      state,
      "INVALID_WORK_RULING",
      event,
      "defer resurfaceAt must be after the ruling time",
      data.workItemId,
    );
    return;
  }
  if (data.decision === "accept" && !obligationsSatisfied(state, item)) {
    issue(
      state,
      "INVALID_WORK_RULING",
      event,
      "accept requires checked evidence for every current contract obligation",
      data.workItemId,
    );
    return;
  }
  if (
    (data.decision === "accept" ||
      data.decision === "accept_with_exception" ||
      data.decision === "send_back") &&
    item.state !== "review_requested"
  ) {
    issue(
      state,
      "INVALID_WORK_RULING",
      event,
      `${data.decision} requires review_requested state`,
      data.workItemId,
    );
    return;
  }
  const ruling: RulingTruth = {
    rulingId: data.rulingId,
    workItemId: data.workItemId,
    decision: data.decision,
    evidenceVersions: [...data.evidenceVersions],
    previousState: item.state,
    previousCondition: item.condition,
    eventId: event.eventId,
    recordedAt: event.occurredAt,
    sourceWorkRevision: data.sourceWorkRevision,
    withdrawn: false,
    ...(data.reason ? { reason: data.reason } : {}),
    ...(data.note ? { note: data.note } : {}),
    ...(data.resurfaceAt ? { resurfaceAt: data.resurfaceAt } : {}),
  };
  (state.rulings ??= {})[data.rulingId] = ruling;
  const ruledItem: WorkItemTruth = {
    ...item,
    state: rulingState(data.decision),
    revision: item.revision + 1,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
    condition: null,
    currentRulingId: data.rulingId,
  };
  if (data.decision === "defer") {
    ruledItem.resurface = {
      at: data.resurfaceAt!,
      due: null,
      projectedAt: null,
      eventId: event.eventId,
    };
  } else {
    delete ruledItem.resurface;
  }
  state.workItems[data.workItemId] = ruledItem;
}

function withdrawRuling(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateRulingWithdrawnPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const { workItemId, rulingId, evidenceVersions } = parsed.value;
  const item = state.workItems[workItemId];
  const ruling = state.rulings?.[rulingId];
  const elapsed = ruling ? Date.parse(event.occurredAt) - Date.parse(ruling.recordedAt) : Infinity;
  const restorable =
    !!item &&
    !!ruling &&
    managerEvent(event) &&
    ruling.workItemId === workItemId &&
    !ruling.withdrawn &&
    item.currentRulingId === rulingId &&
    item.updatedByEventId === ruling.eventId &&
    elapsed >= 0 &&
    elapsed <= 60_000 &&
    sameEvidenceVersions(currentEvidenceVersions(state, workItemId), ruling.evidenceVersions) &&
    sameEvidenceVersions(evidenceVersions, ruling.evidenceVersions);
  if (!restorable || !item || !ruling) {
    issue(
      state,
      "RULING_WITHDRAWAL_REFUSED",
      event,
      "the ruling is expired, changed, no longer current, or its evidence snapshot changed",
      workItemId,
    );
    return;
  }
  state.rulings![rulingId] = { ...ruling, withdrawn: true, withdrawnByEventId: event.eventId };
  const restored: WorkItemTruth = {
    ...item,
    state: ruling.previousState,
    condition: ruling.previousCondition,
    revision: item.revision + 1,
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
  };
  delete restored.currentRulingId;
  delete restored.resurface;
  state.workItems[workItemId] = restored;
}

function recordNudge(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateWorkNudgedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  if (!managerEvent(event) || item.assignment?.roleAssignmentId !== data.roleAssignmentId) {
    issue(
      state,
      "INVALID_NUDGE",
      event,
      "nudge requires a verified manager and the current assignment",
      data.workItemId,
    );
    return;
  }
  state.workItems[data.workItemId] = {
    ...item,
    nudges: [
      ...(item.nudges ?? []),
      {
        eventId: event.eventId,
        roleAssignmentId: data.roleAssignmentId,
        note: data.note,
        recordedAt: event.occurredAt,
      },
    ],
  };
}

function suppressNudge(state: WorkTruthState, event: ProjectEvent): void {
  const parsed = validateWorkNudgeSuppressedPayload(event.payload);
  if (!parsed.ok) {
    issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
    return;
  }
  const data = parsed.value;
  const item = state.workItems[data.workItemId];
  const duration = data.disposition === "snooze" ? 2 : 3;
  const expected = Date.parse(event.occurredAt) + duration * 24 * 60 * 60 * 1000;
  if (!item) {
    issue(state, "WORK_ITEM_NOT_FOUND", event, "work item does not exist", data.workItemId);
    return;
  }
  if (!managerEvent(event) || Date.parse(data.until) !== expected) {
    issue(
      state,
      "INVALID_NUDGE_SUPPRESSION",
      event,
      `suppression requires a verified manager and until = event time + ${duration} days`,
      data.workItemId,
    );
    return;
  }
  state.workItems[data.workItemId] = {
    ...item,
    nudgeSuppression: { disposition: data.disposition, until: data.until, eventId: event.eventId },
  };
}

function deriveWorkSummaries(
  state: WorkTruthState,
  input: readonly unknown[],
  asOf?: string,
): void {
  const parsedEvents = input
    .map(parseProjectEvent)
    .filter((entry) => entry.ok)
    .map((entry) => entry.value);
  for (const item of Object.values(state.workItems)) {
    if (item.turnBudget) {
      const count = countTurns(
        item.workItemId,
        parsedEvents,
        state.postures?.[item.workItemId] ?? [],
      );
      const budget = item.turnBudget;
      const exhausted =
        budget.effectiveMaxTurns === null || count.usedTurns === null
          ? null
          : count.usedTurns >= budget.effectiveMaxTurns;
      item.turnBudget = {
        ...budget,
        usedTurns: count.usedTurns,
        countComplete: count.complete,
        exhausted: count.complete ? exhausted : null,
        remainingTurns:
          count.complete && budget.effectiveMaxTurns !== null
            ? Math.max(0, budget.effectiveMaxTurns - count.usedTurns!)
            : null,
      };
    }
    if (item.resurface) {
      const projectedAt = asOf && Number.isFinite(Date.parse(asOf)) ? asOf : null;
      item.resurface = {
        ...item.resurface,
        projectedAt,
        due: projectedAt === null ? null : Date.parse(projectedAt) >= Date.parse(item.resurface.at),
      };
    }
  }
}

function countTurns(
  workItemId: string,
  events: readonly ProjectEvent[],
  postures: readonly PostureTruth[],
): { usedTurns: number | null; complete: boolean } {
  const runs = new Set(postures.map(({ runId }) => runId));
  const turnEvents = events.filter(
    (event) =>
      event.kind === "evidence.recorded" &&
      event.payload.workItemId === workItemId &&
      event.payload.kind === "turn-record",
  );
  if (runs.size === 0 && turnEvents.length === 0) return { usedTurns: 0, complete: true };
  if (
    runs.size === 0 ||
    [...runs].some((runId) => !turnEvents.some((event) => event.providerRunId === runId))
  ) {
    return { usedTurns: null, complete: false };
  }
  if (
    turnEvents.some(
      (event) =>
        event.source !== "adapter" ||
        event.trust !== "verified" ||
        typeof event.providerRunId !== "string" ||
        !runs.has(event.providerRunId) ||
        typeof event.payload.turn !== "number" ||
        !Number.isInteger(event.payload.turn) ||
        event.payload.turn < 1,
    )
  ) {
    return { usedTurns: null, complete: false };
  }
  const counts = new Map<string, number[]>();
  for (const event of turnEvents) {
    const values = counts.get(event.providerRunId!) ?? [];
    values.push(event.payload.turn as number);
    counts.set(event.providerRunId!, values);
  }
  let total = 0;
  for (const turns of counts.values()) {
    const unique = [...turns].sort((left, right) => left - right);
    if (
      new Set(unique).size !== unique.length ||
      unique.some((turn, index) => turn !== index + 1)
    ) {
      return { usedTurns: null, complete: false };
    }
    total += unique.length;
  }
  return { usedTurns: total, complete: true };
}

function currentEvidenceVersions(state: WorkTruthState, workItemId: string): EvidenceVersionRef[] {
  return Object.values(state.evidence)
    .filter(({ workItemId: id }) => id === workItemId)
    .map(({ evidenceId, version }) => ({ evidenceId, version }))
    .sort((left, right) =>
      left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0,
    );
}

function sameEvidenceVersions(
  left: readonly EvidenceVersionRef[],
  right: readonly EvidenceVersionRef[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.evidenceId === right[index]?.evidenceId && entry.version === right[index]?.version,
    )
  );
}

function obligationsSatisfied(state: WorkTruthState, item: WorkItemTruth): boolean {
  if (!item.contract) {
    return item.requiredEvidenceKinds.every((kind) =>
      Object.values(state.evidence).some(
        (record) =>
          record.workItemId === item.workItemId &&
          record.kind === kind &&
          record.trust === "verified" &&
          record.result === "passed",
      ),
    );
  }
  const revision = item.contractRevision;
  return item.contract.evidenceObligations.every(({ kind }) =>
    Object.values(state.evidence).some(
      (record) =>
        record.workItemId === item.workItemId &&
        record.kind === kind &&
        record.trust === "verified" &&
        record.result === "passed" &&
        (revision === undefined || record.applicableContractRevisions?.includes(revision)),
    ),
  );
}

function rulingState(decision: RulingTruth["decision"]): WorkState {
  if (decision === "accept") return "verified";
  if (decision === "accept_with_exception") return "verified_with_exception";
  if (decision === "send_back") return "active";
  return "paused";
}

function sortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function stringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function integerField(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function stringArrayField(payload: Record<string, unknown>, key: string): string[] | undefined {
  const value = payload[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function evidenceVersionField(
  payload: Record<string, unknown>,
  key: string,
): { evidenceId: string; version: number }[] | undefined {
  const value = payload[key];
  if (!Array.isArray(value)) return undefined;
  const result: { evidenceId: string; version: number }[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const evidenceId = stringField(item as Record<string, unknown>, "evidenceId");
    const version = integerField(item as Record<string, unknown>, "version");
    if (!evidenceId || version === undefined) return undefined;
    result.push({ evidenceId, version });
  }
  return result;
}

function issue(
  state: WorkTruthState,
  code: WorkTruthIssue["code"],
  event: ProjectEvent,
  message: string,
  workItemId?: string,
): void {
  state.issues.push({
    code,
    eventId: event.eventId,
    ...(workItemId ? { workItemId } : {}),
    message,
  });
}
