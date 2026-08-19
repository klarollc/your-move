import type { BrowserLibraryProjection, projectKickoffReadModel } from "@cuckcode/application";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  AttentionRail,
  type AttentionDisposition,
  type OfficeAttentionItem,
  type OfficeDispositionResult,
} from "./attention-rail.js";
import { EvidenceLibrary } from "./evidence-library.js";
import { KickoffPanel } from "./kickoff-panel.js";
import "./office-shell.css";

export type OfficeShellState =
  | "ready"
  | "loading"
  | "empty"
  | "partial"
  | "error"
  | "stale"
  | "offline"
  | "canvas-loss"
  | "rate-limit"
  | "budget-limit"
  | "permission-denied"
  | "missing-artifact"
  | "test-failure"
  | "reviewer-disagreement"
  | "conflict"
  | "restart"
  | "cancelled";

export type OfficeMotionCue = Readonly<{
  canonicalRevision: number;
  presentation: "travel" | "immediate-placement" | "persistent-label";
  checkpoint: string;
  label: string;
  announcement: string;
  queuedCount: number;
  loop: false;
  runtimePaused: false;
}>;

type OfficeEntity = Readonly<{
  entityId: string;
  label: string;
  kind: "zone" | "person";
  state: string;
  relationship?: string;
}>;

type KickoffReadModel = ReturnType<typeof projectKickoffReadModel>;

// The kickoff is anchored to exactly the two regions the composition approves: the collaboration
// table where the round happens, and the manager desk where it is decided.
const kickoffAnchors = ["zone_collaboration", "zone_manager"];

const kickoffRoleLabels: Readonly<Record<string, string>> = {
  delivery: "Delivery Lead",
  design: "Product Designer",
  implementation: "Implementation Engineer",
  test: "Test Engineer",
  visual: "Visual QA Reviewer",
  release: "Release Reviewer",
};

export const officeShellEntities: readonly OfficeEntity[] = Object.freeze([
  { entityId: "zone_reception", label: "Reception", kind: "zone", state: "Candidate intake" },
  { entityId: "zone_team", label: "Team work area", kind: "zone", state: "Six role stations" },
  {
    entityId: "agent_delivery_lead",
    label: "Delivery Lead",
    kind: "person",
    state: "Available",
    relationship: "Coordinates the office team",
  },
  {
    entityId: "agent_product_designer",
    label: "Product Designer",
    kind: "person",
    state: "Available",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_implementation_engineer",
    label: "Implementation Engineer",
    kind: "person",
    state: "Working on the approved graybox slice",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_test_engineer",
    label: "Test Engineer",
    kind: "person",
    state: "Reviewing deterministic tests",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_visual_qa_reviewer",
    label: "Visual QA Reviewer",
    kind: "person",
    state: "Awaiting current-build evidence",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_release_reviewer",
    label: "Release Reviewer",
    kind: "person",
    state: "Not yet requested",
    relationship: "Reports to Delivery Lead",
  },
  { entityId: "zone_library", label: "Project Library", kind: "zone", state: "Current" },
  {
    entityId: "zone_collaboration",
    label: "Collaboration table",
    kind: "zone",
    state: "No active session",
  },
  { entityId: "zone_review", label: "Review station", kind: "zone", state: "Idle" },
  {
    entityId: "zone_manager",
    label: "Manager desk",
    kind: "zone",
    state: "Current priority visible",
  },
  { entityId: "zone_delivery", label: "Delivery area", kind: "zone", state: "No delivery" },
]);

const presentations: Record<
  OfficeShellState,
  Readonly<{ cause: string; recovery?: string; runtime: string }>
> = {
  ready: {
    cause: "Canonical workspace revision 42 is current.",
    runtime: "Runtime connected",
  },
  loading: {
    cause: "Loading the persisted workspace snapshot before showing activity.",
    recovery: "Cancel loading",
    runtime: "Runtime checking persisted state",
  },
  empty: {
    cause: "No project has been selected for this office.",
    recovery: "Choose project",
    runtime: "Runtime connected",
  },
  partial: {
    cause: "Two agent records are unavailable; four current records remain visible.",
    recovery: "Retry missing records",
    runtime: "Runtime partially available",
  },
  error: {
    cause: "Workspace stream was rejected with stable error WS_READ_REJECTED.",
    recovery: "Retry workspace",
    runtime: "Runtime error",
  },
  stale: {
    cause: "The last canonical update exceeded the freshness window; activity is uncertain.",
    recovery: "Refresh workspace",
    runtime: "Runtime freshness unknown",
  },
  offline: {
    cause: "The loopback runtime is unavailable; persisted state remains inspectable.",
    recovery: "Reconnect runtime",
    runtime: "Runtime offline",
  },
  "canvas-loss": {
    cause: "The WebGL context is unavailable; the Office outline is the primary interface.",
    recovery: "Retry canvas",
    runtime: "Runtime connected; canvas unavailable",
  },
  "rate-limit": {
    cause: "The provider rate limit denied the current request; no work is inferred.",
    recovery: "Retry after limit",
    runtime: "Runtime rate limited",
  },
  "budget-limit": {
    cause: "The approved provider budget ceiling is exhausted; execution is blocked.",
    recovery: "Request budget decision",
    runtime: "Runtime budget blocked",
  },
  "permission-denied": {
    cause: "The required permission request was denied; the agent did not continue.",
    recovery: "Review permission boundary",
    runtime: "Runtime permission blocked",
  },
  "missing-artifact": {
    cause: "A required artifact is missing; review and delivery remain unavailable.",
    recovery: "Locate missing artifact",
    runtime: "Runtime artifact blocked",
  },
  "test-failure": {
    cause: "Current test evidence failed; completed and approved remain false.",
    recovery: "Review failed test",
    runtime: "Runtime verification failed",
  },
  "reviewer-disagreement": {
    cause: "The visual and release reviewers disagree; no conclusion was manufactured.",
    recovery: "Resolve reviewer disagreement",
    runtime: "Runtime review contested",
  },
  conflict: {
    cause: "An out-of-order event conflict is quarantined; canonical state did not advance.",
    recovery: "Reconcile conflict",
    runtime: "Runtime conflict quarantined",
  },
  restart: {
    cause: "The runtime restarted; persisted truth is visible while health is revalidated.",
    recovery: "Restore current state",
    runtime: "Runtime restoring persisted state",
  },
  cancelled: {
    cause: "Manager cancellation stopped the work; no completion is inferred.",
    recovery: "Review cancellation",
    runtime: "Runtime work cancelled",
  },
};

export function OfficeShell({
  state,
  canvas,
  onRecovery,
  onResetView,
  selectedEntityId,
  onSelectEntity,
  attention = [],
  onDisposition,
  library,
  motion,
  kickoff,
}: Readonly<{
  state: OfficeShellState;
  canvas?: ReactNode;
  onRecovery?: () => void;
  onResetView?: () => void;
  selectedEntityId?: string | undefined;
  onSelectEntity?: (entityId: string | undefined) => void;
  attention?: readonly OfficeAttentionItem[];
  onDisposition?: (
    item: OfficeAttentionItem,
    intent: AttentionDisposition,
    scope: Record<string, string>,
  ) => OfficeDispositionResult | Promise<OfficeDispositionResult>;
  library?: BrowserLibraryProjection;
  motion?: OfficeMotionCue;
  kickoff?: KickoffReadModel;
}>) {
  const outlineRef = useRef<HTMLElement>(null);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const kickoffTriggerRef = useRef<HTMLButtonElement>(null);
  const [kickoffOpen, setKickoffOpen] = useState(false);
  const [initialEvidenceKind, setInitialEvidenceKind] = useState<
    "test" | "visual" | "release" | undefined
  >(undefined);
  const attentionTriggerRef = useRef<HTMLButtonElement>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [dismissedAttentionIds, setDismissedAttentionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const selectionTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [internalSelection, setInternalSelection] = useState<string | undefined>(undefined);
  const [announcement, setAnnouncement] = useState(
    state === "ready" ? "Workspace current" : `Workspace ${state}`,
  );
  useEffect(() => {
    setAnnouncement(state === "ready" ? "Workspace current" : `Workspace ${state}`);
  }, [state]);
  useEffect(() => {
    if (motion) setAnnouncement(motion.announcement);
  }, [motion]);
  const presentation = presentations[state];
  const selection = selectedEntityId ?? internalSelection;
  const selectedEntity = officeShellEntities.find(({ entityId }) => entityId === selection);
  const visibleAttention = attention.filter(
    ({ attentionId }) => !dismissedAttentionIds.has(attentionId),
  );
  const dispositionsAvailable = state === "ready" || state === "partial";

  useEffect(() => {
    if (!selectedEntityId) return;
    const entity = officeShellEntities.find(({ entityId }) => entityId === selectedEntityId);
    setAnnouncement(`${entity?.label ?? selectedEntityId} selected`);
  }, [selectedEntityId]);
  const selectEntity = (entityId: string, trigger: HTMLButtonElement) => {
    selectionTriggerRef.current = trigger;
    setInternalSelection(entityId);
    onSelectEntity?.(entityId);
    const entity = officeShellEntities.find((candidate) => candidate.entityId === entityId);
    setAnnouncement(`${entity?.label ?? entityId} selected`);
  };

  const closeInspector = () => {
    setInternalSelection(undefined);
    onSelectEntity?.(undefined);
    setAnnouncement("Inspector closed");
    selectionTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!selectedEntity || libraryOpen || kickoffOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeInspector();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });

  const closeAttention = () => {
    setAttentionOpen(false);
    setAnnouncement("Manager attention closed");
    attentionTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!attentionOpen || selectedEntity || libraryOpen || kickoffOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAttention();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });
  const zones = officeShellEntities.filter(({ kind }) => kind === "zone");
  const people = officeShellEntities.filter(({ kind }) => kind === "person");

  return (
    <main
      className="office-shell"
      aria-label="CuckCode office workspace"
      data-inspector-open={Boolean(selectedEntity)}
      data-attention-open={attentionOpen}
      data-library-open={libraryOpen}
      data-kickoff-open={kickoffOpen}
    >
      <a
        className="office-skip-link"
        href="#office-outline"
        onClick={(event) => {
          event.preventDefault();
          outlineRef.current?.focus();
        }}
      >
        Skip to Office outline
      </a>

      <header
        className="office-project-bar"
        aria-label="Project bar"
        data-testid="persistent-structure"
      >
        <div>
          <strong>CuckCode</strong>
          <span>Outcome: truthful graybox office</span>
        </div>
        <span>{presentation.runtime}</span>
        <span>Local session · revision 42</span>
        {visibleAttention.length > 0 ? (
          <button
            ref={attentionTriggerRef}
            type="button"
            aria-expanded={attentionOpen}
            onClick={() => {
              setAttentionOpen(true);
              setAnnouncement(`${visibleAttention.length} manager attention items opened`);
            }}
          >
            Manager attention ({visibleAttention.length})
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onResetView?.();
            setAnnouncement("Canonical view restored");
          }}
        >
          Reset view
        </button>
      </header>

      <section
        className="office-scene"
        aria-label="Office scene"
        data-scene-entity-ids={officeShellEntities.map(({ entityId }) => entityId).join(",")}
        data-selected-entity-id={selection}
        data-testid="persistent-structure"
      >
        {canvas ?? (
          <div className="office-canvas-placeholder" data-office-canvas-host aria-hidden="true">
            <span>Office scene unavailable; use the Office outline.</span>
          </div>
        )}
        {motion ? (
          <div
            className={`office-motion-cue office-motion-cue--${motion.presentation}`}
            data-testid="semantic-motion-cue"
            data-canonical-revision={motion.canonicalRevision}
            data-motion-presentation={motion.presentation}
            data-motion-checkpoint={motion.checkpoint}
            data-motion-loop={motion.loop}
            data-runtime-paused={motion.runtimePaused}
          >
            <strong>{motion.label}</strong>
            <span>
              {motion.queuedCount} transition{motion.queuedCount === 1 ? "" : "s"} queued
            </span>
          </div>
        ) : null}
      </section>

      <section
        id="office-outline"
        className="office-outline"
        aria-label="Office outline"
        data-testid="persistent-structure"
        ref={outlineRef}
        tabIndex={-1}
      >
        <header>
          <div>
            <h1>Office outline</h1>
            <p>Equivalent people, zones, states, relationships, and actions.</p>
          </div>
          <strong>{state === "ready" ? "Current" : state}</strong>
        </header>
        <p data-testid="workspace-cause">Cause: {presentation.cause}</p>
        {presentation.recovery ? (
          <button
            type="button"
            onClick={() => {
              onRecovery?.();
              setAnnouncement(`${presentation.recovery} requested`);
            }}
          >
            {presentation.recovery}
          </button>
        ) : null}

        <ol className="office-zone-list" aria-label="Office zones">
          {zones.map((zone) => (
            <li key={zone.entityId} data-canvas-twin-id={zone.entityId}>
              <div>
                <h2>{zone.label}</h2>
                <p>State: {zone.state}</p>
              </div>
              <button
                type="button"
                onClick={(event) => selectEntity(zone.entityId, event.currentTarget)}
              >
                Locate {zone.label}
              </button>
              {zone.entityId === "zone_team" ? (
                <ol aria-label="Office people">
                  {people.map((person) => (
                    <li key={person.entityId} data-canvas-twin-id={person.entityId}>
                      <div>
                        <h3>{person.label}</h3>
                        <p>State: {person.state}</p>
                        <p>Relationship: {person.relationship}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => selectEntity(person.entityId, event.currentTarget)}
                      >
                        Inspect {person.label}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {attentionOpen && visibleAttention.length > 0 ? (
        <AttentionRail
          items={visibleAttention}
          available={dispositionsAvailable}
          onClose={closeAttention}
          onLocate={(item) => {
            setInternalSelection(item.entityId);
            onSelectEntity?.(item.entityId);
            setAnnouncement(`${item.label} located in the office`);
          }}
          onDismiss={(item) => {
            setDismissedAttentionIds((current) => new Set([...current, item.attentionId]));
            setAnnouncement(`${item.label} dismissed from this view; no disposition was recorded`);
          }}
          onDisposition={
            onDisposition ??
            (() => ({
              ok: false,
              code: "ATTENTION_COMMAND_UNAVAILABLE",
              requiredAction: "Connect the canonical command handler before retrying.",
            }))
          }
        />
      ) : null}
      {selectedEntity ? (
        <aside
          className="office-inspector"
          aria-label="Entity inspector"
          data-selected-entity-id={selectedEntity.entityId}
        >
          <header>
            <div>
              <p>Selected entity</p>
              <h2>{selectedEntity.label}</h2>
            </div>
            <button type="button" onClick={closeInspector}>
              Close inspector
            </button>
          </header>
          <dl>
            <dt>State</dt>
            <dd>{selectedEntity.state}</dd>
            <dt>Cause</dt>
            <dd>Canonical workspace revision 42 fixture</dd>
            <dt>Updated</dt>
            <dd>Revision 42</dd>
            <dt>Freshness</dt>
            <dd>{state === "ready" ? "Current" : state}</dd>
            <dt>Current work</dt>
            <dd>{selectedEntity.kind === "person" ? selectedEntity.state : "Zone operations"}</dd>
            <dt>Blocker</dt>
            <dd>None recorded</dd>
            <dt>Evidence</dt>
            <dd>Deterministic graybox fixture</dd>
            <dt>Runtime binding</dt>
            <dd>Loopback session · simulated</dd>
            <dt>Permissions</dt>
            <dd>Inspect and select only</dd>
            <dt>Technical trail</dt>
            <dd>workspace revision 42 · {selectedEntity.entityId}</dd>
          </dl>
          <button
            type="button"
            onClick={() => setAnnouncement(`${selectedEntity.label} located in the office`)}
          >
            Locate in office
          </button>
          {library &&
          ["zone_library", "zone_review", "zone_delivery"].includes(selectedEntity.entityId) ? (
            <button
              ref={libraryTriggerRef}
              type="button"
              onClick={() => {
                setInitialEvidenceKind(
                  selectedEntity.entityId === "zone_review"
                    ? "visual"
                    : selectedEntity.entityId === "zone_delivery"
                      ? "release"
                      : undefined,
                );
                setLibraryOpen(true);
                setAnnouncement(`${selectedEntity.label} evidence opened`);
              }}
            >
              {selectedEntity.entityId === "zone_review"
                ? "Open Visual QA evidence"
                : selectedEntity.entityId === "zone_delivery"
                  ? "Open Release evidence"
                  : "Open Project Library"}
            </button>
          ) : null}
          {kickoff && kickoffAnchors.includes(selectedEntity.entityId) ? (
            <button
              ref={kickoffTriggerRef}
              type="button"
              onClick={() => {
                setKickoffOpen(true);
                setAnnouncement(`Collaborative kickoff opened from ${selectedEntity.label}`);
              }}
            >
              Open collaborative kickoff
            </button>
          ) : null}
        </aside>
      ) : null}
      {kickoffOpen && kickoff ? (
        <KickoffPanel
          model={kickoff}
          roleLabels={kickoffRoleLabels}
          onClose={() => {
            setKickoffOpen(false);
            setAnnouncement("Collaborative kickoff closed");
            if (kickoffTriggerRef.current) kickoffTriggerRef.current.focus();
            else outlineRef.current?.focus();
          }}
        />
      ) : null}
      {libraryOpen && library ? (
        <EvidenceLibrary
          key={initialEvidenceKind ?? "library"}
          projection={library}
          {...(initialEvidenceKind ? { initialEvidenceKind } : {})}
          onClose={() => {
            setLibraryOpen(false);
            setAnnouncement("Project Library closed");
            if (libraryTriggerRef.current) libraryTriggerRef.current.focus();
            else outlineRef.current?.focus();
          }}
          onLocateOrigin={(entityId) => {
            setInternalSelection(entityId);
            onSelectEntity?.(entityId);
            setAnnouncement(`${entityId} located from evidence`);
          }}
        />
      ) : null}
      <p className="office-live-region" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}
