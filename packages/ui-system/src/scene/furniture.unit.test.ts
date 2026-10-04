import { describe, expect, it } from "vitest";

import { createOfficeLayout, officeLayoutPolicy } from "../office-layout.js";
import { DESK, sceneEntities } from "./entities.js";
import { AGENTS, FLOOR, PROPS, ZONES, iso, type Point } from "./geometry.js";
import { renderSceneLayer, type SceneState } from "./render.js";
import { RECONCILIATION_B_CLARITY } from "./styles.js";

const style = RECONCILIATION_B_CLARITY;
const app = renderSceneLayer(style, { labels: false, figures: false, furniture: true });
const legacy = renderSceneLayer(style, { labels: false, figures: false });

type FurnitureGroup = { name: string; zone: string; item: string; markup: string };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
type Rect = { left: number; right: number; top: number; bottom: number };

function groups(layer: string): FurnitureGroup[] {
  const result: FurnitureGroup[] = [];
  const openGroups = /<g\b[^>]*\bdata-furniture="([^"]+)"[^>]*>/gu;
  for (const match of layer.matchAll(openGroups)) {
    const opening = match[0];
    const start = match.index! + opening.length;
    const depth = { value: 1 };
    const groupTags = /<\/?g\b[^>]*>/gu;
    groupTags.lastIndex = start;
    let end = -1;
    for (const tag of layer.matchAll(groupTags)) {
      if (tag[0].startsWith("</g")) depth.value -= 1;
      else depth.value += 1;
      if (depth.value === 0) {
        end = tag.index!;
        break;
      }
    }
    if (end < 0) throw new Error(`FURNITURE_GROUP_UNCLOSED:${match[1]}`);
    const attribute = (name: string): string =>
      opening.match(new RegExp(`\\b${name}="([^"]+)"`, "u"))?.[1] ?? "";
    result.push({
      name: attribute("data-furniture"),
      zone: attribute("data-zone"),
      item: attribute("data-item"),
      markup: layer.slice(start, end),
    });
  }
  return result;
}

function partGroups(markup: string, part: string): string[] {
  const result: string[] = [];
  const openGroups = new RegExp(`<g\\b[^>]*\\bdata-furniture-part="${part}"[^>]*>`, "gu");
  for (const match of markup.matchAll(openGroups)) {
    const start = match.index! + match[0].length;
    let depth = 1;
    const groupTags = /<\/?g\b[^>]*>/gu;
    groupTags.lastIndex = start;
    let end = -1;
    for (const tag of markup.matchAll(groupTags)) {
      depth += tag[0].startsWith("</g") ? -1 : 1;
      if (depth === 0) {
        end = tag.index!;
        break;
      }
    }
    if (end < 0) throw new Error(`FURNITURE_PART_UNCLOSED:${part}`);
    result.push(markup.slice(start, end));
  }
  return result;
}

function numbers(value: string): number[] {
  return [...value.matchAll(/-?\d+(?:\.\d+)?/gu)].map(([match]) => Number(match));
}

/** Reads the actual projected SVG primitives, not a separately maintained footprint registry. */
function projectedPoints(markup: string): Point[] {
  const result: Point[] = [];
  for (const match of markup.matchAll(/<polygon\b[^>]*\bpoints="([^"]+)"/gu)) {
    const values = numbers(match[1]!);
    for (let i = 0; i + 1 < values.length; i += 2)
      result.push({ x: values[i]!, y: values[i + 1]! });
  }
  for (const match of markup.matchAll(/<path\b[^>]*\bd="([^"]+)"/gu)) {
    const values = numbers(match[1]!);
    for (let i = 0; i + 1 < values.length; i += 2)
      result.push({ x: values[i]!, y: values[i + 1]! });
  }
  for (const match of markup.matchAll(/<ellipse\b([^>]*)>/gu)) {
    const attributes = match[1]!;
    const value = (name: string): number => {
      const found = attributes.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`, "u"));
      return found ? Number(found[1]) : 0;
    };
    const cx = value("cx");
    const cy = value("cy");
    const rx = value("rx");
    const ry = value("ry");
    const angle =
      (Number(attributes.match(/\btransform="rotate\(\s*(-?\d+(?:\.\d+)?)/u)?.[1] ?? 0) * Math.PI) /
      180;
    const extentX = Math.hypot(rx * Math.cos(angle), ry * Math.sin(angle));
    const extentY = Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle));
    result.push({ x: cx - extentX, y: cy - extentY }, { x: cx + extentX, y: cy + extentY });
  }
  for (const match of markup.matchAll(/<rect\b([^>]*)>/gu)) {
    const attributes = match[1]!;
    const value = (name: string): number => {
      const found = attributes.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`, "u"));
      return found ? Number(found[1]) : 0;
    };
    const x = value("x");
    const y = value("y");
    result.push({ x, y }, { x: x + value("width"), y: y + value("height") });
  }
  for (const match of markup.matchAll(/<line\b([^>]*)>/gu)) {
    const attributes = match[1]!;
    const value = (name: string): number => {
      const found = attributes.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`, "u"));
      return found ? Number(found[1]) : 0;
    };
    result.push({ x: value("x1"), y: value("y1") }, { x: value("x2"), y: value("y2") });
  }
  return result;
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (values: Point[]) => {
    const out: Point[] = [];
    for (const point of values) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 1e-9)
        out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function insideConvex(polygon: Point[], point: Point, tolerance = 0.05): boolean {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]!;
    const b = polygon[(index + 1) % polygon.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) <= tolerance) continue;
    const next = Math.sign(cross);
    if (sign !== 0 && next !== sign) return false;
    sign = next;
  }
  return true;
}

/**
 * A zone's safe interior is a 0.12-tile inset extruded through the furniture's allowed height.
 * Projecting that whole 3D prism avoids treating tabletops, books or leaves as if they sat at z=0.
 */
function zonePrism(zoneId: string, inset: number): Point[] {
  const zone = ZONES.find(({ id }) => id === zoneId);
  if (!zone) return [];
  const x0 = zone.x + inset;
  const x1 = zone.x + zone.w - inset;
  const y0 = zone.y + inset;
  const y1 = zone.y + zone.d - inset;
  return convexHull(
    [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [0, 1.5].map((z) => iso(x, y, z)))),
  );
}

function floorPolygon(): Point[] {
  return convexHull(
    [FLOOR.x, FLOOR.x + FLOOR.w].flatMap((x) => [FLOOR.y, FLOOR.y + FLOOR.d].map((y) => iso(x, y))),
  );
}

function boxCorners(x: number, y: number, width: number, depth: number, height: number): Point[] {
  return [0, height].flatMap((z) => [
    iso(x, y, z),
    iso(x + width, y, z),
    iso(x + width, y + depth, z),
    iso(x, y + depth, z),
  ]);
}

function pointsWithin(points: Point[], polygon: Point[]): boolean {
  return points.length > 0 && points.every((point) => insideConvex(polygon, point));
}

function screenBounds(points: Point[], viewport: Parameters<typeof createOfficeLayout>[0]): Bounds {
  const { camera } = createOfficeLayout(viewport);
  const transformed = points.map(({ x, y }) => ({
    x: x * camera.zoom + camera.translation.x,
    y: y * camera.zoom + camera.translation.y,
  }));
  return {
    minX: Math.min(...transformed.map(({ x }) => x)),
    maxX: Math.max(...transformed.map(({ x }) => x)),
    minY: Math.min(...transformed.map(({ y }) => y)),
    maxY: Math.max(...transformed.map(({ y }) => y)),
  };
}

function overlaps(a: Bounds, b: Rect): boolean {
  return a.minX < b.right && b.left < a.maxX && a.minY < b.bottom && b.top < a.maxY;
}

function expectedZone(group: FurnitureGroup): string | undefined {
  if (group.name === "floor-seam") return "floor";
  if (["work-surface", "team-chair", "review-papers"].includes(group.name)) {
    return AGENTS.find(({ agentId }) => agentId === group.item)?.workArea;
  }
  if (group.name === "rug-surface") return "team_area";
  if (["collab-chair", "collab-table-edge"].includes(group.name)) return "collaboration_table";
  if (["shelf-books", "shelf-compartment"].includes(group.name)) return "project_library";
  if (group.name === "reception-edge") return "reception";
  if (group.name === "manager-edge") return "manager_desk";
  if (group.name === "delivery-tray") return "delivery_area";
  if (group.name === "rug-detail") return "team_area";
  if (group.name === "plant-leaves") {
    return PROPS.find(({ kind, x, y }) => kind === "plant" && group.item === `plant-${x}-${y}`)
      ?.zone;
  }
  return undefined;
}

function mutateFirstPolygonPoint(markup: string, point: Point): string {
  return markup.replace(
    /(<polygon\b[^>]*\bpoints=")(\s*-?\d+(?:\.\d+)?),\s*-?\d+(?:\.\d+)?/u,
    `$1${point.x},${point.y}`,
  );
}

const projectedPointsAttribute = (points: Point[]): string =>
  points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

function originalBoxTop(
  prop: (typeof PROPS)[number],
  width: number,
  depth: number,
  height: number,
): string {
  const points = [
    iso(prop.x, prop.y, height),
    iso(prop.x + width, prop.y, height),
    iso(prop.x + width, prop.y + depth, height),
    iso(prop.x, prop.y + depth, height),
  ];
  return `<polygon points="${projectedPointsAttribute(points)}"`;
}

function stateFurniture(state: SceneState): string[] {
  return groups(
    renderSceneLayer(style, { labels: false, figures: false, furniture: true, scene: state }),
  ).map(({ markup, name, zone, item }) => `${name}|${zone}|${item}|${markup}`);
}

describe("Phase 7 static furniture", () => {
  it("keeps every frozen Phase 6 renderer path unchanged unless furniture is explicitly enabled", () => {
    expect(legacy).not.toContain("data-furniture=");
    expect(renderSceneLayer(style, { labels: true, figures: true })).not.toContain(
      "data-furniture=",
    );
    expect(
      renderSceneLayer(style, { labels: false, figures: false, architecture: true }),
    ).not.toContain("data-furniture=");
    expect(app).toContain('data-furniture="team-chair"');
  });

  it("renders a supported desktop and at least one real surface cue for all six stations", () => {
    const surfaces = groups(app).filter(({ name }) => name === "work-surface");
    expect(surfaces).toHaveLength(AGENTS.length);
    for (const agent of AGENTS) {
      const surface = surfaces.find(({ item }) => item === agent.agentId);
      expect(surface, agent.agentId).toBeDefined();
      const keyboard = surface!.markup.match(
        /<polygon\b[^>]*data-furniture-part="keyboard"[^>]*points="([^"]+)"/u,
      )?.[1];
      const keyboardPoints = keyboard ? numbers(keyboard) : [];
      if (keyboard) {
        expect(keyboardPoints, `${agent.agentId} keyboard has four projected corners`).toHaveLength(
          8,
        );
      }
      const deskSurface = surface!.markup.match(
        /<g\b[^>]*data-furniture-part="desk-surface"[^>]*>(.*?)<\/g>/su,
      )?.[1];
      expect(deskSurface, `${agent.agentId} has an explicit desk surface`).toBeDefined();
      const tableFootprint = convexHull(projectedPoints(deskSurface!));
      const keyboardCorners = Array.from({ length: keyboardPoints.length / 2 }, (_, index) => ({
        x: keyboardPoints[index * 2]!,
        y: keyboardPoints[index * 2 + 1]!,
      }));
      if (keyboardCorners.length > 0) {
        expect(
          pointsWithin(keyboardCorners, tableFootprint),
          `${agent.agentId} keyboard sits on its desk`,
        ).toBe(true);
      }
      const supports = partGroups(surface!.markup, "support");
      expect(supports.length, `${agent.agentId} has visible support geometry`).toBeGreaterThan(0);
      for (const support of supports) {
        const supportPoints = projectedPoints(support);
        expect(
          supportPoints,
          `${agent.agentId} support has actual projected geometry`,
        ).not.toHaveLength(0);
        expect(
          supportPoints.some((point) => insideConvex(tableFootprint, point)),
          `${agent.agentId} support reaches the projected tabletop hull`,
        ).toBe(true);
      }
      const monitor = partGroups(surface!.markup, "monitor");
      const stand = partGroups(surface!.markup, "monitor-stand");
      expect(monitor.length, `${agent.agentId} monitor has its stand`).toBe(stand.length);
      for (const standMarkup of stand) {
        const standPoints = projectedPoints(standMarkup);
        expect(standPoints, `${agent.agentId} stand is rendered`).not.toHaveLength(0);
        expect(
          standPoints.filter((point) => insideConvex(tableFootprint, point)).length,
          `${agent.agentId} stand reaches the projected tabletop`,
        ).toBeGreaterThanOrEqual(4);
      }
      const papers = groups(app).filter(
        ({ name, item }) => name === "review-papers" && item === agent.agentId,
      );
      const hasCue = keyboardCorners.length > 0 || monitor.length > 0 || papers.length > 0;
      expect(hasCue, `${agent.agentId} has a real surface cue`).toBe(true);
      expect(surface!.markup).toContain('data-furniture-part="desk-surface"');
      expect(surface!.zone).toBe(agent.workArea);
    }
  });

  it("adds one empty chair per team desk and replaces the two old collaboration blocks", () => {
    const chairs = groups(app).filter(({ name }) => name === "team-chair");
    expect(chairs).toHaveLength(4);
    expect(groups(app).filter(({ name }) => name === "collab-chair")).toHaveLength(4);
    for (const stool of PROPS.filter(({ kind }) => kind === "stool")) {
      expect(app).not.toContain(
        originalBoxTop({ ...stool, x: stool.x - 0.25, y: stool.y - 0.25 }, 0.5, 0.5, 0.46),
      );
    }
    for (const chair of chairs) {
      expect(chair.markup).toContain("<polygon");
      expect(chair.markup).toContain("<path");
      expect(chair.markup).not.toContain("<text");
    }
  });

  it("gives library storage two compartments and books, and review stations blank papers", () => {
    expect(groups(app).filter(({ name }) => name === "shelf-books")).toHaveLength(1);
    const compartments = groups(app).filter(({ name }) => name === "shelf-compartment");
    expect(compartments).toHaveLength(1);
    expect([...compartments[0]!.markup.matchAll(/<polygon\b/gu)]).toHaveLength(2);
    expect(groups(app).filter(({ name }) => name === "review-papers")).toHaveLength(2);
    for (const paper of groups(app).filter(({ name }) => name === "review-papers")) {
      expect(paper.markup).toContain("<polygon");
      expect(paper.markup).not.toMatch(/<text|<path[^>]*stroke=.*(?:attention|green)/u);
    }
  });

  it("keeps each review paper's projected polygon on its own raised desktop", () => {
    const all = groups(app);
    const papers = all.filter(({ name }) => name === "review-papers");
    const desks = all.filter(({ name }) => name === "work-surface");
    expect(papers).toHaveLength(2);
    for (const paper of papers) {
      const desk = desks.find(({ item }) => item === paper.item);
      expect(desk, `${paper.item} has a matching desktop`).toBeDefined();
      const tabletop = desk!.markup.match(
        /<g\b[^>]*data-furniture-part="desk-surface"[^>]*>(.*?)<\/g>/su,
      )?.[1];
      expect(tabletop, `${paper.item} desktop has projected geometry`).toBeDefined();
      const paperPoints = projectedPoints(paper.markup);
      expect(paperPoints, `${paper.item} paper polygon has projected corners`).toHaveLength(4);
      expect(
        pointsWithin(paperPoints, convexHull(projectedPoints(tabletop!))),
        `${paper.item} paper is supported by its actual rendered tabletop`,
      ).toBe(true);
    }
  });

  it("replaces delivery cubes with shallow trays and grounds existing material details", () => {
    const trays = groups(app).filter(({ name }) => name === "delivery-tray");
    expect(trays).toHaveLength(2);
    for (const crate of PROPS.filter(({ kind }) => kind === "crate")) {
      expect(app).not.toContain(originalBoxTop(crate, 0.85, 0.85, 0.6));
    }
    expect(groups(app).filter(({ name }) => name === "reception-edge")).toHaveLength(1);
    expect(groups(app).filter(({ name }) => name === "manager-edge")).toHaveLength(1);
    expect(groups(app).filter(({ name }) => name === "rug-detail")).toHaveLength(1);
    expect(groups(app).filter(({ name }) => name === "rug-surface")).toHaveLength(1);
    expect(groups(app).filter(({ name }) => name === "plant-leaves")).toHaveLength(4);
  });

  it("keeps the original rug fill byte-identical and below every placed furniture group", () => {
    const rug = PROPS.find(({ kind }) => kind === "rug")!;
    const originalPoints = projectedPointsAttribute([
      iso(rug.x - 1.6, rug.y - 1.2),
      iso(rug.x + 1.6, rug.y - 1.2),
      iso(rug.x + 1.6, rug.y + 1.2),
      iso(rug.x - 1.6, rug.y + 1.2),
    ]);
    const fill = `<polygon points="${originalPoints}" fill="${style.palette.textile}" opacity="0.6"/>`;
    const surface = groups(app).find(({ name }) => name === "rug-surface")!;
    expect(surface.markup).toContain(fill);
    expect(legacy).toContain(fill);

    const all = groups(app);
    const surfaceIndex = all.findIndex(({ name }) => name === "rug-surface");
    expect(surfaceIndex).toBeGreaterThanOrEqual(0);
    expect(all.findIndex(({ name }) => name === "floor-seam")).toBeLessThan(surfaceIndex);
    for (const [index, group] of all.entries()) {
      if (group.name === "floor-seam" || group.name === "rug-surface") continue;
      expect(surfaceIndex, `${group.name}/${group.item} paints above the textile`).toBeLessThan(
        index,
      );
    }

    const rugFootprint = convexHull([
      iso(rug.x - 1.6, rug.y - 1.2),
      iso(rug.x + 1.6, rug.y - 1.2),
      iso(rug.x + 1.6, rug.y + 1.2),
      iso(rug.x - 1.6, rug.y + 1.2),
    ]);
    const stitch = all.find(({ name }) => name === "rug-detail")!;
    expect(pointsWithin(projectedPoints(stitch.markup), rugFootprint)).toBe(true);
  });

  it("keeps projected furnishings inside their tagged zone's safe 3D interior and the framed office", () => {
    const all = groups(app);
    expect(all.length).toBeGreaterThan(0);
    for (const group of all) {
      expect(group.zone, `${group.name}/${group.item} is assigned to its canonical zone`).toBe(
        expectedZone(group),
      );
    }
    const zoneGroups = all.filter(({ zone }) => zone !== "floor");
    expect(zoneGroups.every(({ zone }) => ZONES.some((candidate) => candidate.id === zone))).toBe(
      true,
    );
    for (const group of zoneGroups) {
      const points = projectedPoints(group.markup);
      expect(
        points.length,
        `${group.name}/${group.item} exposes projected geometry`,
      ).toBeGreaterThan(0);
      expect(
        pointsWithin(points, zonePrism(group.zone, 0.12)),
        `${group.name}/${group.item} is inside ${group.zone}'s inset 3D prism`,
      ).toBe(true);
    }

    const seams = all.filter(({ name }) => name === "floor-seam");
    expect(seams.length).toBeGreaterThan(0);
    expect(seams.length).toBeLessThanOrEqual(12);
    expect(app).toContain(
      `<clipPath id="furniture-floor-clip"><polygon points="${[
        iso(FLOOR.x, FLOOR.y),
        iso(FLOOR.x + FLOOR.w, FLOOR.y),
        iso(FLOOR.x + FLOOR.w, FLOOR.y + FLOOR.d),
        iso(FLOOR.x, FLOOR.y + FLOOR.d),
      ]
        .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ")}"/></clipPath>`,
    );
    for (const seam of seams) {
      expect(seam.markup).toContain("data-floor-seam=");
      expect(pointsWithin(projectedPoints(seam.markup), floorPolygon())).toBe(true);
    }

    const order = all.map(({ name, item }) => `${name}|${item}`);
    const rugIndex = order.findIndex((entry) => entry.startsWith("rug-detail|"));
    expect(rugIndex).toBeGreaterThanOrEqual(0);
    for (const foreground of [
      "work-surface",
      "team-chair",
      "review-papers",
      "collab-chair",
      "collab-table-edge",
      "shelf-books",
      "shelf-compartment",
      "delivery-tray",
      "reception-edge",
      "manager-edge",
      "plant-leaves",
    ]) {
      const firstForeground = order.findIndex((entry) => entry.startsWith(`${foreground}|`));
      expect(firstForeground, `${foreground} is present`).toBeGreaterThanOrEqual(0);
      expect(rugIndex, "the textile lies below placed furniture").toBeLessThan(firstForeground);
    }

    for (const viewport of [
      { width: 1440, height: 900, attentionOpen: false, inspectorOpen: false },
      { width: 1280, height: 800, attentionOpen: false, inspectorOpen: false },
      { width: 1440, height: 900, attentionOpen: false, inspectorOpen: true },
      { width: 1280, height: 800, attentionOpen: false, inspectorOpen: true },
    ]) {
      const layout = createOfficeLayout(viewport);
      const { zoom, translation } = layout.camera;
      const bounds = layout.projectedOfficeBounds;
      for (const group of all) {
        for (const point of projectedPoints(group.markup)) {
          const x = point.x * zoom + translation.x;
          const y = point.y * zoom + translation.y;
          expect(x, `${group.name}/${group.item} outside camera x`).toBeGreaterThanOrEqual(
            bounds.x - 1,
          );
          expect(y, `${group.name}/${group.item} outside camera y`).toBeGreaterThanOrEqual(
            bounds.y - 1,
          );
          expect(x, `${group.name}/${group.item} outside camera right`).toBeLessThanOrEqual(
            bounds.x + bounds.width + 1,
          );
          expect(y, `${group.name}/${group.item} outside camera bottom`).toBeLessThanOrEqual(
            bounds.y + bounds.height + 1,
          );
        }
      }
    }
  });

  it("rejects chair and tray mutations outside their canonical zone safe insets", () => {
    const current = groups(app);
    const chair = current.find(({ name }) => name === "team-chair")!;
    const team = ZONES.find(({ id }) => id === "team_area")!;
    const chairMutation = mutateFirstPolygonPoint(chair.markup, iso(team.x - 2, team.y + 1, 0.24));
    expect(pointsWithin(projectedPoints(chairMutation), zonePrism(chair.zone, 0.12))).toBe(false);

    const tray = current.find(({ name }) => name === "delivery-tray")!;
    const delivery = ZONES.find(({ id }) => id === "delivery_area")!;
    const trayMutation = mutateFirstPolygonPoint(
      tray.markup,
      iso(delivery.x + delivery.w + 2, delivery.y + 0.5, 0.12),
    );
    expect(pointsWithin(projectedPoints(trayMutation), zonePrism(tray.zone, 0.12))).toBe(false);
  });

  it("rejects a chair mutation that enters a visible person label plate", () => {
    const chair = groups(app).find(({ name }) => name === "team-chair")!;
    const person = sceneEntities().find(({ entityId }) => entityId === "agent_test_engineer")!;
    const viewport = { width: 1440, height: 900, attentionOpen: false, inspectorOpen: false };
    const { camera } = createOfficeLayout(viewport);
    const labelCenter = {
      x: person.anchor.x * camera.zoom + camera.translation.x,
      y: person.anchor.y * camera.zoom + camera.translation.y,
    };
    const visibleLabel: Rect = {
      left: labelCenter.x - 90,
      right: labelCenter.x + 90,
      top: labelCenter.y - 14,
      bottom: labelCenter.y + 14,
    };
    const mutated = mutateFirstPolygonPoint(chair.markup, person.anchor);
    expect(overlaps(screenBounds(projectedPoints(mutated), viewport), visibleLabel)).toBe(true);
  });

  it("rejects a floor seam that escapes the canonical floor mask", () => {
    const seam = groups(app).find(({ name }) => name === "floor-seam")!;
    const escaped = seam.markup.replace(
      /(L\s*)-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/u,
      `$1${iso(FLOOR.x - 1, FLOOR.y, 0).x},${iso(FLOOR.x - 1, FLOOR.y, 0).y}`,
    );
    expect(pointsWithin(projectedPoints(escaped), floorPolygon())).toBe(false);
  });

  it("keeps furniture markup byte-identical while canonical work and collaboration states change", () => {
    const cases: SceneState[] = [
      { agentStates: { agent_delivery_lead: "offline" } },
      { agentStates: { agent_test_engineer: "conflict" }, work: { state: "blocked" } },
      {
        agentStates: { agent_product_designer: "waiting_input" },
        work: { state: "waiting_input" },
      },
      {
        agentStates: { agent_release_reviewer: "unknown" },
        collaborationParticipants: ["agent_delivery_lead"],
      },
    ];
    const baseline = stateFurniture({ agentStates: {} });
    for (const state of cases) expect(stateFurniture(state)).toStrictEqual(baseline);
  });

  it("preserves the canonical floor, seven zone polygons, and all thirteen entity targets", () => {
    expect(FLOOR).toStrictEqual({ x: 0, y: 0, w: 18, d: 14 });
    expect(ZONES.map(({ id, x, y, w, d }) => [id, x, y, w, d])).toStrictEqual([
      ["reception", 0, 0, 4, 4],
      ["manager_desk", 13, 0, 5, 4],
      ["project_library", 0, 5, 4, 5],
      ["team_area", 5, 4, 7, 6],
      ["collaboration_table", 13, 5, 5, 4],
      ["delivery_area", 4, 11, 5, 3],
      ["review_station", 12, 10, 6, 4],
    ]);
    const entities = sceneEntities();
    expect(entities).toHaveLength(13);
    const byId = new Map(entities.map((entity) => [entity.entityId, entity]));
    const zoneIds: Record<string, string> = {
      reception: "zone_reception",
      manager_desk: "zone_manager",
      project_library: "zone_library",
      team_area: "zone_team",
      collaboration_table: "zone_collaboration",
      delivery_area: "zone_delivery",
      review_station: "zone_review",
    };
    for (const zone of ZONES) {
      const entity = byId.get(zoneIds[zone.id]!);
      expect(entity?.polygon).toStrictEqual([
        iso(zone.x, zone.y),
        iso(zone.x + zone.w, zone.y),
        iso(zone.x + zone.w, zone.y + zone.d),
        iso(zone.x, zone.y + zone.d),
      ]);
      expect(entity?.anchor).toStrictEqual(iso(zone.x, zone.y));
    }
    for (const agent of AGENTS) {
      const monitorX = agent.facing === "right" ? agent.x + 1.25 : agent.x + 0.05;
      const corners = [
        ...boxCorners(agent.x, agent.y, DESK.w, DESK.d, DESK.h),
        ...boxCorners(monitorX, agent.y + 0.2, 0.7, 0.12, 0.95),
      ];
      const entity = byId.get(agent.agentId);
      expect(entity?.polygon).toStrictEqual(convexHull(corners));
      expect(entity?.anchor).toStrictEqual(iso(agent.x + 1, agent.y + 0.6, DESK.h));
    }
    expect(PROPS.map(({ zone }) => zone)).toHaveLength(16);
    expect(officeLayoutPolicy.zoomStops).toStrictEqual([0.625, 0.75, 0.875, 1, 1.125, 1.25]);
  });
});
