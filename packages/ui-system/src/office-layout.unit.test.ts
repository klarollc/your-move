import { describe, expect, it } from "vitest";

import {
  createOfficeLayout,
  officeLayoutPolicy,
  serializeOfficeLayout,
  type OfficeViewport,
} from "./office-layout.js";
import { sceneEntities } from "./scene/entities.js";

const viewports: OfficeViewport[] = [
  { width: 1440, height: 900, attentionOpen: false, inspectorOpen: false },
  { width: 1280, height: 800, attentionOpen: false, inspectorOpen: false },
];

describe("createOfficeLayout", () => {
  it.each(viewports)(
    "fits every required zone and six role anchors at $width×$height canonical reset",
    (viewport) => {
      const layout = createOfficeLayout(viewport);

      expect(layout.zones.map(({ zoneId }) => zoneId)).toEqual([
        "reception",
        "team",
        "library",
        "collaboration",
        "review",
        "manager",
        "delivery",
      ]);
      expect(layout.roleAnchors).toHaveLength(6);
      expect(layout.roleAnchors.every(({ visible }) => visible)).toBe(true);
      expect(layout.zones.every(({ visible }) => visible)).toBe(true);
      expect(layout.camera.rotation).toBe(0);
      expect(layout.camera.zoom).toBeGreaterThanOrEqual(officeLayoutPolicy.zoomStops[0]);
    },
  );

  it("uses a byte-equivalent projection for the same descriptor and viewport", () => {
    const viewport = {
      width: 1440,
      height: 900,
      attentionOpen: true,
      inspectorOpen: true,
    } as const;

    expect(serializeOfficeLayout(createOfficeLayout(viewport))).toBe(
      serializeOfficeLayout(createOfficeLayout(viewport)),
    );
  });

  it.each(viewports)(
    "keeps all required content recoverable when both overlays open at $width×$height",
    ({ width, height }) => {
      const layout = createOfficeLayout({
        width,
        height,
        attentionOpen: true,
        inspectorOpen: true,
      });

      expect(layout.sceneViewport.width).toBe(
        width - officeLayoutPolicy.attentionWidth - officeLayoutPolicy.inspectorWidth,
      );
      expect(layout.roleAnchors.every(({ visible }) => visible)).toBe(true);
      expect(layout.zones.every(({ visible }) => visible)).toBe(true);
      expect(layout.camera.zoom).toBeGreaterThanOrEqual(officeLayoutPolicy.zoomStops[0]);
      expect(layout.camera.panClamp).toMatchObject({
        minX: expect.any(Number),
        maxX: expect.any(Number),
        minY: expect.any(Number),
        maxY: expect.any(Number),
      });
    },
  );

  it("defines accessible hit and cutaway measurements without promoting art tokens", () => {
    expect(officeLayoutPolicy.minimumHitSize).toBe(44);
    // Moved (P-4, Task 3b ruling G-1): the 64×32 graybox projection gave way to the Phase 6 scene's.
    expect(officeLayoutPolicy.projection).toEqual({ source: "phase-6-scene", tile: 34 });
    expect(officeLayoutPolicy.cutaway).toEqual({
      minimumOccluderHeight: 64,
      revealAlpha: 0.16,
      reasons: ["selected", "attention"],
    });
    expect(officeLayoutPolicy.status).toBe("graybox-candidate");
  });

  const entities = new Map(sceneEntities().map((entity) => [entity.entityId, entity]));
  const zoneEntity: Record<string, string> = {
    reception: "zone_reception",
    team: "zone_team",
    library: "zone_library",
    collaboration: "zone_collaboration",
    review: "zone_review",
    manager: "zone_manager",
    delivery: "zone_delivery",
  };
  const round = (value: number) => Math.round(value * 1000) / 1000;

  it.each(viewports)(
    "frames the Phase 6 scene's own zones and desks at $width×$height (G-1)",
    (viewport) => {
      const layout = createOfficeLayout(viewport);
      const { zoom, translation } = layout.camera;
      const toScreen = ({ x, y }: { x: number; y: number }) => ({
        x: round(x * zoom + translation.x),
        y: round(y * zoom + translation.y),
      });
      for (const zone of layout.zones) {
        const entity = entities.get(zoneEntity[zone.zoneId]!);
        expect(zone.polygon).toStrictEqual(entity!.polygon.map(toScreen));
      }
      for (const anchor of layout.roleAnchors) {
        const entity = entities.get(`agent_${anchor.roleId.replaceAll("-", "_")}`);
        expect(anchor.point).toStrictEqual(toScreen(entity!.anchor));
      }
    },
  );

  const reachable: OfficeViewport[] = [1440, 1280].flatMap((width) =>
    [false, true].flatMap((attentionOpen) =>
      [false, true].map((inspectorOpen) => ({
        width,
        height: width === 1440 ? 900 : 800,
        attentionOpen,
        inspectorOpen,
      })),
    ),
  );

  it.each(reachable)(
    "gives every desk a hit region over the whole desk, at least 44 px square ($width, attention $attentionOpen, inspector $inspectorOpen)",
    (viewport) => {
      const layout = createOfficeLayout(viewport);
      const { zoom, translation } = layout.camera;
      for (const anchor of layout.roleAnchors) {
        const entity = entities.get(`agent_${anchor.roleId.replaceAll("-", "_")}`)!;
        const xs = entity.polygon.map(({ x }) => x * zoom + translation.x);
        const ys = entity.polygon.map(({ y }) => y * zoom + translation.y);
        const { hitRegion } = anchor;
        expect(hitRegion.width).toBeGreaterThanOrEqual(officeLayoutPolicy.minimumHitSize);
        expect(hitRegion.height).toBeGreaterThanOrEqual(officeLayoutPolicy.minimumHitSize);
        expect(hitRegion.x).toBeLessThanOrEqual(Math.min(...xs) + 0.001);
        expect(hitRegion.y).toBeLessThanOrEqual(Math.min(...ys) + 0.001);
        expect(hitRegion.x + hitRegion.width).toBeGreaterThanOrEqual(Math.max(...xs) - 0.001);
        expect(hitRegion.y + hitRegion.height).toBeGreaterThanOrEqual(Math.max(...ys) - 0.001);
      }
    },
  );
});
