import type { BrowserLibraryProjection } from "@cuckcode/application";
import { useEffect, useRef, useState } from "react";

import "./evidence-library.css";

const evidenceNames = {
  test: "Automated verification",
  visual: "Visual QA review",
  release: "Release readiness",
} as const;

type EvidenceRecord = BrowserLibraryProjection["evidence"][number];

export function EvidenceLibrary({
  projection,
  initialEvidenceKind,
  onClose,
  onLocateOrigin,
}: Readonly<{
  projection: BrowserLibraryProjection;
  initialEvidenceKind?: EvidenceRecord["kind"];
  onClose: () => void;
  onLocateOrigin: (entityId: string) => void;
}>) {
  const libraryRef = useRef<HTMLElement>(null);
  const [focusedEvidence, setFocusedEvidence] = useState<EvidenceRecord | undefined>(() =>
    initialEvidenceKind
      ? projection.evidence.find(({ kind }) => kind === initialEvidenceKind)
      : undefined,
  );
  const focusTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);

  const closeEvidence = () => {
    setFocusedEvidence(undefined);
    if (focusTriggerRef.current) focusTriggerRef.current.focus();
    else libraryRef.current?.focus();
  };

  useEffect(() => {
    const closeTopmost = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (focusedEvidence) closeEvidence();
      else onClose();
    };
    window.addEventListener("keydown", closeTopmost);
    return () => window.removeEventListener("keydown", closeTopmost);
  });

  return (
    <aside className="evidence-library" aria-label="Project Library" ref={libraryRef} tabIndex={-1}>
      <header>
        <div>
          <p>Shared project knowledge</p>
          <h2>Project Library</h2>
        </div>
        <button type="button" onClick={onClose}>
          Close Library
        </button>
      </header>

      <section aria-labelledby="library-knowledge-heading">
        <h3 id="library-knowledge-heading">Knowledge lifecycle</h3>
        <p>Statuses remain explicit; non-current records stay inspectable.</p>
        <ol className="evidence-library-knowledge">
          {projection.knowledge.map((record) => (
            <li key={record.knowledgeId} data-knowledge-id={record.knowledgeId}>
              <span data-testid="knowledge-status" data-status={record.status}>
                {record.status}
              </span>
              <strong>{record.title}</strong>
              <p>{record.snippet}</p>
              <small>
                revision {record.revision} · origin {record.originatingEntityId}
              </small>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="library-evidence-heading">
        <h3 id="library-evidence-heading">Evidence lanes</h3>
        <p>Test, visual, and release decisions are evaluated independently.</p>
        <div className="evidence-library-lanes">
          {projection.evidence.map((record) => (
            <section key={record.evidenceId} aria-label={`${capitalize(record.kind)} evidence`}>
              <p>{record.kind}</p>
              <h4>{evidenceNames[record.kind]}</h4>
              <strong>{statusLabel(record)}</strong>
              <p>{record.summary}</p>
              <button
                type="button"
                onClick={(event) => {
                  focusTriggerRef.current = event.currentTarget;
                  setFocusedEvidence(record);
                }}
              >
                View {evidenceNames[record.kind]}
              </button>
            </section>
          ))}
        </div>
      </section>

      {focusedEvidence ? (
        <section
          className="focused-evidence"
          role="dialog"
          aria-modal="true"
          aria-label={`Evidence: ${evidenceNames[focusedEvidence.kind]}`}
        >
          <header>
            <div>
              <p>{focusedEvidence.kind} evidence</p>
              <h3>{evidenceNames[focusedEvidence.kind]}</h3>
            </div>
            <button type="button" onClick={closeEvidence}>
              Close evidence
            </button>
          </header>
          <p>{statusLabel(focusedEvidence)}</p>
          <p>{focusedEvidence.summary}</p>
          <dl>
            <dt>Evidence ID</dt>
            <dd>{focusedEvidence.evidenceId}</dd>
            <dt>Revision</dt>
            <dd>revision {focusedEvidence.revision}</dd>
            <dt>Originating office entity</dt>
            <dd>{focusedEvidence.originatingEntityId}</dd>
          </dl>
          <button type="button" onClick={() => onLocateOrigin(focusedEvidence.originatingEntityId)}>
            Locate origin in office
          </button>
        </section>
      ) : null}
    </aside>
  );
}

function statusLabel(record: EvidenceRecord): string {
  if (record.status === "complete" && !record.approved) return "Complete — not approved";
  return capitalize(record.status);
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
