import type { BrowserLibraryProjection } from "@cuckcode/application";
import { useEffect, useRef, useState } from "react";

import "./evidence-library.css";

type EvidenceRecord = BrowserLibraryProjection["evidence"][number];
export type EvidenceLink = Readonly<{ evidenceId: string; version: number }>;

export function EvidenceLibrary({
  projection,
  initialEvidence,
  onClose,
  onLocateOrigin,
}: Readonly<{
  projection: BrowserLibraryProjection;
  /** Open at this record and version (spec §6). Never falls back to another record. */
  initialEvidence?: EvidenceLink;
  onClose: () => void;
  onLocateOrigin: (entityId: string) => void;
}>) {
  const libraryRef = useRef<HTMLElement>(null);
  const linked = initialEvidence
    ? projection.evidence.find(
        ({ evidenceId, version }) =>
          evidenceId === initialEvidence.evidenceId && version === initialEvidence.version,
      )
    : undefined;
  // Owner ruling 8b-3: a focused record opens only from an item-and-version link, never by kind.
  const [focusedEvidence, setFocusedEvidence] = useState<EvidenceRecord | undefined>(linked);
  const [unresolvedLink, setUnresolvedLink] = useState<EvidenceLink | undefined>(() =>
    initialEvidence && !linked ? initialEvidence : undefined,
  );
  const focusTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);

  const closeEvidence = () => {
    setFocusedEvidence(undefined);
    setUnresolvedLink(undefined);
    if (focusTriggerRef.current) focusTriggerRef.current.focus();
    else libraryRef.current?.focus();
  };

  useEffect(() => {
    const closeTopmost = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (focusedEvidence || unresolvedLink) closeEvidence();
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
        <p>One lane per recorded evidence kind; each is evaluated independently.</p>
        {projection.evidence.length === 0 ? <p>No evidence recorded.</p> : null}
        <div className="evidence-library-lanes">
          {lanesOf(projection.evidence).map(([kind, records]) => (
            <section key={kind} aria-label={`${capitalize(kind)} evidence`}>
              <h4>{capitalize(kind)} evidence</h4>
              <ol>
                {records.map((record) => (
                  <li
                    key={`${record.evidenceId}@${record.version}`}
                    data-evidence-id={record.evidenceId}
                  >
                    <p>
                      {record.evidenceId} · version {record.version}
                    </p>
                    <strong>{statusLabel(record)}</strong>
                    <p>{record.summary ?? NO_SUMMARY}</p>
                    <button
                      type="button"
                      onClick={(event) => {
                        focusTriggerRef.current = event.currentTarget;
                        setFocusedEvidence(record);
                      }}
                    >
                      View {record.evidenceId} v{record.version}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </section>

      {focusedEvidence ? (
        <section
          className="focused-evidence"
          role="dialog"
          aria-modal="true"
          aria-label={`Evidence: ${focusedEvidence.evidenceId} v${focusedEvidence.version}`}
        >
          <header>
            <div>
              <p>{capitalize(focusedEvidence.kind)} evidence</p>
              <h3>
                {focusedEvidence.evidenceId} v{focusedEvidence.version}
              </h3>
            </div>
            <button type="button" onClick={closeEvidence}>
              Close evidence
            </button>
          </header>
          <p>{statusLabel(focusedEvidence)}</p>
          <p>{focusedEvidence.summary ?? NO_SUMMARY}</p>
          <dl>
            <dt>Evidence ID</dt>
            <dd>{focusedEvidence.evidenceId}</dd>
            <dt>Version</dt>
            <dd>version {focusedEvidence.version}</dd>
            <dt>Kind</dt>
            <dd>{focusedEvidence.kind}</dd>
            {focusedEvidence.workItemId ? (
              <>
                <dt>Work item</dt>
                <dd>{focusedEvidence.workItemId}</dd>
              </>
            ) : null}
            {focusedEvidence.causeEventId ? (
              <>
                <dt>Recorded by event</dt>
                <dd>{focusedEvidence.causeEventId}</dd>
              </>
            ) : null}
            <dt>Revision</dt>
            <dd>revision {focusedEvidence.revision}</dd>
            <dt>Originating office entity</dt>
            <dd>{focusedEvidence.originatingEntityId ?? "No office entity holds this work"}</dd>
          </dl>
          {focusedEvidence.originatingEntityId ? (
            <button
              type="button"
              onClick={() => {
                if (focusedEvidence.originatingEntityId) {
                  onLocateOrigin(focusedEvidence.originatingEntityId);
                }
              }}
            >
              Locate origin in office
            </button>
          ) : null}
        </section>
      ) : null}
      {unresolvedLink ? (
        <section
          className="focused-evidence"
          role="dialog"
          aria-modal="true"
          aria-label="Evidence link unavailable"
        >
          <header>
            <div>
              <p>Evidence link</p>
              <h3>Evidence link unavailable</h3>
            </div>
            <button type="button" onClick={closeEvidence}>
              Close evidence
            </button>
          </header>
          <p>
            The Project Library holds no record for this link. No other record was opened in its
            place.
          </p>
          <dl>
            <dt>Evidence ID</dt>
            <dd>{unresolvedLink.evidenceId}</dd>
            <dt>Version</dt>
            <dd>version {unresolvedLink.version}</dd>
            <dt>Versions in the Library</dt>
            <dd>{versionsHeld(projection, unresolvedLink.evidenceId)}</dd>
          </dl>
        </section>
      ) : null}
    </aside>
  );
}

const NO_SUMMARY = "No summary recorded";

/** Lanes are the recorded kinds, in the projection's order (owner ruling 8b-1). */
function lanesOf(
  records: BrowserLibraryProjection["evidence"],
): ReadonlyArray<readonly [string, EvidenceRecord[]]> {
  const lanes = new Map<string, EvidenceRecord[]>();
  for (const record of records) lanes.set(record.kind, [...(lanes.get(record.kind) ?? []), record]);
  return [...lanes];
}

function statusLabel(record: EvidenceRecord): string {
  if (record.status === "complete" && !record.approved) return "Complete — not approved";
  return capitalize(record.status);
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function versionsHeld(projection: BrowserLibraryProjection, evidenceId: string): string {
  const versions = projection.evidence
    .filter((record) => record.evidenceId === evidenceId)
    .map(({ version }) => `version ${version}`);
  return versions.length > 0 ? versions.join(", ") : "None: this ID is not in the Library";
}
