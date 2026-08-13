import { describe, expect, it } from "vitest";

import {
  createOfficeLayout,
  officeLayoutPolicy,
  serializeOfficeLayout,
  type OfficeViewport,
} from "./office-layout.js";

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
    expect(officeLayoutPolicy.projection).toEqual({ tileWidth: 64, tileHeight: 32, elevation: 24 });
    expect(officeLayoutPolicy.cutaway).toEqual({
      minimumOccluderHeight: 64,
      revealAlpha: 0.16,
      reasons: ["selected", "attention"],
    });
    expect(officeLayoutPolicy.status).toBe("graybox-candidate");
  });
});
