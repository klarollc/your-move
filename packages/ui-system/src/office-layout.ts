import { sceneEntities, type SceneEntity } from "./scene/entities.js";
import { FLOOR, TILE, floorExtent } from "./scene/geometry.js";

export type OfficeViewport = {
  width: number;
  height: number;
  attentionOpen: boolean;
  inspectorOpen: boolean;
};

type Point = { x: number; y: number };
type Rectangle = Point & { width: number; height: number };
type ZoneId =
  "reception" | "team" | "library" | "collaboration" | "review" | "manager" | "delivery";

export const officeLayoutPolicy = {
  status: "graybox-candidate",
  // Phase 7 Task 3b, ruling G-1: the camera frames the Phase 6 scene's own geometry, so what is
  // drawn, where labels sit and what a click hits share one projection.
  projection: { source: "phase-6-scene", tile: TILE },
  officeGrid: { width: FLOOR.w, height: FLOOR.d, objectHeadroom: 2 * TILE },
  projectBarHeight: 56,
  attentionWidth: 280,
  inspectorWidth: 320,
  scenePadding: 24,
  minimumHitSize: 44,
  recoverableOfficeEdge: 96,
  zoomStops: [0.625, 0.75, 0.875, 1, 1.125, 1.25] as const,
  cutaway: {
    minimumOccluderHeight: 64,
    revealAlpha: 0.16,
    reasons: ["selected", "attention"],
  },
} as const;

const zoneEntityIds: ReadonlyArray<{ zoneId: ZoneId; entityId: string }> = [
  { zoneId: "reception", entityId: "zone_reception" },
  { zoneId: "team", entityId: "zone_team" },
  { zoneId: "library", entityId: "zone_library" },
  { zoneId: "collaboration", entityId: "zone_collaboration" },
  { zoneId: "review", entityId: "zone_review" },
  { zoneId: "manager", entityId: "zone_manager" },
  { zoneId: "delivery", entityId: "zone_delivery" },
];

const roleIds = [
  "delivery-lead",
  "product-designer",
  "implementation-engineer",
  "test-engineer",
  "visual-qa-reviewer",
  "release-reviewer",
] as const;

const entitiesById = new Map(sceneEntities().map((entity) => [entity.entityId, entity]));
const entity = (entityId: string): SceneEntity => {
  const found = entitiesById.get(entityId);
  if (!found) throw new Error(`OFFICE_LAYOUT_ENTITY_MISSING:${entityId}`);
  return found;
};
const roleEntity = (roleId: string): SceneEntity => entity(`agent_${roleId.replaceAll("-", "_")}`);

export type OfficeLayout = {
  schemaVersion: 1;
  status: "graybox-candidate";
  sceneViewport: Rectangle;
  camera: {
    rotation: 0;
    zoom: (typeof officeLayoutPolicy.zoomStops)[number];
    translation: Point;
    panClamp: { minX: number; maxX: number; minY: number; maxY: number };
  };
  projectedOfficeBounds: Rectangle;
  zones: Array<{ zoneId: ZoneId; polygon: Point[]; visible: boolean }>;
  roleAnchors: Array<{
    roleId: (typeof roleIds)[number];
    point: Point;
    hitRegion: Rectangle;
    visible: boolean;
  }>;
};

export function createOfficeLayout(viewport: OfficeViewport): OfficeLayout {
  requireViewport(viewport);
  const sceneViewport = createSceneViewport(viewport);
  const rawBounds = rawOfficeBounds();
  const zoom = selectFitZoom(sceneViewport, rawBounds);
  const translation = {
    x: round(
      sceneViewport.x + (sceneViewport.width - rawBounds.width * zoom) / 2 - rawBounds.x * zoom,
    ),
    y: round(
      sceneViewport.y + (sceneViewport.height - rawBounds.height * zoom) / 2 - rawBounds.y * zoom,
    ),
  };
  const projectedOfficeBounds = transformRectangle(rawBounds, zoom, translation);
  const sceneBounds = insetRectangle(sceneViewport, officeLayoutPolicy.scenePadding);

  return {
    schemaVersion: 1,
    status: officeLayoutPolicy.status,
    sceneViewport,
    camera: {
      rotation: 0,
      zoom,
      translation,
      panClamp: createPanClamp(sceneViewport, rawBounds, zoom),
    },
    projectedOfficeBounds,
    zones: zoneEntityIds.map(({ zoneId, entityId }) => {
      const polygon = entity(entityId).polygon.map((point) =>
        transformPoint(point, zoom, translation),
      );
      return { zoneId, polygon, visible: contains(sceneBounds, boundsOf(polygon)) };
    }),
    roleAnchors: roleIds.map((roleId) => {
      const desk = roleEntity(roleId);
      const point = transformPoint(desk.anchor, zoom, translation);
      // The whole desk takes the pointer, and never less than the minimum target.
      const hitRegion = atLeast(
        boundsOf(desk.polygon.map((corner) => transformPoint(corner, zoom, translation))),
        officeLayoutPolicy.minimumHitSize,
      );
      return { roleId, point, hitRegion, visible: contains(sceneBounds, hitRegion) };
    }),
  };
}

export function serializeOfficeLayout(layout: OfficeLayout): string {
  return JSON.stringify(layout);
}

function createSceneViewport(viewport: OfficeViewport): Rectangle {
  const x = viewport.attentionOpen ? officeLayoutPolicy.attentionWidth : 0;
  const width =
    viewport.width -
    (viewport.attentionOpen ? officeLayoutPolicy.attentionWidth : 0) -
    (viewport.inspectorOpen ? officeLayoutPolicy.inspectorWidth : 0);
  return {
    x,
    y: officeLayoutPolicy.projectBarHeight,
    width,
    height: viewport.height - officeLayoutPolicy.projectBarHeight,
  };
}

function rawOfficeBounds(): Rectangle {
  // Snapped outward to whole pixels: the isometric floor's edges are irrational, and the camera
  // recovers these bounds from the rounded frame, so a fractional edge would not survive reset.
  const extent = floorExtent();
  const { objectHeadroom } = officeLayoutPolicy.officeGrid;
  const minX = Math.floor(extent.minX);
  const minY = Math.floor(extent.minY - objectHeadroom);
  return {
    x: minX,
    y: minY,
    width: Math.ceil(extent.maxX) - minX,
    height: Math.ceil(extent.maxY) - minY,
  };
}

function selectFitZoom(
  sceneViewport: Rectangle,
  officeBounds: Rectangle,
): (typeof officeLayoutPolicy.zoomStops)[number] {
  const availableWidth = sceneViewport.width - officeLayoutPolicy.scenePadding * 2;
  const availableHeight = sceneViewport.height - officeLayoutPolicy.scenePadding * 2;
  const fit = Math.min(availableWidth / officeBounds.width, availableHeight / officeBounds.height);
  const selected = [...officeLayoutPolicy.zoomStops].reverse().find((stop) => stop <= fit);
  if (selected === undefined) throw new RangeError("OFFICE_VIEWPORT_BELOW_APPROVED_MINIMUM");
  return selected;
}

function createPanClamp(
  sceneViewport: Rectangle,
  officeBounds: Rectangle,
  zoom: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const edge = officeLayoutPolicy.recoverableOfficeEdge;
  return {
    minX: round(sceneViewport.x + edge - (officeBounds.x + officeBounds.width) * zoom),
    maxX: round(sceneViewport.x + sceneViewport.width - edge - officeBounds.x * zoom),
    minY: round(sceneViewport.y + edge - (officeBounds.y + officeBounds.height) * zoom),
    maxY: round(sceneViewport.y + sceneViewport.height - edge - officeBounds.y * zoom),
  };
}

function transformPoint(point: Point, zoom: number, translation: Point): Point {
  return { x: round(point.x * zoom + translation.x), y: round(point.y * zoom + translation.y) };
}

function transformRectangle(rectangle: Rectangle, zoom: number, translation: Point): Rectangle {
  return {
    x: round(rectangle.x * zoom + translation.x),
    y: round(rectangle.y * zoom + translation.y),
    width: round(rectangle.width * zoom),
    height: round(rectangle.height * zoom),
  };
}

function boundsOf(points: Point[]): Rectangle {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function insetRectangle(rectangle: Rectangle, inset: number): Rectangle {
  return {
    x: rectangle.x + inset,
    y: rectangle.y + inset,
    width: rectangle.width - inset * 2,
    height: rectangle.height - inset * 2,
  };
}

/** Grows a rectangle about its centre until each side is at least `size`. */
function atLeast(rectangle: Rectangle, size: number): Rectangle {
  const width = Math.max(rectangle.width, size);
  const height = Math.max(rectangle.height, size);
  return {
    x: round(rectangle.x - (width - rectangle.width) / 2),
    y: round(rectangle.y - (height - rectangle.height) / 2),
    width: round(width),
    height: round(height),
  };
}

function contains(outer: Rectangle, inner: Rectangle): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function requireViewport(viewport: OfficeViewport): void {
  if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)) {
    throw new TypeError("OFFICE_VIEWPORT_MUST_USE_INTEGER_CSS_PIXELS");
  }
  if (viewport.width <= 0 || viewport.height <= officeLayoutPolicy.projectBarHeight) {
    throw new RangeError("OFFICE_VIEWPORT_INVALID");
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
