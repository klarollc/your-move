import { createOfficeLayout, officeLayoutPolicy } from "@cuckcode/ui-system";
import { useMemo, useState } from "react";

import "./layout-trial.css";

const zoneNames = {
  reception: "Reception",
  team: "Team work area",
  library: "Project library",
  collaboration: "Collaboration table",
  review: "Review station",
  manager: "Manager desk",
  delivery: "Delivery area",
} as const;

const roles = {
  "delivery-lead": { code: "DL", name: "Delivery Lead" },
  "product-designer": { code: "PD", name: "Product Designer" },
  "implementation-engineer": { code: "IE", name: "Implementation Engineer" },
  "test-engineer": { code: "TE", name: "Test Engineer" },
  "visual-qa-reviewer": { code: "VQA", name: "Visual QA Reviewer" },
  "release-reviewer": { code: "RR", name: "Release Reviewer" },
} as const;

export function LayoutTrial() {
  const [viewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [overlays] = useState(
    () => new URLSearchParams(window.location.search).get("overlays") === "both",
  );
  const layout = useMemo(
    () =>
      createOfficeLayout({
        ...viewport,
        attentionOpen: overlays,
        inspectorOpen: overlays,
      }),
    [overlays, viewport],
  );

  return (
    <main className="layout-trial" aria-label="Phase 4 graybox layout trial">
      <header className="trial-project-bar">
        <strong>CuckCode layout trial</strong>
        <span>Canonical office reset</span>
        <span className="trial-measurement">
          {viewport.width}×{viewport.height} · zoom {layout.camera.zoom}
        </span>
        <button type="button">Reset view</button>
      </header>

      {overlays ? (
        <aside className="trial-attention" aria-label="Manager attention">
          <h2>Manager attention</h2>
          <p>No pending requests</p>
          <small>Authored width: {officeLayoutPolicy.attentionWidth}px</small>
        </aside>
      ) : null}

      <section className="trial-scene" aria-label="Graybox office projection">
        <svg
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          role="img"
          aria-label="All office zones and six role anchors at canonical reset"
        >
          <rect
            className="trial-office-bounds"
            x={layout.projectedOfficeBounds.x}
            y={layout.projectedOfficeBounds.y}
            width={layout.projectedOfficeBounds.width}
            height={layout.projectedOfficeBounds.height}
          />
          {layout.zones.map((zone) => {
            const labelPoint = centroid(zone.polygon);
            return (
              <g key={zone.zoneId}>
                <polygon
                  className={`trial-zone trial-zone-${zone.zoneId}`}
                  points={zone.polygon.map(({ x, y }) => `${x},${y}`).join(" ")}
                />
                <text className="trial-zone-label" x={labelPoint.x} y={labelPoint.y}>
                  {zoneNames[zone.zoneId]}
                </text>
              </g>
            );
          })}
          {layout.roleAnchors.map((anchor) => {
            const role = roles[anchor.roleId];
            return (
              <g key={anchor.roleId} aria-label={role.name}>
                <rect
                  className="trial-hit-region"
                  x={anchor.hitRegion.x}
                  y={anchor.hitRegion.y}
                  width={anchor.hitRegion.width}
                  height={anchor.hitRegion.height}
                />
                <circle
                  className="trial-role-marker"
                  cx={anchor.point.x}
                  cy={anchor.point.y}
                  r="15"
                />
                <text className="trial-role-code" x={anchor.point.x} y={anchor.point.y + 4}>
                  {role.code}
                </text>
              </g>
            );
          })}
        </svg>
      </section>

      {overlays ? (
        <aside className="trial-inspector" aria-label="Layout measurements">
          <h2>Office outline</h2>
          <ol>
            {layout.roleAnchors.map((anchor) => (
              <li key={anchor.roleId}>
                <span>{roles[anchor.roleId].code}</span> {roles[anchor.roleId].name}
              </li>
            ))}
          </ol>
          <dl>
            <div>
              <dt>Projection</dt>
              <dd>2:1 fixed isometric</dd>
            </div>
            <div>
              <dt>Hit region</dt>
              <dd>{officeLayoutPolicy.minimumHitSize}px minimum</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Graybox candidate</dd>
            </div>
          </dl>
        </aside>
      ) : null}
    </main>
  );
}

function centroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}
