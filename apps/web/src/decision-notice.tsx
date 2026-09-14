import {
  DEFAULT_MAX_REASON_LENGTH,
  applyAction,
  createDecisionState,
  deriveStatus,
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
  const [state, setState] = useState<DecisionState>(() => loadState(notice, storage));
  const [displayStatus, setDisplayStatus] = useState<DecisionStatus | null>(null);
  const [deferOpen, setDeferOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [announcement, setAnnouncement] = useState("Decision notice loaded");
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

  const reportFailure = (code: ValidationCode, detail: string) => {
    if (code === "reason-empty" || code === "reason-too-long") {
      setValidation(code);
      setFocusRequest("reason");
      setAnnouncement(detail);
      return;
    }
    if (code === "date-invalid" || code === "malformed-event") {
      setValidation("date-invalid");
      setFocusRequest("review-date");
      setAnnouncement(detail);
      return;
    }
    setAnnouncement(detail);
    setFocusRequest("status");
  };

  const apply = (action: DecisionAction) => {
    const result = applyAction(state, action, clock, maxReasonLength);
    if (!result.ok) {
      reportFailure(result.code, result.detail);
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
      reportFailure("reason-empty", validationLabels["reason-empty"].detail);
      return;
    }
    if (reason.length > maxReasonLength) {
      reportFailure("reason-too-long", validationLabels["reason-too-long"].detail);
      return;
    }
    if (reviewDate.length === 0) {
      reportFailure("date-invalid", validationLabels["date-invalid"].detail);
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
                  disabled={resolved.state !== "resolved"}
                  onClick={() => setAnnouncement(`${link.label} is available in the local fixture`)}
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
          This decision is unavailable in the current workspace. Actions are disabled and no change
          can be recorded.
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
          <button ref={retryRef} type="button" onClick={retry}>
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
            <span>
              {reason.length}/{maxReasonLength}
            </span>
          </div>
          <div className="decision-notice__field">
            <label htmlFor="decision-notice-reason">
              Deferral reason <span aria-hidden="true">*</span>
            </label>
            <textarea
              ref={reasonRef}
              id="decision-notice-reason"
              name="reason"
              value={reason}
              maxLength={maxReasonLength}
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
              disabled={status === "saving" || status === "save-failed" || status === "disabled"}
            >
              Submit deferral
            </button>
          </div>
        </form>
      ) : null}

      <footer className="decision-notice__actions" aria-label="Decision actions">
        {canAct ? (
          <>
            <button type="button" className="decision-notice__primary" onClick={acknowledge}>
              Acknowledge
            </button>
            <button
              type="button"
              onClick={() => {
                setDeferOpen(true);
                setValidation(null);
                setSaveError(null);
                setAnnouncement("Deferral editor opened");
                setFocusRequest("reason");
              }}
            >
              Defer
            </button>
          </>
        ) : null}
        {canUndo ? (
          <button
            ref={undoRef}
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

function loadState(notice: DecisionNotice, storage: DecisionNoticeStorage): DecisionState {
  try {
    const saved = storage.load();
    return saved?.notice.decisionId === notice.decisionId ? saved : createDecisionState(notice);
  } catch {
    return createDecisionState(notice);
  }
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
