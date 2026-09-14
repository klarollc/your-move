/**
 * The Decision Notice pure core.
 *
 * This is the RED surface for Phase 5 Task 4. The types are real and the functions exist so that
 * tests fail on missing *behaviour* rather than on a missing import — a suite that fails to resolve
 * a module has not tested anything, and recording that as RED evidence would be recording a typo.
 *
 * Every function throws `NOT_IMPLEMENTED`. That is the expected failure reason for every criterion
 * at RED, declared in advance in `docs/evidence/phase-5/red-evidence.json` and compared against what
 * actually happens.
 *
 * The core is deliberately pure: no clock, no storage, no DOM. C-08 requires a deterministic
 * injected clock and IDs, and the way that requirement gets quietly broken is a core that reaches
 * for `Date.now()` because it is convenient.
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

export type ApplyResult =
  { ok: true; state: DecisionState } | { ok: false; code: ValidationCode; detail: string };

/** Injected, never ambient. C-08. */
export type Clock = { now: () => string };

const NOT_IMPLEMENTED = "NOT_IMPLEMENTED";

export function createDecisionState(notice: DecisionNotice): DecisionState {
  void notice;
  throw new Error(NOT_IMPLEMENTED);
}

export function applyAction(
  state: DecisionState,
  action: DecisionAction,
  clock: Clock,
  maxReasonLength?: number,
): ApplyResult {
  void state;
  void action;
  void clock;
  void maxReasonLength;
  throw new Error(NOT_IMPLEMENTED);
}

/** Derives the status shown to a viewer, including `overdue`, from state plus the injected clock. */
export function deriveStatus(state: DecisionState, clock: Clock): DecisionStatus {
  void state;
  void clock;
  throw new Error(NOT_IMPLEMENTED);
}

/** The severity as it must be presented, including the named unknown state. C-14. */
export function presentSeverity(severity: SeverityValue): {
  kind: "known" | "unknown";
  label: string;
  sourceValue?: string;
} {
  void severity;
  throw new Error(NOT_IMPLEMENTED);
}

/** The due date as it must be presented, including the named malformed state. C-15. */
export function presentDueDate(
  dueAt: string,
  locale: string,
): { kind: "valid" | "malformed"; label: string; rawValue?: string } {
  void dueAt;
  void locale;
  throw new Error(NOT_IMPLEMENTED);
}

/** Resolves one evidence link against the local fixture. Never fetches. C-16. */
export function resolveEvidenceLink(
  link: EvidenceLink,
  fixture: ReadonlyMap<string, string>,
): { state: EvidenceLinkState; accessibleName: string } {
  void link;
  void fixture;
  throw new Error(NOT_IMPLEMENTED);
}

/** The non-colour signature a viewer can use to tell one state from another. C-07. */
export function statusSignature(status: DecisionStatus): {
  label: string;
  icon: string;
  accessibleName: string;
} {
  void status;
  throw new Error(NOT_IMPLEMENTED);
}
