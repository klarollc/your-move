import type { BrowserLibraryProjection, projectKickoffReadModel } from "@cuckcode/application";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  AttentionRail,
  type AttentionDisposition,
  type OfficeAttentionItem,
  type OfficeDispositionResult,
} from "./attention-rail.js";
import { EvidenceLibrary, type EvidenceLink } from "./evidence-library.js";
import { KickoffPanel } from "./kickoff-panel.js";
import { OFFICE_REGISTRY } from "./office-fixtures/registry.js";
import {
  NOT_ASSIGNED,
  NOT_IN_FIXTURE,
  approvalText,
  attentionItemsFrom,
  blockerText,
  currentWorkText,
  entityOf,
  evidenceText,
  approvalPlain,
  evidencePlain,
  freshnessWarning,
  happeningText,
  needsManager,
  needsYouPlain,
  personStateWord,
  stateWord,
  whyText,
  needsYouText,
  notCurrentReasons,
  officeModelFor,
  personStateText,
  requestedActionText,
  revisionOf,
  type OfficeModel,
} from "./office-model.js";
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

/** Ids, labels, relationships and layout order only. What anyone is doing comes from the model. */
/** States in which the scene cannot be the working surface, so the outline is (Task 9e). */
const SCENE_UNAVAILABLE: ReadonlySet<string> = new Set([
  "loading",
  "empty",
  "error",
  "canvas-loss",
]);

export const officeShellEntities: readonly OfficeEntity[] = Object.freeze(
  OFFICE_REGISTRY.map((entry) => ({
    entityId: entry.entityId,
    label: entry.label,
    kind: entry.kind,
    ...(entry.kind === "person" && entry.relationship ? { relationship: entry.relationship } : {}),
  })),
);

const presentations: Record<
  OfficeShellState,
  Readonly<{ cause: string; recovery?: string; runtime: string }>
> = {
  ready: {
    cause: "", // Stated from the model's revision at render time.
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
  model: modelProp,
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
  /** The office read model to render; the shell projects the state's fixture log when omitted. */
  model?: OfficeModel;
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
  const shellRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  // Side panels start below the project bar, which wraps to more rows when narrow or zoomed
  // (Task 9d, F-9-2), and below the status notice when one is shown (Task 9e, A-4). The measured
  // offset is published as --office-bar-height.
  const noticeRef = useRef<HTMLDivElement>(null);
  const noticeShown = state !== "ready";
  useEffect(() => {
    const bar = barRef.current;
    const shell = shellRef.current;
    if (!bar || !shell || typeof ResizeObserver === "undefined") return;
    const publish = () => {
      const bottom = (noticeRef.current ?? bar).getBoundingClientRect().bottom;
      const top = shell.getBoundingClientRect().top;
      shell.style.setProperty("--office-bar-height", `${Math.ceil(bottom - top)}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    if (noticeRef.current) observer.observe(noticeRef.current);
    return () => observer.disconnect();
  }, [noticeShown]);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const kickoffTriggerRef = useRef<HTMLButtonElement>(null);
  const [kickoffOpen, setKickoffOpen] = useState(false);
  const [initialEvidence, setInitialEvidence] = useState<EvidenceLink | undefined>(undefined);
  const attentionTriggerRef = useRef<HTMLButtonElement>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);
  // Task 9e (A-1 to A-3): the outline is on demand, and shown without asking when the scene
  // cannot be the working surface.
  const sceneUnavailable = SCENE_UNAVAILABLE.has(state);
  const [outlineOpen, setOutlineOpen] = useState(sceneUnavailable);
  const outlineTriggerRef = useRef<HTMLButtonElement>(null);
  const focusOutlineRef = useRef(false);
  useEffect(() => {
    if (sceneUnavailable) setOutlineOpen(true);
  }, [sceneUnavailable]);
  useEffect(() => {
    if (outlineOpen && focusOutlineRef.current) {
      focusOutlineRef.current = false;
      outlineRef.current?.focus();
    }
  }, [outlineOpen]);
  const openOutline = () => {
    focusOutlineRef.current = true;
    setAttentionOpen(false);
    setOutlineOpen(true);
    if (outlineOpen) outlineRef.current?.focus();
    setAnnouncement("Office outline opened");
  };
  const closeOutline = () => {
    setOutlineOpen(false);
    setAnnouncement("Office outline closed");
    outlineTriggerRef.current?.focus();
  };
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
  const office = useMemo(() => modelProp ?? officeModelFor(state), [modelProp, state]);
  const { model } = office;
  const revision = revisionOf(model);
  const attention = attentionItemsFrom(model);
  const presentation =
    state === "ready"
      ? {
          ...presentations.ready,
          cause: model.current
            ? `Canonical workspace revision ${revision} is current.`
            : `Canonical workspace revision ${revision} is not current: ${notCurrentReasons(model)}.`,
        }
      : presentations[state];
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

  useEffect(() => {
    if (!outlineOpen || selectedEntity || libraryOpen || kickoffOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOutline();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });
  // One state word, and "Needs you" when a held item needs the manager (Task 9d, F-9-3).
  const personState = (entityId: string) => {
    const entity = entityOf(model, entityId);
    if (entity?.kind !== "person") return "Not in the office read model";
    return `${personStateWord(entity)}${needsManager(entity) ? " · Needs you" : ""}`;
  };
  const zones = officeShellEntities.filter(({ kind }) => kind === "zone");
  const people = officeShellEntities.filter(({ kind }) => kind === "person");

  return (
    <main
      className="office-shell"
      ref={shellRef}
      aria-label="CuckCode office workspace"
      data-inspector-open={Boolean(selectedEntity)}
      data-attention-open={attentionOpen}
      data-outline-open={outlineOpen}
      data-outline-primary={sceneUnavailable}
      data-library-open={libraryOpen}
      data-kickoff-open={kickoffOpen}
    >
      <a
        className="office-skip-link"
        href="#office-outline-open"
        onClick={(event) => {
          event.preventDefault();
          openOutline();
        }}
      >
        Open the Office outline
      </a>

      <header
        className="office-project-bar"
        ref={barRef}
        aria-label="Project bar"
        data-testid="persistent-structure"
      >
        <div>
          <h1 className="office-product-name">CuckCode</h1>
          <span>Outcome: truthful graybox office</span>
        </div>
        <span>{presentation.runtime}</span>
        <span>Local session · revision {revision}</span>
        <button
          ref={outlineTriggerRef}
          id="office-outline-open"
          type="button"
          aria-expanded={outlineOpen}
          aria-controls="office-outline"
          onClick={() => (outlineOpen ? closeOutline() : openOutline())}
        >
          Office outline
        </button>
        {visibleAttention.length > 0 ? (
          <button
            ref={attentionTriggerRef}
            type="button"
            aria-expanded={attentionOpen}
            onClick={() => {
              setOutlineOpen(false);
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

      {state !== "ready" ? (
        // A-4: when the workspace is not current, its cause and recovery sit under the bar.
        <div className="office-status-notice" data-testid="workspace-notice" ref={noticeRef}>
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
        </div>
      ) : null}

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

      {outlineOpen ? (
        <section
          id="office-outline"
          className="office-outline"
          aria-label="Office outline"
          ref={outlineRef}
          tabIndex={-1}
        >
          <header>
            <div>
              <h2>Office outline</h2>
              <p>Equivalent people, zones, states, relationships, and actions.</p>
            </div>
            <strong>{state === "ready" ? "Current" : state}</strong>
            <button type="button" onClick={closeOutline}>
              Close outline
            </button>
          </header>
          {state === "ready" ? (
            <p data-testid="workspace-cause">Cause: {presentation.cause}</p>
          ) : null}

          <ol className="office-zone-list" aria-label="Office zones">
            {zones.map((zone) => (
              <li key={zone.entityId} data-canvas-twin-id={zone.entityId}>
                <div>
                  <h3>{zone.label}</h3>
                  <p>State: Layout only — no canonical state record</p>
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
                          <h4>{person.label}</h4>
                          <p>{personState(person.entityId)}</p>
                          <p>{person.relationship}</p>
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
          {model.unassignedWork.length > 0 ? (
            <div className="office-unassigned">
              <h3 id="office-unassigned-heading">Unassigned work</h3>
              {/* Task 9d, F-9-1: work nobody holds, which no person's card or inspector lists. */}
              <ol aria-label="Unassigned work">
                {model.unassignedWork.map((work) => (
                  <li key={work.workItemId}>
                    <strong>{work.outcome}</strong> <span>{stateWord(work.state)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

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
          <InspectorFields
            model={model}
            entityId={selectedEntity.entityId}
            overlay={office.overlay}
            revision={revision}
            {...(library
              ? {
                  onOpenEvidence: (link: EvidenceLink, trigger: HTMLButtonElement) => {
                    libraryTriggerRef.current = trigger;
                    setInitialEvidence(link);
                    setLibraryOpen(true);
                    setAnnouncement(`Evidence ${link.evidenceId} version ${link.version} opened`);
                  },
                }
              : {})}
          />
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
                setInitialEvidence(undefined);
                setLibraryOpen(true);
                setAnnouncement(`${selectedEntity.label} evidence opened`);
              }}
            >
              Open Project Library
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
            else (outlineRef.current ?? outlineTriggerRef.current)?.focus();
          }}
        />
      ) : null}
      {libraryOpen && library ? (
        <EvidenceLibrary
          key={
            initialEvidence ? `${initialEvidence.evidenceId}@${initialEvidence.version}` : "library"
          }
          projection={library}
          {...(initialEvidence ? { initialEvidence } : {})}
          onClose={() => {
            setLibraryOpen(false);
            setAnnouncement("Project Library closed");
            if (libraryTriggerRef.current) libraryTriggerRef.current.focus();
            else (outlineRef.current ?? outlineTriggerRef.current)?.focus();
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

function InspectorFields({
  model,
  entityId,
  overlay,
  revision,
  onOpenEvidence,
}: Readonly<{
  model: OfficeModel["model"];
  entityId: string;
  overlay: string | null;
  revision: number;
  /** Present when a Project Library is available to open the evidence in. */
  onOpenEvidence?: (link: EvidenceLink, trigger: HTMLButtonElement) => void;
}>) {
  const entity = entityOf(model, entityId);
  const trail = `workspace revision ${revision} · last event ${model.source.lastEventId ?? "none"} · ${entityId}`;
  if (!entity || entity.kind === "zone") {
    return (
      <>
        <dl className="office-inspector-answers">
          <dt>What&apos;s happening</dt>
          <dd>Layout only — no canonical state record</dd>
        </dl>
        <details className="office-inspector-technical">
          <summary>Technical detail</summary>
          <dl>
            <dt>State</dt>
            <dd>Layout only — no canonical state record</dd>
            <dt>Cause</dt>
            <dd>No cause event recorded</dd>
            <dt>Current work</dt>
            <dd>{NOT_ASSIGNED}</dd>
            <dt>Runtime binding</dt>
            <dd>{NOT_IN_FIXTURE}</dd>
            <dt>Permissions</dt>
            <dd>{NOT_IN_FIXTURE}</dd>
            <dt>Technical trail</dt>
            <dd>{trail}</dd>
          </dl>
        </details>
      </>
    );
  }
  const agent = entity.agent;
  const recorded = agent.status === "recorded" ? agent : null;
  const freshness = recorded ? recorded.freshness : "unavailable";
  const runtime = entity.runtime;
  const warning = freshnessWarning(entity, model, overlay);
  return (
    <>
      {warning ? (
        <p className="office-inspector-warning" role="note">
          {warning}
        </p>
      ) : null}
      <dl className="office-inspector-answers">
        <dt>What&apos;s happening</dt>
        <dd>{happeningText(entity)}</dd>
        <dt>Why</dt>
        <dd>{whyText(entity)}</dd>
        <dt>What needs you</dt>
        <dd>{needsYouPlain(entity)}</dd>
        <dt>Evidence</dt>
        <dd>
          {evidencePlain(entity)}
          {onOpenEvidence
            ? entity.work
                .flatMap((work) => work.evidence)
                .map(({ evidenceId, kind, version }) => (
                  <button
                    key={`${evidenceId}@${version}`}
                    type="button"
                    onClick={(event) =>
                      onOpenEvidence({ evidenceId, version }, event.currentTarget)
                    }
                  >
                    Open {stateWord(kind)} evidence, version {version}
                  </button>
                ))
            : null}
        </dd>
        <dt>Approval</dt>
        <dd>{approvalPlain(entity)}</dd>
      </dl>
      {/* Owner rulings 9d-1 and 9d-2: identifiers, codes and attribution words are on demand. */}
      <details className="office-inspector-technical">
        <summary>Technical detail</summary>
        <dl>
          <dt>State</dt>
          <dd>{personStateText(entity)}</dd>
          <dt>Cause</dt>
          <dd>{recorded?.causeEventId ?? "No cause event recorded"}</dd>
          <dt>Updated</dt>
          <dd>{recorded?.updatedAt ?? "Not recorded"}</dd>
          <dt>Freshness</dt>
          <dd>
            {freshness}
            {overlay ? ` · workspace ${overlay}` : ""}
            {model.current ? "" : " · the office read model is not current"}
          </dd>
          <dt>Current work</dt>
          <dd>{currentWorkText(entity)}</dd>
          <dt>Needs you</dt>
          <dd>{needsYouText(entity)}</dd>
          <dt>Blocker</dt>
          <dd>{blockerText(entity)}</dd>
          <dt>Requested action</dt>
          <dd>{requestedActionText(entity)}</dd>
          <dt>Approval status</dt>
          <dd>{approvalText(entity)}</dd>
          <dt>Evidence records</dt>
          <dd>{evidenceText(entity)}</dd>
          <dt>Runtime binding</dt>
          <dd>
            {runtime.status === "recorded"
              ? `${runtime.source} v${runtime.version}${runtime.fixture ? " · fixture" : ""}`
              : NOT_IN_FIXTURE}
          </dd>
          <dt>Permissions</dt>
          <dd>
            {runtime.status === "recorded"
              ? runtime.permissions.join(", ") || "None recorded"
              : NOT_IN_FIXTURE}
          </dd>
          <dt>Technical trail</dt>
          <dd>{trail}</dd>
        </dl>
      </details>
    </>
  );
}
