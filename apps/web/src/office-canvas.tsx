import {
  executeAttentionCommand,
  projectKickoffReadModel,
  type BrowserLibraryProjection,
} from "@cuckcode/application";
import type { KickoffBriefing, KickoffContribution } from "@cuckcode/contracts";
import {
  createKickoff,
  recordKickoffContribution,
  recordKickoffSynthesis,
  type KickoffState,
} from "@cuckcode/domain";
import {
  createOfficeCamera,
  createOfficeLayout,
  officeLayoutPolicy,
  planSemanticMotion,
} from "@cuckcode/ui-system";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AttentionDisposition,
  OfficeAttentionItem,
  OfficeDispositionResult,
} from "./attention-rail.js";
import { OfficeShell, type OfficeShellState } from "./office-shell.js";
import {
  createOfficeSceneAdapter,
  type OfficeSceneAdapter,
  type SceneDescriptor,
} from "./office-scene-adapter.js";
import { createPixiSceneRenderer } from "./pixi-scene-renderer.js";

const sceneDescriptors: readonly SceneDescriptor[] = Object.freeze([
  zone("zone_reception", -340, -20, 150, 130, 0),
  zone("zone_team", -150, -40, 650, 190, 0),
  agent("agent_delivery_lead", -110, 0, 1),
  agent("agent_product_designer", -15, 0, 2),
  agent("agent_implementation_engineer", 80, 0, 3),
  agent("agent_test_engineer", 175, 0, 4),
  agent("agent_visual_qa_reviewer", 270, 0, 5),
  agent("agent_release_reviewer", 365, 0, 6),
  zone("zone_library", -280, 210, 180, 110, 7),
  zone("zone_collaboration", -40, 210, 210, 110, 8),
  zone("zone_review", 230, 210, 180, 110, 9),
  zone("zone_manager", -230, 370, 240, 100, 10),
  zone("zone_delivery", 260, 370, 180, 100, 11),
]);

const knowledgeStatuses = [
  "authoritative",
  "approved",
  "provisional",
  "contested",
  "stale",
  "superseded",
  "rejected",
] as const;

const libraryProjection: BrowserLibraryProjection = {
  knowledge: knowledgeStatuses.map((status, index) => ({
    knowledgeId: `knowledge_${status}`,
    status,
    title: `${status.slice(0, 1).toUpperCase()}${status.slice(1)} project record`,
    snippet: `Browser-safe ${status} context remains explicitly labeled.`,
    revision: index + 1,
    originatingEntityId: "zone_library",
  })),
  evidence: [
    {
      evidenceId: "evidence_task_11_test",
      kind: "test",
      status: "complete",
      summary: "Automated verification completed; manager approval remains separate.",
      revision: 42,
      originatingEntityId: "agent_test_engineer",
      approved: false,
    },
    {
      evidenceId: "evidence_task_11_visual",
      kind: "visual",
      status: "approved",
      summary: "Graybox composition approved for the bounded interaction gate.",
      revision: 42,
      originatingEntityId: "zone_review",
      approved: true,
    },
    {
      evidenceId: "evidence_task_11_release",
      kind: "release",
      status: "pending",
      summary: "Release review has not started; completion is not implied.",
      revision: 42,
      originatingEntityId: "zone_delivery",
      approved: false,
    },
  ],
};

const officeAttention: readonly OfficeAttentionItem[] = Object.freeze([
  {
    attentionId: "attention_blocked_test",
    entityId: "agent_test_engineer",
    label: "Test evidence is blocked",
    reason: "blocked",
    priority: 10,
    causeEventId: "event_test_blocked",
    plainLanguage: "The Test Engineer needs the current browser evidence.",
    requiredAction: "Redirect the evidence request or decline the blocker.",
  },
  {
    attentionId: "attention_graybox_review",
    entityId: "agent_implementation_engineer",
    label: "Graybox review requested",
    reason: "review_requested",
    priority: 40,
    causeEventId: "event_review_requested",
    plainLanguage: "The Implementation Engineer is waiting for a manager disposition.",
    requiredAction: "Approve, decline, defer, cancel, or redirect the request.",
  },
]);

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
  const withSynthesis = recordKickoffSynthesis(state, {
    synthesisId: "synthesis_graybox",
    authorRoleId: "delivery",
    proposedGoal: "Build the Decision Notice as the first isolated slice.",
    includedContributionIds: kickoffRoleIds.map((roleId) => `contribution_${roleId}`),
    disagreementRegister: [
      { roleId: "release", statement: "Independent review must stay separate from delivery" },
    ],
    unresolvedEvidenceGaps: ["No rendered evidence exists yet"],
  });
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
}: Readonly<{
  initialState: OfficeShellState;
  motionEnabled?: boolean;
  motionCheckpoint?: string;
  kickoffFixture?: KickoffFixtureId | undefined;
}>) {
  const [state, setState] = useState(initialState);
  const [canvasKey, setCanvasKey] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  const motionPlan = motionEnabled
    ? planSemanticMotion({
        canonicalRevision: 44,
        transitions: [
          {
            transitionId: "transition_handoff_review",
            semantic: "handoff",
            entityId: "agent_implementation_engineer",
            fromEntityId: "zone_team",
            toEntityId: "zone_review",
            canonicalRevision: 43,
          },
          {
            transitionId: "transition_delivery_queue",
            semantic: "delivery",
            entityId: "artifact_graybox",
            fromEntityId: "zone_review",
            toEntityId: "zone_delivery",
            canonicalRevision: 44,
          },
        ],
        reducedMotion,
        motionPaused: false,
        clock: () => 1_723_680_000_000,
      })
    : undefined;
  const showPersistedScene = !["loading", "empty", "error", "canvas-loss"].includes(state);

  const handleCanvasUnavailable = useCallback((unavailable: boolean) => {
    if (unavailable) setState("canvas-loss");
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
          />
        ) : undefined
      }
      onRecovery={recover}
      onResetView={() => setCanvasKey((value) => value + 1)}
      selectedEntityId={selectedEntityId}
      onSelectEntity={setSelectedEntityId}
      {...(kickoffFixture ? { kickoff: kickoffFixtures[kickoffFixture] } : {})}
      attention={officeAttention}
      library={libraryProjection}
      {...(motionPlan?.lead
        ? {
            motion: {
              canonicalRevision: motionPlan.canonicalState.revision,
              presentation: motionPlan.lead.presentation,
              checkpoint: motionCheckpoint,
              label:
                motionPlan.lead.presentation === "travel"
                  ? "Handoff moving to Review station"
                  : motionPlan.lead.persistentLabel,
              announcement: motionPlan.lead.announcement,
              queuedCount: motionPlan.queued.length,
              loop: motionPlan.lead.loop,
              runtimePaused: motionPlan.runtimePaused,
            },
          }
        : {})}
      onDisposition={(item, intent, scope) => executeFixtureDisposition(state, item, intent, scope)}
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
  item: OfficeAttentionItem,
  intent: AttentionDisposition,
  scope: Record<string, string>,
): OfficeDispositionResult {
  const commandId = `command_${item.attentionId}_${intent}`;
  const result = executeAttentionCommand({
    command: {
      schemaVersion: 1,
      commandId,
      projectId: "project_graybox",
      expectedRevision: 42,
      actor: { actorType: "manager", actorId: "manager_local" },
      intent,
      targetEntityId: item.entityId,
      payload: { attentionId: item.attentionId, ...scope },
    },
    current: {
      projectId: "project_graybox",
      revision: 42,
      freshness: state === "stale" ? "stale" : "current",
      connection:
        state === "offline" ? "disconnected" : state === "error" ? "timeout" : "connected",
      attention: officeAttention,
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
}: Readonly<{
  onCanvasUnavailable: (unavailable: boolean) => void;
  onSelectEntity: (entityId: string) => void;
}>) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const adapterCell: { current?: OfficeSceneAdapter } = {};
    const renderer = createPixiSceneRenderer(
      () => adapterCell.current?.contextLost(),
      ({ entityId }) => onSelectEntity(entityId),
    );
    const adapter = createOfficeSceneAdapter(renderer, onCanvasUnavailable);
    adapterCell.current = adapter;

    void adapter
      .mount(host)
      .then(() => {
        if (cancelled) return;
        adapter.update(sceneDescriptors);
        resizeScene(adapter, host.clientWidth, host.clientHeight, host);
        observer = new ResizeObserver(([entry]) => {
          if (!entry) return;
          const width = Math.round(entry.contentRect.width);
          const height = Math.round(entry.contentRect.height);
          if (width < 1 || height < 1) return;
          resizeScene(adapter, width, height, host);
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

  return <div className="office-canvas-host" data-office-canvas-host ref={hostRef} />;
}

function resizeScene(
  adapter: OfficeSceneAdapter,
  width: number,
  height: number,
  host: HTMLDivElement,
) {
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
      return;
    }
    throw error;
  }
  host.dataset.officeViewportStatus = "approved";
  const camera = createOfficeCamera(layout);
  adapter.setCamera({
    zoom: camera.zoom,
    translation: {
      x: camera.translation.x,
      y: camera.translation.y - officeLayoutPolicy.projectBarHeight,
    },
  });
  const implementationCenter = {
    x: (80 + 34) * camera.zoom + camera.translation.x,
    y: 34 * camera.zoom + camera.translation.y - officeLayoutPolicy.projectBarHeight,
  };
  host.dataset.agentImplementationScreen = `${implementationCenter.x},${implementationCenter.y}`;
}

function zone(
  entityId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
): SceneDescriptor {
  return { entityId, entityType: "zone", x, y, width, height, depth, visible: true };
}

function agent(entityId: string, x: number, y: number, depth: number): SceneDescriptor {
  return {
    entityId,
    entityType: "agent",
    x,
    y,
    width: 68,
    height: 68,
    depth,
    visible: true,
  };
}
