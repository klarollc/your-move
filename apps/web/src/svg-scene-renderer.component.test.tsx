import { afterEach, describe, expect, it, vi } from "vitest";

import type { SceneDescriptor } from "./office-scene-adapter.js";
import { createSvgSceneRenderer } from "./svg-scene-renderer.js";

/**
 * Phase 7 Task 3a (spec F-1; plan Q-1). The SVG renderer behind the scene adapter, at parity with
 * the Pixi renderer it replaces: one rectangle per descriptor, the same palette, depth order,
 * camera transform, pointer selection and teardown.
 */
const zone: SceneDescriptor = {
  entityId: "zone_team",
  entityType: "zone",
  x: -150,
  y: -40,
  width: 650,
  height: 190,
  depth: 0,
  visible: true,
};
const desk: SceneDescriptor = {
  entityId: "agent_test_engineer",
  entityType: "agent",
  x: 175,
  y: 0,
  width: 80,
  height: 60,
  depth: 4,
  visible: true,
};

let host: HTMLElement;
const mounted = async (
  onIntent = vi.fn(),
  options?: Parameters<typeof createSvgSceneRenderer>[1],
) => {
  host = document.createElement("div");
  document.body.append(host);
  const renderer = createSvgSceneRenderer(onIntent, options);
  await renderer.mount(host);
  return { renderer, onIntent };
};
const svg = () => host.querySelector('svg[data-scene-renderer="svg"]');
const node = (id: string) => host.querySelector(`[data-entity-id="${id}"]`);
/** A lookup that fails as an assertion, never as a null dereference. */
const must = (element: Element | null): Element => {
  expect(element).not.toBeNull();
  return element as Element;
};

afterEach(() => host?.remove());

describe("the SVG scene renderer", () => {
  it("mounts one SVG element marked as the scene renderer", async () => {
    await mounted();
    expect(host.querySelectorAll('svg[data-scene-renderer="svg"]')).toHaveLength(1);
  });

  it("draws each descriptor as a rectangle at its place, in the Pixi palette", async () => {
    const { renderer } = await mounted();
    renderer.upsert(zone);
    renderer.upsert(desk);
    const rect = must(node("zone_team"));
    expect(rect.tagName.toLowerCase()).toBe("rect");
    expect(rect.getAttribute("x")).toBe("-150");
    expect(rect.getAttribute("y")).toBe("-40");
    expect(rect.getAttribute("width")).toBe("650");
    expect(rect.getAttribute("height")).toBe("190");
    expect(rect.getAttribute("fill")).toBe("#cfd2cf");
    expect(rect.getAttribute("fill-opacity")).toBe("0.72");
    expect(rect.getAttribute("stroke")).toBe("#676b68");
    expect(must(node("agent_test_engineer")).getAttribute("fill")).toBe("#f2f1eb");
    expect(must(node("agent_test_engineer")).getAttribute("stroke")).toBe("#292c2a");
  });

  it("updates in place, hides what is not visible, and removes what is gone", async () => {
    const { renderer } = await mounted();
    renderer.upsert(desk);
    renderer.upsert({ ...desk, x: 200, visible: false });
    expect(host.querySelectorAll('[data-entity-id="agent_test_engineer"]')).toHaveLength(1);
    expect(must(node("agent_test_engineer")).getAttribute("x")).toBe("200");
    expect(must(node("agent_test_engineer")).getAttribute("visibility")).toBe("hidden");
    renderer.remove("agent_test_engineer");
    expect(node("agent_test_engineer")).toBeNull();
  });

  it("orders nodes by the sort it is given", async () => {
    const { renderer } = await mounted();
    renderer.upsert(desk);
    renderer.upsert(zone);
    renderer.sort(["zone_team", "agent_test_engineer"]);
    const order = [...host.querySelectorAll("[data-entity-id]")].map((n) =>
      n.getAttribute("data-entity-id"),
    );
    expect(order).toEqual(["zone_team", "agent_test_engineer"]);
  });

  it("applies the camera transform and the host size", async () => {
    const { renderer } = await mounted();
    renderer.transform(1.5, { x: 40, y: -12 });
    renderer.resize(640, 360);
    expect(must(host.querySelector("[data-scene-layer]")).getAttribute("transform")).toBe(
      "translate(40 -12) scale(1.5)",
    );
    expect(must(svg()).getAttribute("width")).toBe("640");
    expect(must(svg()).getAttribute("height")).toBe("360");
  });

  it("selects the entity under the pointer", async () => {
    const { renderer, onIntent } = await mounted();
    renderer.upsert(desk);
    must(node("agent_test_engineer")).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onIntent).toHaveBeenCalledWith({
      type: "scene.entity.select",
      entityId: "agent_test_engineer",
    });
  });

  it("clears and tears down completely", async () => {
    const { renderer } = await mounted();
    renderer.upsert(desk);
    must(node("agent_test_engineer"));
    renderer.clear();
    expect(node("agent_test_engineer")).toBeNull();
    must(svg());
    renderer.destroy();
    expect(svg()).toBeNull();
  });

  // Phase 7 Task 3b (rulings G-1 to G-3): the Active office drawn once as art, with each entity's
  // hit region over it from the same geometry.
  const art = {
    defs: '<filter id="soft-test"><feGaussianBlur stdDeviation="2"/></filter>',
    layer: '<polygon data-art="floor" points="0,0 10,0 10,10" filter="url(#soft-test)"/>',
  };
  const outlined: SceneDescriptor = {
    ...desk,
    points: [
      { x: 0, y: 0 },
      { x: 10.5, y: 0 },
      { x: 10.5, y: 8 },
    ],
  };

  it("draws the art once, as SVG, inside the camera layer and beneath every hit region", async () => {
    const { renderer } = await mounted(vi.fn(), { art });
    renderer.upsert(outlined);
    renderer.sort(["agent_test_engineer"]);
    const filter = must(host.querySelector("svg > defs > filter#soft-test"));
    expect(filter.namespaceURI).toBe("http://www.w3.org/2000/svg");
    const floor = must(host.querySelector('[data-scene-layer] [data-art="floor"]'));
    expect(floor.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(host.querySelectorAll('[data-art="floor"]')).toHaveLength(1);
    const hit = must(node("agent_test_engineer"));
    expect(floor.compareDocumentPosition(hit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    renderer.clear();
    expect(host.querySelectorAll('[data-art="floor"]')).toHaveLength(1);
  });

  it("outlines a descriptor that carries points as an invisible hit polygon", async () => {
    const { renderer, onIntent } = await mounted(vi.fn(), { art });
    renderer.upsert(desk);
    renderer.upsert(outlined);
    expect(host.querySelectorAll('[data-entity-id="agent_test_engineer"]')).toHaveLength(1);
    const hit = must(node("agent_test_engineer"));
    expect(hit.tagName.toLowerCase()).toBe("polygon");
    expect(hit.getAttribute("points")).toBe("0,0 10.5,0 10.5,8");
    expect(hit.getAttribute("fill-opacity")).toBe("0");
    expect(hit.getAttribute("stroke")).toBe("none");
    expect(hit.getAttribute("pointer-events")).toBe("visible");
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onIntent).toHaveBeenCalledWith({
      type: "scene.entity.select",
      entityId: "agent_test_engineer",
    });
  });
});
