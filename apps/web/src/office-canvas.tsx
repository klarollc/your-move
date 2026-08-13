import { createOfficeCamera, createOfficeLayout, officeLayoutPolicy } from "@cuckcode/ui-system";
import { useEffect, useRef, useState } from "react";

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

export function OfficeWorkspace({ initialState }: Readonly<{ initialState: OfficeShellState }>) {
  const [state, setState] = useState(initialState);
  const [canvasKey, setCanvasKey] = useState(0);
  const showPersistedScene = !["loading", "empty", "error", "canvas-loss"].includes(state);

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
            onCanvasUnavailable={(unavailable) => {
              if (unavailable) setState("canvas-loss");
            }}
          />
        ) : undefined
      }
      onRecovery={recover}
      onResetView={() => setCanvasKey((value) => value + 1)}
    />
  );
}

function OfficeCanvas({
  onCanvasUnavailable,
}: Readonly<{ onCanvasUnavailable: (unavailable: boolean) => void }>) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const adapterCell: { current?: OfficeSceneAdapter } = {};
    const renderer = createPixiSceneRenderer(
      () => adapterCell.current?.contextLost(),
      () => undefined,
    );
    const adapter = createOfficeSceneAdapter(renderer, onCanvasUnavailable);
    adapterCell.current = adapter;

    void adapter
      .mount(host)
      .then(() => {
        if (cancelled) return;
        adapter.update(sceneDescriptors);
        resizeScene(adapter, host.clientWidth, host.clientHeight);
        observer = new ResizeObserver(([entry]) => {
          if (!entry) return;
          const width = Math.round(entry.contentRect.width);
          const height = Math.round(entry.contentRect.height);
          if (width < 1 || height < 1) return;
          resizeScene(adapter, width, height);
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
  }, [onCanvasUnavailable]);

  return <div className="office-canvas-host" data-office-canvas-host ref={hostRef} />;
}

function resizeScene(adapter: OfficeSceneAdapter, width: number, height: number) {
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
