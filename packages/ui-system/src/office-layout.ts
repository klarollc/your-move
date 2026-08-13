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
  projection: { tileWidth: 64, tileHeight: 32, elevation: 24 },
  officeGrid: { width: 18, height: 12, objectHeadroom: 128 },
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

const zones: ReadonlyArray<{
  zoneId: ZoneId;
  x: number;
  y: number;
  width: number;
  height: number;
}> = [
  { zoneId: "reception", x: 0.5, y: 1, width: 3, height: 3 },
  { zoneId: "team", x: 4, y: 1, width: 13.5, height: 4 },
  { zoneId: "library", x: 1, y: 6, width: 4, height: 3 },
  { zoneId: "collaboration", x: 6, y: 6, width: 5, height: 3 },
  { zoneId: "review", x: 12, y: 6, width: 4.5, height: 3 },
  { zoneId: "manager", x: 1, y: 10, width: 6, height: 2 },
  { zoneId: "delivery", x: 13, y: 10, width: 4, height: 2 },
];

const roleAnchors = [
  { roleId: "delivery-lead", x: 4.75, y: 2.5 },
  { roleId: "product-designer", x: 7.25, y: 2.5 },
  { roleId: "implementation-engineer", x: 9.75, y: 2.5 },
  { roleId: "test-engineer", x: 12.25, y: 2.5 },
  { roleId: "visual-qa-reviewer", x: 14.75, y: 2.5 },
  { roleId: "release-reviewer", x: 17.25, y: 2.5 },
] as const;

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
    roleId: (typeof roleAnchors)[number]["roleId"];
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
    zones: zones.map((zone) => {
      const polygon = zonePolygon(zone, zoom, translation);
      return { zoneId: zone.zoneId, polygon, visible: contains(sceneBounds, boundsOf(polygon)) };
    }),
    roleAnchors: roleAnchors.map((anchor) => {
      const point = transformPoint(project(anchor.x, anchor.y), zoom, translation);
      const hitRegion = centeredRectangle(point, officeLayoutPolicy.minimumHitSize);
      return {
        roleId: anchor.roleId,
        point,
        hitRegion,
        visible: contains(sceneBounds, hitRegion),
      };
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
  const { width, height, objectHeadroom } = officeLayoutPolicy.officeGrid;
  const corners = [project(0, 0), project(width, 0), project(0, height), project(width, height)];
  const floorBounds = boundsOf(corners);
  return {
    x: floorBounds.x,
    y: floorBounds.y - objectHeadroom,
    width: floorBounds.width,
    height: floorBounds.height + objectHeadroom,
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

function project(x: number, y: number, elevation = 0): Point {
  return {
    x: (x - y) * (officeLayoutPolicy.projection.tileWidth / 2),
    y:
      (x + y) * (officeLayoutPolicy.projection.tileHeight / 2) -
      elevation * officeLayoutPolicy.projection.elevation,
  };
}

function zonePolygon(zone: (typeof zones)[number], zoom: number, translation: Point): Point[] {
  return [
    project(zone.x, zone.y),
    project(zone.x + zone.width, zone.y),
    project(zone.x + zone.width, zone.y + zone.height),
    project(zone.x, zone.y + zone.height),
  ].map((point) => transformPoint(point, zoom, translation));
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

function centeredRectangle(point: Point, size: number): Rectangle {
  return { x: round(point.x - size / 2), y: round(point.y - size / 2), width: size, height: size };
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
