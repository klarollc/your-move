import { useRef, useState, type FormEvent } from "react";

import "./work-list.css";

export type WorkListItem = Readonly<{
  workItemId: string;
  outcome: string;
  state: string;
  assignee: string | null;
  partial: boolean;
  contractAcceptsEvidence: boolean;
  evidenceObligations: readonly Readonly<{ kind: string; description: string }>[];
  evidence: readonly Readonly<{
    kind: string;
    result: string;
    eventId: string;
    outputSha256?: string;
  }>[];
  postures: readonly Readonly<{
    runId: string;
    requested: string;
    granted: string;
    declared: string;
    match: boolean;
    eventId: string;
  }>[];
  lastEvent: string | null;
}>;

export type WorkListAssignment = Readonly<{ roleAssignmentId: string; label: string }>;
export type WorkListRunner = Readonly<{
  available: boolean;
  state:
    "unavailable" | "idle" | "starting" | "running" | "completed" | "failed" | "recovery_required";
  workItemId?: string;
}>;

export type SurfaceBCommandApi = Readonly<{
  onCreate: (input: { outcome: string; acceptanceCriteria: string[] }) => void | Promise<void>;
  onAssign: (workItemId: string, roleAssignmentId: string) => void | Promise<void>;
  onEvidence: (
    workItemId: string,
    input: {
      kind: string;
      result: "passed" | "failed";
      note?: string;
      outputSha256?: string;
    },
  ) => void | Promise<void>;
  onReview: (workItemId: string) => void | Promise<void>;
  onExecute: (workItemId: string) => void | Promise<void>;
}>;

export function WorkList(
  props: Readonly<{
    projectName: string;
    revision: number;
    items: readonly WorkListItem[];
    assignments: readonly WorkListAssignment[];
    runner: WorkListRunner;
    connected?: boolean;
    actionsDisabled?: boolean;
    partialLog?: boolean;
    error?: string | null;
  }> &
    SurfaceBCommandApi,
) {
  const [createOpen, setCreateOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [criteria, setCriteria] = useState("");
  const [assignmentsByWork, setAssignmentsByWork] = useState<Record<string, string>>({});
  const [evidenceOpen, setEvidenceOpen] = useState<string | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<Record<string, string>>({});
  const [evidenceResult, setEvidenceResult] = useState<Record<string, "passed" | "failed">>({});
  const [evidenceNote, setEvidenceNote] = useState<Record<string, string>>({});
  const [evidenceDigest, setEvidenceDigest] = useState<Record<string, string>>({});
  const newWorkButton = useRef<HTMLButtonElement>(null);

  const createWork = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const acceptanceCriteria = criteria
      .split("\n")
      .map((criterion) => criterion.trim())
      .filter((criterion) => criterion.length > 0);
    if (outcome.trim().length === 0 || acceptanceCriteria.length === 0) return;
    void props.onCreate({ outcome: outcome.trim(), acceptanceCriteria });
    setCreateOpen(false);
    newWorkButton.current?.focus();
    setOutcome("");
    setCriteria("");
  };

  const recordEvidence = (event: FormEvent<HTMLFormElement>, item: WorkListItem) => {
    event.preventDefault();
    const kind = evidenceKind[item.workItemId] ?? item.evidenceObligations[0]?.kind ?? "";
    if (!kind) return;
    const note = evidenceNote[item.workItemId]?.trim();
    const outputSha256 = evidenceDigest[item.workItemId]?.trim().toLowerCase();
    void props.onEvidence(item.workItemId, {
      kind,
      result: evidenceResult[item.workItemId] ?? "passed",
      ...(note ? { note } : {}),
      ...(outputSha256 ? { outputSha256 } : {}),
    });
    setEvidenceOpen(null);
  };

  const busy = props.runner.state === "starting" || props.runner.state === "running";
  const actionsDisabled = props.actionsDisabled === true || busy;

  return (
    <main className="workflow-surface">
      <header className="workflow-header">
        <div>
          <p className="workflow-eyebrow">{props.projectName}</p>
          <h1>Work</h1>
          <p className="workflow-subtitle">Create a clear outcome, then follow its evidence.</p>
        </div>
        <button
          className="workflow-primary"
          onClick={() => setCreateOpen(true)}
          type="button"
          disabled={actionsDisabled}
          ref={newWorkButton}
        >
          New work
        </button>
      </header>

      <div className="workflow-meta" aria-live="polite">
        <span>Event log · revision {props.revision}</span>
        {props.partialLog ? <span className="workflow-warning">Log is incomplete</span> : null}
        {busy ? <span>Runner in progress · {props.runner.workItemId}</span> : null}
        {props.runner.state === "completed" ? <span>Runner finished</span> : null}
        {props.runner.state === "failed" ? <span>Runner stopped before completion</span> : null}
        {props.runner.state === "recovery_required" ? (
          <span className="workflow-warning">
            Log lock needs attention before work can continue
          </span>
        ) : null}
      </div>

      {props.error ? (
        <p className="workflow-error" role="alert">
          {props.error}
        </p>
      ) : null}

      {props.connected === false ? (
        <p className="workflow-notice">Connect the local workflow server to load or change work.</p>
      ) : props.runner.state === "unavailable" ? (
        <p className="workflow-notice">
          Execution is unavailable until this local server is configured for a live runner.
        </p>
      ) : null}

      <section className="workflow-list" aria-label="Work items">
        {props.items.length === 0 ? (
          <div className="workflow-empty">
            <h2>No work yet</h2>
            <p>Create the first outcome to begin.</p>
          </div>
        ) : (
          props.items.map((item) => {
            const assignmentId =
              assignmentsByWork[item.workItemId] ?? props.assignments[0]?.roleAssignmentId ?? "";
            const activeEvidenceKind =
              evidenceKind[item.workItemId] ?? item.evidenceObligations[0]?.kind ?? "";
            return (
              <article className="workflow-row" key={item.workItemId} aria-label={item.outcome}>
                <div className="workflow-row-main">
                  <div className="workflow-row-copy">
                    <h2>{item.outcome}</h2>
                    <p className="workflow-row-state">
                      <span>{humanState(item.state)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.assignee ?? "Unassigned"}</span>
                      {item.partial ? (
                        <span className="workflow-warning">Partial record</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="workflow-actions">
                    {item.state === "draft" || item.state === "ready" ? (
                      <div className="workflow-assign">
                        <label
                          className="workflow-visually-hidden"
                          htmlFor={`assign-${item.workItemId}`}
                        >
                          Assign {item.outcome}
                        </label>
                        <select
                          id={`assign-${item.workItemId}`}
                          value={assignmentId}
                          onChange={(event) =>
                            setAssignmentsByWork((current) => ({
                              ...current,
                              [item.workItemId]: event.target.value,
                            }))
                          }
                          disabled={actionsDisabled || props.assignments.length === 0}
                        >
                          {props.assignments.map((assignment) => (
                            <option
                              key={assignment.roleAssignmentId}
                              value={assignment.roleAssignmentId}
                            >
                              {assignment.label}
                            </option>
                          ))}
                          {props.assignments.length === 0 ? (
                            <option value="">No available role</option>
                          ) : null}
                        </select>
                        <button
                          type="button"
                          onClick={() => void props.onAssign(item.workItemId, assignmentId)}
                          disabled={actionsDisabled || props.assignments.length === 0}
                        >
                          Assign
                        </button>
                      </div>
                    ) : null}
                    {item.state === "assigned" ? (
                      <button
                        type="button"
                        onClick={() => void props.onExecute(item.workItemId)}
                        disabled={!props.runner.available || busy || props.actionsDisabled === true}
                        title={
                          !props.runner.available
                            ? "Configure the loopback runner to enable execution"
                            : undefined
                        }
                      >
                        Run {item.outcome}
                      </button>
                    ) : null}
                    {item.contractAcceptsEvidence ? (
                      <button
                        type="button"
                        onClick={() => setEvidenceOpen(item.workItemId)}
                        disabled={actionsDisabled}
                      >
                        Record evidence
                      </button>
                    ) : null}
                    {item.state === "active" ? (
                      <button
                        type="button"
                        onClick={() => void props.onReview(item.workItemId)}
                        disabled={actionsDisabled}
                      >
                        Request review
                      </button>
                    ) : null}
                  </div>
                </div>

                {evidenceOpen === item.workItemId ? (
                  <form
                    className="workflow-evidence-form"
                    onSubmit={(event) => recordEvidence(event, item)}
                  >
                    <label>
                      Evidence type
                      <select
                        value={activeEvidenceKind}
                        onChange={(event) =>
                          setEvidenceKind((current) => ({
                            ...current,
                            [item.workItemId]: event.target.value,
                          }))
                        }
                      >
                        {item.evidenceObligations.map((obligation) => (
                          <option key={obligation.kind} value={obligation.kind}>
                            {obligation.kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Result
                      <select
                        value={evidenceResult[item.workItemId] ?? "passed"}
                        onChange={(event) =>
                          setEvidenceResult((current) => ({
                            ...current,
                            [item.workItemId]: event.target.value as "passed" | "failed",
                          }))
                        }
                      >
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                    </label>
                    <label className="workflow-evidence-note">
                      Note
                      <input
                        value={evidenceNote[item.workItemId] ?? ""}
                        maxLength={280}
                        onChange={(event) =>
                          setEvidenceNote((current) => ({
                            ...current,
                            [item.workItemId]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="workflow-evidence-digest">
                      Saved output SHA-256 (optional)
                      <input
                        value={evidenceDigest[item.workItemId] ?? ""}
                        inputMode="text"
                        autoCapitalize="none"
                        autoComplete="off"
                        maxLength={64}
                        pattern="[a-fA-F0-9]{64}"
                        aria-describedby={`evidence-digest-help-${item.workItemId}`}
                        onChange={(event) =>
                          setEvidenceDigest((current) => ({
                            ...current,
                            [item.workItemId]: event.target.value,
                          }))
                        }
                      />
                      <span
                        id={`evidence-digest-help-${item.workItemId}`}
                        className="workflow-help"
                      >
                        A digest links this record to the output you saved.
                      </span>
                    </label>
                    <button className="workflow-primary" type="submit" disabled={actionsDisabled}>
                      Save evidence
                    </button>
                  </form>
                ) : null}

                <details className="workflow-details">
                  <summary>Evidence and activity</summary>
                  <div className="workflow-detail-content">
                    <div>
                      <h3>Evidence</h3>
                      {item.evidence.length > 0 ? (
                        <ul>
                          {item.evidence.map((evidence) => (
                            <li key={evidence.eventId}>
                              {evidence.kind}: {evidence.result}
                              {evidence.outputSha256 ? (
                                <code className="workflow-digest">
                                  {" "}
                                  SHA-256 {evidence.outputSha256}
                                </code>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No evidence recorded.</p>
                      )}
                    </div>
                    <div>
                      <h3>Runtime posture</h3>
                      {item.postures.length > 0 ? (
                        item.postures.map((posture) => (
                          <p className="workflow-posture" key={posture.eventId}>
                            Requested {posture.requested}; granted {posture.granted}; declared{" "}
                            {posture.declared}
                            {posture.match ? " · match" : " · mismatch"}
                          </p>
                        ))
                      ) : (
                        <p>No runtime posture recorded.</p>
                      )}
                    </div>
                    <p className="workflow-last-event">
                      Last event: {item.lastEvent ?? "not recorded"}
                    </p>
                  </div>
                </details>
              </article>
            );
          })
        )}
      </section>

      {createOpen ? (
        <section className="workflow-create-panel" aria-labelledby="create-title">
          <form onSubmit={createWork}>
            <h2 id="create-title">Create work</h2>
            <label htmlFor="create-outcome">
              Outcome
              <input
                id="create-outcome"
                value={outcome}
                required
                autoFocus
                onChange={(event) => setOutcome(event.target.value)}
              />
            </label>
            <label htmlFor="create-criteria">
              Acceptance criteria
              <textarea
                id="create-criteria"
                value={criteria}
                required
                rows={4}
                onChange={(event) => setCriteria(event.target.value)}
              />
              <span className="workflow-help">Enter one clear criterion per line.</span>
            </label>
            <div className="workflow-dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  newWorkButton.current?.focus();
                }}
              >
                Cancel
              </button>
              <button className="workflow-primary" type="submit" disabled={actionsDisabled}>
                Create work
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}

function humanState(state: string): string {
  return state.replaceAll("_", " ");
}
