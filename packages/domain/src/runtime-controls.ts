import type { RuntimeCorrelation } from "@cuckcode/contracts";

type Continuity = {
  bindingFingerprint: string;
  capabilityFingerprint: string;
  permissionFingerprint: string;
  contextHash: string;
  eventCursor: number;
};

type PermissionRequest = {
  requestId: string;
  correlation: RuntimeCorrelation;
  operation: string;
  resource: string;
  expiresAt: number;
  decision?: "allow_once" | "deny";
  used: boolean;
};

export type RuntimeControlState = {
  continuity: Continuity;
  connected: boolean;
  actionsBlocked: boolean;
  cancelled: boolean;
  cancellation?: RuntimeCorrelation;
  permissions: Record<string, PermissionRequest>;
  issues: { code: string }[];
};

export function createRuntimeControlState(continuity: Continuity): RuntimeControlState {
  return {
    continuity: { ...continuity },
    connected: true,
    actionsBlocked: false,
    cancelled: false,
    permissions: {},
    issues: [],
  };
}

export function requestPermission(
  state: RuntimeControlState,
  request: Omit<PermissionRequest, "used" | "decision">,
): RuntimeControlState {
  return {
    ...state,
    permissions: {
      ...state.permissions,
      [request.requestId]: { ...request, correlation: { ...request.correlation }, used: false },
    },
  };
}

export function applyPermissionDecision(
  state: RuntimeControlState,
  decision: {
    requestId: string;
    correlation: RuntimeCorrelation;
    decision: "allow_once" | "deny";
    decidedBy: string;
    decidedAt: number;
  },
): RuntimeControlState {
  const request = state.permissions[decision.requestId];
  if (
    !request ||
    !sameCorrelation(request.correlation, decision.correlation) ||
    decision.decidedAt > request.expiresAt
  )
    return issue(state, "STALE_PERMISSION_DECISION");
  if (request.decision !== undefined) return issue(state, "DUPLICATE_PERMISSION_DECISION");
  return {
    ...state,
    permissions: {
      ...state.permissions,
      [request.requestId]: { ...request, decision: decision.decision },
    },
  };
}

export function consumePermission(
  state: RuntimeControlState,
  input: {
    requestId: string;
    correlation: RuntimeCorrelation;
    operation: string;
    resource: string;
    at: number;
  },
): { state: RuntimeControlState; allowed: boolean; reason: string } {
  const request = state.permissions[input.requestId];
  if (state.actionsBlocked || !state.connected || state.cancelled)
    return { state, allowed: false, reason: "RUNTIME_ACTIONS_BLOCKED" };
  if (!request) return { state, allowed: false, reason: "PERMISSION_NOT_FOUND" };
  if (input.at > request.expiresAt) return { state, allowed: false, reason: "PERMISSION_EXPIRED" };
  if (request.used) return { state, allowed: false, reason: "DECISION_ALREADY_USED" };
  if (
    request.decision !== "allow_once" ||
    request.operation !== input.operation ||
    request.resource !== input.resource ||
    !sameCorrelation(request.correlation, input.correlation)
  )
    return { state, allowed: false, reason: "PERMISSION_NOT_ALLOWED" };
  return {
    state: {
      ...state,
      permissions: { ...state.permissions, [request.requestId]: { ...request, used: true } },
    },
    allowed: true,
    reason: "ALLOWED_ONCE",
  };
}

export function requestCancellation(
  state: RuntimeControlState,
  correlation: RuntimeCorrelation,
): RuntimeControlState {
  return { ...state, actionsBlocked: true, cancellation: { ...correlation } };
}

export function recordCancellationTerminal(
  state: RuntimeControlState,
  correlation: RuntimeCorrelation,
): RuntimeControlState {
  if (!state.cancellation || !sameCorrelation(state.cancellation, correlation))
    return issue(state, "CANCELLATION_CORRELATION_MISMATCH");
  return { ...state, cancelled: true, actionsBlocked: true };
}

export function disconnectRuntime(state: RuntimeControlState): RuntimeControlState {
  return { ...state, connected: false, actionsBlocked: true };
}

export function reconcileRuntime(
  state: RuntimeControlState,
  observed: Continuity,
): RuntimeControlState {
  const matches = (Object.keys(state.continuity) as (keyof Continuity)[]).every(
    (key) => state.continuity[key] === observed[key],
  );
  if (!matches)
    return issue(
      { ...state, connected: false, actionsBlocked: true },
      "RECOVERY_RECONCILIATION_FAILED",
    );
  return { ...state, connected: true, actionsBlocked: state.cancelled };
}

function issue(state: RuntimeControlState, code: string): RuntimeControlState {
  return { ...state, issues: [...state.issues, { code }] };
}

function sameCorrelation(left: RuntimeCorrelation, right: RuntimeCorrelation): boolean {
  return (
    left.bindingId === right.bindingId &&
    left.providerRunId === right.providerRunId &&
    left.providerRequestId === right.providerRequestId &&
    left.threadId === right.threadId &&
    left.turnId === right.turnId &&
    left.itemId === right.itemId
  );
}
