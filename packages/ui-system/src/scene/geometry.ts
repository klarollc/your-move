/**
 * Shared geometry for every Phase 6 candidate composition.
 *
 * The controlled comparison frame requires that candidates differ in art direction and in nothing
 * else. Three hand-built offices would drift — a desk nudged here, an agent moved there — and the
 * drift would be invisible until a reviewer scored one candidate higher for a reason that was not
 * art. So all three are generated from this one module: identical camera, floor plan, zone
 * rectangles, agent placement, labels, and state. A candidate supplies a style, never a layout.
 */

export const TILE = 34;
const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = Math.sin(Math.PI / 6);

export type Point = { x: number; y: number };

/** Fixed three-quarter isometric camera. Candidates may not change it. */
export function iso(x: number, y: number, z = 0): Point {
  return { x: (x - y) * TILE * ISO_X, y: (x + y) * TILE * ISO_Y - z * TILE };
}

export const pts = (points: Point[]): string =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

export type Zone = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
};

/** The brief's required functional zones, placed once. */
export const ZONES: Zone[] = [
  { id: "reception", label: "Reception", x: 0, y: 0, w: 4, d: 4 },
  { id: "manager_desk", label: "Manager desk", x: 13, y: 0, w: 5, d: 4 },
  { id: "project_library", label: "Project Library", x: 0, y: 5, w: 4, d: 5 },
  { id: "team_area", label: "Team area", x: 5, y: 4, w: 7, d: 6 },
  { id: "collaboration_table", label: "Collaboration table", x: 13, y: 5, w: 5, d: 4 },
  { id: "delivery_area", label: "Delivery", x: 4, y: 11, w: 5, d: 3 },
  { id: "review_station", label: "Review station", x: 12, y: 10, w: 6, d: 4 },
];

export type AgentPlacement = {
  roleId: string;
  agentId: string;
  label: string;
  workArea: string;
  /** Desk anchor, in tiles. */
  x: number;
  y: number;
  /** Which way the figure faces; affects the desk, not the camera. */
  facing: "left" | "right";
  /** Silhouette variation. Role is never signalled by body or demographics — only by place and label. */
  build: "tall" | "medium" | "short" | "seated-wheelchair" | "broad" | "slight";
  hair: "cropped" | "coiled" | "long" | "bun" | "locs" | "wrapped";
  /** Two approved-system personalization examples per agent (brief, candidate board item 7). */
  accessory: string;
  deskObject: string;
};

/**
 * Placement matches `PHASE6_ROLE_WORK_AREAS` in the frozen fixture: four roles in the team area,
 * two at the review station. Silhouette and personalization vary across agents so the avatar
 * contract can be judged, and they are deliberately not correlated with role seniority.
 */
export const AGENTS: AgentPlacement[] = [
  {
    roleId: "delivery-lead",
    agentId: "agent_delivery_lead",
    label: "Delivery Lead",
    workArea: "team_area",
    x: 6,
    y: 5,
    facing: "right",
    build: "medium",
    hair: "coiled",
    accessory: "woven lanyard",
    deskObject: "folded paper schedule",
  },
  {
    roleId: "product-designer",
    agentId: "agent_product_designer",
    label: "Product Designer",
    workArea: "team_area",
    x: 9,
    y: 5,
    facing: "left",
    build: "slight",
    hair: "bun",
    accessory: "sleeve of pencils",
    deskObject: "material sample tray",
  },
  {
    roleId: "implementation-engineer",
    agentId: "agent_implementation_engineer",
    label: "Implementation Engineer",
    workArea: "team_area",
    x: 6,
    y: 8,
    facing: "right",
    build: "broad",
    hair: "cropped",
    accessory: "wrist support",
    deskObject: "second monitor riser",
  },
  {
    roleId: "test-engineer",
    agentId: "agent_test_engineer",
    label: "Test Engineer",
    workArea: "team_area",
    x: 9,
    y: 8,
    facing: "left",
    build: "seated-wheelchair",
    hair: "locs",
    accessory: "clip-on task light",
    deskObject: "labelled sample jars",
  },
  {
    roleId: "visual-qa-reviewer",
    agentId: "agent_visual_qa_reviewer",
    label: "Visual QA Reviewer",
    workArea: "review_station",
    x: 13,
    y: 11,
    facing: "right",
    build: "tall",
    hair: "wrapped",
    accessory: "loupe on a cord",
    deskObject: "colour target card",
  },
  {
    roleId: "release-reviewer",
    agentId: "agent_release_reviewer",
    label: "Release Reviewer",
    workArea: "review_station",
    x: 16,
    y: 11,
    facing: "left",
    build: "short",
    hair: "long",
    accessory: "reading glasses",
    deskObject: "stamped sign-off tray",
  },
];

/** The one agent the frozen frame has in `active` presence, working the one current priority. */
export const ACTIVE_AGENT_ID = "agent_implementation_engineer";

export type Prop = { zone: string; x: number; y: number; kind: PropKind; density: "core" | "warm" };
export type PropKind =
  | "plant"
  | "shelf"
  | "lamp"
  | "stool"
  | "crate"
  | "rug"
  | "board"
  | "cabinet"
  | "managerDesk"
  | "collabTable"
  | "receptionCounter";

/**
 * `core` props every candidate draws; `warm` props only candidates whose emphasis calls for higher
 * prop density. Density is a declared style choice, never an accident of who drew more furniture.
 */
export const PROPS: Prop[] = [
  { zone: "reception", x: 0.8, y: 1.4, kind: "receptionCounter", density: "core" },
  { zone: "reception", x: 2.9, y: 2.9, kind: "plant", density: "warm" },
  { zone: "manager_desk", x: 14.2, y: 1.2, kind: "managerDesk", density: "core" },
  { zone: "manager_desk", x: 15.9, y: 0.5, kind: "board", density: "core" },
  { zone: "manager_desk", x: 14.4, y: 2.9, kind: "lamp", density: "warm" },
  { zone: "project_library", x: 1.3, y: 6.2, kind: "shelf", density: "core" },
  { zone: "project_library", x: 1.3, y: 8.3, kind: "cabinet", density: "core" },
  { zone: "project_library", x: 2.9, y: 9.2, kind: "plant", density: "warm" },
  { zone: "team_area", x: 8.4, y: 7.1, kind: "rug", density: "warm" },
  { zone: "team_area", x: 11.4, y: 4.5, kind: "plant", density: "warm" },
  { zone: "collaboration_table", x: 14.2, y: 6, kind: "collabTable", density: "core" },
  { zone: "collaboration_table", x: 13.6, y: 5.4, kind: "stool", density: "core" },
  { zone: "collaboration_table", x: 17.1, y: 7.6, kind: "stool", density: "warm" },
  { zone: "delivery_area", x: 4.6, y: 11.6, kind: "crate", density: "core" },
  { zone: "delivery_area", x: 6.4, y: 12.5, kind: "crate", density: "warm" },
  { zone: "review_station", x: 17.2, y: 13.1, kind: "plant", density: "warm" },
];

export const FLOOR = { x: 0, y: 0, w: 18, d: 14 };

/** Bounding box of the projected floor, used to fit the camera identically in every candidate. */
export function floorExtent(): { minX: number; minY: number; maxX: number; maxY: number } {
  const corners = [
    iso(FLOOR.x, FLOOR.y),
    iso(FLOOR.x + FLOOR.w, FLOOR.y),
    iso(FLOOR.x, FLOOR.y + FLOOR.d),
    iso(FLOOR.x + FLOOR.w, FLOOR.y + FLOOR.d),
  ];
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

/** Painter's-algorithm depth key. Identical ordering in every candidate. */
export const depth = (x: number, y: number): number => x + y;
