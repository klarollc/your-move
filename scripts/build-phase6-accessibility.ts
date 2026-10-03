import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ACCOMMODATION_CHANGES, FOCUS_INTENT, STATE_TREATMENTS } from "./phase6-accessibility.js";
import { CANDIDATE_STYLES, type CandidateStyle } from "@cuckcode/ui-system/scene";

const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-6/accessibility-report.json");

function luminance(hex: string): number {
  const channel = (index: number): number => {
    const raw = parseInt(hex.replace("#", "").slice(index, index + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Counts what a composition actually renders. The board page claims the 1280x800 view drops
 * nothing; counting both artifacts turns that from a sentence into a measurement, and is the only
 * form of the claim that survives someone later changing the fit logic.
 */
async function countRendered(
  candidateId: string,
  size: string,
): Promise<{ text: number; zoneLabels: number }> {
  const svg = await readFile(
    resolve(ROOT, `docs/evidence/phase-6/candidates/${candidateId}/composition-${size}.svg`),
    "utf8",
  );
  const text = svg.match(/<text\b/gu)?.length ?? 0;
  // Zone labels are the upper-case plated titles; agent labels are mixed case.
  const zoneLabels =
    svg.match(/<text[^>]*>[^<]*<\/text>/gu)?.filter((node) => {
      const body = node.replace(/<[^>]+>/gu, "");
      return body.length > 0 && body === body.toUpperCase() && /[A-Z]/u.test(body);
    }).length ?? 0;
  return { text, zoneLabels };
}

async function candidateReport(style: CandidateStyle) {
  const p = style.palette;
  const roleColour: Record<string, string> = {
    ink: p.ink,
    inkMuted: p.inkMuted,
    attention: p.attention,
    metal: p.metal,
    figure: p.figure,
    greenery: p.greenery,
    textile: p.textile,
  };

  // Every state marker is a graphical object drawn on the floor: SC 1.4.11, 3:1.
  const statePairs = STATE_TREATMENTS.map((treatment) => {
    const colour = roleColour[treatment.paletteRole] ?? p.ink;
    const ratio = contrastRatio(colour, p.floorZoneA);
    return {
      state: `${treatment.family}:${treatment.state}`,
      paletteRole: treatment.paletteRole,
      colour,
      against: p.floorZoneA,
      ratio: Number(ratio.toFixed(2)),
      threshold: 3,
      passes: ratio >= 3,
    };
  });

  const focusRatio = contrastRatio(p.attention, p.sceneGround);
  const wide = await countRendered(style.candidateId, "1440x900");
  const narrow = await countRendered(style.candidateId, "1280x800");

  return {
    candidateId: style.candidateId,
    focus: {
      treatment: FOCUS_INTENT.treatment,
      innerRing: p.attention,
      outerRing: p.sceneGround,
      ratio: Number(focusRatio.toFixed(2)),
      threshold: FOCUS_INTENT.threshold,
      passes: focusRatio >= FOCUS_INTENT.threshold,
    },
    statePairs,
    accommodation: {
      declaredChanges: ACCOMMODATION_CHANGES,
      textCount1440: wide.text,
      textCount1280: narrow.text,
      zoneLabels1440: wide.zoneLabels,
      zoneLabels1280: narrow.zoneLabels,
    },
  };
}

const candidates = [];
for (const style of CANDIDATE_STYLES) candidates.push(await candidateReport(style));

const failing = candidates.flatMap((candidate) => [
  ...candidate.statePairs
    .filter((pair) => !pair.passes)
    .map((pair) => `${candidate.candidateId}/${pair.state}`),
  ...(candidate.focus.passes ? [] : [`${candidate.candidateId}/focus`]),
]);

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      schema: "cuckcode.phase6-accessibility.v1",
      status:
        "Task 6 complete 2026-09-13. Documents accessible treatment and contrast intent. Approves no candidate and promotes nothing.",
      reviewedAt: "2026-09-13",
      note: "State treatments are shared by all three candidates because what a state means is canonical truth; only its colour is art direction. A candidate that distinguished two states by a cue another candidate lacked would be offering a different semantics, not a different look.",
      treatments: STATE_TREATMENTS,
      candidates,
      failing,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({ ok: failing.length === 0, states: STATE_TREATMENTS.length, failing })}\n`,
);
