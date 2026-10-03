/**
 * The three candidate styles.
 *
 * Every field here is a *treatment*: colour, edge, shadow, density, lighting. Nothing here can move
 * a desk, add an agent, or change a label — that lives in `geometry.ts` and is
 * shared. The brief's three comparative emphases survive because the styles are the only variable.
 *
 * Amber is a single reserved accent in all three. It marks manager attention and focus only, never
 * role identity, never severity, never decoration. That constraint is approved
 * (`.ui-craft/tokens.md`) and none of these candidates reopens it.
 */

export type CandidateStyle = {
  candidateId: string;
  name: string;
  emphasis: string;
  namedRisk: string;
  /** Semantic palette. Keys are roles in the scene, not raw colour names. */
  palette: {
    pageGround: string;
    sceneGround: string;
    floorBase: string;
    floorZoneA: string;
    floorZoneB: string;
    zoneEdge: string;
    plaster: string;
    plasterShade: string;
    wood: string;
    woodShade: string;
    woodEdge: string;
    metal: string;
    metalShade: string;
    textile: string;
    greenery: string;
    greeneryShade: string;
    paper: string;
    glass: string;
    figure: string;
    figureShade: string;
    /** The one reserved accent. */
    attention: string;
    attentionSoft: string;
    ink: string;
    inkMuted: string;
    shadow: string;
  };
  /** Stroke width on solid faces. 0 means no outline. */
  edgeWidth: number;
  /** Contact-shadow treatment under objects and figures. */
  shadow: { blur: number; opacity: number; spread: number };
  /** Whether `warm`-density props are drawn. */
  includeWarmProps: boolean;
  /** Visible plinth thickness under the floor, in px. 0 means the floor sits flush. */
  plinth: number;
  /** Top-face lightening applied to lit surfaces, 0–1. */
  lift: number;
  /** Practical lamp glow radius, 0 for none. */
  practicalGlow: number;
  typography: { display: string; mono: string; labelWeight: number; labelSize: number };
};

const SHARED_TYPE = {
  display:
    "'Iowan Old Style', 'Palatino Linotype', 'Segoe UI', -apple-system, system-ui, sans-serif",
  mono: "'Cascadia Mono', 'Consolas', 'SF Mono', ui-monospace, monospace",
};

export const CANDIDATE_A: CandidateStyle = {
  candidateId: "candidate-a-architectural-clarity",
  name: "Architectural clarity",
  emphasis:
    "Strong floor-plane zoning, clean silhouettes, restrained props, and immediate role and location comprehension.",
  namedRisk: "Becoming sterile or diagrammatic.",
  palette: {
    pageGround: "#eceae5",
    sceneGround: "#e4e1da",
    floorBase: "#dcd8cf",
    floorZoneA: "#d3cec3",
    floorZoneB: "#e6e2d9",
    zoneEdge: "#b3ab9b",
    plaster: "#f4f2ed",
    plasterShade: "#ddd9d0",
    wood: "#cbb392",
    woodShade: "#b09874",
    woodEdge: "#95815f",
    metal: "#6f7377",
    metalShade: "#55585c",
    textile: "#9fa79c",
    greenery: "#64765e",
    greeneryShade: "#63785d",
    paper: "#fbfaf7",
    glass: "#d7e1e3",
    figure: "#6e7276",
    figureShade: "#6e7378",
    attention: "#a56419",
    attentionSoft: "#f0d9b6",
    ink: "#2f2e2b",
    inkMuted: "#595751",
    shadow: "#8d877b",
  },
  edgeWidth: 1.1,
  shadow: { blur: 1.5, opacity: 0.16, spread: 1 },
  includeWarmProps: false,
  plinth: 0,
  lift: 0.06,
  practicalGlow: 0,
  typography: { ...SHARED_TYPE, labelWeight: 600, labelSize: 12 },
};

export const CANDIDATE_B: CandidateStyle = {
  candidateId: "candidate-b-human-studio-warmth",
  name: "Human studio warmth",
  emphasis:
    "Muted textiles, individual desk objects, soft practical lighting, and agent-authored identity details.",
  namedRisk: "Visual noise, or false anthropomorphic sentiment.",
  palette: {
    pageGround: "#f2ece2",
    sceneGround: "#efe7d9",
    floorBase: "#e7dccb",
    floorZoneA: "#e0d3be",
    floorZoneB: "#efe6d6",
    zoneEdge: "#cbb99e",
    plaster: "#f8f3ea",
    plasterShade: "#e6dccd",
    wood: "#d2b183",
    woodShade: "#b49062",
    woodEdge: "#9a7749",
    metal: "#7b7368",
    metalShade: "#605950",
    textile: "#b08a72",
    greenery: "#687e5c",
    greeneryShade: "#647c57",
    paper: "#fdfbf6",
    glass: "#dde6e2",
    figure: "#7f766b",
    figureShade: "#776d62",
    attention: "#ab6819",
    attentionSoft: "#f6e2c0",
    ink: "#332e27",
    inkMuted: "#625b51",
    shadow: "#9c8a72",
  },
  edgeWidth: 0,
  shadow: { blur: 5, opacity: 0.2, spread: 2 },
  includeWarmProps: true,
  plinth: 0,
  lift: 0.1,
  practicalGlow: 46,
  typography: { ...SHARED_TYPE, labelWeight: 500, labelSize: 12 },
};

export const CANDIDATE_C: CandidateStyle = {
  candidateId: "candidate-c-miniature-craft-precision",
  name: "Miniature craft precision",
  emphasis:
    "Material edges, contained depth, contact shadows, carefully staged objects, and model-like spatial coherence.",
  namedRisk: "Reading as a toy, a diorama, or a game rather than a serious work environment.",
  palette: {
    pageGround: "#e8e5de",
    sceneGround: "#ded9cf",
    floorBase: "#d9d2c4",
    floorZoneA: "#cec6b5",
    floorZoneB: "#e3ddd0",
    zoneEdge: "#a89d88",
    plaster: "#f6f3ec",
    plasterShade: "#d8d2c6",
    wood: "#c9a778",
    woodShade: "#a5814f",
    woodEdge: "#7d5f34",
    metal: "#686c70",
    metalShade: "#4a4d51",
    textile: "#98a08f",
    greenery: "#5f7356",
    greeneryShade: "#546b4b",
    paper: "#fcfaf4",
    glass: "#d4dee0",
    figure: "#726b62",
    figureShade: "#6a635a",
    attention: "#9f5d12",
    attentionSoft: "#efd6ac",
    ink: "#2b2924",
    inkMuted: "#57524c",
    shadow: "#6f6553",
  },
  edgeWidth: 0.9,
  shadow: { blur: 1, opacity: 0.34, spread: 0.5 },
  includeWarmProps: true,
  plinth: 14,
  lift: 0.14,
  practicalGlow: 26,
  typography: { ...SHARED_TYPE, labelWeight: 600, labelSize: 11.5 },
};

export const CANDIDATE_STYLES = [CANDIDATE_A, CANDIDATE_B, CANDIDATE_C];

/**
 * The Task 8 reconciliation: base Candidate B, with three clarity traits imported from Candidate A.
 *
 * Kept separate from `CANDIDATE_STYLES` on purpose. The three candidates are the artifacts the Task
 * 7 review scored; editing one of them into this would leave that review pointing at something that
 * no longer exists. Retained and imported traits are named in
 * `docs/evidence/phase-6/decision-record-2026-09-13-task-8-selection.md`.
 *
 * Retained from B: warm palette, textiles, full warm-density props, practical lighting, soft lift.
 * Imported from A: a defining edge on solid faces, a grounded contact shadow, stronger floor-zone
 * separation. Deliberately not imported: A's prop restraint — the clarity problem is definition, not
 * object count, and removing props would remove the warmth that made B strongest.
 */
export const RECONCILIATION_B_CLARITY: CandidateStyle = {
  ...CANDIDATE_B,
  candidateId: "reconciliation-b-clarity",
  name: "Human studio warmth, clarified",
  emphasis:
    "Candidate B's warmth, with Candidate A's edge definition, grounded shadow, and floor-zone separation imported.",
  namedRisk:
    "Importing edge and zoning definition far enough to answer the clarity note that it acquires A's diagrammatic reading instead.",
  palette: {
    ...CANDIDATE_B.palette,
    // Wider value gap between adjacent zones; darker boundary stroke. Zone legibility is the
    // primary clarity channel and B's weakest.
    floorZoneA: "#d9cbb2",
    floorZoneB: "#f1eade",
    zoneEdge: "#ab9576",
    // Darkened to hold 4.5:1 against the now-darker floor zone A. Measured, not assumed.
    inkMuted: "#585149",
    // Deepening the floor for zone clarity cost the graphical markers their 3:1, so every marker
    // role is re-solved against the new floor rather than inherited from B. Clarity and
    // accessibility are the same adjustment here, not competing ones.
    attention: "#a16218",
    greenery: "#627656",
    figure: "#776f65",
    metal: "#797166",
  },
  // A defining line, well short of A's 1.1: separation without the diagram.
  edgeWidth: 0.7,
  // Objects sit rather than hover. Tightened toward A's 1.5/1 without going flat.
  shadow: { blur: 2.6, opacity: 0.22, spread: 1.2 },
  practicalGlow: 34,
};
