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

/**
 * ISO-8601 with an explicit UTC designator, and nothing else.
 *
 * Deliberately not "whatever Date.parse accepts". `Date.parse` takes "October 1, 2026" and an offset
 * like +02:00, and both of those stored in the project record mean a later reader has to know which
 * machine wrote them. Fractional seconds are optional because a time without them is still UTC.
 */
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

export type StoredDateViolation = { field: string; value: string };

/**
 * Every date this state would persist, checked as stored rather than as rendered. C-15.
 *
 * `presentDueDate` names a malformed date for a reader, which is a rendering decision and says
 * nothing about whether the project should be holding it. This is the other question: is what was
 * written back something a later reader can interpret without knowing where it came from.
 */
export function storedDateViolations(state: DecisionState): StoredDateViolation[] {
  const violations: StoredDateViolation[] = [];
  const check = (field: string, value: string): void => {
    if (!ISO_8601_UTC.test(value) || parsedTime(value) === null) violations.push({ field, value });
  };

  check("notice.dueAt", state.notice.dueAt);
  if (state.deferral) check("deferral.reviewAt", state.deferral.reviewAt);
  state.log.forEach((event, index) => {
    check(`log[${index}].at`, event.at);
    if (event.kind === "defer") check(`log[${index}].reviewAt`, event.reviewAt);
  });
  return violations;
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
  // Decision 7-B: the contract fixes this name, and it is what a screen reader reads aloud.
  disabled: { label: "Disabled", icon: "lock" },
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

export type PersistedStateRefusal =
  | "not-an-object"
  | "different-decision"
  | "unknown-status"
  | "invalid-revision"
  | "invalid-log"
  | "invalid-deferral"
  | "date-not-utc";

export type PersistedStateResult =
  { ok: true; state: DecisionState } | { ok: false; reason: PersistedStateRefusal };

const STATUSES = new Set(Object.keys(STATUS_SIGNATURES));

const isEvent = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  if (event.kind !== "acknowledge" && event.kind !== "defer" && event.kind !== "undo") return false;
  if (typeof event.actionId !== "string" || event.actionId.length === 0) return false;
  if (typeof event.at !== "string") return false;
  if (!Number.isInteger(event.revision) || (event.revision as number) < 1) return false;
  if (event.kind === "defer") {
    return typeof event.reason === "string" && typeof event.reviewAt === "string";
  }
  return true;
};

/**
 * Read a state that came back from storage, or refuse it and say which part was unreadable. C-05.
 *
 * This used to be one identity check: if the decision id matched, the whole object was adopted as
 * the project's belief about that decision. The adapter is injected, so whatever supplies it is
 * outside this module entirely — a corrupt payload was a decision the component made by accident.
 *
 * Refusing names a reason rather than returning a bare false, because the caller's obligation is to
 * tell someone that stored state was discarded, and "something was wrong with it" is not a thing a
 * person can act on.
 */
export function parsePersistedState(value: unknown, notice: DecisionNotice): PersistedStateResult {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "not-an-object" };
  const candidate = value as Record<string, unknown>;

  const savedNotice = candidate.notice as DecisionNotice | undefined;
  if (savedNotice?.decisionId !== notice.decisionId) {
    return { ok: false, reason: "different-decision" };
  }
  if (typeof candidate.status !== "string" || !STATUSES.has(candidate.status)) {
    return { ok: false, reason: "unknown-status" };
  }
  if (!Number.isInteger(candidate.revision) || (candidate.revision as number) < 0) {
    return { ok: false, reason: "invalid-revision" };
  }
  if (!Array.isArray(candidate.log) || !candidate.log.every(isEvent)) {
    return { ok: false, reason: "invalid-log" };
  }
  const deferral = candidate.deferral;
  if (deferral !== null && deferral !== undefined) {
    const record = deferral as Record<string, unknown>;
    if (typeof record.reason !== "string" || typeof record.reviewAt !== "string") {
      return { ok: false, reason: "invalid-deferral" };
    }
  }

  const state = {
    ...(candidate as unknown as DecisionState),
    deferral: (deferral ?? null) as DecisionState["deferral"],
  };
  // Every date it carries, checked as stored. A state whose timestamps cannot be interpreted without
  // knowing which machine wrote them is not a state this project can reason about later. C-15.
  if (storedDateViolations(state).length > 0) return { ok: false, reason: "date-not-utc" };

  return { ok: true, state };
}
