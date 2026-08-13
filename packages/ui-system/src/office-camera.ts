import { officeLayoutPolicy, type OfficeLayout } from "./office-layout.js";

type Point = Readonly<{ x: number; y: number }>;
type Rectangle = Point & Readonly<{ width: number; height: number }>;
type ZoomStop = (typeof officeLayoutPolicy.zoomStops)[number];

export type OfficeCamera = Readonly<{
  schemaVersion: 1;
  rotation: 0;
  zoom: ZoomStop;
  translation: Point;
  canonical: Readonly<{ zoom: ZoomStop; translation: Point }>;
  panClamp: Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>;
  sceneViewport: Rectangle;
  worldBounds: Rectangle;
  selectedEntityId?: string;
}>;

export type CameraCommand =
  | Readonly<{ type: "camera.pan"; deltaX: number; deltaY: number }>
  | Readonly<{ type: "camera.zoom"; direction: "in" | "out" }>
  | Readonly<{ type: "camera.reset" }>;

export type SceneDepth = Readonly<{
  entityId: string;
  gridX: number;
  gridY: number;
  elevation: number;
}>;

export type SceneHitRegion = Rectangle &
  Readonly<{ entityId: string; depth: number; visible: boolean }>;

export type SceneOccluder = Readonly<{
  entityId: string;
  height: number;
  occludesEntityIds: readonly string[];
}>;

export function createOfficeCamera(layout: OfficeLayout, selectedEntityId?: string): OfficeCamera {
  const worldBounds = inverseRectangle(
    layout.projectedOfficeBounds,
    layout.camera.zoom,
    layout.camera.translation,
  );
  return {
    schemaVersion: 1,
    rotation: 0,
    zoom: layout.camera.zoom,
    translation: { ...layout.camera.translation },
    canonical: {
      zoom: layout.camera.zoom,
      translation: { ...layout.camera.translation },
    },
    panClamp: { ...layout.camera.panClamp },
    sceneViewport: { ...layout.sceneViewport },
    worldBounds,
    ...(selectedEntityId === undefined ? {} : { selectedEntityId }),
  };
}

export function applyCameraCommand(camera: OfficeCamera, command: CameraCommand): OfficeCamera {
  if (command.type === "camera.reset") {
    const zoom = camera.canonical.zoom;
    return {
      ...camera,
      zoom,
      translation: { ...camera.canonical.translation },
      panClamp: createPanClamp(camera.sceneViewport, camera.worldBounds, zoom),
    };
  }

  if (command.type === "camera.pan") {
    requireFinite(command.deltaX, "OFFICE_CAMERA_PAN_INVALID");
    requireFinite(command.deltaY, "OFFICE_CAMERA_PAN_INVALID");
    return {
      ...camera,
      translation: clampTranslation(
        {
          x: camera.translation.x + command.deltaX,
          y: camera.translation.y + command.deltaY,
        },
        camera.panClamp,
      ),
    };
  }

  const index = officeLayoutPolicy.zoomStops.indexOf(camera.zoom);
  const offset = command.direction === "in" ? 1 : -1;
  const nextIndex = clamp(index + offset, 0, officeLayoutPolicy.zoomStops.length - 1);
  const zoom = officeLayoutPolicy.zoomStops[nextIndex] ?? camera.zoom;
  const anchor = {
    x: camera.sceneViewport.x + camera.sceneViewport.width / 2,
    y: camera.sceneViewport.y + camera.sceneViewport.height / 2,
  };
  const worldAnchor = screenToWorld(anchor, camera);
  const panClamp = createPanClamp(camera.sceneViewport, camera.worldBounds, zoom);
  return {
    ...camera,
    zoom,
    panClamp,
    translation: clampTranslation(
      {
        x: anchor.x - worldAnchor.x * zoom,
        y: anchor.y - worldAnchor.y * zoom,
      },
      panClamp,
    ),
  };
}

export function worldToScreen(point: Point, camera: OfficeCamera): Point {
  return {
    x: round(point.x * camera.zoom + camera.translation.x),
    y: round(point.y * camera.zoom + camera.translation.y),
  };
}

export function screenToWorld(point: Point, camera: OfficeCamera): Point {
  return {
    x: round((point.x - camera.translation.x) / camera.zoom),
    y: round((point.y - camera.translation.y) / camera.zoom),
  };
}

export function compareSceneDepth(left: SceneDepth, right: SceneDepth): number {
  return (
    left.gridX + left.gridY - (right.gridX + right.gridY) ||
    left.elevation - right.elevation ||
    left.entityId.localeCompare(right.entityId)
  );
}

export function hitTestScene(point: Point, regions: readonly SceneHitRegion[]): string | undefined {
  return [...regions]
    .filter(
      (region) =>
        region.visible &&
        point.x >= region.x &&
        point.y >= region.y &&
        point.x <= region.x + region.width &&
        point.y <= region.y + region.height,
    )
    .sort(
      (left, right) => right.depth - left.depth || left.entityId.localeCompare(right.entityId),
    )[0]?.entityId;
}

export function resolveCutaways(
  occluders: readonly SceneOccluder[],
  criticalEntityIds: readonly string[],
): Array<{
  entityId: string;
  alpha: typeof officeLayoutPolicy.cutaway.revealAlpha;
  interactive: false;
  reason: "selected-or-attention";
}> {
  const critical = new Set(criticalEntityIds);
  return occluders
    .filter(
      ({ height, occludesEntityIds }) =>
        height >= officeLayoutPolicy.cutaway.minimumOccluderHeight &&
        occludesEntityIds.some((entityId) => critical.has(entityId)),
    )
    .sort((left, right) => left.entityId.localeCompare(right.entityId))
    .map(({ entityId }) => ({
      entityId,
      alpha: officeLayoutPolicy.cutaway.revealAlpha,
      interactive: false,
      reason: "selected-or-attention",
    }));
}

export function serializeOfficeCamera(camera: OfficeCamera): string {
  return JSON.stringify(camera);
}

function createPanClamp(
  viewport: Rectangle,
  worldBounds: Rectangle,
  zoom: number,
): OfficeCamera["panClamp"] {
  const edge = officeLayoutPolicy.recoverableOfficeEdge;
  return {
    minX: round(viewport.x + edge - (worldBounds.x + worldBounds.width) * zoom),
    maxX: round(viewport.x + viewport.width - edge - worldBounds.x * zoom),
    minY: round(viewport.y + edge - (worldBounds.y + worldBounds.height) * zoom),
    maxY: round(viewport.y + viewport.height - edge - worldBounds.y * zoom),
  };
}

function clampTranslation(point: Point, bounds: OfficeCamera["panClamp"]): Point {
  return {
    x: round(clamp(point.x, bounds.minX, bounds.maxX)),
    y: round(clamp(point.y, bounds.minY, bounds.maxY)),
  };
}

function inverseRectangle(rectangle: Rectangle, zoom: number, translation: Point): Rectangle {
  return {
    x: round((rectangle.x - translation.x) / zoom),
    y: round((rectangle.y - translation.y) / zoom),
    width: round(rectangle.width / zoom),
    height: round(rectangle.height / zoom),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function requireFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new TypeError(code);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
