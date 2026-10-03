import { describe, expect, it } from "vitest";

import { createOfficeLayout, officeLayoutPolicy } from "../office-layout.js";
import { resolveCutaways } from "../office-camera.js";
import {
  SUN,
  WALL,
  WALLS,
  WINDOWS,
  WINDOW_WALL_Y,
  daylightPatches,
  type WallBox,
} from "./architecture.js";
import { DESK, sceneEntities } from "./entities.js";
import { FLOOR, iso } from "./geometry.js";
import { renderComposition, renderSceneLayer } from "./render.js";
import { RECONCILIATION_B_CLARITY } from "./styles.js";

/**
 * Phase 7 Task 5 (spec F-6; rulings W-1 to W-4). The office reads as a room: two full-height back
 * walls, the window wall behind Reception and the Manager desk, baked daylight, and front walls cut
 * to low stubs by one fixed rule, so architecture never hides a desk, a label or a target.
 */
const style = RECONCILIATION_B_CLARITY;
const back = WALLS.filter(({ kind }) => kind === "back");
const front = WALLS.filter(({ kind }) => kind === "front");
const corners = (wall: WallBox) =>
  [0, wall.h].flatMap((z) => [
    iso(wall.x, wall.y, z),
    iso(wall.x + wall.w, wall.y, z),
    iso(wall.x + wall.w, wall.y + wall.d, z),
    iso(wall.x, wall.y + wall.d, z),
  ]);

describe("the walls", () => {
  it("stand on the floor's two back edges at full height, inside the floor (W-2)", () => {
    expect(back.map(({ id }) => id).sort()).toStrictEqual(["wall_back_left", "wall_back_right"]);
    for (const wall of back) expect(wall.h).toBe(WALL.height);
    const left = back.find(({ id }) => id === "wall_back_left")!;
    const right = back.find(({ id }) => id === "wall_back_right")!;
    expect([left.x, left.w, left.y, left.y + left.d]).toStrictEqual([
      0,
      WALL.thickness,
      0,
      FLOOR.d,
    ]);
    expect([right.y, right.d, right.x + right.w]).toStrictEqual([0, WALL.thickness, FLOOR.w]);
    for (const wall of WALLS) {
      expect(wall.x).toBeGreaterThanOrEqual(0);
      expect(wall.y).toBeGreaterThanOrEqual(0);
      expect(wall.x + wall.w).toBeLessThanOrEqual(FLOOR.w);
      expect(wall.y + wall.d).toBeLessThanOrEqual(FLOOR.d);
    }
  });

  it("cut the two front edges down to stubs lower than a desk top", () => {
    expect(front.map(({ id }) => id).sort()).toStrictEqual(["wall_front_left", "wall_front_right"]);
    for (const wall of front) {
      expect(wall.h).toBe(WALL.stubHeight);
      expect(wall.h).toBeLessThan(DESK.h);
    }
    const left = front.find(({ id }) => id === "wall_front_left")!;
    const right = front.find(({ id }) => id === "wall_front_right")!;
    expect(left.y + left.d).toBe(FLOOR.d);
    expect(right.x + right.w).toBe(FLOOR.w);
  });

  it("never needs the reveal rule: no wall in front of anything is tall enough to hide it", () => {
    const everyone = sceneEntities().map(({ entityId }) => entityId);
    const maxZoom = Math.max(...officeLayoutPolicy.zoomStops);
    const occluders = front.map((wall) => ({
      entityId: wall.id,
      height: wall.h * 34 * maxZoom,
      occludesEntityIds: everyone,
    }));
    expect(occluders.length).toBeGreaterThan(0);
    expect(resolveCutaways(occluders, everyone)).toStrictEqual([]);
  });

  it.each([
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ])("sit inside the office bounds the camera frames at $width×$height", (viewport) => {
    const layout = createOfficeLayout({ ...viewport, attentionOpen: false, inspectorOpen: false });
    const { zoom, translation } = layout.camera;
    const bounds = layout.projectedOfficeBounds;
    expect(WALLS).toHaveLength(4);
    for (const wall of WALLS) {
      for (const point of corners(wall)) {
        const x = point.x * zoom + translation.x;
        const y = point.y * zoom + translation.y;
        expect(x, wall.id).toBeGreaterThanOrEqual(bounds.x - 0.01);
        expect(y, wall.id).toBeGreaterThanOrEqual(bounds.y - 0.01);
        expect(x, wall.id).toBeLessThanOrEqual(bounds.x + bounds.width + 0.01);
        expect(y, wall.id).toBeLessThanOrEqual(bounds.y + bounds.height + 0.01);
      }
    }
  });
});

describe("the window wall and its daylight (W-1, F-6)", () => {
  it("puts the windows in the upper-right back wall, within its length and height", () => {
    const wall = back.find(({ id }) => id === "wall_back_right");
    expect(wall).toBeDefined();
    if (!wall) return;
    expect(WINDOW_WALL_Y).toBe(wall.y + wall.d);
    expect(WINDOWS.length).toBeGreaterThanOrEqual(3);
    for (const pane of WINDOWS) {
      expect(pane.x0).toBeGreaterThan(wall.x);
      expect(pane.x1).toBeLessThan(wall.x + wall.w);
      expect(pane.z0).toBeGreaterThan(0);
      expect(pane.z1).toBeLessThan(wall.h);
    }
  });

  it("lays one patch of light on the floor per window, where the fixed sun carries it", () => {
    const patches = daylightPatches();
    expect(patches).toHaveLength(WINDOWS.length);
    // The light travels into the room and toward the lit (right-facing) side of every object.
    expect(SUN.dy).toBeGreaterThan(0);
    expect(SUN.dx).toBeLessThan(0);
    for (const [index, pane] of WINDOWS.entries()) {
      const at = (x: number, z: number) => ({ x: x + SUN.dx * z, y: WINDOW_WALL_Y + SUN.dy * z });
      expect(patches[index]).toStrictEqual([
        at(pane.x0, pane.z0),
        at(pane.x1, pane.z0),
        at(pane.x1, pane.z1),
        at(pane.x0, pane.z1),
      ]);
      for (const point of patches[index]!) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(FLOOR.w);
        expect(point.y).toBeGreaterThan(WINDOW_WALL_Y);
        expect(point.y).toBeLessThanOrEqual(FLOOR.d);
      }
    }
  });
});

describe("the architecture layer", () => {
  const plain = renderSceneLayer(style, { labels: false, figures: false });
  const built = renderSceneLayer(style, { labels: false, figures: false, architecture: true });
  const groups = [...built.matchAll(/<g data-arch="(\w+)">[^]*?<\/g>/gu)];

  it("adds only its own groups: without them the layer is unchanged", () => {
    expect(groups.map((match) => match[1])).toStrictEqual(["back", "daylight", "front"]);
    let stripped = built;
    for (const [group] of groups)
      stripped = stripped.replace(`${group}\n    `, "").replace(`\n    ${group}`, "");
    expect(stripped).toBe(plain);
  });

  it("draws back walls and daylight beneath every object, and front stubs above them", () => {
    const floorEnd = plain.indexOf("\n    ");
    const objects = plain.slice(floorEnd + 5);
    const objectsAt = built.indexOf(objects);
    expect(objectsAt).toBeGreaterThan(0);
    const at = (name: string) => built.indexOf(`<g data-arch="${name}">`);
    expect(at("back")).toBeLessThan(at("daylight"));
    expect(at("daylight")).toBeLessThan(objectsAt);
    expect(at("front")).toBeGreaterThan(objectsAt + objects.length - 1);
  });

  it("carries no text, and leaves the frozen Phase 6 frame alone", () => {
    expect(built).toContain('<g data-arch="back">');
    expect(built).not.toContain("<text");
    expect(renderComposition(style, 1440, 900)).not.toContain("data-arch");
  });
});
