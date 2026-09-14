import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { phase6ComparisonFixtureDigest } from "@cuckcode/testing";

import { STATE_TREATMENTS } from "./phase6-accessibility.js";
import { renderComposition } from "./phase6-candidate-render.js";
import { CANDIDATE_B, RECONCILIATION_B_CLARITY } from "./phase6-candidate-styles.js";

/**
 * Builds the Task 8 reconciliation and re-measures it.
 *
 * It is written to its own directory, not alongside the three candidates. The Task 1 guard requires
 * every candidate manifest on disk to be registered in the frozen fixture, and the reconciliation is
 * not a fourth candidate — it is the outcome of the owner's ruling on the three.
 *
 * Every contrast result established in Tasks 2-6 is recomputed here rather than inherited. The
 * reconciliation changes floor values, edges and shadows, all of which move measured contrast, and
 * an inherited pass would be a claim about the candidate it came from.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-6/reconciliation");
const DIGEST = phase6ComparisonFixtureDigest();
const style = RECONCILIATION_B_CLARITY;

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

const p = style.palette;

const textPairs: Array<[string, string, string]> = [
  ["Agent label on scene ground", p.ink, p.sceneGround],
  ["Zone label on floor A", p.inkMuted, p.floorZoneA],
  ["Zone label on floor B", p.inkMuted, p.floorZoneB],
  ["Body text on plaster", p.ink, p.plaster],
];

const markerRoles: Array<[string, string]> = [
  ["attention", p.attention],
  ["greenery", p.greenery],
  ["figure", p.figure],
  ["metal", p.metal],
  ["ink", p.ink],
  ["inkMuted", p.inkMuted],
];

const measurements = [
  ...textPairs.map(([name, fg, bg]) => {
    const ratio = contrastRatio(fg, bg);
    return {
      name,
      kind: "text" as const,
      threshold: 4.5,
      ratio: Number(ratio.toFixed(2)),
      passes: ratio >= 4.5,
    };
  }),
  ...markerRoles.flatMap(([role, colour]) =>
    [
      ["floor zone A", p.floorZoneA],
      ["scene ground", p.sceneGround],
    ].map(([surface, bg]) => {
      const ratio = contrastRatio(colour, bg as string);
      return {
        name: `Marker ${role} on ${surface}`,
        kind: "non-text" as const,
        threshold: 3,
        ratio: Number(ratio.toFixed(2)),
        passes: ratio >= 3,
      };
    }),
  ),
  (() => {
    const ratio = contrastRatio(p.attention, p.attentionSoft);
    return {
      name: "Attention marker on its own halo",
      kind: "non-text" as const,
      threshold: 3,
      ratio: Number(ratio.toFixed(2)),
      passes: ratio >= 3,
    };
  })(),
];

const failing = measurements.filter((entry) => !entry.passes);

/** Exactly what changed from the base candidate, field by field. */
const deltas = [
  {
    field: "edgeWidth",
    from: CANDIDATE_B.edgeWidth,
    to: style.edgeWidth,
    source: "Candidate A",
    why: "Define silhouettes; B drew no outline at all.",
  },
  {
    field: "shadow.blur",
    from: CANDIDATE_B.shadow.blur,
    to: style.shadow.blur,
    source: "Candidate A",
    why: "Ground objects; B's softest shadow let them hover.",
  },
  {
    field: "shadow.opacity",
    from: CANDIDATE_B.shadow.opacity,
    to: style.shadow.opacity,
    source: "Candidate A",
    why: "Hold the contact without going flat.",
  },
  {
    field: "shadow.spread",
    from: CANDIDATE_B.shadow.spread,
    to: style.shadow.spread,
    source: "Candidate A",
    why: "Tighten the footprint.",
  },
  {
    field: "palette.floorZoneA",
    from: CANDIDATE_B.palette.floorZoneA,
    to: p.floorZoneA,
    source: "Candidate A",
    why: "Widen the value gap between adjacent zones.",
  },
  {
    field: "palette.floorZoneB",
    from: CANDIDATE_B.palette.floorZoneB,
    to: p.floorZoneB,
    source: "Candidate A",
    why: "Widen the value gap between adjacent zones.",
  },
  {
    field: "palette.zoneEdge",
    from: CANDIDATE_B.palette.zoneEdge,
    to: p.zoneEdge,
    source: "Candidate A",
    why: "Zone boundaries are the primary clarity signal.",
  },
  {
    field: "practicalGlow",
    from: CANDIDATE_B.practicalGlow,
    to: style.practicalGlow,
    source: "reduced",
    why: "Trim bloom so the new edges are not washed out.",
  },
  {
    field: "palette.inkMuted",
    from: CANDIDATE_B.palette.inkMuted,
    to: p.inkMuted,
    source: "re-measured",
    why: "Hold 4.5:1 against the darker floor.",
  },
  {
    field: "palette.attention",
    from: CANDIDATE_B.palette.attention,
    to: p.attention,
    source: "re-measured",
    why: "Hold 3:1 against the darker floor.",
  },
  {
    field: "palette.greenery",
    from: CANDIDATE_B.palette.greenery,
    to: p.greenery,
    source: "re-measured",
    why: "Hold 3:1 against the darker floor.",
  },
  {
    field: "palette.figure",
    from: CANDIDATE_B.palette.figure,
    to: p.figure,
    source: "re-measured",
    why: "Hold 3:1 against the darker floor.",
  },
  {
    field: "palette.metal",
    from: CANDIDATE_B.palette.metal,
    to: p.metal,
    source: "re-measured",
    why: "Hold 3:1 against the darker floor.",
  },
];

const unchanged = [
  "props drawn (all 16, warm density retained — the clarity problem is definition, not object count)",
  "every other palette role: plaster, wood, textile, paper, glass, ink, attentionSoft, shadow",
  "typography stacks, label weight and size",
  "top-face lift, plinth (none)",
  "all twenty state treatments and their reduced-motion equivalents",
  "the frozen comparison frame and every element of the shared geometry",
];

await mkdir(OUT, { recursive: true });

const standalone = (width: number, height: number): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n${renderComposition(style, width, height).replace(
    "<svg ",
    '<svg xmlns="http://www.w3.org/2000/svg" ',
  )}\n`;
await writeFile(resolve(OUT, "composition-1440x900.svg"), standalone(1440, 900), "utf8");
await writeFile(resolve(OUT, "composition-1280x800.svg"), standalone(1280, 800), "utf8");

await writeFile(
  resolve(OUT, "reconciliation.json"),
  `${JSON.stringify(
    {
      schema: "cuckcode.phase6-reconciliation.v1",
      status:
        "PROPOSED under the owner's Task 8 ruling. Candidate. Not approved, not promoted, not implementable.",
      ruledAt: "2026-09-13",
      baseCandidate: CANDIDATE_B.candidateId,
      clarityTraitsFrom: "candidate-a-architectural-clarity",
      fixtureDigest: DIGEST,
      deltas,
      unchanged,
      stateTreatmentCount: STATE_TREATMENTS.length,
      measurements,
      failing,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

// Side-by-side against the base, so the clarity pass can be judged as a change rather than alone.
await writeFile(
  resolve(OUT, "before-after.html"),
  `<meta charset="utf-8">
<title>Task 8 reconciliation — before and after</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#f2ece2; color:#332e27; font-family:'Iowan Old Style','Palatino Linotype','Segoe UI',system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding-block:36px; padding-inline:20px; }
  h1 { font-size:25px; margin:0 0 6px; }
  p.lede { color:#585149; max-width:74ch; font-size:15px; margin:0 0 10px; }
  .status { display:inline-block; margin:8px 0 0; padding:6px 12px; border:1.5px solid #a16218; color:#a16218; font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
  article { margin-block:36px; border-top:1px solid #ab9576; padding-top:18px; }
  h2 { font-size:18px; margin:0 0 4px; }
  .note { color:#585149; font-size:14px; margin:0 0 14px; max-width:74ch; }
  .frame { background:#fdfbf6; border:1px solid #ab9576; overflow-x:auto; }
  .frame svg { display:block; width:100%; height:auto; }
  table { border-collapse:collapse; width:100%; font-size:13px; margin-top:12px; }
  th,td { text-align:left; padding:7px 9px; border-bottom:1px solid #ab9576; vertical-align:top; }
  th { font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#585149; }
  code { font-family:'Cascadia Mono',Consolas,ui-monospace,monospace; font-size:12px; }
  @media (max-width:700px) { .wrap { padding-inline:14px; } }
</style>
<div class="wrap">
  <h1>Task 8 reconciliation — base B, clarity imported from A</h1>
  <p class="lede">Same frozen frame, digest <code>${DIGEST.slice(0, 16)}…</code>. Thirteen fields changed; everything else, including all sixteen props, is Candidate B unaltered.</p>
  <p class="status">Proposed — not approved, not promoted, not implementable</p>

  <article>
    <h2>Before — Candidate B as reviewed</h2>
    <p class="note">No outline on solid faces, softest contact shadow of the three, narrowest floor-zone value gap.</p>
    <div class="frame">${renderComposition(CANDIDATE_B, 1440, 900)}</div>
  </article>

  <article>
    <h2>After — the clarity pass</h2>
    <p class="note">0.7px edge on solid faces, contact shadow tightened from blur 5 to 2.6, wider floor-zone separation with a darker boundary, practical glow trimmed from 46 to 34. Marker and label colours re-solved so nothing regressed: ${failing.length === 0 ? "every measured pair still meets its WCAG 2.2 threshold." : `${failing.length} pair(s) FAIL and are recorded.`}</p>
    <div class="frame">${renderComposition(style, 1440, 900)}</div>
  </article>

  <article>
    <h2>What changed</h2>
    <table><thead><tr><th>Field</th><th>From</th><th>To</th><th>Source</th><th>Why</th></tr></thead><tbody>
    ${deltas.map((d) => `<tr><td><code>${d.field}</code></td><td><code>${d.from}</code></td><td><code>${d.to}</code></td><td>${d.source}</td><td>${d.why}</td></tr>`).join("")}
    </tbody></table>
  </article>
</div>
`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({ ok: failing.length === 0, measured: measurements.length, failing: failing.map((f) => f.name) })}\n`,
);
