import { describe, expect, it } from "vitest";

import { createOfficeLayout, officeLayoutPolicy } from "./office-layout.js";
import {
  applyCameraCommand,
  compareSceneDepth,
  createOfficeCamera,
  hitTestScene,
  resolveCutaways,
  screenToWorld,
  serializeOfficeCamera,
  worldToScreen,
} from "./office-camera.js";

const layout = () =>
  createOfficeLayout({
    width: 1280,
    height: 800,
    attentionOpen: false,
    inspectorOpen: false,
  });

describe("office camera", () => {
  it("returns to the byte-exact canonical transform without losing selection", () => {
    const canonical = createOfficeCamera(layout(), "agent_a");
    const moved = applyCameraCommand(
      applyCameraCommand(canonical, { type: "camera.pan", deltaX: 300, deltaY: -240 }),
      { type: "camera.zoom", direction: "in" },
    );
    const reset = applyCameraCommand(moved, { type: "camera.reset" });

    expect(serializeOfficeCamera(reset)).toBe(serializeOfficeCamera(canonical));
    expect(reset.selectedEntityId).toBe("agent_a");
    expect(reset.rotation).toBe(0);
  });

  it("uses discrete zoom stops and clamps every pan to a recoverable office edge", () => {
    const canonical = createOfficeCamera(layout());
    const zoomed = applyCameraCommand(canonical, { type: "camera.zoom", direction: "in" });
    const panned = applyCameraCommand(zoomed, {
      type: "camera.pan",
      deltaX: 100_000,
      deltaY: -100_000,
    });

    const canonicalIndex = officeLayoutPolicy.zoomStops.indexOf(canonical.zoom);
    expect(zoomed.zoom).toBe(officeLayoutPolicy.zoomStops[canonicalIndex + 1]);
    expect(panned.translation).toEqual({
      x: panned.panClamp.maxX,
      y: panned.panClamp.minY,
    });
  });

  it("maps world and screen coordinates reversibly", () => {
    const camera = applyCameraCommand(createOfficeCamera(layout()), {
      type: "camera.zoom",
      direction: "in",
    });
    const world = { x: 117.25, y: 308.75 };

    expect(screenToWorld(worldToScreen(world, camera), camera)).toEqual(world);
  });

  it("sorts scene depth deterministically regardless of input order", () => {
    const nodes = [
      { entityId: "agent_z", gridX: 4, gridY: 3, elevation: 0 },
      { entityId: "agent_b", gridX: 2, gridY: 5, elevation: 0 },
      { entityId: "agent_a", gridX: 2, gridY: 5, elevation: 0 },
      { entityId: "artifact", gridX: 1, gridY: 2, elevation: 1 },
    ];

    expect([...nodes].sort(compareSceneDepth).map(({ entityId }) => entityId)).toEqual([
      "artifact",
      "agent_a",
      "agent_b",
      "agent_z",
    ]);
  });

  it("hit-tests the visible topmost entity with a stable tie-break", () => {
    const regions = [
      { entityId: "agent_b", x: 10, y: 10, width: 60, height: 60, depth: 2, visible: true },
      { entityId: "agent_a", x: 10, y: 10, width: 60, height: 60, depth: 2, visible: true },
      { entityId: "hidden", x: 10, y: 10, width: 60, height: 60, depth: 4, visible: false },
    ];

    expect(hitTestScene({ x: 30, y: 30 }, regions)).toBe("agent_a");
    expect(hitTestScene({ x: 90, y: 90 }, regions)).toBeUndefined();
  });

  it("cuts away only authored occluders hiding selected or attention-critical entities", () => {
    const occluders = [
      { entityId: "wall_b", height: 80, occludesEntityIds: ["agent_b"] },
      { entityId: "wall_a", height: 80, occludesEntityIds: ["agent_a"] },
      { entityId: "low_partition", height: 40, occludesEntityIds: ["agent_a"] },
    ];

    expect(resolveCutaways(occluders, ["agent_a"])).toEqual([
      { entityId: "wall_a", alpha: 0.16, interactive: false, reason: "selected-or-attention" },
    ]);
  });
});
