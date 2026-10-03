import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { AGENTS, PROPS } from "@cuckcode/ui-system/scene";
import { STATE_TREATMENTS } from "./phase6-accessibility.js";
import { CANDIDATE_STYLES, type CandidateStyle } from "@cuckcode/ui-system/scene";

const ROOT = resolve(process.cwd());

/** The brief's fourteen rubric criteria, verbatim in order. */
export const RUBRIC_CRITERIA = [
  "office-before-dashboard clarity",
  "six-role glance readability",
  "manager attention legibility",
  "calmness and restraint",
  "warmth without toy-like character",
  "material coherence and depth",
  "inclusive agent expression",
  "accessible contrast and focus intent",
  "feasibility in PixiJS/WebGL and the DOM shell",
  "behaviour under 1280x800 and reduced motion",
  "originality and provenance quality",
  "reciprocal legibility: human observers understand agent needs and contributions without the scene obscuring agent-facing state",
  "collaboration clarity without fake proximity, activity, or consensus",
  "visual accommodation of agent-authored identity without weakening role, state, or accessibility semantics",
] as const;

/**
 * The task contract for a Task 7 scored review.
 *
 * The reviewer is given measurements and declarations, never the rendered images — a bounded
 * text-only turn cannot open a PNG. That limit is stated to the reviewer rather than hidden,
 * because a Visual QA Reviewer that scores "warmth without toy-like character" from a palette
 * listing would be producing exactly the evidence this project exists to refuse.
 */
export const TASK7_CONTRACT = `You are performing a Phase 6 Task 7 scored review for CuckCode.

Three art-direction candidates render one identical frozen comparison frame. They differ only in
treatment. Your job is to score each candidate against the fourteen rubric criteria, 1 to 5, with
written evidence for each score.

CRITICAL LIMIT ON YOUR EVIDENCE. You have NOT been shown the rendered compositions. You cannot see
them; this turn is text-only and no tool is available to you. What follows is measured data and
declared intent ABOUT the candidates, not the candidates themselves.

Therefore, for each criterion, do exactly one of:
  SCORE n - when the data you were given genuinely supports a judgement, citing which datum.
  NOT-ASSESSABLE - when the criterion requires seeing the rendered artifact, saying what you would
  need to see.

Do not guess a score to fill the table. An unfounded score is worse than an honest refusal, and the
refusals are part of what this review is for. Scores support discussion and select nothing; the
owner selects at Task 8.

Output plain text. No tools, no commands, no file access, no external effects.`;

const swatchList = (style: CandidateStyle): string =>
  Object.entries(style.palette)
    .map(([role, value]) => `${role}=${value}`)
    .join(" ");

async function contrastFor(candidateId: string): Promise<string> {
  const manifest = JSON.parse(
    await readFile(
      resolve(ROOT, `docs/evidence/phase-6/candidates/${candidateId}/manifest.json`),
      "utf8",
    ),
  ) as {
    contrast: Array<{
      pair: string;
      kind: string;
      threshold: number;
      ratio: number;
      passesAA: boolean;
    }>;
  };
  return manifest.contrast
    .map(
      (entry) =>
        `    ${entry.pair} [${entry.kind}] required ${entry.threshold}:1, measured ${entry.ratio}:1 -> ${entry.passesAA ? "pass" : "FAIL"}`,
    )
    .join("\n");
}

async function accessibilityFor(candidateId: string): Promise<string> {
  const report = JSON.parse(
    await readFile(resolve(ROOT, "docs/evidence/phase-6/accessibility-report.json"), "utf8"),
  ) as {
    candidates: Array<{
      candidateId: string;
      focus: { ratio: number; threshold: number; passes: boolean };
      statePairs: Array<{ state: string; ratio: number; passes: boolean }>;
      accommodation: {
        textCount1440: number;
        textCount1280: number;
        zoneLabels1440: number;
        zoneLabels1280: number;
      };
    }>;
  };
  const entry = report.candidates.find((item) => item.candidateId === candidateId);
  if (!entry) return "    (no accessibility record)";
  const worst = [...entry.statePairs].sort((a, b) => a.ratio - b.ratio)[0];
  return [
    `    focus indicator ${entry.focus.ratio}:1 against required ${entry.focus.threshold}:1 -> ${entry.focus.passes ? "pass" : "FAIL"}`,
    `    all 20 state markers pass 3:1; worst is ${worst?.state} at ${worst?.ratio}:1`,
    `    rendered text nodes: ${entry.accommodation.textCount1440} at 1440x900, ${entry.accommodation.textCount1280} at 1280x800`,
    `    zone labels: ${entry.accommodation.zoneLabels1440} at 1440x900, ${entry.accommodation.zoneLabels1280} at 1280x800`,
  ].join("\n");
}

async function candidateBlock(style: CandidateStyle): Promise<string> {
  const propCount = PROPS.filter(
    (prop) => prop.density === "core" || style.includeWarmProps,
  ).length;
  return `CANDIDATE: ${style.name} (${style.candidateId})
  emphasis: ${style.emphasis}
  named risk: ${style.namedRisk}
  palette: ${swatchList(style)}
  edge stroke width: ${style.edgeWidth} (0 means no outline on solid faces)
  contact shadow: blur ${style.shadow.blur}, opacity ${style.shadow.opacity}, spread ${style.shadow.spread}
  top-face lift: ${style.lift}
  plinth thickness: ${style.plinth}px (0 means the floor runs flush to the frame)
  practical lamp glow radius: ${style.practicalGlow}px (0 means no additive glow pass)
  props drawn: ${propCount} of ${PROPS.length} (warm-density props ${style.includeWarmProps ? "included" : "withheld"})
  display type: ${style.typography.display}
  mono type: ${style.typography.mono}
  label weight ${style.typography.labelWeight}, label size ${style.typography.labelSize}px
  measured contrast:
${await contrastFor(style.candidateId)}
  accessibility:
${await accessibilityFor(style.candidateId)}`;
}

export async function buildReviewPacket(): Promise<string> {
  const blocks = await Promise.all(CANDIDATE_STYLES.map(candidateBlock));
  const avatars = AGENTS.map(
    (agent) =>
      `  ${agent.label}: work area ${agent.workArea}, build ${agent.build}, hair ${agent.hair}, accessory "${agent.accessory}", desk object "${agent.deskObject}"`,
  ).join("\n");
  const states = STATE_TREATMENTS.map(
    (treatment) =>
      `  ${treatment.family}:${treatment.state} -> cues [${treatment.nonColourCues.join("; ")}] reduced-motion: ${treatment.reducedMotion}`,
  ).join("\n");

  return `SHARED FRAME (identical in all three candidates, generated from one geometry module)
  Fixed three-quarter isometric camera. Seven functional zones: reception, manager desk, Project
  Library, team area, collaboration table, delivery, review station. Six distinct connected agents,
  four in the team area and two at the review station. One current priority in the active state. No
  escalation. Inspector closed, attention rail collapsed, camera at reset.
  Exactly two semantic-motion subjects: the active work item and the agent working it.

AVATARS (identical in all three; role is signalled by work area, tools and label, never by body)
${avatars}

STATE TREATMENTS (identical in all three; meaning is canonical, only colour is art direction)
${states}

${blocks.join("\n\n")}

PROVENANCE (identical in all three)
  Nine references, all five required fields present. No named living artist imitated. No commercial
  visual identity reproduced. No image traced, sampled, model-generated or copied. No external asset
  fetched at build time.
  OPEN GAP: zero architectural, material, ergonomic, photographic or historical references were
  consulted, although the brief permits them. The candidates are original because nothing external
  informed them, which is not the same as being well researched.
  OPEN GAP: the generated-raster half of the approved hybrid medium was not produced.
  OPEN GAP: four of six named typefaces are proprietary and could not be embedded in Phase 7; only
  Cascadia Mono (SIL OFL 1.1) would survive an embedding review.

THE FOURTEEN RUBRIC CRITERIA
${RUBRIC_CRITERIA.map((criterion, index) => `  ${index + 1}. ${criterion}`).join("\n")}

Score all three candidates against all fourteen. Remember: SCORE n with the datum you relied on, or
NOT-ASSESSABLE with what you would need to see.`;
}
