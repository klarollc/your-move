import type { SceneRendererPort } from "./office-scene-adapter.js";

export type SceneIntent = Readonly<{ type: "scene.entity.select"; entityId: string }>;

const SVG = "http://www.w3.org/2000/svg";

/**
 * Phase 7 Task 3a (spec F-1). The office scene drawn as SVG in the DOM, behind the same adapter the
 * Pixi renderer used, and at parity with it: one rectangle per descriptor, the same palette, depth
 * order, camera transform and pointer selection. There is no WebGL context to lose; a failure to
 * mount reaches the shell as `render-error` (plan Q-1). The Active office is Task 3b.
 */
export function createSvgSceneRenderer(onIntent: (intent: SceneIntent) => void): SceneRendererPort {
  let svg: SVGSVGElement | undefined;
  let layer: SVGGElement | undefined;
  const nodes = new Map<string, SVGRectElement>();

  const requireLayer = (): SVGGElement => {
    if (!layer) throw new Error("SVG_SCENE_NOT_MOUNTED");
    return layer;
  };

  return {
    mount(host) {
      if (svg) throw new Error("SVG_SCENE_ALREADY_MOUNTED");
      const nextSvg = document.createElementNS(SVG, "svg");
      nextSvg.dataset.sceneRenderer = "svg";
      nextSvg.setAttribute("width", String(Math.max(1, host.clientWidth)));
      nextSvg.setAttribute("height", String(Math.max(1, host.clientHeight)));
      // The DOM labels and the Office outline name everything; the drawing is decoration to
      // assistive technology, as the Pixi canvas was.
      nextSvg.setAttribute("aria-hidden", "true");
      const nextLayer = document.createElementNS(SVG, "g");
      nextLayer.dataset.sceneLayer = "";
      nextSvg.append(nextLayer);
      host.append(nextSvg);
      svg = nextSvg;
      layer = nextLayer;
    },

    upsert(descriptor) {
      const target = requireLayer();
      let rect = nodes.get(descriptor.entityId);
      if (!rect) {
        const created = document.createElementNS(SVG, "rect");
        created.dataset.entityId = descriptor.entityId;
        created.addEventListener("click", () =>
          onIntent({ type: "scene.entity.select", entityId: descriptor.entityId }),
        );
        nodes.set(descriptor.entityId, created);
        target.append(created);
        rect = created;
      }
      const palette = descriptor.entityType === "zone" ? zonePalette : agentPalette;
      rect.setAttribute("x", String(descriptor.x));
      rect.setAttribute("y", String(descriptor.y));
      rect.setAttribute("width", String(descriptor.width));
      rect.setAttribute("height", String(descriptor.height));
      rect.setAttribute("fill", palette.fill);
      rect.setAttribute("fill-opacity", String(palette.alpha));
      rect.setAttribute("stroke", palette.stroke);
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("visibility", descriptor.visible ? "visible" : "hidden");
    },

    remove(entityId) {
      nodes.get(entityId)?.remove();
      nodes.delete(entityId);
    },

    sort(entityIds) {
      const target = requireLayer();
      for (const entityId of entityIds) {
        const rect = nodes.get(entityId);
        if (rect) target.append(rect);
      }
    },

    transform(zoom, translation) {
      requireLayer().setAttribute(
        "transform",
        `translate(${translation.x} ${translation.y}) scale(${zoom})`,
      );
    },

    resize(width, height) {
      if (!svg) throw new Error("SVG_SCENE_NOT_MOUNTED");
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
    },

    clear() {
      for (const rect of nodes.values()) rect.remove();
      nodes.clear();
    },

    destroy() {
      svg?.remove();
      svg = undefined;
      layer = undefined;
      nodes.clear();
    },
  };
}

// The Pixi renderer's palette, unchanged (3a is parity).
const zonePalette = { fill: "#cfd2cf", stroke: "#676b68", alpha: 0.72 } as const;
const agentPalette = { fill: "#f2f1eb", stroke: "#292c2a", alpha: 1 } as const;
