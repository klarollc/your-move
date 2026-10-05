/**
 * Payload contracts for work events (Phase 7-O spec §3.1–3.2, plan P-2).
 *
 * The event envelope stays at `schemaVersion: 1` and keeps `payload` open, as it always has. What
 * this module adds is a versioned contract for the payloads that carry decision detail:
 *
 * - `work.assigned` / `work.released` bind a work item to a role assignment. With staffing's role
 *   assignment → agent record, that makes work → agent a chain of canonical records, never a join by
 *   name or position.
 * - `work.transitioned` gains `payloadVersion: 2`. A version-2 transition into an attention-raising
 *   state must say why, on whom it waits, and what the manager is asked to do. Version-1 payloads,
 *   which carry no version field, keep exactly their old meaning so every recorded log still replays.
 * - `payloadVersion: 3` (DF-029, spec §10.1) makes the request optional for `blocked` and
 *   `waiting_input`: a condition says who can resolve it, and separately whether the manager is
 *   asked to act. Waiting on the manager, and a review, still require a request. Version 2 keeps its
 *   exact meaning: there, every condition asks the manager.
 */

export const workConditionReasonCodes = [
  "awaiting_evidence",
  "awaiting_decision",
  "awaiting_permission",
  "awaiting_clarification",
  "dependency_blocked",
  "external_unavailable",
  "review_requested",
] as const;

export const waitingOnKinds = ["manager", "agent", "external", "evidence"] as const;

export const requestedActionKinds = [
  "approve",
  "decline",
  "defer",
  "cancel",
  "redirect",
  "provide_evidence",
  "answer_question",
] as const;

/** Transitions into these states raise manager attention and, from version 2, carry a condition. */
export const attentionRaisingStates = ["blocked", "waiting_input", "review_requested"] as const;

export type WorkConditionReasonCode = (typeof workConditionReasonCodes)[number];
export type WaitingOnKind = (typeof waitingOnKinds)[number];
export type RequestedActionKind = (typeof requestedActionKinds)[number];

export type RequestedAction = { kind: RequestedActionKind; summary: string };

export type WorkCondition = {
  reasonCode: WorkConditionReasonCode;
  summary: string;
  waitingOn: { kind: WaitingOnKind; id?: string };
  requestedAction: RequestedAction;
};

/** A version-3 condition: the request is optional where someone other than the manager resolves it. */
// Declared in full rather than derived with `Omit`: a type from the TypeScript library is not event
// vocabulary, and scripts/office-literal-guard.mjs would guard it as an office record.
export type WorkConditionV3 = {
  reasonCode: WorkConditionReasonCode;
  summary: string;
  waitingOn: { kind: WaitingOnKind; id?: string };
  requestedAction?: RequestedAction;
};

/** Version-3 targets whose condition may omit the request (spec §10.1). */
const REQUEST_OPTIONAL_STATES: readonly string[] = ["blocked", "waiting_input"];

export type WorkTransitionPayload =
  | { workItemId: string; fromRevision: number; toState: string; payloadVersion: 1 }
  | {
      workItemId: string;
      fromRevision: number;
      toState: string;
      payloadVersion: 2;
      condition?: WorkCondition;
    }
  | {
      workItemId: string;
      fromRevision: number;
      toState: string;
      payloadVersion: 3;
      condition?: WorkConditionV3;
    };

export type WorkAssignmentPayload = { workItemId: string; roleAssignmentId: string };

export type WorkPayloadResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

const SHA256 = /^[a-f0-9]{64}$/;

/** Validate the additive worktree identity without narrowing historical evidence payloads. */
export function validateEvidenceRecordedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<Record<string, unknown>> {
  const worktreeSha256 = payload.worktreeSha256;
  if (worktreeSha256 === undefined) return { ok: true, value: payload };
  if (typeof worktreeSha256 !== "string" || !SHA256.test(worktreeSha256)) {
    return {
      ok: false,
      issues: ["worktreeSha256 must be a 64-character lowercase hex digest"],
    };
  }
  return { ok: true, value: payload };
}

const WORK_ITEM_ID = /^work_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ROLE_ASSIGNMENT_ID = /^role-assignment_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_SUMMARY = 280;
/** The waiting-on kinds that name a canonical record, and so must identify it. */
const RECORD_KINDS: readonly WaitingOnKind[] = ["agent", "evidence"];

export function validateWorkAssignmentPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkAssignmentPayload> {
  const issues: string[] = [];
  const extra = Object.keys(payload).filter(
    (key) => key !== "workItemId" && key !== "roleAssignmentId",
  );
  if (extra.length > 0) issues.push(`unexpected fields: ${extra.sort().join(", ")}`);
  if (!matches(payload.workItemId, WORK_ITEM_ID)) issues.push("workItemId is missing or malformed");
  if (!matches(payload.roleAssignmentId, ROLE_ASSIGNMENT_ID)) {
    issues.push("roleAssignmentId is missing or malformed");
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      roleAssignmentId: payload.roleAssignmentId as string,
    },
  };
}

export function validateWorkTransitionPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkTransitionPayload> {
  const issues: string[] = [];
  const { workItemId, fromRevision, toState } = payload;
  if (typeof workItemId !== "string" || workItemId.length === 0) {
    issues.push("workItemId is missing");
  }
  if (typeof fromRevision !== "number" || !Number.isInteger(fromRevision) || fromRevision < 0) {
    issues.push("fromRevision must be a non-negative integer");
  }
  if (typeof toState !== "string" || toState.length === 0) issues.push("toState is missing");

  const version = payload.payloadVersion ?? 1;
  if (version !== 1 && version !== 2 && version !== 3) {
    issues.push(`unsupported payloadVersion ${String(version)}`);
  }

  if (version === 1 && "condition" in payload) {
    issues.push("condition requires payloadVersion 2");
  }

  let condition: WorkConditionV3 | undefined;
  if (version === 2 || version === 3) {
    const raises = (attentionRaisingStates as readonly unknown[]).includes(toState);
    if (raises && !("condition" in payload)) {
      issues.push(`a version-${version} transition to ${String(toState)} requires a condition`);
    } else if (!raises && "condition" in payload) {
      issues.push(`a transition to ${String(toState)} raises no attention and takes no condition`);
    } else if (raises) {
      const checked = validateCondition(payload.condition, version, String(toState));
      if (checked.ok) condition = checked.value;
      else issues.push(...checked.issues);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  const core = {
    workItemId: workItemId as string,
    fromRevision: fromRevision as number,
    toState: toState as string,
  };
  if (version === 1) return { ok: true, value: { ...core, payloadVersion: 1 } };
  if (version === 3) {
    return {
      ok: true,
      value: condition ? { ...core, payloadVersion: 3, condition } : { ...core, payloadVersion: 3 },
    };
  }
  return {
    ok: true,
    value: condition
      ? { ...core, payloadVersion: 2, condition: condition as WorkCondition }
      : { ...core, payloadVersion: 2 },
  };
}

function validateCondition(
  value: unknown,
  version: 2 | 3,
  toState: string,
): WorkPayloadResult<WorkConditionV3> {
  if (!isRecord(value)) return { ok: false, issues: ["condition must be an object"] };
  const issues: string[] = [];
  const allowed = ["reasonCode", "summary", "waitingOn", "requestedAction"];
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) issues.push(`condition has unexpected fields: ${extra.sort().join(", ")}`);

  if (!includes(workConditionReasonCodes, value.reasonCode)) {
    issues.push("condition.reasonCode is not a known reason");
  }
  if (!isSummary(value.summary)) {
    issues.push(`condition.summary must be 1-${MAX_SUMMARY} characters`);
  }

  const waitingOn = value.waitingOn;
  if (!isRecord(waitingOn) || !includes(waitingOnKinds, waitingOn.kind)) {
    issues.push("condition.waitingOn.kind is not a known kind");
  } else {
    const keys = Object.keys(waitingOn).filter((key) => key !== "kind" && key !== "id");
    if (keys.length > 0) issues.push("condition.waitingOn has unexpected fields");
    const id = waitingOn.id;
    if (id !== undefined && (typeof id !== "string" || id.length === 0)) {
      issues.push("condition.waitingOn.id must be a non-empty string");
    }
    if (RECORD_KINDS.includes(waitingOn.kind) && id === undefined) {
      issues.push(`condition.waitingOn.id is required when waiting on ${waitingOn.kind}`);
    }
    if (waitingOn.kind === "manager" && id !== undefined) {
      issues.push("condition.waitingOn.id is not taken when waiting on the manager");
    }
  }

  const action = value.requestedAction;
  if (action === undefined && version === 3) {
    // Version 3 only: an absent request is allowed unless the manager is the one waited on, or the
    // target is a review. Version 2 falls through to its unchanged check below.
    if (isRecord(waitingOn) && waitingOn.kind === "manager") {
      issues.push("waiting on the manager requires a requested action");
    } else if (!REQUEST_OPTIONAL_STATES.includes(toState)) {
      issues.push(`${toState} requires a requested action`);
    }
  } else if (!isRecord(action) || !includes(requestedActionKinds, action.kind)) {
    issues.push("condition.requestedAction.kind is not a known action");
  } else {
    if (Object.keys(action).some((key) => key !== "kind" && key !== "summary")) {
      issues.push("condition.requestedAction has unexpected fields");
    }
    if (!isSummary(action.summary)) {
      issues.push(`condition.requestedAction.summary must be 1-${MAX_SUMMARY} characters`);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  const waiting = waitingOn as { kind: WaitingOnKind; id?: string };
  const requested = action as { kind: RequestedActionKind; summary: string } | undefined;
  const core = {
    reasonCode: value.reasonCode as WorkConditionReasonCode,
    summary: value.summary as string,
    waitingOn:
      waiting.id === undefined ? { kind: waiting.kind } : { kind: waiting.kind, id: waiting.id },
  };
  return {
    ok: true,
    value: requested
      ? { ...core, requestedAction: { kind: requested.kind, summary: requested.summary } }
      : core,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isSummary(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_SUMMARY;
}

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
