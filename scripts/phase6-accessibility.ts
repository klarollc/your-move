/**
 * Accessible treatment for every canonical state, Phase 6 Task 6.
 *
 * The treatments are **shared by all three candidates**, and that is a deliberate claim rather than
 * an economy. What a state means is canonical truth; only how it is coloured is art direction. If
 * Candidate B distinguished `blocked` from `failed` by a cue that Candidate A lacked, the two
 * candidates would differ in what the office can express, and the owner at Task 8 would be choosing
 * a semantics rather than a look.
 *
 * MDD forbids status that relies on colour alone. Every entry therefore carries at least one cue
 * that survives greyscale, and no two states within a family may share an identical cue set — a
 * state that is merely annotated is not the same as a state that is distinguishable.
 */

export type StateTreatment = {
  state: string;
  family: "work" | "agent" | "collaboration";
  /** Cues that survive greyscale: position, shape, occupancy, label, texture. Never hue. */
  nonColourCues: string[];
  /** What the transition into this state does when the viewer has asked for reduced motion. */
  reducedMotion: string;
  /** Which palette role carries this state's colour. Resolved per candidate. */
  paletteRole: "ink" | "inkMuted" | "attention" | "metal" | "figure" | "greenery" | "textile";
};

export const STATE_TREATMENTS: StateTreatment[] = [
  // ---- work states ----
  {
    state: "draft",
    family: "work",
    nonColourCues: ["at the owning desk", "outline-only card", "no evidence tray"],
    reducedMotion: "Card appears at full opacity; no fade.",
    paletteRole: "inkMuted",
  },
  {
    state: "ready",
    family: "work",
    nonColourCues: ["at the owning desk", "filled card", "no assignee marker"],
    reducedMotion: "Fill applies instantly.",
    paletteRole: "inkMuted",
  },
  {
    state: "assigned",
    family: "work",
    nonColourCues: ["at the owning desk", "filled card", "assignee marker present"],
    reducedMotion: "Assignee marker appears without travel.",
    paletteRole: "ink",
  },
  {
    state: "active",
    family: "work",
    nonColourCues: [
      "at the owning desk",
      "raised card",
      "assignee marker present",
      "motion permitted",
    ],
    reducedMotion:
      "Card raises instantly; the permitted motion is suppressed and the raised height carries the state.",
    paletteRole: "attention",
  },
  {
    state: "review_requested",
    family: "work",
    nonColourCues: ["moved to the review station", "card on the review surface"],
    reducedMotion: "Card is drawn at the review station; no travel path is animated.",
    paletteRole: "ink",
  },
  {
    state: "verified",
    family: "work",
    nonColourCues: ["at the review station", "check glyph", "evidence tray filled"],
    reducedMotion: "Glyph appears without transition.",
    paletteRole: "greenery",
  },
  {
    state: "completed",
    family: "work",
    nonColourCues: ["moved to the delivery area", "crate form", "no assignee marker"],
    reducedMotion: "Card is drawn in the delivery area; no travel path is animated.",
    paletteRole: "greenery",
  },
  {
    state: "waiting_input",
    family: "work",
    nonColourCues: ["at the owning desk", "question glyph", "entry in the attention rail"],
    reducedMotion: "Glyph and rail entry appear at full opacity; no pulse.",
    paletteRole: "attention",
  },
  {
    state: "blocked",
    family: "work",
    nonColourCues: [
      "at the owning desk",
      "bar glyph across the card",
      "entry in the attention rail",
    ],
    reducedMotion: "Bar appears without transition; nothing pulses.",
    paletteRole: "metal",
  },
  {
    state: "failed",
    family: "work",
    nonColourCues: [
      "at the owning desk",
      "broken-edge card",
      "entry in the attention rail",
      "evidence tray filled",
    ],
    reducedMotion: "Broken edge is drawn immediately; no shake, ever.",
    paletteRole: "metal",
  },
  {
    state: "paused",
    family: "work",
    nonColourCues: ["at the owning desk", "half-height card", "assignee marker dimmed"],
    reducedMotion: "Height change applies instantly.",
    paletteRole: "inkMuted",
  },
  {
    state: "cancelled",
    family: "work",
    nonColourCues: ["moved to the archive edge", "outline-only card", "strike glyph"],
    reducedMotion: "Card is drawn at the archive edge; no travel path is animated.",
    paletteRole: "inkMuted",
  },
  // ---- agent presences ----
  {
    state: "unavailable",
    family: "agent",
    nonColourCues: ["no figure at the work area", "vacant desk", "name plate only"],
    reducedMotion: "Figure is absent; no departure is animated.",
    paletteRole: "inkMuted",
  },
  {
    state: "idle",
    family: "agent",
    nonColourCues: ["figure at the work area", "upright posture", "no work card"],
    reducedMotion: "No ambient motion in either mode; idle is already still.",
    paletteRole: "figure",
  },
  {
    state: "reserved",
    family: "agent",
    nonColourCues: ["figure at the work area", "upright posture", "work card present, not raised"],
    reducedMotion: "Card appears without transition.",
    paletteRole: "figure",
  },
  {
    state: "active",
    family: "agent",
    nonColourCues: [
      "figure at the work area",
      "attention marker above the figure",
      "raised work card",
      "motion permitted",
    ],
    reducedMotion:
      "Marker appears at full opacity; the permitted motion is suppressed and the marker plus raised card carry the state.",
    paletteRole: "attention",
  },
  {
    state: "waiting",
    family: "agent",
    nonColourCues: [
      "figure at the work area",
      "question glyph above the figure",
      "entry in the attention rail",
    ],
    reducedMotion: "Glyph appears without pulse.",
    paletteRole: "attention",
  },
  {
    state: "blocked",
    family: "agent",
    nonColourCues: [
      "figure at the work area",
      "bar glyph above the figure",
      "entry in the attention rail",
    ],
    reducedMotion: "Bar appears without transition.",
    paletteRole: "metal",
  },
  {
    state: "reviewing",
    family: "agent",
    nonColourCues: [
      "figure at the review station",
      "upright posture",
      "card on the review surface",
    ],
    reducedMotion: "Figure is drawn at the review station; no walk is animated.",
    paletteRole: "figure",
  },
  {
    state: "failed",
    family: "agent",
    nonColourCues: [
      "figure at the work area",
      "broken-edge glyph above the figure",
      "entry in the attention rail",
      "evidence tray filled",
    ],
    reducedMotion: "Glyph is drawn immediately; no shake, ever.",
    paletteRole: "metal",
  },
  // ---- collaboration kinds ----
  // Added 2026-09-13 while building Task 9. Task 6 documented work states and agent presences and
  // stopped there; `projectOfficeScene` emits a third family, and both of its kinds carry
  // semanticMotion. Twenty documented states out of twenty-two is the same guard-inside-an-
  // unexamined-boundary shape this repository keeps recording, found this time by a later task
  // needing the thing the earlier one had not covered.
  {
    state: "collaboration",
    family: "collaboration",
    nonColourCues: [
      "marked at the collaboration table",
      "a shared artifact on the table",
      "a participation marker above each recorded participant, at their own work area",
    ],
    // Corrected 2026-09-13: this first read "participants co-located at the shared surface". The
    // canonical state does not move an agent when a collaboration is recorded, so drawing them
    // gathered would be exactly the fake proximity the brief forbids by name. Participation is
    // marked where the agent actually is.
    reducedMotion:
      "Markers and artifact are drawn in place; no agent is animated moving to the table.",
    paletteRole: "ink",
  },
  {
    state: "handoff",
    family: "collaboration",
    nonColourCues: [
      "spanning two work areas",
      "artifact shown at both endpoints",
      "both participant markers present",
    ],
    reducedMotion: "Both endpoints are drawn; no transit path is animated.",
    paletteRole: "metal",
  },
];

/**
 * What genuinely changes between the two approved viewports. The camera is fixed, so this is a
 * uniform fit rather than a reflow — which is worth stating because a candidate that reflowed would
 * be changing the information hierarchy between viewports and would not be comparable to the others.
 */
export const ACCOMMODATION_CHANGES = [
  "Uniform scale-to-fit: the same scene, the same margins, a smaller scale factor. No reflow.",
  "No zone, agent, label, prop or state marker is dropped, merged or abbreviated.",
  "The camera does not move, rotate, or change its angle; reset view returns to the same position at both sizes.",
  "Label plates keep their pixel size relative to the scene, so text scales with the composition rather than staying fixed and crowding it.",
  "The accessible Office outline is unchanged at both viewports; it is not a function of scale.",
];

/** Focus indicator, shared across candidates for the same reason the state treatments are. */
export const FOCUS_INTENT = {
  treatment:
    "A two-layer ring on the focused subject: an inner ring in the reserved accent and an outer ring in the scene ground, so the indicator holds against both the floor and any object it may sit on. Focus is never carried by fill alone, never by the absence of a ring on other subjects, and never shares its treatment with the attention marker — attention says the work needs you, focus says the keyboard is here.",
  /** WCAG 2.2 SC 1.4.11: non-text contrast, 3:1. */
  threshold: 3,
};
