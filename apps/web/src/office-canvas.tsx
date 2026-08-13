import { executeAttentionCommand, type BrowserLibraryProjection } from "@cuckcode/application";
import { createOfficeCamera, createOfficeLayout, officeLayoutPolicy } from "@cuckcode/ui-system";
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

export function OfficeWorkspace({ initialState }: Readonly<{ initialState: OfficeShellState }>) {
  const [state, setState] = useState(initialState);
  const [canvasKey, setCanvasKey] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
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
      attention={officeAttention}
      library={libraryProjection}
      onDisposition={(item, intent, scope) =>
        executeFixtureDisposition(initialState, item, intent, scope)
      }
    />
  );
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
  const camera = createOfficeCamera(
    createOfficeLayout({
      width,
      height: height + officeLayoutPolicy.projectBarHeight,
      attentionOpen: false,
      inspectorOpen: false,
    }),
  );
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
