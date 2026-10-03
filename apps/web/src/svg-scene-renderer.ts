import type { SceneRendererPort } from "./office-scene-adapter.js";

export type SceneIntent = Readonly<{ type: "scene.entity.select"; entityId: string }>;

const SVG = "http://www.w3.org/2000/svg";

export type SvgSceneArt = Readonly<{ defs: string; layer: string }>;

/**
 * The office scene drawn as SVG in the DOM, behind the scene adapter (Phase 7 Task 3a, spec F-1).
 * There is no WebGL context to lose; a failure to mount reaches the shell as `render-error` (plan
 * Q-1). The Active office is drawn once as art (Task 3b), with one invisible hit polygon per entity
 * over it from the same geometry. Task 4 (R-3) removed the graybox rectangles kept for Pixi parity.
 */
export function createSvgSceneRenderer(
  onIntent: (intent: SceneIntent) => void,
  options?: Readonly<{ art?: SvgSceneArt }>,
): SceneRendererPort {
  let svg: SVGSVGElement | undefined;
  let layer: SVGGElement | undefined;
  let hits: SVGGElement | undefined;
  const nodes = new Map<string, SVGPolygonElement>();

  const requireLayer = (): SVGGElement => {
    if (!layer) throw new Error("SVG_SCENE_NOT_MOUNTED");
    return layer;
  };
  const requireHits = (): SVGGElement => {
    if (!hits) throw new Error("SVG_SCENE_NOT_MOUNTED");
    return hits;
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
      // Task 3b: the Active office is drawn once, from markup generated in-tree by
      // `@cuckcode/ui-system/scene` out of fixed geometry and style. It carries no canonical text.
      if (options?.art) {
        const defs = document.createElementNS(SVG, "defs");
        defs.innerHTML = options.art.defs;
        nextSvg.append(defs);
        const drawn = document.createElementNS(SVG, "g");
        drawn.dataset.sceneArt = "";
        drawn.innerHTML = options.art.layer;
        nextLayer.append(drawn);
      }
      const nextHits = document.createElementNS(SVG, "g");
      nextHits.dataset.sceneHits = "";
      nextLayer.append(nextHits);
      nextSvg.append(nextLayer);
      host.append(nextSvg);
      svg = nextSvg;
      layer = nextLayer;
      hits = nextHits;
    },

    upsert(descriptor) {
      const target = requireHits();
      let shape = nodes.get(descriptor.entityId);
      if (!shape) {
        const created = document.createElementNS(SVG, "polygon");
        created.dataset.entityId = descriptor.entityId;
        created.addEventListener("click", () =>
          onIntent({ type: "scene.entity.select", entityId: descriptor.entityId }),
        );
        nodes.set(descriptor.entityId, created);
        target.append(created);
        shape = created;
      }
      // A hit region over the art: invisible, but it takes the pointer wherever it is visible.
      shape.setAttribute("points", descriptor.points.map(({ x, y }) => `${x},${y}`).join(" "));
      shape.setAttribute("fill", "#000");
      shape.setAttribute("fill-opacity", "0");
      shape.setAttribute("stroke", "none");
      shape.setAttribute("pointer-events", "visible");
      shape.setAttribute("visibility", descriptor.visible ? "visible" : "hidden");
    },

    remove(entityId) {
      nodes.get(entityId)?.remove();
      nodes.delete(entityId);
    },

    sort(entityIds) {
      const target = requireHits();
      for (const entityId of entityIds) {
        const shape = nodes.get(entityId);
        if (shape) target.append(shape);
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
      for (const shape of nodes.values()) shape.remove();
      nodes.clear();
    },

    destroy() {
      svg?.remove();
      svg = undefined;
      layer = undefined;
      hits = undefined;
      nodes.clear();
    },
  };
}
