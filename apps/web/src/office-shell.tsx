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
  attentionSummary,
  blockerText,
  currentWorkText,
  entityOf,
  evidenceText,
  approvalPlain,
  evidencePlain,
  freshnessWarning,
  happeningText,
  personStateLine,
  needsYouPlain,
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

const capitalise = (value: string) =>
  value.length === 0 ? value : `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

/** The contextual surfaces, of which one at most is open (Task 9f-2, P-2). */
type Surface = "outline" | "attention" | "inspector" | "library" | "kickoff";
type BackEntry = Readonly<{
  surface: Surface;
  focusLabel: string | undefined;
  /** The inspector's entity when the surface left behind is the inspector. */
  selection: string | undefined;
}>;
const surfaceNames: Readonly<Record<Surface, string>> = {
  outline: "outline",
  attention: "attention",
  inspector: "inspector",
  library: "Library",
  kickoff: "kickoff",
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
    runtime: "Runtime updates unavailable",
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
  const kickoffTriggerRef = useRef<HTMLButtonElement>(null);
  const [initialEvidence, setInitialEvidence] = useState<EvidenceLink | undefined>(undefined);
  const attentionTriggerRef = useRef<HTMLButtonElement>(null);
  const outlineTriggerRef = useRef<HTMLButtonElement>(null);
  // Task 9f-2, owner ruling P-2 (reverses A-2; AR-04, constitution rule 3): one contextual surface
  // at a time. Moving from one surface to the next keeps a way back: the stack holds the surfaces
  // left behind and the name of the control used, so going back can focus it again. The outline
  // is still shown without asking when the scene cannot be the working surface (Task 9e).
  const sceneUnavailable = SCENE_UNAVAILABLE.has(state);
  const [surface, setSurface] = useState<Surface | null>(sceneUnavailable ? "outline" : null);
  const [backStack, setBackStack] = useState<readonly BackEntry[]>([]);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const pendingFocusRef = useRef<string | undefined>(undefined);
  const selectionRef = useRef<string | undefined>(undefined);
  const focusOutlineRef = useRef(false);
  const outlineOpen = surface === "outline";
  const attentionOpen = surface === "attention";
  const libraryOpen = surface === "library";
  const kickoffOpen = surface === "kickoff";
  useEffect(() => {
    if (sceneUnavailable) setSurface((current) => current ?? "outline");
  }, [sceneUnavailable]);
  useEffect(() => {
    if (outlineOpen && focusOutlineRef.current) {
      focusOutlineRef.current = false;
      outlineRef.current?.focus();
    }
    const label = pendingFocusRef.current;
    if (!label) return;
    pendingFocusRef.current = undefined;
    [...(shellRef.current?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent?.trim() === label)
      ?.focus();
  }, [surface, outlineOpen]);
  /** Move to another surface from the current one, remembering the way back. */
  const advance = (next: Surface, focusLabel?: string) => {
    const current = surfaceRef.current;
    if (current && current !== next) {
      const selection = current === "inspector" ? selectionRef.current : undefined;
      setBackStack((stack) => [...stack, { surface: current, focusLabel, selection }]);
    }
    surfaceRef.current = next;
    setSurface(next);
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
  // Task 9f-1, owner ruling 9f-1a: the MDD's runtime health stays in the bar, in plain words.
  const health = capitalise(presentation.runtime.replace(/^Runtime /u, ""));
  const selection = selectedEntityId ?? internalSelection;
  selectionRef.current = selection;
  const selectedEntity = officeShellEntities.find(({ entityId }) => entityId === selection);
  const inspectorOpen = surface === "inspector" && Boolean(selectedEntity);
  const visibleAttention = attention.filter(
    ({ attentionId }) => !dismissedAttentionIds.has(attentionId),
  );
  const dispositionsAvailable = state === "ready" || state === "partial";

  useEffect(() => {
    if (!selectedEntityId) return;
    const entity = officeShellEntities.find(({ entityId }) => entityId === selectedEntityId);
    setAnnouncement(`${entity?.label ?? selectedEntityId} selected`);
    // A selection made in the scene opens the inspector in place of what was open.
    if (surfaceRef.current !== "inspector") advance("inspector");
  }, [selectedEntityId]);
  const selectEntity = (entityId: string, trigger: HTMLButtonElement) => {
    selectionTriggerRef.current = trigger;
    advance("inspector", trigger.textContent?.trim());
    setInternalSelection(entityId);
    onSelectEntity?.(entityId);
    const entity = officeShellEntities.find((candidate) => candidate.entityId === entityId);
    setAnnouncement(`${entity?.label ?? entityId} selected`);
  };

  const clearSelection = () => {
    if (!selection) return;
    setInternalSelection(undefined);
    onSelectEntity?.(undefined);
  };
  /** Open a surface from the project bar: a fresh start, with nothing to go back to. */
  const openFromBar = (next: Surface | null) => {
    clearSelection();
    setBackStack([]);
    surfaceRef.current = next;
    setSurface(next);
  };
  const openOutline = () => {
    focusOutlineRef.current = true;
    openFromBar("outline");
    if (outlineOpen) outlineRef.current?.focus();
    setAnnouncement("Office outline opened");
  };
  const triggerFor = (origin: Surface | undefined) =>
    origin === "outline"
      ? outlineTriggerRef.current
      : origin === "attention"
        ? attentionTriggerRef.current
        : undefined;
  /** Close whatever is open and return to the office, focusing what began this journey. */
  const closeToOffice = (announcement: string) => {
    const origin = backStack[0]?.surface ?? surfaceRef.current ?? undefined;
    const leaving = surfaceRef.current;
    openFromBar(null);
    setAnnouncement(announcement);
    const trigger = triggerFor(origin);
    if (trigger) trigger.focus();
    else if (leaving === "inspector") selectionTriggerRef.current?.focus();
    else (outlineTriggerRef.current ?? undefined)?.focus();
  };
  const closeOutline = () => closeToOffice("Office outline closed");
  const closeAttention = () => closeToOffice("Manager attention closed");
  const closeInspector = () => closeToOffice("Inspector closed");
  /** Go back one surface, or close to the office when there is nothing to go back to. */
  const back = () => {
    const previous = backStack.at(-1);
    const leaving = surfaceRef.current;
    if (!previous) {
      closeToOffice(
        leaving === "inspector"
          ? "Inspector closed"
          : `${surfaceNames[leaving ?? "outline"]} closed`,
      );
      return;
    }
    if (previous.surface === "inspector" && previous.selection) {
      setInternalSelection(previous.selection);
      onSelectEntity?.(previous.selection);
    } else if (leaving === "inspector") clearSelection();
    setBackStack((stack) => stack.slice(0, -1));
    pendingFocusRef.current = previous.focusLabel;
    surfaceRef.current = previous.surface;
    setSurface(previous.surface);
    setAnnouncement(`Back to ${surfaceNames[previous.surface]}`);
  };

  useEffect(() => {
    // The Library and the kickoff handle their own Escape; each closes through `back`.
    if (!surface || libraryOpen || kickoffOpen) return;
    const backOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") back();
    };
    window.addEventListener("keydown", backOnEscape);
    return () => window.removeEventListener("keydown", backOnEscape);
  });
  const personState = (entityId: string) => personStateLine(model, entityId);
  const zones = officeShellEntities.filter(({ kind }) => kind === "zone");
  const people = officeShellEntities.filter(({ kind }) => kind === "person");

  return (
    <main
      className="office-shell"
      ref={shellRef}
      aria-label="CuckCode office workspace"
      data-inspector-open={inspectorOpen}
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
        <div className="office-project-identity">
          <h1 className="office-product-name">CuckCode</h1>
          <span aria-hidden="true">/</span>
          <span>truthful graybox office</span>
        </div>
        <span className="office-health">{health}</span>
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
              openFromBar("attention");
              setAnnouncement(`${visibleAttention.length} manager attention items opened`);
            }}
          >
            {attentionSummary(visibleAttention)}
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
          {/* Task 9f-1: the session's runtime and revision, off the bar (AR-04). */}
          <details className="office-outline-technical">
            <summary>Technical detail</summary>
            <dl>
              <dt>Runtime</dt>
              <dd>{presentation.runtime}</dd>
              <dt>Session</dt>
              <dd>Local session · revision {revision}</dd>
            </dl>
          </details>
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
            advance("inspector", `Locate ${item.label}`);
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
      {inspectorOpen && selectedEntity ? (
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
            <div className="office-inspector-actions">
              {backStack.length > 0 ? (
                <button type="button" onClick={back}>
                  Back to {surfaceNames[backStack.at(-1)!.surface]}
                </button>
              ) : null}
              <button type="button" onClick={closeInspector}>
                Close inspector
              </button>
            </div>
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
                    advance("library", trigger.textContent?.trim());
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
              onClick={(event) => {
                setInitialEvidence(undefined);
                advance("library", event.currentTarget.textContent?.trim());
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
              onClick={(event) => {
                advance("kickoff", event.currentTarget.textContent?.trim());
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
            back();
            setAnnouncement("Collaborative kickoff closed");
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
            back();
            setAnnouncement("Project Library closed");
          }}
          onLocateOrigin={(entityId, evidence) => {
            // Back from the inspector returns to the Library, on the record that was open.
            advance("inspector", `View ${evidence.evidenceId} v${evidence.version}`);
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
