import { describe, expect, it } from "vitest";

import { sceneEntities } from "./entities.js";
import { AGENTS, ZONES, iso, type Point } from "./geometry.js";
import { renderComposition, renderSceneDefs, renderSceneLayer } from "./render.js";
import { RECONCILIATION_B_CLARITY } from "./styles.js";

/**
 * Phase 7 Task 3b (rulings G-1 to G-3): the app draws the Active visual system's own scene, from
 * the same geometry its camera, labels and hit regions use.
 */
const style = RECONCILIATION_B_CLARITY;
const count = (svg: string, tag: string): number => svg.split(`<${tag} `).length - 1;

describe("the scene layer", () => {
  it("is, with labels and figures, exactly what the frozen composition draws", () => {
    const frame = renderComposition(style, 1440, 900);
    const layer = renderSceneLayer(style, { labels: true, figures: true });
    expect(layer.length).toBeGreaterThan(0);
    expect(frame).toContain(layer);
    expect(renderSceneDefs(style).length).toBeGreaterThan(0);
    expect(frame).toContain(renderSceneDefs(style));
  });

  it("drops only the baked labels and the fixed figures for the app", () => {
    const full = renderSceneLayer(style, { labels: true, figures: true });
    const app = renderSceneLayer(style, { labels: false, figures: false });
    expect(count(full, "text")).toBeGreaterThan(0);
    expect(count(app, "text")).toBe(0);
    expect(full).toContain(`fill="${style.palette.figure}"`);
    expect(app).not.toContain(`fill="${style.palette.figure}"`);
    expect(app).not.toContain(`fill="${style.palette.figureShade}"`);
    // Floor, zones, desks and props are all polygons; figures and labels never are.
    expect(count(app, "polygon")).toBeGreaterThan(0);
    expect(count(app, "polygon")).toBe(count(full, "polygon"));
  });

  it("references only filters its defs declare", () => {
    const app = renderSceneLayer(style, { labels: false, figures: false });
    const defs = renderSceneDefs(style);
    const used = new Set([...app.matchAll(/url\(#([^)]+)\)/gu)].map((match) => match[1]));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(defs).toContain(`id="${id}"`);
  });
});

const zoneIds: Record<string, string> = {
  reception: "zone_reception",
  manager_desk: "zone_manager",
  project_library: "zone_library",
  team_area: "zone_team",
  collaboration_table: "zone_collaboration",
  delivery_area: "zone_delivery",
  review_station: "zone_review",
};

/** Inside or on the boundary of a convex polygon, either winding. */
function inside(polygon: Point[], point: Point): boolean {
  let sign = 0;
  for (const [index, a] of polygon.entries()) {
    const b = polygon[(index + 1) % polygon.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-6) continue;
    const next = Math.sign(cross);
    if (sign !== 0 && next !== sign) return false;
    sign = next;
  }
  return true;
}

const boxCorners = (x: number, y: number, w: number, d: number, h: number): Point[] =>
  [0, h].flatMap((z) => [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]);

describe("scene entities", () => {
  const entities = sceneEntities();
  const byId = new Map(entities.map((entity) => [entity.entityId, entity]));

  it("names the office's seven zones and six people, once each", () => {
    expect(entities.map(({ entityId }) => entityId).sort()).toStrictEqual(
      [...Object.values(zoneIds), ...AGENTS.map(({ agentId }) => agentId)].sort(),
    );
  });

  it("outlines each zone as its Phase 6 floor plate", () => {
    for (const zone of ZONES) {
      const entity = byId.get(zoneIds[zone.id]!);
      expect(entity?.entityType).toBe("zone");
      expect(entity?.polygon).toStrictEqual([
        iso(zone.x, zone.y),
        iso(zone.x + zone.w, zone.y),
        iso(zone.x + zone.w, zone.y + zone.d),
        iso(zone.x, zone.y + zone.d),
      ]);
      // Phase 6 named a zone at its back corner (`zoneLabels`); the app label keeps that place.
      expect(entity?.anchor).toStrictEqual(iso(zone.x, zone.y));
    }
  });

  it("outlines each person by their whole desk, monitor included, anchored on the desk top", () => {
    for (const agent of AGENTS) {
      const entity = byId.get(agent.agentId);
      expect(entity?.entityType).toBe("agent");
      const monitorX = agent.facing === "right" ? agent.x + 1.25 : agent.x + 0.05;
      const corners = [
        ...boxCorners(agent.x, agent.y, 2, 1.2, 0.42),
        ...boxCorners(monitorX, agent.y + 0.2, 0.7, 0.12, 0.95),
      ];
      for (const corner of corners) {
        expect(inside(entity!.polygon, corner), `${agent.agentId} misses a corner`).toBe(true);
      }
      expect(entity?.anchor).toStrictEqual(iso(agent.x + 1, agent.y + 0.6, 0.42));
      expect(inside(entity!.polygon, entity!.anchor)).toBe(true);
    }
  });

  it("puts every zone beneath every person, and people in the scene's own depth order", () => {
    const zones = entities.filter(({ entityType }) => entityType === "zone");
    const people = entities.filter(({ entityType }) => entityType === "agent");
    expect(Math.max(...zones.map(({ depth }) => depth))).toBeLessThan(
      Math.min(...people.map(({ depth }) => depth)),
    );
    const expected = [...AGENTS]
      .sort((a, b) => a.x + a.y - (b.x + b.y) || a.agentId.localeCompare(b.agentId))
      .map(({ agentId }) => agentId);
    const actual = [...people]
      .sort((a, b) => a.depth - b.depth || a.entityId.localeCompare(b.entityId))
      .map(({ entityId }) => entityId);
    expect(actual).toStrictEqual(expected);
  });
});
