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
function box(
  style: CandidateStyle,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  base: string,
  edge: string,
): string {
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const left = [iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)];
  const right = [iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)];
  const stroke =
    style.edgeWidth > 0
      ? ` stroke="${edge}" stroke-width="${style.edgeWidth}" stroke-linejoin="round"`
      : "";
  return [
    `<polygon points="${pts(left)}" fill="${shade(base, -0.22)}"${stroke}/>`,
    `<polygon points="${pts(right)}" fill="${shade(base, -0.1)}"${stroke}/>`,
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

  const pieces: Piece[] = [];
  for (const agent of AGENTS) {
    pieces.push(deskPiece(style, agent), figurePiece(style, agent, scene));
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
    const piece = propPiece(style, prop);
    if (piece) pieces.push(piece);
  }
  pieces.sort((left, right) => left.key - right.key);

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeText(style.name)} candidate: the frozen Phase 6 default-office comparison frame">
  <defs>
    <filter id="soft-${style.candidateId}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${style.shadow.blur}"/></filter>
    <filter id="glow-${style.candidateId}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="12"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${style.palette.sceneGround}"/>
  <g transform="translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) scale(${scale.toFixed(4)})">
    ${floorPlane(style)}
    ${zoneLabels(style)}
    ${pieces.map((piece) => piece.svg).join("\n    ")}
  </g>
</svg>`;
}
