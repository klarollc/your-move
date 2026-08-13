import { useEffect, useRef, useState } from "react";

import {
  createOfficeSceneAdapter,
  type OfficeSceneAdapter,
  type SceneDescriptor,
} from "./office-scene-adapter.js";
import { createPixiSceneRenderer, type SceneIntent } from "./pixi-scene-renderer.js";
import "./pixi-scene-probe.css";

const descriptors: readonly SceneDescriptor[] = Object.freeze([
  Object.freeze({
    entityId: "agent_b",
    entityType: "agent",
    x: 480,
    y: 260,
    width: 92,
    height: 92,
    depth: 2,
    visible: true,
  }),
  Object.freeze({
    entityId: "zone_team",
    entityType: "zone",
    x: 180,
    y: 120,
    width: 620,
    height: 360,
    depth: 0,
    visible: true,
  }),
  Object.freeze({
    entityId: "agent_a",
    entityType: "agent",
    x: 320,
    y: 220,
    width: 92,
    height: 92,
    depth: 1,
    visible: true,
  }),
]);

const sceneOrder = [...descriptors]
  .sort((left, right) => left.depth - right.depth || left.entityId.localeCompare(right.entityId))
  .map(({ entityId }) => entityId)
  .join(",");

export function PixiSceneProbe() {
  const hostRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<OfficeSceneAdapter | undefined>(undefined);
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const [released, setReleased] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [lastIntent, setLastIntent] = useState<SceneIntent | undefined>(undefined);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (released) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const adapterCell: { current?: OfficeSceneAdapter } = {};
    const renderer = createPixiSceneRenderer(
      () => adapterCell.current?.contextLost(),
      setLastIntent,
    );
    const adapter = createOfficeSceneAdapter(renderer, setCanvasUnavailable);
    adapterCell.current = adapter;
    adapterRef.current = adapter;

    void adapter
      .mount(host)
      .then(() => {
        if (cancelled) return;
        adapter.update(descriptors);
        observer = new ResizeObserver(([entry]) => {
          if (!entry) return;
          const width = Math.round(entry.contentRect.width);
          const height = Math.round(entry.contentRect.height);
          if (width < 1 || height < 1) return;
          adapter.resize(width, height);
          setRenderSize({ width, height });
        });
        observer.observe(host);
      })
      .catch(() => {
        if (!cancelled) setCanvasUnavailable(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      adapter.unmount();
      if (adapterRef.current === adapter) adapterRef.current = undefined;
    };
  }, [generation, released]);

  const retryCanvas = () => {
    adapterRef.current?.unmount();
    adapterRef.current = undefined;
    setCanvasUnavailable(false);
    setGeneration((value) => value + 1);
  };
  const releaseRenderer = () => {
    adapterRef.current?.unmount();
    adapterRef.current = undefined;
    setReleased(true);
  };

  const status = released
    ? "Renderer released."
    : canvasUnavailable
      ? "Canvas unavailable. Office outline remains available."
      : "Canvas ready.";

  return (
    <main
      className="pixi-probe"
      aria-label="Phase 4 Pixi scene probe"
      data-canvas-unavailable={canvasUnavailable}
      data-render-height={renderSize.height}
      data-last-intent={lastIntent ? `${lastIntent.type}:${lastIntent.entityId}` : undefined}
      data-render-width={renderSize.width}
      data-scene-order={sceneOrder}
    >
      <header className="pixi-probe-bar">
        <div>
          <strong>Office scene adapter</strong>
          <span>Graybox renderer lifecycle probe</span>
        </div>
        <p role="status">{status}</p>
        {canvasUnavailable && !released ? (
          <button type="button" onClick={retryCanvas}>
            Retry canvas
          </button>
        ) : null}
        <button type="button" onClick={releaseRenderer} disabled={released}>
          Release renderer
        </button>
      </header>
      <div className="pixi-probe-host" ref={hostRef} aria-hidden="true" />
      <section className="pixi-probe-outline" aria-label="Office scene outline">
        <h1>Team work area</h1>
        <p>Semantic fallback remains operable without the canvas.</p>
        <ul>
          <li>Product Designer · agent_a · available</li>
          <li>Implementation Engineer · agent_b · working</li>
        </ul>
      </section>
    </main>
  );
}
