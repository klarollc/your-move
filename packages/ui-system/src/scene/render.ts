import {
  ACTIVE_AGENT_ID,
  AGENTS,
  FLOOR,
  PROPS,
  TILE,
  ZONES,
  depth,
  floorExtent,
  iso,
  pts,
  type AgentPlacement,
  type Prop,
} from "./geometry.js";
import { WALLS, WINDOWS, WINDOW_WALL_Y, daylightPatches, type WallBox } from "./architecture.js";
import type { CandidateStyle } from "./styles.js";

type Piece = { key: number; svg: string };

/**
 * The canonical state a composition renders.
 *
 * Omitted, the renderer reproduces the frozen default-office frame byte for byte — the candidates
 * and the reconciliation were reviewed against that output and must not move. Supplied, a state
 * layer is drawn on top: per-agent glyphs and the work card at the zone its state puts it in.
 */
export type SceneState = {
  agentStates: Record<string, string>;
  work?: { state: string };
  collaborationParticipants?: string[];
};

const DEFAULT_SCENE_STATE: SceneState = {
  agentStates: { [ACTIVE_AGENT_ID]: "active" },
};

/** Where a work item sits, by state. The zone is a cue in its own right (Task 6). */
function workZone(state: string): { x: number; y: number } | null {
  if (["review_requested", "verified"].includes(state)) return { x: 14.6, y: 11.4 };
  if (state === "completed") return { x: 5.6, y: 12.1 };
  if (state === "cancelled") return { x: 1.2, y: 12.4 };
  if (
    [
      "draft",
      "ready",
      "assigned",
      "active",
      "waiting_input",
      "blocked",
      "failed",
      "paused",
    ].includes(state)
  )
    return { x: 6.4, y: 7.2 };
  return null;
}

const shade = (hex: string, amount: number): string => {
  const value = hex.replace("#", "");
  const channel = (index: number): number => parseInt(value.slice(index, index + 2), 16);
  const mix = (input: number): number =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(amount >= 0 ? input + (255 - input) * amount : input * (1 + amount)),
      ),
    );
  return `#${[mix(channel(0)), mix(channel(2)), mix(channel(4))]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
};

const escapeText = (value: string): string =>
  value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/** One isometric box: top, left, right. The only volume primitive candidates get. */
type FaceShading = Readonly<{ left: number; right: number }>;

const DEFAULT_FACE_SHADING: FaceShading = { left: -0.22, right: -0.1 };
const WALL_FACE_SHADING: FaceShading = { left: -0.08, right: -0.04 };

function box(
  style: CandidateStyle,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  base: string,
  edge: string,
  faceShading: FaceShading = DEFAULT_FACE_SHADING,
): string {
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const left = [iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)];
  const right = [iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)];
  const stroke =
    style.edgeWidth > 0
      ? ` stroke="${edge}" stroke-width="${style.edgeWidth}" stroke-linejoin="round"`
      : "";
  return [
    `<polygon points="${pts(left)}" fill="${shade(base, faceShading.left)}"${stroke}/>`,
    `<polygon points="${pts(right)}" fill="${shade(base, faceShading.right)}"${stroke}/>`,
    `<polygon points="${pts(top)}" fill="${shade(base, style.lift)}"${stroke}/>`,
  ].join("");
}

/** Contact shadow. Its weight is the main thing separating the three emphases at ground level. */
function contact(style: CandidateStyle, x: number, y: number, w: number, d: number): string {
  const centre = iso(x + w / 2, y + d / 2);
  const rx = ((w + d) / 2) * TILE * 0.62 + style.shadow.spread;
  return `<ellipse cx="${centre.x.toFixed(2)}" cy="${centre.y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${(rx * 0.5).toFixed(2)}" fill="${style.palette.shadow}" opacity="${style.shadow.opacity}" filter="url(#soft-${style.candidateId})"/>`;
}

function floorPlane(style: CandidateStyle): string {
  const p = style.palette;
  const corners = [
    iso(FLOOR.x, FLOOR.y),
    iso(FLOOR.x + FLOOR.w, FLOOR.y),
    iso(FLOOR.x + FLOOR.w, FLOOR.y + FLOOR.d),
    iso(FLOOR.x, FLOOR.y + FLOOR.d),
  ];
  const parts: string[] = [];
  if (style.plinth > 0) {
    const lower = corners.map((point) => ({ x: point.x, y: point.y + style.plinth }));
    parts.push(
      `<polygon points="${pts([corners[3]!, corners[2]!, lower[2]!, lower[3]!])}" fill="${shade(p.floorBase, -0.34)}"/>`,
      `<polygon points="${pts([corners[2]!, corners[1]!, lower[1]!, lower[2]!])}" fill="${shade(p.floorBase, -0.24)}"/>`,
    );
  }
  parts.push(`<polygon points="${pts(corners)}" fill="${p.floorBase}"/>`);

  for (const [index, zone] of ZONES.entries()) {
    const quad = [
      iso(zone.x, zone.y),
      iso(zone.x + zone.w, zone.y),
      iso(zone.x + zone.w, zone.y + zone.d),
      iso(zone.x, zone.y + zone.d),
    ];
    const fill = index % 2 === 0 ? p.floorZoneA : p.floorZoneB;
    const stroke =
      style.edgeWidth > 0
        ? ` stroke="${p.zoneEdge}" stroke-width="${(style.edgeWidth * 1.3).toFixed(2)}"`
        : ` stroke="${p.zoneEdge}" stroke-width="0.6" stroke-opacity="0.45"`;
    parts.push(`<polygon points="${pts(quad)}" fill="${fill}"${stroke}/>`);
  }
  return parts.join("");
}

/**
 * Zone labels are centred on the zone's top vertex, not indented from its corner. Anchoring at a
 * corner and running the text rightwards pushed it outside the diamond, which clipped "PROJECT
 * LIBRARY" to "ROJECT LIBRARY" and read as a rendering bug rather than an art direction.
 */
function zoneLabels(style: CandidateStyle): string {
  return ZONES.map((zone) => {
    const at = iso(zone.x, zone.y);
    const text = zone.label.toUpperCase();
    const size = style.typography.labelSize;
    const plateW = text.length * size * 0.66 + 14;
    return `<g><rect x="${(at.x - plateW / 2).toFixed(2)}" y="${(at.y - size - 4).toFixed(2)}" width="${plateW.toFixed(2)}" height="${(size + 7).toFixed(2)}" rx="2" fill="${style.palette.paper}" opacity="0.72"/><text x="${at.x.toFixed(2)}" y="${(at.y + 1).toFixed(2)}" text-anchor="middle" font-family="${style.typography.display}" font-size="${size}" font-weight="${style.typography.labelWeight}" fill="${style.palette.inkMuted}" letter-spacing="0.5">${escapeText(text)}</text></g>`;
  }).join("");
}

function deskPiece(style: CandidateStyle, agent: AgentPlacement): Piece {
  const p = style.palette;
  const parts: string[] = [contact(style, agent.x - 0.1, agent.y - 0.1, 2.2, 1.6)];
  parts.push(box(style, agent.x, agent.y, 2, 1.2, 0.42, p.wood, p.woodEdge));
  // Monitor: charcoal metal, the technical surface.
  const mx = agent.facing === "right" ? agent.x + 1.25 : agent.x + 0.05;
  parts.push(box(style, mx, agent.y + 0.2, 0.7, 0.12, 0.95, p.metal, shade(p.metal, -0.4)));
  // Desk object, the agent's approved personalization.
  const ox = agent.facing === "right" ? agent.x + 0.25 : agent.x + 1.15;
  parts.push(box(style, ox, agent.y + 0.62, 0.45, 0.38, 0.6, p.paper, p.woodEdge));
  return { key: depth(agent.x, agent.y), svg: parts.join("") };
}

/** A raised, thin isometric slab used by the furniture-only application scene. */
function slab(
  style: CandidateStyle,
  x: number,
  y: number,
  w: number,
  d: number,
  z0: number,
  z1: number,
  base: string,
  edge: string,
): string {
  const top = [iso(x, y, z1), iso(x + w, y, z1), iso(x + w, y + d, z1), iso(x, y + d, z1)];
  const left = [iso(x, y + d, z1), iso(x + w, y + d, z1), iso(x + w, y + d, z0), iso(x, y + d, z0)];
  const right = [
    iso(x + w, y, z1),
    iso(x + w, y + d, z1),
    iso(x + w, y + d, z0),
    iso(x + w, y, z0),
  ];
  const stroke = style.edgeWidth > 0 ? ` stroke="${edge}" stroke-width="${style.edgeWidth}"` : "";
  return [
    `<polygon points="${pts(left)}" fill="${shade(base, -0.18)}"${stroke}/>`,
    `<polygon points="${pts(right)}" fill="${shade(base, -0.08)}"${stroke}/>`,
    `<polygon points="${pts(top)}" fill="${shade(base, style.lift)}"${stroke}/>`,
  ].join("");
}

function furnishedDeskPiece(style: CandidateStyle, agent: AgentPlacement): Piece {
  const p = style.palette;
  const supportOffsets: Array<[number, number]> =
    agent.agentId === "agent_implementation_engineer"
      ? []
      : agent.agentId === "agent_test_engineer"
        ? [
            [1.68, 1.15],
            [1.78, 1.15],
          ]
        : agent.workArea === "review_station"
          ? [
              [1.15, 1.15],
              [1.45, 1.15],
            ]
          : [
              [1.15, 1.15],
              [1.2, 1.15],
            ];
  const legs = supportOffsets
    .map(
      ([dx, dy]) =>
        `<g data-furniture-part="support">${slab(style, agent.x + dx, agent.y + dy, 0.05, 0.05, 0, 0.38, p.metalShade, p.woodEdge)}</g>`,
    )
    .join("");
  const angledEngineerSupport =
    agent.agentId === "agent_implementation_engineer"
      ? (() => {
          const top = iso(agent.x + 1.72, agent.y + 1.1, 0.38);
          const foot = iso(agent.x + 1.0, agent.y + 1.75);
          return `<g data-furniture-part="support"><path d="M ${top.x.toFixed(2)} ${top.y.toFixed(2)} L ${foot.x.toFixed(2)} ${foot.y.toFixed(2)}" fill="none" stroke="${p.metalShade}" stroke-width="1.5"/></g>`;
        })()
      : "";
  const table = `<g data-furniture-part="desk-surface">${slab(style, agent.x + 0.14, agent.y, 1.72, 1.2, 0.38, 0.48, p.wood, p.woodEdge)}</g>`;
  // Compact back-corner screens use only clear stations; other desks retain a keyboard cue.
  const monitorX = agent.x + 0.15;
  const monitor =
    agent.agentId === "agent_test_engineer" || agent.agentId === "agent_release_reviewer"
      ? ""
      : `<g data-furniture-part="monitor">${slab(
          style,
          monitorX,
          agent.y + 0.02,
          0.4,
          0.08,
          0.72,
          1.1,
          p.metal,
          p.metalShade,
        )}<g data-furniture-part="monitor-stand">${slab(style, agent.x + 0.17, agent.y + 0.03, 0.06, 0.04, 0.49, 0.72, p.metalShade, p.woodEdge)}</g></g>`;
  const keyboard = [
    iso(agent.x + 0.15, agent.y + 0.02, 0.48),
    iso(agent.x + 0.25, agent.y + 0.02, 0.48),
    iso(agent.x + 0.25, agent.y + 0.08, 0.48),
    iso(agent.x + 0.15, agent.y + 0.08, 0.48),
  ];
  const workSurface = `${legs}${angledEngineerSupport}${table}${monitor}<polygon data-furniture-part="keyboard" points="${pts(keyboard)}" fill="${p.metalShade}" stroke="${p.woodEdge}" stroke-width="0.7"/>`;
  return {
    key: depth(agent.x, agent.y),
    svg: `${contact(style, agent.x - 0.1, agent.y - 0.1, 2.2, 1.6)}${furnitureGroup("work-surface", workSurface, agent.workArea, agent.agentId)}`,
  };
}

function figurePiece(style: CandidateStyle, agent: AgentPlacement, scene: SceneState): Piece {
  const p = style.palette;
  const seated = agent.build === "seated-wheelchair";
  const heights: Record<AgentPlacement["build"], number> = {
    tall: 1.72,
    broad: 1.58,
    medium: 1.6,
    slight: 1.52,
    short: 1.44,
    "seated-wheelchair": 1.16,
  };
  const widths: Record<AgentPlacement["build"], number> = {
    tall: 0.4,
    broad: 0.54,
    medium: 0.44,
    slight: 0.37,
    short: 0.42,
    "seated-wheelchair": 0.46,
  };
  const h = heights[agent.build];
  const w = widths[agent.build];
  // Behind the desk, in depth terms: a smaller x+y draws first, so the figure reads as seated at
  // the workstation rather than standing in the aisle in front of it.
  const fx = agent.x + 1;
  const fy = agent.y - 0.5;
  const base = iso(fx, fy);
  const shoulder = base.y - (h - 0.62) * TILE;
  const headY = base.y - h * TILE + TILE * 0.2;
  const parts: string[] = [contact(style, fx - 0.32, fy - 0.32, 0.64, 0.64)];

  if (seated) {
    const wheel = iso(fx, fy, 0.34);
    parts.push(
      `<ellipse cx="${wheel.x.toFixed(2)}" cy="${wheel.y.toFixed(2)}" rx="${(TILE * 0.36).toFixed(2)}" ry="${(TILE * 0.34).toFixed(2)}" fill="none" stroke="${p.metalShade}" stroke-width="2.6"/>`,
    );
  }
  // Simplified adult proportions: a tapered torso with shoulders, not a cone. No facial detail at
  // canonical scale, by the avatar contract.
  const halfW = (w * TILE) / 2;
  parts.push(
    `<path d="M ${(base.x - halfW * 0.8).toFixed(2)} ${base.y.toFixed(2)} L ${(base.x - halfW).toFixed(2)} ${shoulder.toFixed(2)} Q ${base.x.toFixed(2)} ${(shoulder - TILE * 0.16).toFixed(2)} ${(base.x + halfW).toFixed(2)} ${shoulder.toFixed(2)} L ${(base.x + halfW * 0.8).toFixed(2)} ${base.y.toFixed(2)} Z" fill="${p.figure}"/>`,
    `<circle cx="${base.x.toFixed(2)}" cy="${headY.toFixed(2)}" r="${(TILE * 0.19).toFixed(2)}" fill="${p.figureShade}"/>`,
  );
  const head = { x: base.x, y: headY - TILE * 0.18 };
  const hairShapes: Record<AgentPlacement["hair"], string> = {
    cropped: `<circle cx="${head.x.toFixed(2)}" cy="${(head.y + TILE * 0.12).toFixed(2)}" r="${(TILE * 0.21).toFixed(2)}" fill="${shade(p.figureShade, -0.3)}"/>`,
    coiled: `<circle cx="${head.x.toFixed(2)}" cy="${(head.y + TILE * 0.05).toFixed(2)}" r="${(TILE * 0.27).toFixed(2)}" fill="${shade(p.figureShade, -0.34)}"/>`,
    long: `<path d="M ${(head.x - TILE * 0.22).toFixed(2)} ${(head.y + TILE * 0.16).toFixed(2)} q 0 ${(TILE * 0.62).toFixed(2)} ${(TILE * 0.22).toFixed(2)} ${(TILE * 0.62).toFixed(2)} q ${(TILE * 0.22).toFixed(2)} 0 ${(TILE * 0.22).toFixed(2)} ${(-TILE * 0.62).toFixed(2)} z" fill="${shade(p.figureShade, -0.3)}"/>`,
    bun: `<circle cx="${head.x.toFixed(2)}" cy="${(head.y - TILE * 0.08).toFixed(2)}" r="${(TILE * 0.13).toFixed(2)}" fill="${shade(p.figureShade, -0.32)}"/>`,
    locs: `<path d="M ${(head.x - TILE * 0.24).toFixed(2)} ${(head.y + TILE * 0.1).toFixed(2)} h ${(TILE * 0.48).toFixed(2)} v ${(TILE * 0.5).toFixed(2)} h ${(-TILE * 0.1).toFixed(2)} v ${(-TILE * 0.28).toFixed(2)} h ${(-TILE * 0.1).toFixed(2)} v ${(TILE * 0.3).toFixed(2)} h ${(-TILE * 0.1).toFixed(2)} v ${(-TILE * 0.3).toFixed(2)} h ${(-TILE * 0.08).toFixed(2)} z" fill="${shade(p.figureShade, -0.34)}"/>`,
    wrapped: `<path d="M ${(head.x - TILE * 0.23).toFixed(2)} ${(head.y + TILE * 0.14).toFixed(2)} a ${(TILE * 0.23).toFixed(2)} ${(TILE * 0.23).toFixed(2)} 0 0 1 ${(TILE * 0.46).toFixed(2)} 0 z" fill="${p.textile}"/>`,
  };
  parts.push(hairShapes[agent.hair]);

  const labelY = headY - TILE * 0.58;
  const glyphY = labelY - 13;
  switch (scene.agentStates[agent.agentId]) {
    case "active":
      parts.push(
        `<circle cx="${base.x.toFixed(2)}" cy="${glyphY.toFixed(2)}" r="8" fill="${p.attentionSoft}"/>`,
        `<circle cx="${base.x.toFixed(2)}" cy="${glyphY.toFixed(2)}" r="3.8" fill="${p.attention}"/>`,
      );
      break;
    case "waiting":
      // A question, not a colour. The glyph is the cue; the accent only carries it.
      parts.push(
        `<circle cx="${base.x.toFixed(2)}" cy="${glyphY.toFixed(2)}" r="8" fill="${p.attentionSoft}"/>`,
        `<text x="${base.x.toFixed(2)}" y="${(glyphY + 4).toFixed(2)}" text-anchor="middle" font-family="${style.typography.display}" font-size="12" font-weight="700" fill="${p.attention}">?</text>`,
      );
      break;
    case "blocked":
      parts.push(
        `<rect x="${(base.x - 9).toFixed(2)}" y="${(glyphY - 2.6).toFixed(2)}" width="18" height="5.2" rx="1" fill="${p.metal}"/>`,
      );
      break;
    case "failed":
      parts.push(
        `<path d="M ${(base.x - 9).toFixed(2)} ${(glyphY - 4).toFixed(2)} l 6 4 l -6 4 M ${(base.x + 9).toFixed(2)} ${(glyphY - 4).toFixed(2)} l -6 4 l 6 4" fill="none" stroke="${p.metal}" stroke-width="2.4"/>`,
      );
      break;
    default:
      break;
  }

  if (scene.collaborationParticipants?.includes(agent.agentId)) {
    // Marked where the agent is, never moved to the table. Proximity is never a claim here.
    parts.push(
      `<circle cx="${(base.x + 13).toFixed(2)}" cy="${glyphY.toFixed(2)}" r="5.4" fill="none" stroke="${p.ink}" stroke-width="1.8"/>`,
      `<circle cx="${(base.x + 13).toFixed(2)}" cy="${glyphY.toFixed(2)}" r="1.9" fill="${p.ink}"/>`,
    );
  }

  // Labels sit just above the head on an opaque plate. Floating them higher put them over other
  // zones, which made the frame read as mislabelled rather than as an office.
  const charWidth = 5.1;
  const plateW = agent.label.length * charWidth + 12;
  parts.push(
    `<rect x="${(base.x - plateW / 2).toFixed(2)}" y="${(labelY - 9).toFixed(2)}" width="${plateW.toFixed(2)}" height="13" rx="2" fill="${p.paper}" opacity="0.92"/>`,
    `<text x="${base.x.toFixed(2)}" y="${labelY.toFixed(2)}" text-anchor="middle" font-family="${style.typography.display}" font-size="9" font-weight="${style.typography.labelWeight}" fill="${p.ink}">${escapeText(agent.label)}</text>`,
  );
  return { key: depth(fx, fy) + 0.05, svg: parts.join("") };
}

const furnitureGroup = (name: string, svg: string, zone = "floor", item?: string): string =>
  `<g data-furniture="${name}" data-zone="${zone}"${item ? ` data-item="${item}"` : ""} aria-hidden="true">${svg}</g>`;

/** Low-contrast seams clipped to the unchanged canonical floor footprint. */
function floorSeams(style: CandidateStyle): string {
  const corners = [
    iso(FLOOR.x, FLOOR.y),
    iso(FLOOR.x + FLOOR.w, FLOOR.y),
    iso(FLOOR.x + FLOOR.w, FLOOR.y + FLOOR.d),
    iso(FLOOR.x, FLOOR.y + FLOOR.d),
  ];
  const seams: Array<[number, number, number, number]> = [
    [1.1, 2.2, 3.0, 2.2],
    [5.5, 1.3, 7.9, 1.3],
    [10.2, 2.5, 12.3, 2.5],
    [15.3, 1.6, 17.1, 1.6],
    [2.0, 6.7, 3.7, 6.7],
    [12.5, 13.5, 14.5, 13.5],
    [5.1, 12.1, 7.8, 12.1],
    [10.2, 12.8, 11.6, 12.8],
  ];
  const paths = seams
    .map(([x1, y1, x2, y2], index) => {
      const start = iso(x1, y1);
      const end = iso(x2, y2);
      return furnitureGroup(
        "floor-seam",
        `<path data-floor-seam="${index}" d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}"/>`,
        "floor",
        `seam-${index}`,
      );
    })
    .join("");
  return `<defs><clipPath id="furniture-floor-clip"><polygon points="${pts(corners)}"/></clipPath></defs><g clip-path="url(#furniture-floor-clip)" fill="none" stroke="${style.palette.woodShade}" stroke-width="0.8" opacity="0.22">${paths}</g>`;
}

function chair(style: CandidateStyle, x: number, y: number): string {
  const p = style.palette;
  const width = 0.4;
  const seatDepth = 0.36;
  const seat = [
    iso(x, y + seatDepth, 0.2),
    iso(x + width, y + seatDepth, 0.2),
    iso(x + width, y, 0.2),
    iso(x, y, 0.2),
  ];
  const seatEdge = [
    seat[0]!,
    seat[1]!,
    iso(x + width, y + seatDepth, 0.14),
    iso(x, y + seatDepth, 0.14),
  ];
  const back = [
    iso(x, y + 0.04, 0.2),
    iso(x + width, y + 0.04, 0.2),
    iso(x + width, y + 0.04, 0.58),
    iso(x, y + 0.04, 0.58),
  ];
  const legs = [
    [x + 0.04, y + seatDepth - 0.04],
    [x + width - 0.04, y + seatDepth - 0.04],
    [x + width - 0.04, y + 0.04],
  ]
    .map(([lx, ly]) => {
      const top = iso(lx!, ly!, 0.14);
      const foot = iso(lx!, ly!);
      return `<path d="M ${top.x.toFixed(2)} ${top.y.toFixed(2)} L ${foot.x.toFixed(2)} ${foot.y.toFixed(2)}" stroke="${p.metalShade}" stroke-width="2"/>`;
    })
    .join("");
  const rails = [
    [x + 0.04, y + 0.04],
    [x + width - 0.04, y + 0.04],
  ]
    .map(([lx, ly]) => {
      const base = iso(lx!, ly!, 0.2);
      const top = iso(lx!, ly!, 0.58);
      return `<path d="M ${base.x.toFixed(2)} ${base.y.toFixed(2)} L ${top.x.toFixed(2)} ${top.y.toFixed(2)}" stroke="${p.metalShade}" stroke-width="2"/>`;
    })
    .join("");
  const shadow = iso(x + width / 2, y + seatDepth / 2);
  return [
    `<ellipse cx="${shadow.x.toFixed(2)}" cy="${shadow.y.toFixed(2)}" rx="6.00" ry="3.00" fill="${p.shadow}" opacity="0.12"/>`,
    legs,
    `<polygon points="${pts(back)}" fill="${p.textile}" stroke="${p.woodEdge}" stroke-width="1.1"/>`,
    rails,
    `<polygon points="${pts(seatEdge)}" fill="${p.woodShade}"/>`,
    `<polygon points="${pts(seat)}" fill="${p.textile}" stroke="${p.woodEdge}" stroke-width="1.2"/>`,
  ].join("");
}

/** Static, state-neutral additions for the opt-in application rendering path. */
function furniturePieces(style: CandidateStyle): Piece[] {
  const p = style.palette;
  const pieces: Piece[] = [];

  for (const agent of AGENTS) {
    if (agent.workArea === "team_area") {
      const x = agent.x + 0.15;
      const y = agent.y + 0.03;
      pieces.push({
        // Tuck the chair beneath its own desktop. The opaque desk surface masks the lower
        // silhouette, leaving the back visible in the clear strip above the nameplate.
        key: depth(agent.x, agent.y) - 0.03,
        svg: furnitureGroup("team-chair", chair(style, x, y), agent.workArea, agent.agentId),
      });
    } else {
      // Keep review sheets on the front-right corner of their own work surface.
      const x = agent.x + 1.72;
      const y = agent.y + 1.1;
      const sheet = [
        iso(x, y, 0.49),
        iso(x + 0.1, y, 0.49),
        iso(x + 0.1, y + 0.06, 0.49),
        iso(x, y + 0.06, 0.49),
      ];
      const paper = `<polygon points="${pts(sheet)}" fill="${p.paper}" stroke="${p.woodEdge}" stroke-width="0.65"/>`;
      pieces.push({
        key: depth(x, y) + 0.02,
        svg: furnitureGroup("review-papers", paper, agent.workArea, agent.agentId),
      });
    }
  }

  const collab = PROPS.find(({ kind }) => kind === "collabTable");
  if (collab) {
    const legs = [
      [0.12, 0.12],
      [2.56, 0.12],
      [0.12, 1.8],
      [2.56, 1.8],
    ]
      .map(([x, y]) =>
        box(style, collab.x + x!, collab.y + y!, 0.12, 0.12, 0.36, p.metalShade, p.woodEdge),
      )
      .join("");
    pieces.push({
      key: depth(collab.x, collab.y) + 0.02,
      svg: furnitureGroup(
        "collab-table-edge",
        `${legs}${slab(style, collab.x, collab.y, 2.8, 2, 0.36, 0.46, p.wood, p.woodEdge)}`,
        collab.zone,
        "collaboration-table",
      ),
    });
  }

  const chairs: Array<[number, number]> = [
    [13.25, 7.2],
    [16.95, 7.2],
    [13.25, 8.25],
    [16.95, 8.25],
  ];
  for (const [index, [x, y]] of chairs.entries()) {
    pieces.push({
      key: depth(x, y) + 0.02,
      svg: furnitureGroup(
        "collab-chair",
        chair(style, x, y),
        "collaboration_table",
        `chair-${index + 1}`,
      ),
    });
  }

  const shelf = PROPS.find(({ kind }) => kind === "shelf");
  if (shelf) {
    const books = Array.from({ length: 8 }, (_, index) => {
      const rowIndex = index % 4;
      const y = shelf.y + 0.08 + rowIndex * 0.38;
      const z0 = index < 4 ? 0.18 + (rowIndex % 2) * 0.02 : 0.62 + (rowIndex % 2) * 0.02;
      const z1 = index < 4 ? 0.61 - (rowIndex % 3) * 0.035 : 1.08 - (rowIndex % 3) * 0.035;
      const front = shelf.x + 0.58;
      const polygon = [
        iso(front, y, z1),
        iso(front, y + 0.3, z1),
        iso(front, y + 0.3, z0),
        iso(front, y, z0),
      ];
      const colors = [p.textile, p.plaster, p.woodShade, p.paper];
      return `<polygon points="${pts(polygon)}" fill="${colors[index % colors.length]}" stroke="${p.woodEdge}" stroke-width="0.45"/>`;
    }).join("");
    pieces.push({
      key: depth(shelf.x, shelf.y) + 0.02,
      svg: furnitureGroup("shelf-books", books, shelf.zone, "library-shelf"),
    });
    const compartments = [0.14, 0.59]
      .map((z) => {
        const plank = [
          iso(shelf.x + 0.56, shelf.y + 0.04, z),
          iso(shelf.x + 0.6, shelf.y + 0.04, z),
          iso(shelf.x + 0.6, shelf.y + 1.66, z),
          iso(shelf.x + 0.56, shelf.y + 1.66, z),
        ];
        return `<polygon points="${pts(plank)}" fill="${p.woodShade}" stroke="${p.woodEdge}" stroke-width="0.7"/>`;
      })
      .join("");
    pieces.push({
      key: depth(shelf.x, shelf.y) + 0.03,
      svg: furnitureGroup("shelf-compartment", compartments, shelf.zone, "library-shelf"),
    });
  }

  const reception = PROPS.find(({ kind }) => kind === "receptionCounter");
  if (reception) {
    const a = iso(reception.x + 0.08, reception.y + 0.81, 0.58);
    const b = iso(reception.x + 1.82, reception.y + 0.81, 0.58);
    pieces.push({
      key: depth(reception.x, reception.y) + 0.02,
      svg: furnitureGroup(
        "reception-edge",
        `<path d="M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}" fill="none" stroke="${p.plasterShade}" stroke-width="2.2"/>`,
        reception.zone,
        "reception-counter",
      ),
    });
  }

  const manager = PROPS.find(({ kind }) => kind === "managerDesk");
  if (manager) {
    const supports = [
      [0.1, 0.08],
      [2.2, 0.08],
      [0.1, 1.12],
      [2.2, 1.12],
    ]
      .map(([x, y]) =>
        box(style, manager.x + x!, manager.y + y!, 0.12, 0.12, 0.42, p.metalShade, p.woodEdge),
      )
      .join("");
    pieces.push({
      key: depth(manager.x, manager.y) + 0.02,
      svg: furnitureGroup(
        "manager-edge",
        `${supports}${slab(style, manager.x, manager.y, 2.4, 1.3, 0.42, 0.5, p.wood, p.woodEdge)}`,
        manager.zone,
        "manager-desk",
      ),
    });
  }

  for (const crate of PROPS.filter(({ kind }) => kind === "crate")) {
    pieces.push({
      key: depth(crate.x, crate.y) + 0.02,
      svg: furnitureGroup(
        "delivery-tray",
        `${box(style, crate.x, crate.y, 0.85, 0.85, 0.12, p.wood, p.woodEdge)}<polygon points="${pts([iso(crate.x + 0.12, crate.y + 0.12, 0.14), iso(crate.x + 0.73, crate.y + 0.12, 0.14), iso(crate.x + 0.73, crate.y + 0.73, 0.14), iso(crate.x + 0.12, crate.y + 0.73, 0.14)])}" fill="${p.paper}" stroke="${p.woodEdge}" stroke-width="0.55"/>`,
        crate.zone,
        `tray-${crate.x}-${crate.y}`,
      ),
    });
  }

  const rug = PROPS.find(({ kind }) => kind === "rug");
  if (rug) {
    const footprint = [
      iso(rug.x - 1.6, rug.y - 1.2),
      iso(rug.x + 1.6, rug.y - 1.2),
      iso(rug.x + 1.6, rug.y + 1.2),
      iso(rug.x - 1.6, rug.y + 1.2),
    ];
    pieces.push({
      key: -1,
      svg: furnitureGroup(
        "rug-surface",
        `<polygon points="${pts(footprint)}" fill="${p.textile}" opacity="0.6"/>`,
        rug.zone,
        "team-rug",
      ),
    });
    const seamStart = iso(6.9, 8.1);
    const seamEnd = iso(7.05, 8.1);
    pieces.push({
      key: -0.5,
      svg: furnitureGroup(
        "rug-detail",
        `<path d="M ${seamStart.x.toFixed(2)} ${seamStart.y.toFixed(2)} L ${seamEnd.x.toFixed(2)} ${seamEnd.y.toFixed(2)}" fill="none" stroke="${p.paper}" stroke-width="1.2" opacity="0.48"/>`,
        rug.zone,
        "team-rug",
      ),
    });
  }

  for (const plant of PROPS.filter(({ kind }) => kind === "plant")) {
    const isTeamFoliage = plant.x === 11.4;
    const isReleaseFoliage = plant.x === 17.2;
    const centre = iso(
      plant.x + (isTeamFoliage ? 0.2 : 0),
      plant.y + (isTeamFoliage ? -0.2 : 0),
      isTeamFoliage ? 0.8 : isReleaseFoliage ? 0.6 : 0.8,
    );
    const leaves = [
      `<ellipse cx="${(centre.x - 2).toFixed(2)}" cy="${(centre.y + 1).toFixed(2)}" rx="2.3" ry="3.4" transform="rotate(-32 ${(centre.x - 2).toFixed(2)} ${(centre.y + 1).toFixed(2)})" fill="${p.greeneryShade}"/>`,
      `<ellipse cx="${(centre.x + 2).toFixed(2)}" cy="${(centre.y + 1).toFixed(2)}" rx="2.3" ry="3.4" transform="rotate(34 ${(centre.x + 2).toFixed(2)} ${(centre.y + 1).toFixed(2)})" fill="${p.greenery}"/>`,
      `<ellipse cx="${centre.x.toFixed(2)}" cy="${(centre.y - 2).toFixed(2)}" rx="2.1" ry="3.5" fill="${p.greenery}"/>`,
    ].join("");
    pieces.push({
      key: depth(plant.x, plant.y) + 0.025,
      svg: furnitureGroup("plant-leaves", leaves, plant.zone, `plant-${plant.x}-${plant.y}`),
    });
  }

  return pieces;
}

function propPiece(style: CandidateStyle, prop: Prop): Piece | null {
  if (prop.density === "warm" && !style.includeWarmProps) return null;
  const p = style.palette;
  const parts: string[] = [];
  switch (prop.kind) {
    case "plant": {
      parts.push(contact(style, prop.x - 0.3, prop.y - 0.3, 0.6, 0.6));
      parts.push(box(style, prop.x - 0.22, prop.y - 0.22, 0.44, 0.44, 0.3, p.wood, p.woodEdge));
      const crown = iso(prop.x, prop.y, 0.72);
      parts.push(
        `<ellipse cx="${crown.x.toFixed(2)}" cy="${crown.y.toFixed(2)}" rx="${(TILE * 0.3).toFixed(2)}" ry="${(TILE * 0.34).toFixed(2)}" fill="${p.greenery}"/>`,
        `<ellipse cx="${(crown.x - 5).toFixed(2)}" cy="${(crown.y + 5).toFixed(2)}" rx="${(TILE * 0.18).toFixed(2)}" ry="${(TILE * 0.2).toFixed(2)}" fill="${p.greeneryShade}"/>`,
      );
      break;
    }
    case "shelf":
      parts.push(contact(style, prop.x, prop.y, 0.65, 1.7));
      parts.push(box(style, prop.x, prop.y, 0.6, 1.7, 1.25, p.wood, p.woodEdge));
      break;
    case "cabinet":
      parts.push(contact(style, prop.x, prop.y, 0.65, 1.2));
      parts.push(box(style, prop.x, prop.y, 0.6, 1.2, 0.8, p.metal, shade(p.metal, -0.4)));
      break;
    case "lamp": {
      parts.push(contact(style, prop.x - 0.2, prop.y - 0.2, 0.4, 0.4));
      parts.push(
        box(style, prop.x - 0.08, prop.y - 0.08, 0.16, 0.16, 1.5, p.metal, shade(p.metal, -0.4)),
      );
      const bulb = iso(prop.x, prop.y, 1.62);
      if (style.practicalGlow > 0) {
        parts.push(
          `<circle cx="${bulb.x.toFixed(2)}" cy="${bulb.y.toFixed(2)}" r="${style.practicalGlow}" fill="${p.attentionSoft}" opacity="0.3" filter="url(#glow-${style.candidateId})"/>`,
        );
      }
      parts.push(
        `<ellipse cx="${bulb.x.toFixed(2)}" cy="${bulb.y.toFixed(2)}" rx="${(TILE * 0.3).toFixed(2)}" ry="${(TILE * 0.16).toFixed(2)}" fill="${p.plaster}"/>`,
      );
      break;
    }
    case "stool":
      parts.push(contact(style, prop.x - 0.25, prop.y - 0.25, 0.5, 0.5));
      parts.push(box(style, prop.x - 0.25, prop.y - 0.25, 0.5, 0.5, 0.46, p.textile, p.woodEdge));
      break;
    case "crate":
      parts.push(contact(style, prop.x, prop.y, 0.9, 0.9));
      parts.push(box(style, prop.x, prop.y, 0.85, 0.85, 0.6, p.paper, p.woodEdge));
      break;
    case "managerDesk":
      parts.push(contact(style, prop.x - 0.1, prop.y - 0.1, 2.6, 1.6));
      parts.push(box(style, prop.x, prop.y, 2.4, 1.3, 0.46, p.wood, p.woodEdge));
      parts.push(
        box(style, prop.x + 1.5, prop.y + 0.25, 0.7, 0.12, 0.95, p.metal, shade(p.metal, -0.4)),
      );
      break;
    case "collabTable":
      parts.push(contact(style, prop.x - 0.1, prop.y - 0.1, 3, 2.2));
      parts.push(box(style, prop.x, prop.y, 2.8, 2, 0.44, p.wood, p.woodEdge));
      break;
    case "receptionCounter":
      parts.push(contact(style, prop.x - 0.1, prop.y - 0.1, 2.1, 1));
      parts.push(box(style, prop.x, prop.y, 1.9, 0.8, 0.72, p.plaster, p.woodEdge));
      break;
    case "rug":
      parts.push(
        `<polygon points="${pts([iso(prop.x - 1.6, prop.y - 1.2), iso(prop.x + 1.6, prop.y - 1.2), iso(prop.x + 1.6, prop.y + 1.2), iso(prop.x - 1.6, prop.y + 1.2)])}" fill="${p.textile}" opacity="0.6"/>`,
      );
      break;
    case "board":
      parts.push(contact(style, prop.x, prop.y, 1.1, 0.2));
      parts.push(box(style, prop.x, prop.y, 1.1, 0.12, 0.95, p.plaster, p.woodEdge));
      break;
  }
  return { key: depth(prop.x, prop.y), svg: parts.join("") };
}

/** The work item itself, shaped by its state. Only drawn when a scene state is supplied. */
function workCardPiece(style: CandidateStyle, state: string): Piece | null {
  const at = workZone(state);
  if (!at) return null;
  const p = style.palette;
  const raised = state === "active";
  const outlineOnly = ["draft", "cancelled"].includes(state);
  const half = state === "paused";
  const h = half ? 0.22 : raised ? 0.66 : 0.44;
  const parts: string[] = [contact(style, at.x, at.y, 0.9, 0.7)];
  const top = [
    iso(at.x, at.y, h),
    iso(at.x + 0.85, at.y, h),
    iso(at.x + 0.85, at.y + 0.65, h),
    iso(at.x, at.y + 0.65, h),
  ];
  if (outlineOnly) {
    parts.push(
      `<polygon points="${pts(top)}" fill="none" stroke="${p.inkMuted}" stroke-width="1.6" stroke-dasharray="3 2"/>`,
    );
  } else {
    parts.push(box(style, at.x, at.y, 0.85, 0.65, h, p.paper, p.woodEdge));
  }
  const centre = iso(at.x + 0.42, at.y + 0.32, h);
  if (state === "blocked") {
    parts.push(
      `<rect x="${(centre.x - 13).toFixed(2)}" y="${(centre.y - 2.4).toFixed(2)}" width="26" height="4.8" rx="1" fill="${p.metal}"/>`,
    );
  } else if (state === "waiting_input") {
    parts.push(
      `<text x="${centre.x.toFixed(2)}" y="${(centre.y + 4).toFixed(2)}" text-anchor="middle" font-family="${style.typography.display}" font-size="12" font-weight="700" fill="${p.attention}">?</text>`,
    );
  } else if (state === "verified") {
    parts.push(
      `<path d="M ${(centre.x - 7).toFixed(2)} ${centre.y.toFixed(2)} l 4.5 4.5 l 9 -9" fill="none" stroke="${p.greenery}" stroke-width="2.6"/>`,
    );
  } else if (state === "failed") {
    parts.push(
      `<path d="M ${(centre.x - 7).toFixed(2)} ${(centre.y - 5).toFixed(2)} l 14 10 M ${(centre.x + 7).toFixed(2)} ${(centre.y - 5).toFixed(2)} l -14 10" fill="none" stroke="${p.metal}" stroke-width="2.4"/>`,
    );
  } else if (state === "cancelled") {
    parts.push(
      `<line x1="${(centre.x - 12).toFixed(2)}" y1="${centre.y.toFixed(2)}" x2="${(centre.x + 12).toFixed(2)}" y2="${centre.y.toFixed(2)}" stroke="${p.inkMuted}" stroke-width="2.2"/>`,
    );
  }
  return { key: depth(at.x, at.y) + 0.3, svg: parts.join("") };
}

/** A wall: plaster faces, a defining edge; a front stub shows its cut top in charcoal (Task 5). */
function wallSvg(style: CandidateStyle, wall: WallBox): string {
  const p = style.palette;
  const faces = box(
    style,
    wall.x,
    wall.y,
    wall.w,
    wall.d,
    wall.h,
    p.plaster,
    shade(p.plaster, -0.35),
    WALL_FACE_SHADING,
  );
  if (wall.kind === "back") return faces;
  const cut = [
    iso(wall.x, wall.y, wall.h),
    iso(wall.x + wall.w, wall.y, wall.h),
    iso(wall.x + wall.w, wall.y + wall.d, wall.h),
    iso(wall.x, wall.y + wall.d, wall.h),
  ];
  return `${faces}<polygon data-wall-cut-cap="true" points="${pts(cut)}" fill="${p.metal}"/>`;
}

/** The window wall's panes: glass, a charcoal frame and one mullion, on the wall's inner face. */
function windowsSvg(style: CandidateStyle): string {
  const p = style.palette;
  const frame = shade(p.metal, -0.4);
  return WINDOWS.map((pane) => {
    const y = WINDOW_WALL_Y;
    const quad = [
      iso(pane.x0, y, pane.z1),
      iso(pane.x1, y, pane.z1),
      iso(pane.x1, y, pane.z0),
      iso(pane.x0, y, pane.z0),
    ];
    const mid = (pane.x0 + pane.x1) / 2;
    const top = iso(mid, y, pane.z1);
    const bottom = iso(mid, y, pane.z0);
    return [
      `<polygon points="${pts(quad)}" fill="${p.glass}" stroke="${frame}" stroke-width="1.6" stroke-linejoin="round"/>`,
      `<line x1="${top.x.toFixed(2)}" y1="${top.y.toFixed(2)}" x2="${bottom.x.toFixed(2)}" y2="${bottom.y.toFixed(2)}" stroke="${frame}" stroke-width="1.2"/>`,
    ].join("");
  }).join("");
}

/** Baked daylight: each window's light on the floor, soft and fixed (F-6). */
function daylightSvg(style: CandidateStyle): string {
  const gradientId = `daylight-${style.candidateId}`;
  const gradient = `<defs><radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="${style.palette.plaster}" stop-opacity="0.28"/><stop offset="65%" stop-color="${style.palette.plaster}" stop-opacity="0.12"/><stop offset="100%" stop-color="${style.palette.plaster}" stop-opacity="0"/></radialGradient></defs>`;
  const patches = daylightPatches()
    .map(
      (patch) =>
        `<polygon points="${pts(patch.map(({ x, y }) => iso(x, y)))}" fill="url(#${gradientId})"/>`,
    )
    .join("");
  return `${gradient}${patches}`;
}

/** Options for the scene layer the app draws (Phase 7 Task 3b). */
export type SceneLayerOptions = {
  /** Phase 6 baked zone and person labels. The app labels in the DOM instead (ruling G-3). */
  labels: boolean;
  /** Phase 6's fixed figures. The app draws none until the behaviour map drives them (G-2). */
  figures: boolean;
  /** Phase 7 Task 5: walls, the window wall and baked daylight. Off for the frozen frame. */
  architecture?: boolean;
  /** Phase 7 Task 6: static furnishings and floor materials. Off in every frozen composition. */
  furniture?: boolean;
  scene?: SceneState;
};

/** The shared filters the scene layer references, as the frozen frame declares them. */
export function renderSceneDefs(style: CandidateStyle): string {
  return `<filter id="soft-${style.candidateId}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${style.shadow.blur}"/></filter>
    <filter id="glow-${style.candidateId}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="12"/></filter>`;
}

/**
 * The scene in world coordinates (`iso` pixels), unframed. With labels and figures it is exactly
 * the body of the frozen comparison frame; the app asks for neither (rulings G-2, G-3).
 */
export function renderSceneLayer(style: CandidateStyle, options: SceneLayerOptions): string {
  const scene = options.scene ?? DEFAULT_SCENE_STATE;
  const pieces: Piece[] = [];
  if (options.furniture) pieces.push(...furniturePieces(style));
  for (const agent of AGENTS) {
    pieces.push(options.furniture ? furnishedDeskPiece(style, agent) : deskPiece(style, agent));
    if (options.figures) pieces.push(figurePiece(style, agent, scene));
  }
  if (scene.work) {
    const card = workCardPiece(style, scene.work.state);
    if (card) pieces.push(card);
  }
  if ((scene.collaborationParticipants?.length ?? 0) > 0) {
    // The shared artifact, on the collaboration table the descriptor's zone names.
    const cx = 14.9;
    const cy = 6.7;
    pieces.push({
      key: depth(cx, cy) + 0.3,
      svg: [
        contact(style, cx, cy, 0.8, 0.6),
        box(style, cx, cy, 0.75, 0.55, 0.52, style.palette.paper, style.palette.woodEdge),
      ].join(""),
    });
  }
  for (const prop of PROPS) {
    if (
      options.furniture &&
      (prop.kind === "stool" ||
        prop.kind === "crate" ||
        prop.kind === "rug" ||
        prop.kind === "collabTable" ||
        prop.kind === "managerDesk")
    )
      continue;
    const piece = propPiece(style, prop);
    if (piece) pieces.push(piece);
  }
  pieces.sort((left, right) => left.key - right.key);
  const backWalls = WALLS.filter(({ kind }) => kind === "back")
    .map((wall) => wallSvg(style, wall))
    .join("");
  const frontWalls = WALLS.filter(({ kind }) => kind === "front")
    .map((wall) => wallSvg(style, wall))
    .join("");
  return [
    floorPlane(style),
    ...(options.furniture ? [floorSeams(style)] : []),
    ...(options.architecture
      ? [
          `<g data-arch="back">${backWalls}${windowsSvg(style)}</g>`,
          `<g data-arch="daylight">${daylightSvg(style)}</g>`,
        ]
      : []),
    ...(options.labels ? [zoneLabels(style)] : []),
    pieces.map((piece) => piece.svg).join("\n    "),
    ...(options.architecture ? [`<g data-arch="front">${frontWalls}</g>`] : []),
  ].join("\n    ");
}

export function renderComposition(
  style: CandidateStyle,
  width: number,
  height: number,
  scene: SceneState = DEFAULT_SCENE_STATE,
): string {
  const extent = floorExtent();
  const sceneWidth = extent.maxX - extent.minX;
  const sceneHeight = extent.maxY - extent.minY + style.plinth;
  const scale = Math.min((width - 96) / sceneWidth, (height - 150) / sceneHeight);
  const offsetX = width / 2 - (extent.minX + sceneWidth / 2) * scale;
  const offsetY = 96 - extent.minY * scale;

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeText(style.name)} candidate: the frozen Phase 6 default-office comparison frame">
  <defs>
    ${renderSceneDefs(style)}
  </defs>
  <rect width="${width}" height="${height}" fill="${style.palette.sceneGround}"/>
  <g transform="translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) scale(${scale.toFixed(4)})">
    ${renderSceneLayer(style, { labels: true, figures: true, scene })}
  </g>
</svg>`;
}
