/**
 * The Decision Notice pure core.
 *
 * Pure by construction: no clock, no storage, no DOM. C-08 requires a deterministic injected clock
 * and IDs, and the way that requirement gets quietly broken is a core that reaches for `Date.now()`
 * because it is convenient. Nothing here can.
 *
 * Two properties hold across every function and are the ones worth breaking on purpose to check:
 * a refused action returns the state untouched (C-21), and the log is append-only, so an undo adds
 * an event rather than erasing the one it reverses (C-13).
 */

export type Severity = "routine" | "significant" | "critical";
export type SeverityValue = Severity | { unknown: string };

export type DecisionStatus =
  "pending" | "acknowledged" | "deferred" | "overdue" | "saving" | "save-failed" | "disabled";

export type EvidenceLinkState = "resolved" | "missing" | "invalid" | "unavailable";

export type EvidenceLink = {
  linkId: string;
  label: string;
  artifactPath: string;
};

export type DecisionNotice = {
  decisionId: string;
  title: string;
  summary: string;
  severity: SeverityValue;
  /** ISO-8601 UTC, or the raw value when it could not be parsed. */
  dueAt: string;
  evidenceLinks: EvidenceLink[];
};

export type DecisionAction =
  | { kind: "acknowledge"; actionId: string; at: string }
  | { kind: "defer"; actionId: string; at: string; reason: string; reviewAt: string }
  | { kind: "undo"; actionId: string; at: string };

export type DecisionEvent = DecisionAction & { revision: number };

export type ValidationCode =
  | "reason-empty"
  | "reason-too-long"
  | "date-invalid"
  | "already-actioned"
  | "duplicate-event"
  | "stale-event"
  | "malformed-event"
  | "out-of-order-event";

export type DecisionState = {
  notice: DecisionNotice;
  status: DecisionStatus;
  revision: number;
  /** Append-only. An undo adds an event; it never removes one. */
  log: DecisionEvent[];
  deferral: { reason: string; reviewAt: string } | null;
};

/** Injected, never ambient. C-08. */
export type Clock = { now: () => string };

export type ApplyResult =
  { ok: true; state: DecisionState } | { ok: false; code: ValidationCode; detail: string };

export const DEFAULT_MAX_REASON_LENGTH = 280;

const refuse = (code: ValidationCode, detail: string): ApplyResult => ({ ok: false, code, detail });

const parsedTime = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function createDecisionState(notice: DecisionNotice): DecisionState {
  return { notice, status: "pending", revision: 0, log: [], deferral: null };
}

/**
 * The order of these checks is load-bearing and is fixed by the criteria.
 *
 * A malformed event is refused as malformed even when the decision has already been actioned: the
 * event could not be understood, so "you already acted" would be a claim about an event nobody
 * successfully read. Reporting the deeper fault first is what keeps a refusal honest.
 */
export function applyAction(
  state: DecisionState,
  action: DecisionAction,
  clock: Clock,
  maxReasonLength: number = DEFAULT_MAX_REASON_LENGTH,
): ApplyResult {
  if (state.log.some((event) => event.actionId === action.actionId)) {
    return refuse("duplicate-event", `action ${action.actionId} has already been applied`);
  }

  const actionAt = parsedTime(action.at);
  if (actionAt === null) {
    return refuse("malformed-event", `action timestamp "${action.at}" is not a valid time`);
  }
  if (action.kind === "defer" && parsedTime(action.reviewAt) === null) {
    return refuse("malformed-event", `review time "${action.reviewAt}" is not a valid time`);
  }

  const latest = state.log.at(-1);
  if (latest !== undefined && actionAt < (parsedTime(latest.at) ?? 0)) {
    return refuse(
      "out-of-order-event",
      `action ${action.actionId} predates the last recorded event`,
    );
  }

  const nextRevision = state.revision + 1;
  const withEvent = (status: DecisionStatus, deferral: DecisionState["deferral"]): ApplyResult => ({
    ok: true,
    state: {
      ...state,
      status,
      revision: nextRevision,
      log: [...state.log, { ...action, revision: nextRevision }],
      deferral,
    },
  });

  if (action.kind === "undo") {
    if (state.status !== "acknowledged" && state.status !== "deferred") {
      return refuse("stale-event", "there is no action to undo");
    }
    // Append-only: the action being undone stays in the log. C-13.
    return withEvent("pending", null);
  }

  // Acknowledge and defer are mutually exclusive, and neither may be applied twice. C-12.
  if (state.status === "acknowledged" || state.status === "deferred") {
    return refuse("already-actioned", `the decision is already ${state.status}`);
  }

  if (action.kind === "defer") {
    const invalid = checkDeferral(action.reason, action.reviewAt, clock, maxReasonLength);
    if (invalid) return invalid;
    return withEvent("deferred", { reason: action.reason, reviewAt: action.reviewAt });
  }

  return withEvent("acknowledged", null);
}

/**
 * Deferral validation, in the order the criteria fix.
 *
 * Each refusal names the field focus returns to, because C-10 makes focus restoration part of the
 * contract rather than a detail the UI is left to invent.
 */
function checkDeferral(
  reason: string,
  reviewAt: string,
  clock: Clock,
  maxReasonLength: number,
): ApplyResult | undefined {
  if (reason.trim().length === 0) {
    return refuse(
      "reason-empty",
      "a deferral requires a reason; focus returns to the reason field",
    );
  }
  if (reason.length > maxReasonLength) {
    return refuse(
      "reason-too-long",
      `a deferral reason is bounded at ${maxReasonLength} characters; focus returns to the reason field`,
    );
  }
  if ((parsedTime(reviewAt) ?? 0) <= (parsedTime(clock.now()) ?? 0)) {
    return refuse(
      "date-invalid",
      "a review time must be in the future; focus returns to the date field",
    );
  }
  return undefined;
}

/**
 * Overdue is derived, never stored.
 *
 * Storing it would mean a decision is overdue because something remembered to write that down, and
 * the office would show a stale fact whenever nothing did.
 */
export function deriveStatus(state: DecisionState, clock: Clock): DecisionStatus {
  if (state.status !== "pending" && state.status !== "deferred") return state.status;
  const deadline =
    state.status === "deferred" ? (state.deferral?.reviewAt ?? "") : state.notice.dueAt;
  const due = parsedTime(deadline);
  const now = parsedTime(clock.now());
  if (due === null || now === null) return state.status;
  return now > due ? "overdue" : state.status;
}

const SEVERITY_LABELS: Record<Severity, string> = {
  routine: "Routine",
  significant: "Significant",
  critical: "Critical",
};

/** An unrecognised severity is a named state that discloses what it received. Never blank, never guessed. */
export function presentSeverity(severity: SeverityValue): {
  kind: "known" | "unknown";
  label: string;
  sourceValue?: string;
} {
  if (typeof severity === "string" && severity in SEVERITY_LABELS) {
    return { kind: "known", label: SEVERITY_LABELS[severity] };
  }
  const sourceValue = typeof severity === "string" ? severity : severity.unknown;
  return { kind: "unknown", label: "Unknown severity", sourceValue };
}

/** A malformed date is a named state carrying its raw value, so a reader can see what arrived. */
export function presentDueDate(
  dueAt: string,
  locale: string,
): { kind: "valid" | "malformed"; label: string; rawValue?: string } {
  const parsed = parsedTime(dueAt);
  if (parsed === null) {
    return { kind: "malformed", label: "Due date unavailable: malformed", rawValue: dueAt };
  }
  return {
    kind: "valid",
    label: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(parsed),
  };
}

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//iu;

/** Resolves against the supplied fixture and nothing else. No request ever leaves. C-11, C-16. */
export function resolveEvidenceLink(
  link: EvidenceLink,
  fixture: ReadonlyMap<string, string>,
): { state: EvidenceLinkState; accessibleName: string } {
  const named = (
    state: EvidenceLinkState,
    suffix: string,
  ): { state: EvidenceLinkState; accessibleName: string } => ({
    state,
    accessibleName: `${link.label}: ${suffix}`,
  });

  if (link.artifactPath.trim().length === 0) return named("invalid", "evidence link invalid");
  if (EXTERNAL_SCHEME.test(link.artifactPath)) {
    return named("unavailable", "evidence unavailable in this session");
  }
  if (!fixture.has(link.artifactPath)) return named("missing", "evidence missing");
  return named("resolved", "evidence available");
}

const STATUS_SIGNATURES: Record<DecisionStatus, { label: string; icon: string }> = {
  pending: { label: "Pending", icon: "circle-outline" },
  acknowledged: { label: "Acknowledged", icon: "check" },
  deferred: { label: "Deferred", icon: "clock" },
  overdue: { label: "Overdue", icon: "warning-triangle" },
  saving: { label: "Saving", icon: "spinner-static" },
  "save-failed": { label: "Save failed", icon: "error" },
  disabled: { label: "Unavailable", icon: "lock" },
};

/** Text and shape, never colour. No two statuses may share a signature. C-07. */
export function statusSignature(status: DecisionStatus): {
  label: string;
  icon: string;
  accessibleName: string;
} {
  const signature = STATUS_SIGNATURES[status];
  return { ...signature, accessibleName: `Decision status: ${signature.label.toLowerCase()}` };
}
