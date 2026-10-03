import { AGENTS, ZONES, depth, iso, type Point } from "./geometry.js";

/**
 * The office's selectable entities in Phase 6 world coordinates (Phase 7 Task 3b, ruling G-1):
 * one geometry for what is drawn, where the camera frames, where labels sit and what a click hits.
 */
export type SceneEntity = {
  entityId: string;
  entityType: "zone" | "agent";
  /** Projected outline at zoom 1, in order around the shape. */
  polygon: Point[];
  /** Where the entity's label and its published screen point attach. */
  anchor: Point;
  depth: number;
};

/** Phase 6 zone ids to the app's entity ids. */
export const SCENE_ZONE_ENTITY_IDS: Readonly<Record<string, string>> = Object.freeze({
  reception: "zone_reception",
  manager_desk: "zone_manager",
  project_library: "zone_library",
  team_area: "zone_team",
  collaboration_table: "zone_collaboration",
  delivery_area: "zone_delivery",
  review_station: "zone_review",
});

/** The desk's own box, as `deskPiece` draws it. */
export const DESK = { w: 2, d: 1.2, h: 0.42 } as const;

const boxCorners = (x: number, y: number, w: number, d: number, h: number): Point[] =>
  [0, h].flatMap((z) => [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]);

/** Convex hull, monotone chain; collinear points dropped. */
function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (input: Point[]): Point[] => {
    const out: Point[] = [];
    for (const point of input) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 1e-9)
        out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function sceneEntities(): SceneEntity[] {
  const zones: SceneEntity[] = ZONES.map((zone, index) => ({
    entityId: SCENE_ZONE_ENTITY_IDS[zone.id]!,
    entityType: "zone",
    polygon: [
      iso(zone.x, zone.y),
      iso(zone.x + zone.w, zone.y),
      iso(zone.x + zone.w, zone.y + zone.d),
      iso(zone.x, zone.y + zone.d),
    ],
    anchor: iso(zone.x, zone.y),
    // Zones lie flat on the floor, beneath everything standing on it.
    depth: index - ZONES.length,
  }));
  const people: SceneEntity[] = AGENTS.map((agent) => {
    const monitorX = agent.facing === "right" ? agent.x + 1.25 : agent.x + 0.05;
    return {
      entityId: agent.agentId,
      entityType: "agent",
      polygon: hull([
        ...boxCorners(agent.x, agent.y, DESK.w, DESK.d, DESK.h),
        ...boxCorners(monitorX, agent.y + 0.2, 0.7, 0.12, 0.95),
      ]),
      anchor: iso(agent.x + DESK.w / 2, agent.y + DESK.d / 2, DESK.h),
      depth: depth(agent.x, agent.y),
    };
  });
  return [...zones, ...people];
}
