import {
  DEFAULT_MAX_REASON_LENGTH,
  applyAction,
  createDecisionState,
  deriveStatus,
  parsePersistedState,
  presentDueDate,
  presentSeverity,
  resolveEvidenceLink,
  statusSignature,
  type Clock,
  type DecisionAction,
  type DecisionNotice,
  type DecisionState,
  type DecisionStatus,
  type EvidenceLinkState,
  type ValidationCode,
} from "@cuckcode/domain";
import { useEffect, useRef, useState, type FormEvent } from "react";

import "./decision-notice.css";

export type DecisionNoticeStorage = Readonly<{
  load: () => DecisionState | null;
  save: (state: DecisionState) => void | Promise<void>;
}>;

export type DecisionNoticeCardProps = Readonly<{
  notice: DecisionNotice;
  fixture: ReadonlyMap<string, string>;
  clock: Clock;
  storage: DecisionNoticeStorage;
  idSource: () => string;
  locale: string;
  animationPolicy: "standard" | "reduced";
  maxReasonLength?: number;
}>;

type FocusRequest = "reason" | "review-date" | "retry" | "status" | "undo";
type ValidationState = "reason-empty" | "reason-too-long" | "date-invalid";

const evidenceLabels: Record<EvidenceLinkState, string> = {
  resolved: "Evidence available",
  missing: "Evidence missing",
  invalid: "Evidence reference invalid",
  unavailable: "Evidence unavailable",
};

const validationLabels: Record<ValidationState, { label: string; detail: string }> = {
  "reason-empty": {
    label: "Deferral reason error: reason required",
    detail: "Reason required. Add a short explanation before deferring.",
  },
  "reason-too-long": {
    label: "Deferral reason error: reason too long",
    detail: "Reason too long. Shorten the explanation before deferring.",
  },
  "date-invalid": {
    label: "Deferral review date error: invalid future date required",
    detail: "Review date invalid. Choose a future date.",
  },
};

/**
 * Decision 7-D: the surface owns every sentence a person hears.
 *
 * The core's `detail` strings are written for a log — one of them said "focus returns to the date
 * field", which is an instruction to whoever implements the focus move, and it was being read aloud
 * by a screen reader. The core keeps those strings; nothing announces them. Every refusal code the
 * core can return is mapped here, so a code added later without a sentence is a type error rather
 * than a developer string arriving in someone's ear.
 */
const refusalWording: Record<
  ValidationCode,
  { validation: ValidationState | null; detail: string }
> = {
  "reason-empty": { validation: "reason-empty", detail: validationLabels["reason-empty"].detail },
  "reason-too-long": {
    validation: "reason-too-long",
    detail: validationLabels["reason-too-long"].detail,
  },
  "date-invalid": { validation: "date-invalid", detail: validationLabels["date-invalid"].detail },
  "malformed-event": {
    validation: "date-invalid",
    detail: validationLabels["date-invalid"].detail,
  },
  "already-actioned": {
    validation: null,
    detail: "This decision has already been actioned. Undo it before recording another change.",
  },
  "duplicate-event": {
    validation: null,
    detail: "That change was already recorded. Nothing was applied twice.",
  },
  "stale-event": {
    validation: null,
    detail: "There is nothing to undo on this decision.",
  },
  "out-of-order-event": {
    validation: null,
    detail: "That change arrived out of order and was not applied.",
  },
};

type PendingSave = Readonly<{
  nextState: DecisionState;
  action: DecisionAction;
}>;

export function DecisionNoticeCard({
  notice,
  fixture,
  clock,
  storage,
  idSource,
  locale,
  animationPolicy,
  maxReasonLength = DEFAULT_MAX_REASON_LENGTH,
}: DecisionNoticeCardProps) {
  const [loaded] = useState(() => loadState(notice, storage));
  const [state, setState] = useState<DecisionState>(loaded.state);
  const [displayStatus, setDisplayStatus] = useState<DecisionStatus | null>(null);
  const [deferOpen, setDeferOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [announcement, setAnnouncement] = useState(
    loaded.refusal === null
      ? "Decision notice loaded"
      : `Decision notice loaded. A saved state could not be read (${loaded.refusal}) and was not applied; this decision is shown from the start.`,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const reviewDateRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  const status = displayStatus ?? deriveStatus(state, clock);
  const signature = statusSignature(status);
  const dueDate = presentDueDate(notice.dueAt, locale);
  const severity = presentSeverity(notice.severity);
  const severityKey = typeof notice.severity === "string" ? notice.severity : "unknown";
  const canAct =
    state.status === "pending" &&
    status !== "disabled" &&
    status !== "saving" &&
    status !== "save-failed";
  const lastEvent = state.log.at(-1);
  const canUndo =
    (state.status === "acknowledged" || state.status === "deferred") &&
    (lastEvent?.kind === "acknowledge" || lastEvent?.kind === "defer") &&
    status !== "saving" &&
    status !== "save-failed";

  /**
   * Decision 9-D. C-10 names reload as one of the four transitions focus must handle, and a fresh
   * mount left focus on the document body — which the criterion forbids in as many words. Only a
   * mount that *restored* something moves focus; a first visit with nothing saved is not a reload.
   */
  useEffect(() => {
    if (loaded.state.log.length > 0 || loaded.refusal !== null) setFocusRequest("status");
    // Mount only: `loaded` is read once at construction, so a later save cannot re-trigger this.
    // Re-running it would end every action on the status rather than where the contract says.
  }, [loaded]);

  useEffect(() => {
    if (!focusRequest) return;
    const target =
      focusRequest === "reason"
        ? reasonRef.current
        : focusRequest === "review-date"
          ? reviewDateRef.current
          : focusRequest === "retry"
            ? retryRef.current
            : focusRequest === "undo"
              ? undoRef.current
              : statusRef.current;
    target?.focus();
    setFocusRequest(null);
  }, [focusRequest]);

  useEffect(() => {
    if (!deferOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDeferOpen(false);
      setValidation(null);
      setSaveError(null);
      setAnnouncement("Deferral editor closed; no decision change was recorded");
      setFocusRequest("status");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deferOpen]);

  const commit = async (pending: PendingSave) => {
    setPendingSave(pending);
    setDisplayStatus("saving");
    // The control the person just activated is about to be disabled. Disabling a focused element
    // drops focus to the body, so focus is moved somewhere named instead. C-10.
    setFocusRequest("status");
    setSaveError(null);
    setAnnouncement("Saving decision change");
    try {
      await storage.save(pending.nextState);
      setState(pending.nextState);
      setPendingSave(null);
      setDisplayStatus(null);
      setDeferOpen(false);
      setValidation(null);
      setSaveError(null);
      setAnnouncement(successAnnouncement(pending.action));
      setFocusRequest(pending.action.kind === "undo" ? "status" : "undo");
    } catch (error) {
      setDisplayStatus("save-failed");
      setSaveError(
        error instanceof Error ? error.message : "The fixture storage adapter rejected the save.",
      );
      setAnnouncement("Save failed. Your input is preserved; retry the decision change.");
      setFocusRequest("retry");
    }
  };

  /** The refusal's code decides where focus goes and which sentence is announced. Never its detail. */
  const reportFailure = (code: ValidationCode) => {
    const wording = refusalWording[code];
    setValidation(wording.validation);
    setAnnouncement(wording.detail);
    if (wording.validation === "reason-empty" || wording.validation === "reason-too-long") {
      setFocusRequest("reason");
      return;
    }
    setFocusRequest(wording.validation === "date-invalid" ? "review-date" : "status");
  };

  const apply = (action: DecisionAction) => {
    const result = applyAction(state, action, clock, maxReasonLength);
    if (!result.ok) {
      reportFailure(result.code);
      return;
    }
    void commit({ action, nextState: result.state });
  };

  const acknowledge = () => {
    if (!canAct) return;
    apply({ kind: "acknowledge", actionId: idSource(), at: clock.now() });
  };

  const submitDeferral = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAct) return;
    if (reason.trim().length === 0) {
      reportFailure("reason-empty");
      return;
    }
    if (reason.length > maxReasonLength) {
      reportFailure("reason-too-long");
      return;
    }
    if (reviewDate.length === 0) {
      reportFailure("date-invalid");
      return;
    }
    const reviewAt = reviewDate ? `${reviewDate}T00:00:00.000Z` : "";
    apply({
      kind: "defer",
      actionId: idSource(),
      at: clock.now(),
      reason,
      reviewAt,
    });
  };

  const retry = () => {
    if (!pendingSave) return;
    void commit(pendingSave);
  };

  return (
    <article
      className="decision-notice"
      aria-labelledby="decision-notice-title"
      aria-describedby="decision-notice-summary"
      data-animation-policy={animationPolicy}
      data-decision-id={notice.decisionId}
      data-status={status}
    >
      <header className="decision-notice__header">
        <div>
          <p className="decision-notice__eyebrow">Decision notice</p>
          <h1 id="decision-notice-title">{notice.title}</h1>
          <code className="decision-notice__id">{notice.decisionId}</code>
        </div>
        <div
          ref={statusRef}
          data-focus-target="status"
          className={`decision-notice__status decision-notice__status--${status}`}
          role="status"
          aria-label={signature.accessibleName}
          data-testid="decision-status-icon"
          data-status={status}
          tabIndex={-1}
        >
          <StatusIcon status={status} />
          <span>{signature.label}</span>
        </div>
      </header>

      <p id="decision-notice-summary" className="decision-notice__summary">
        {notice.summary}
      </p>

      <div className="decision-notice__metadata">
        <section
          className={`decision-notice__severity decision-notice__severity--${severityKey}`}
          aria-label={`Severity: ${severityKey}`}
        >
          <SeverityIcon severity={severityKey} />
          <div>
            <span className="decision-notice__label">Severity</span>
            <strong>{severity.label}</strong>
            {severity.sourceValue ? <code>Source value: {severity.sourceValue}</code> : null}
          </div>
        </section>
        <section
          className={`decision-notice__due-date ${dueDate.kind === "malformed" ? "decision-notice__due-date--malformed" : ""}`}
          aria-label="Due date"
        >
          <CalendarIcon malformed={dueDate.kind === "malformed"} />
          <div>
            <span className="decision-notice__label">Due date</span>
            <strong>{dueDate.label}</strong>
            {dueDate.rawValue ? <code>Source value: {dueDate.rawValue}</code> : null}
          </div>
        </section>
      </div>

      <section
        className="decision-notice__evidence"
        aria-labelledby="decision-notice-evidence-heading"
      >
        <div className="decision-notice__section-heading">
          <div>
            <span className="decision-notice__label">Supporting record</span>
            <h2 id="decision-notice-evidence-heading">Evidence links</h2>
          </div>
          <span>{notice.evidenceLinks.length} artifacts</span>
        </div>
        <ol className="decision-notice__evidence-list" data-testid="decision-evidence-list">
          {notice.evidenceLinks.map((link) => {
            const resolved = resolveEvidenceLink(link, fixture);
            const accessibleName = `Evidence link: ${resolved.state}, ${link.label}`;
            return (
              <li key={link.linkId} data-evidence-state={resolved.state}>
                <span className="decision-notice__evidence-icon" aria-hidden="true">
                  <EvidenceIcon state={resolved.state} />
                </span>
                <div>
                  <strong>{link.label}</strong>
                  <span>{evidenceLabels[resolved.state]}</span>
                  <code>{link.artifactPath}</code>
                </div>
                <button
                  type="button"
                  aria-label={accessibleName}
                  aria-disabled={resolved.state !== "resolved" || undefined}
                  onClick={() => {
                    if (resolved.state !== "resolved") return;
                    setAnnouncement(`${link.label} is available in the local fixture`);
                  }}
                >
                  {resolved.state === "resolved" ? "Inspect" : "Unavailable"}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {state.status === "deferred" && state.deferral ? (
        <section className="decision-notice__defer-summary" aria-label="Deferral details">
          <div>
            <span className="decision-notice__label">Next review</span>
            <strong>{presentDueDate(state.deferral.reviewAt, locale).label}</strong>
          </div>
          <div>
            <span className="decision-notice__label">Reason</span>
            <p>{state.deferral.reason}</p>
          </div>
        </section>
      ) : null}

      {status === "disabled" ? (
        <p className="decision-notice__disabled-note" role="note">
          This decision is disabled in the current workspace. The actions remain visible and inert,
          and no change can be recorded.
        </p>
      ) : null}

      {status === "save-failed" ? (
        <section
          className="decision-notice__failure"
          role="alert"
          aria-label="Decision save failed"
        >
          <div>
            <StatusIcon status="save-failed" />
            <strong>Save failed</strong>
          </div>
          <p>{saveError ?? "The fixture storage adapter rejected the save."}</p>
          <button ref={retryRef} data-focus-target="retry" type="button" onClick={retry}>
            Retry save
          </button>
        </section>
      ) : null}

      {deferOpen ? (
        <form
          className="decision-notice__defer-form"
          aria-label="Defer decision"
          onSubmit={submitDeferral}
        >
          <div className="decision-notice__section-heading">
            <div>
              <span className="decision-notice__label">Change the review date</span>
              <h2>Defer this decision</h2>
            </div>
            {/*
              Decision 7-A. The field used to carry maxLength, so the browser refused the 281st
              character and the over-length refusal could never fire for a person. The contract says
              the opposite: reject overlong input rather than truncate it, and show the count.
            */}
            <span
              data-testid="decision-reason-count"
              className="decision-notice__reason-count"
              data-over={reason.length > maxReasonLength ? "true" : "false"}
              aria-live="polite"
            >
              {reason.length > maxReasonLength
                ? `${reason.length - maxReasonLength} character${reason.length - maxReasonLength === 1 ? "" : "s"} over the ${maxReasonLength} limit`
                : `${maxReasonLength - reason.length} characters remaining of ${maxReasonLength}`}
            </span>
          </div>
          <div className="decision-notice__field">
            <label htmlFor="decision-notice-reason">
              Deferral reason <span aria-hidden="true">*</span>
            </label>
            <textarea
              ref={reasonRef}
              data-focus-target="reason"
              id="decision-notice-reason"
              name="reason"
              value={reason}
              aria-invalid={validation === "reason-empty" || validation === "reason-too-long"}
              aria-describedby={
                validation === "reason-empty" || validation === "reason-too-long"
                  ? "decision-notice-reason-error"
                  : undefined
              }
              onChange={(event) => {
                setReason(event.target.value);
                setValidation(null);
              }}
            />
            {validation === "reason-empty" || validation === "reason-too-long" ? (
              <p
                id="decision-notice-reason-error"
                className="decision-notice__validation"
                role="alert"
                aria-label={validationLabels[validation].label}
              >
                {validationLabels[validation].detail}
              </p>
            ) : null}
          </div>
          <div className="decision-notice__field">
            <label htmlFor="decision-notice-review-date">Review date</label>
            <input
              ref={reviewDateRef}
              data-focus-target="review-date"
              id="decision-notice-review-date"
              name="review-date"
              type="date"
              value={reviewDate}
              aria-invalid={validation === "date-invalid"}
              aria-describedby={
                validation === "date-invalid" ? "decision-notice-date-error" : undefined
              }
              onChange={(event) => {
                setReviewDate(event.target.value);
                setValidation(null);
              }}
            />
            {validation === "date-invalid" ? (
              <p
                id="decision-notice-date-error"
                className="decision-notice__validation"
                role="alert"
                aria-label={validationLabels[validation].label}
              >
                {validationLabels[validation].detail}
              </p>
            ) : null}
          </div>
          <div className="decision-notice__actions">
            <button type="button" onClick={() => setDeferOpen(false)}>
              Cancel deferral
            </button>
            <button
              type="submit"
              aria-disabled={
                status === "saving" ||
                status === "save-failed" ||
                status === "disabled" ||
                undefined
              }
            >
              Submit deferral
            </button>
          </div>
        </form>
      ) : null}

      <footer className="decision-notice__actions" aria-label="Decision actions">
        {/*
          Decision 7-C. These used to be removed from the DOM whenever the decision could not be
          acted on. A keyboard user then finds nothing where a control should be, and in `saving`
          focus is left on a button that vanished underneath the person who just activated it.
        */}
        <button
          type="button"
          className="decision-notice__primary"
          onClick={acknowledge}
          aria-disabled={!canAct || undefined}
        >
          Acknowledge
        </button>
        <button
          type="button"
          aria-disabled={!canAct || undefined}
          onClick={() => {
            if (!canAct) return;
            setDeferOpen(true);
            setValidation(null);
            setSaveError(null);
            setAnnouncement("Deferral editor opened");
            setFocusRequest("reason");
          }}
        >
          Defer
        </button>
        {canUndo ? (
          <button
            ref={undoRef}
            data-focus-target="undo"
            type="button"
            onClick={() => apply({ kind: "undo", actionId: idSource(), at: clock.now() })}
          >
            Undo latest decision change
          </button>
        ) : null}
        {status === "saving" ? <span className="decision-notice__saving-copy">Saving…</span> : null}
      </footer>

      <p className="decision-notice__announcement" aria-live="polite">
        {announcement}
      </p>
    </article>
  );
}

/**
 * Decision 9-A. A saved state is adopted only when every part of it reads, and a refusal is carried
 * back rather than swallowed.
 *
 * Starting fresh in silence would show a person "pending" for a decision they deferred, and nothing
 * anywhere would record that something was discarded. That is the substitution this project refuses
 * everywhere else in its evidence model, and it was happening here on every load.
 */
function loadState(
  notice: DecisionNotice,
  storage: DecisionNoticeStorage,
): { state: DecisionState; refusal: string | null } {
  let saved: unknown;
  try {
    saved = storage.load();
  } catch {
    return { state: createDecisionState(notice), refusal: "adapter-unavailable" };
  }
  if (saved === null || saved === undefined)
    return { state: createDecisionState(notice), refusal: null };

  const parsed = parsePersistedState(saved, notice);
  if (parsed.ok) return { state: parsed.state, refusal: null };
  // A state belonging to a different decision is not a fault; it is simply not this one's.
  if (parsed.reason === "different-decision") {
    return { state: createDecisionState(notice), refusal: null };
  }
  return { state: createDecisionState(notice), refusal: parsed.reason };
}

function successAnnouncement(action: DecisionAction): string {
  if (action.kind === "acknowledge") return "Decision acknowledged; undo available";
  if (action.kind === "defer") return "Decision deferred; undo available";
  return "Decision restored to pending";
}

function StatusIcon({ status }: Readonly<{ status: DecisionStatus }>) {
  return (
    <svg
      className="decision-notice__icon"
      data-status={status}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      {status === "acknowledged" ? <path d="m4 10 4 4 8-8" /> : null}
      {status === "deferred" ? <path d="M10 5v5l3 2M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" /> : null}
      {status === "overdue" ? <path d="M10 2 2 17h16L10 2Zm0 5v4m0 3v.1" /> : null}
      {status === "saving" ? <path d="M4 10h12M10 4v12" /> : null}
      {status === "save-failed" ? <path d="M10 2 2 17h16L10 2Zm0 5v5m0 3v.1" /> : null}
      {status === "disabled" ? <path d="m4 4 12 12M6 8V6a4 4 0 0 1 8 0v2m-9 0h10v8H5V8Z" /> : null}
      {status === "pending" ? <circle cx="10" cy="10" r="7" /> : null}
    </svg>
  );
}

function SeverityIcon({ severity }: Readonly<{ severity: string }>) {
  return (
    <svg
      className="decision-notice__icon"
      data-severity={severity}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      {severity === "routine" ? <circle cx="10" cy="10" r="4" /> : null}
      {severity === "significant" ? <path d="M4 7h12M4 13h12" /> : null}
      {severity === "critical" ? <path d="m10 2 7 7-7 9-7-9 7-7Zm0 5v4m0 3v.1" /> : null}
      {severity === "unknown" ? (
        <path d="M7.5 7.5a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.1-1.6 2.6m0 3v.1" />
      ) : null}
    </svg>
  );
}

function CalendarIcon({ malformed }: Readonly<{ malformed: boolean }>) {
  return (
    <svg
      className="decision-notice__icon"
      data-date-state={malformed ? "malformed" : "valid"}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M5 3v3m10-3v3M3 8h14M4 5h12a1 1 0 0 1 1 1v10H3V6a1 1 0 0 1 1-1Z" />
      {malformed ? <path d="m7 12 6 3m0-3-6 3" /> : null}
    </svg>
  );
}

function EvidenceIcon({ state }: Readonly<{ state: EvidenceLinkState }>) {
  return (
    <svg
      className="decision-notice__icon"
      data-evidence-icon={state}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M5 2h7l3 3v13H5V2Zm7 0v4h3" />
      {state === "resolved" ? <path d="m7 12 2 2 4-4" /> : null}
      {state === "missing" ? <path d="M7 12h5" /> : null}
      {state === "invalid" ? <path d="m7 11 5 5m0-5-5 5" /> : null}
      {state === "unavailable" ? <path d="M7 11h5" /> : null}
    </svg>
  );
}
