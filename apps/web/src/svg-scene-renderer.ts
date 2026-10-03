import type { SceneRendererPort } from "./office-scene-adapter.js";

export type SceneIntent = Readonly<{ type: "scene.entity.select"; entityId: string }>;

const SVG = "http://www.w3.org/2000/svg";

/**
 * Phase 7 Task 3a (spec F-1). The office scene drawn as SVG in the DOM, behind the same adapter the
 * Pixi renderer used, and at parity with it: one rectangle per descriptor, the same palette, depth
 * order, camera transform and pointer selection. There is no WebGL context to lose; a failure to
 * mount reaches the shell as `render-error` (plan Q-1). Task 3b adds the Active office as drawn art
 * and, for descriptors that carry points, invisible hit polygons over it from the same geometry.
 */
export type SvgSceneArt = Readonly<{ defs: string; layer: string }>;

export function createSvgSceneRenderer(
  onIntent: (intent: SceneIntent) => void,
  options?: Readonly<{ art?: SvgSceneArt }>,
): SceneRendererPort {
  let svg: SVGSVGElement | undefined;
  let layer: SVGGElement | undefined;
  let hits: SVGGElement | undefined;
  const nodes = new Map<string, SVGRectElement | SVGPolygonElement>();

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
      const tag = descriptor.points ? "polygon" : "rect";
      let shape = nodes.get(descriptor.entityId);
      if (shape && shape.tagName.toLowerCase() !== tag) {
        const replaced = shape;
        shape = undefined;
        nodes.delete(descriptor.entityId);
        replaced.remove();
      }
      if (!shape) {
        const created = document.createElementNS(SVG, tag);
        created.dataset.entityId = descriptor.entityId;
        created.addEventListener("click", () =>
          onIntent({ type: "scene.entity.select", entityId: descriptor.entityId }),
        );
        nodes.set(descriptor.entityId, created);
        target.append(created);
        shape = created;
      }
      shape.setAttribute("visibility", descriptor.visible ? "visible" : "hidden");
      if (descriptor.points) {
        // A hit region over the art: invisible, but it takes the pointer wherever it is visible.
        shape.setAttribute("points", descriptor.points.map(({ x, y }) => `${x},${y}`).join(" "));
        shape.setAttribute("fill", "#000");
        shape.setAttribute("fill-opacity", "0");
        shape.setAttribute("stroke", "none");
        shape.setAttribute("pointer-events", "visible");
        return;
      }
      const palette = descriptor.entityType === "zone" ? zonePalette : agentPalette;
      shape.setAttribute("x", String(descriptor.x));
      shape.setAttribute("y", String(descriptor.y));
      shape.setAttribute("width", String(descriptor.width));
      shape.setAttribute("height", String(descriptor.height));
      shape.setAttribute("fill", palette.fill);
      shape.setAttribute("fill-opacity", String(palette.alpha));
      shape.setAttribute("stroke", palette.stroke);
      shape.setAttribute("stroke-width", "2");
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

// The Pixi renderer's palette, unchanged (3a is parity).
const zonePalette = { fill: "#cfd2cf", stroke: "#676b68", alpha: 0.72 } as const;
const agentPalette = { fill: "#f2f1eb", stroke: "#292c2a", alpha: 1 } as const;
