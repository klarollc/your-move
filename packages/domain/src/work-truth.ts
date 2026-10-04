import {
  parseProjectEvent,
  validateWorkAssignmentPayload,
  validateWorkCreatedPayload,
  validateWorkTransitionPayload,
  type ProjectEvent,
  type WorkConditionV3,
  type WorkContract,
} from "@cuckcode/contracts";

import { applyStaffingEvent, createStaffingTruth, type StaffingTruth } from "./staffing-truth.js";

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
  | "cancelled";

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
};

export type EvidenceTruth = {
  evidenceId: string;
  workItemId: string;
  kind: string;
  version: number;
  result: "passed" | "failed";
  eventId: string;
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
    | "WORK_ORPHANED";
  eventId: string;
  workItemId?: string;
  message: string;
};

export type WorkTruthState = {
  workItems: Record<string, WorkItemTruth>;
  evidence: Record<string, EvidenceTruth>;
  approvals: Record<string, ApprovalTruth>;
  issues: WorkTruthIssue[];
};

const transitions: Record<WorkState, readonly WorkState[]> = {
  draft: ["ready", "cancelled"],
  ready: ["assigned", "cancelled"],
  assigned: ["active", "waiting_input", "blocked", "failed", "paused", "cancelled"],
  active: ["review_requested", "waiting_input", "blocked", "failed", "paused", "cancelled"],
  review_requested: ["verified", "active", "blocked", "failed", "cancelled"],
  verified: ["completed", "active", "cancelled"],
  completed: [],
  waiting_input: ["active", "blocked", "failed", "paused", "cancelled"],
  blocked: ["active", "failed", "paused", "cancelled"],
  failed: ["active", "cancelled"],
  paused: ["active", "cancelled"],
  cancelled: [],
};

export function reduceWorkTruth(input: readonly unknown[]): WorkTruthState {
  const state: WorkTruthState = { workItems: {}, evidence: {}, approvals: {}, issues: [] };
  // Work assignment is valid only against staffing as it stood at that point in the log, so
  // staffing is replayed alongside, through its own reducer, and never re-derived here.
  const staffing = createStaffingTruth();

  for (const candidate of input) {
    const parsed = parseProjectEvent(candidate);
    if (!parsed.ok) continue;
    const event = parsed.value;
    applyStaffingEvent(staffing, event);
    if (event.kind === "work.created") createWorkItem(state, event);
    if (event.kind === "evidence.recorded") recordEvidence(state, event);
    if (event.kind === "work.transitioned") transitionWorkItem(state, event);
    if (event.kind === "approval.recorded") recordApproval(state, event);
    if (event.kind === "work.assigned") assignWork(state, event, staffing);
    if (event.kind === "work.released") releaseWork(state, event);
    if (event.kind === "role.released") orphanReleasedWork(state, event, staffing);
  }

  return state;
}

function createWorkItem(state: WorkTruthState, event: ProjectEvent): void {
  // Version 2 carries the bounded work contract (W3). Version 1 keeps its exact old meaning.
  if (event.payload.payloadVersion !== undefined) {
    const parsed = validateWorkCreatedPayload(event.payload);
    if (!parsed.ok) {
      issue(state, "MALFORMED_WORK_EVENT", event, parsed.issues.join("; "));
      return;
    }
    const { workItemId, outcome, requiredEvidenceKinds, contract } = parsed.value;
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
  };
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
