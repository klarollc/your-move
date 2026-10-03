import { FLOOR } from "./geometry.js";

/**
 * Phase 7 Task 5 (spec F-6; rulings W-1 to W-4). The room around the Phase 6 floor, in tiles.
 *
 * Two full-height back walls stand on the floor's back edges and the two front edges are cut down
 * to low stubs: one fixed cutaway rule, so architecture never covers a desk, a label or a target.
 * Thickness is taken inward, on the floor's edge strip, so the walls stay inside the bounds the
 * camera already frames (their tops reach exactly the object headroom).
 *
 * The windows are in the upper-right back wall (W-1): the approved renderer shades every
 * right-facing side lighter than every left-facing one, which is light from that side, so the
 * daylight agrees with every existing shadow. It is fixed and never depends on state (MDD §9).
 */
export const WALL = { height: 2, thickness: 0.2, stubHeight: 0.3 } as const;

export type WallBox = {
  id: string;
  kind: "back" | "front";
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
};

const T = WALL.thickness;

export const WALLS: WallBox[] = [
  { id: "wall_back_left", kind: "back", x: 0, y: 0, w: T, d: FLOOR.d, h: WALL.height },
  { id: "wall_back_right", kind: "back", x: T, y: 0, w: FLOOR.w - T, d: T, h: WALL.height },
  {
    id: "wall_front_right",
    kind: "front",
    x: FLOOR.w - T,
    y: T,
    w: T,
    d: FLOOR.d - T,
    h: WALL.stubHeight,
  },
  {
    id: "wall_front_left",
    kind: "front",
    x: T,
    y: FLOOR.d - T,
    w: FLOOR.w - 2 * T,
    d: T,
    h: WALL.stubHeight,
  },
];

/** The inner face of the window wall. */
export const WINDOW_WALL_Y = T;

export type WindowPane = { x0: number; x1: number; z0: number; z1: number };

/** Four bays, sill to head, spaced along the window wall. */
export const WINDOWS: WindowPane[] = [1.6, 5.6, 9.6, 13.6].map((x0) => ({
  x0,
  x1: x0 + 2.8,
  z0: 0.55,
  z1: 1.7,
}));

/** The fixed sun: per tile of window height, how far its light travels across the floor. */
export const SUN = { dx: -0.6, dy: 1.4 } as const;

export type FloorPoint = { x: number; y: number };

/** Each window's light on the floor: the pane carried down along the sun. */
export function daylightPatches(): FloorPoint[][] {
  const at = (x: number, z: number): FloorPoint => ({
    x: x + SUN.dx * z,
    y: WINDOW_WALL_Y + SUN.dy * z,
  });
  return WINDOWS.map((pane) => [
    at(pane.x0, pane.z0),
    at(pane.x1, pane.z0),
    at(pane.x1, pane.z1),
    at(pane.x0, pane.z1),
  ]);
}
