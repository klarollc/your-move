import { executeAttentionCommand, projectKickoffReadModel } from "@cuckcode/application";
import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import {
  createKickoff,
  recordKickoffContribution,
  recordKickoffSynthesis,
  type KickoffState,
} from "@cuckcode/domain";
import { createOfficeCamera, createOfficeLayout, officeLayoutPolicy } from "@cuckcode/ui-system";
import {
  RECONCILIATION_B_CLARITY,
  renderSceneDefs,
  renderSceneLayer,
  sceneEntities,
} from "@cuckcode/ui-system/scene";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AttentionDisposition,
  OfficeAttentionItem,
  OfficeDispositionResult,
} from "./attention-rail.js";
import {
  attentionItemsFrom,
  officeLibraryFor,
  motionFrom,
  officeModelFor,
  revisionOf,
  sceneLabelsFrom,
  UPDATES_UNAVAILABLE_STATES,
  type OfficeModel,
  type SceneLabel,
} from "./office-model.js";
import { OfficeShell, type OfficeShellState } from "./office-shell.js";
import {
  createOfficeSceneAdapter,
  type OfficeSceneAdapter,
  type SceneDescriptor,
  type SceneTransform,
} from "./office-scene-adapter.js";
import { createSvgSceneRenderer } from "./svg-scene-renderer.js";

/**
 * Phase 7 Task 3b (rulings G-1 to G-3). The Active visual system's own office, drawn once, with no
 * baked labels or fixed figures; every entity's hit region, label anchor and the camera come from
 * the same Phase 6 geometry. Task 5 (W-1 to W-4) adds the room: back walls, the window wall and its
 * fixed daylight, and front walls cut to low stubs.
 */
const sceneArt = Object.freeze({
  defs: renderSceneDefs(RECONCILIATION_B_CLARITY),
  layer: renderSceneLayer(RECONCILIATION_B_CLARITY, {
    labels: false,
    figures: false,
    architecture: true,
    furniture: true,
  }),
});
const entities = sceneEntities();
const sceneDescriptors: readonly SceneDescriptor[] = Object.freeze(
  entities.map((entity) => ({
    entityId: entity.entityId,
    entityType: entity.entityType,
    points: entity.polygon,
    depth: entity.depth,
    visible: true,
  })),
);
const anchorsById = new Map(entities.map((entity) => [entity.entityId, entity.anchor]));

// Deterministic kickoff fixtures. These are graybox records, not a live kickoff: no role is
// promoted, no provider is called, and no charter is approved.
const kickoffRoleIds = ["delivery", "design", "implementation", "test", "visual", "release"];

const kickoffBriefing: KickoffBriefing = {
  schemaVersion: 1,
  kickoffId: "kickoff_graybox",
  projectId: "project_graybox",
  briefingVersion: 3,
  goal: "Choose the first project goal collaboratively.",
  constraints: ["No pre-charter implementation"],
  permissions: ["project.read", "collaboration.contribute"],
  evidenceFloor: ["test", "visual", "release"],
  knowledgeSnapshotId: "snapshot_42",
  managerNonNegotiables: ["Six attributable roles", "One revision maximum"],
  activeRoleIds: kickoffRoleIds,
};

function kickoffContribution(roleId: string): KickoffContribution {
  return {
    schemaVersion: 1,
    contributionId: `contribution_${roleId}`,
    kickoffId: "kickoff_graybox",
    briefingVersion: 3,
    roleId,
    agentId: `agent_${roleId}`,
    kind: "proposal",
    goal: `${roleId} goal`,
    value: `${roleId} value`,
    risk: `${roleId} risk`,
    dependencies: [],
    acceptanceCriteria: [`${roleId} criterion`],
    evidenceNeeds: [`${roleId} evidence`],
    uncertainties: [],
    disagreements:
      roleId === "release" ? ["Independent review must stay separate from delivery"] : [],
  };
}

function buildKickoffState(roleCount: number, synthesised: boolean): KickoffState {
  let state = createKickoff(kickoffBriefing);
  for (const roleId of kickoffRoleIds.slice(0, roleCount)) {
    const next = recordKickoffContribution(state, kickoffContribution(roleId));
    if (!next.ok) throw new Error(next.code);
    state = next.state;
  }
  if (!synthesised) return state;
  const withSynthesis = recordKickoffSynthesis(
    state,
    {
      synthesisId: "synthesis_graybox",
      authorRoleId: "delivery",
      proposedGoal: "Build the Decision Notice as the first isolated slice.",
      includedContributionIds: kickoffRoleIds.map((roleId) => `contribution_${roleId}`),
      disagreementRegister: [
        { roleId: "release", statement: "Independent review must stay separate from delivery" },
      ],
      unresolvedEvidenceGaps: ["No rendered evidence exists yet"],
    },
    "delivery",
  );
  if (!withSynthesis.ok) throw new Error(withSynthesis.code);
  return withSynthesis.state;
}

export const kickoffFixtures = {
  round: projectKickoffReadModel(buildKickoffState(3, false)),
  revision: projectKickoffReadModel(buildKickoffState(6, true)),
} as const;

export type KickoffFixtureId = keyof typeof kickoffFixtures;

export function OfficeWorkspace({
  initialState,
  motionEnabled = false,
  motionCheckpoint = "settled",
  kickoffFixture,
  fixtureId,
}: Readonly<{
  initialState: OfficeShellState;
  motionEnabled?: boolean;
  motionCheckpoint?: string;
  kickoffFixture?: KickoffFixtureId | undefined;
  /** A named office log (`?fixture=`) rendered instead of the state's own log. */
  fixtureId?: string | undefined;
}>) {
  const [state, setState] = useState(initialState);
  const [canvasKey, setCanvasKey] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  // The canonical log for this state is replayed and projected once; every surface reads it.
  const office = useMemo(() => officeModelFor(state, fixtureId), [state, fixtureId]);
  const library = useMemo(() => officeLibraryFor(state, fixtureId), [state, fixtureId]);
  const labels = useMemo(
    () =>
      sceneLabelsFrom(office.model, { updatesUnavailable: UPDATES_UNAVAILABLE_STATES.has(state) }),
    [office, state],
  );
  const motion = motionEnabled
    ? motionFrom(office.model, {
        reducedMotion,
        checkpoint: motionCheckpoint,
        updatesUnavailable: UPDATES_UNAVAILABLE_STATES.has(state),
      })
    : undefined;
  const showPersistedScene = !["loading", "empty", "error", "render-error"].includes(state);

  const handleCanvasUnavailable = useCallback((unavailable: boolean) => {
    if (unavailable) setState("render-error");
  }, []);
  const recover = () => {
    setCanvasKey((value) => value + 1);
    setState("ready");
  };

  return (
    <OfficeShell
      state={state}
      canvas={
        showPersistedScene ? (
          <OfficeCanvas
            key={canvasKey}
            onCanvasUnavailable={handleCanvasUnavailable}
            onSelectEntity={setSelectedEntityId}
            labels={labels}
          />
        ) : undefined
      }
      onRecovery={recover}
      onResetView={() => setCanvasKey((value) => value + 1)}
      selectedEntityId={selectedEntityId}
      onSelectEntity={setSelectedEntityId}
      {...(kickoffFixture ? { kickoff: kickoffFixtures[kickoffFixture] } : {})}
      model={office}
      library={library}
      {...(motion ? { motion } : {})}
      onDisposition={(item, intent, scope) =>
        executeFixtureDisposition(state, office, item, intent, scope)
      }
    />
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function executeFixtureDisposition(
  state: OfficeShellState,
  office: OfficeModel,
  item: OfficeAttentionItem,
  intent: AttentionDisposition,
  scope: Record<string, string>,
): OfficeDispositionResult {
  const commandId = `command_${item.attentionId}_${intent}`;
  const revision = revisionOf(office.model);
  const result = executeAttentionCommand({
    command: {
      schemaVersion: 1,
      commandId,
      projectId: "project_graybox",
      expectedRevision: revision,
      actor: { actorType: "manager", actorId: "manager_local" },
      intent,
      targetEntityId: item.entityId,
      payload: { attentionId: item.attentionId, ...scope },
    },
    current: {
      projectId: "project_graybox",
      revision,
      freshness: state === "stale" || !office.model.current ? "stale" : "current",
      connection:
        state === "offline" ? "disconnected" : state === "error" ? "timeout" : "connected",
      attention: attentionItemsFrom(office.model),
    },
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      ...(result.requiredAction ? { requiredAction: result.requiredAction } : {}),
    };
  }
  return {
    ok: true,
    receipt: {
      receiptId: result.receipt.receiptId,
      acceptedRevision: result.receipt.acceptedRevision,
      resultingRevision: result.receipt.resultingRevision,
      targetEntityId: result.receipt.targetEntityId,
      disposition: result.receipt.disposition,
      correlationId: result.receipt.technicalScope.correlationId,
      agentVisible: result.receipt.agentVisible,
    },
  };
}

function OfficeCanvas({
  onCanvasUnavailable,
  onSelectEntity,
  labels,
}: Readonly<{
  onCanvasUnavailable: (unavailable: boolean) => void;
  onSelectEntity: (entityId: string) => void;
  labels: readonly SceneLabel[];
}>) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The camera the scene was last drawn with, so the labels sit over what they name.
  const [camera, setCamera] = useState<SceneTransform | undefined>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const renderer = createSvgSceneRenderer(({ entityId }) => onSelectEntity(entityId), {
      art: sceneArt,
    });
    const adapter = createOfficeSceneAdapter(renderer, onCanvasUnavailable);

    void adapter
      .mount(host)
      .then(() => {
        if (cancelled) return;
        adapter.update(sceneDescriptors);
        setCamera(resizeScene(adapter, host.clientWidth, host.clientHeight, host));
        observer = new ResizeObserver(([entry]) => {
          if (!entry) return;
          const width = Math.round(entry.contentRect.width);
          const height = Math.round(entry.contentRect.height);
          if (width < 1 || height < 1) return;
          setCamera(resizeScene(adapter, width, height, host));
        });
        observer.observe(host);
      })
      .catch(() => {
        if (!cancelled) onCanvasUnavailable(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      adapter.unmount();
    };
  }, [onCanvasUnavailable, onSelectEntity]);

  return (
    <>
      <div className="office-canvas-host" data-office-canvas-host ref={hostRef} />
      {camera ? <SceneLabels labels={labels} camera={camera} /> : null}
    </>
  );
}

/**
 * Task 9f-3 (P-3; AR-01, constitution rules 2 and 9): horizontal screen-space labels over the
 * scene, as a list for assistive technology, never taking the pointer. Task 3b (G-3): a person's
 * label sits on their own desk; a zone's sits above its back corner, where Phase 6 named it.
 */
function SceneLabels({
  labels,
  camera,
}: Readonly<{ labels: readonly SceneLabel[]; camera: SceneTransform }>) {
  const { zoom, translation } = camera;
  return (
    <ol className="office-scene-labels" aria-label="People and places in the office">
      {labels.map((label) => {
        const anchor = anchorsById.get(label.entityId);
        if (!anchor) return null;
        return (
          <li
            key={label.entityId}
            className="office-scene-label"
            data-scene-label={label.entityId}
            data-placement={label.kind === "person" ? "desk" : "zone"}
            data-needs-you={label.needsYou}
            style={{
              left: `${anchor.x * zoom + translation.x}px`,
              top: `${anchor.y * zoom + translation.y}px`,
            }}
          >
            {label.state ? `${label.name} · ${label.state}` : label.name}
          </li>
        );
      })}
    </ol>
  );
}

/** Resizes and re-frames the scene; returns the camera drawn with, or nothing below the minimum. */
function resizeScene(
  adapter: OfficeSceneAdapter,
  width: number,
  height: number,
  host: HTMLDivElement,
): SceneTransform | undefined {
  adapter.resize(width, height);
  let layout;
  try {
    layout = createOfficeLayout({
      width,
      height: height + officeLayoutPolicy.projectBarHeight,
      attentionOpen: false,
      inspectorOpen: false,
    });
  } catch (error) {
    if (error instanceof RangeError && error.message === "OFFICE_VIEWPORT_BELOW_APPROVED_MINIMUM") {
      host.dataset.officeViewportStatus = "below-approved-minimum";
      return undefined;
    }
    throw error;
  }
  host.dataset.officeViewportStatus = "approved";
  const camera = createOfficeCamera(layout);
  const drawn: SceneTransform = {
    zoom: camera.zoom,
    translation: {
      x: camera.translation.x,
      y: camera.translation.y - officeLayoutPolicy.projectBarHeight,
    },
  };
  adapter.setCamera(drawn);
  const implementation = anchorsById.get("agent_implementation_engineer");
  if (!implementation) throw new Error("OFFICE_SCENE_ANCHOR_MISSING");
  const implementationCenter = {
    x: implementation.x * drawn.zoom + drawn.translation.x,
    y: implementation.y * drawn.zoom + drawn.translation.y,
  };
  host.dataset.agentImplementationScreen = `${implementationCenter.x},${implementationCenter.y}`;
  return drawn;
}
