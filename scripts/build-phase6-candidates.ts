import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { phase6ComparisonFixtureDigest } from "@cuckcode/testing";

import { ACCOMMODATION_CHANGES, FOCUS_INTENT, STATE_TREATMENTS } from "./phase6-accessibility.js";
import { AGENTS, ZONES } from "./phase6-candidate-geometry.js";
import { renderComposition } from "./phase6-candidate-render.js";
import { CANDIDATE_STYLES, type CandidateStyle } from "./phase6-candidate-styles.js";
import { ORIGINALITY, PROVENANCE_GAPS, PROVENANCE_REFERENCES } from "./phase6-provenance.js";

const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-6/candidates");
const DIGEST = phase6ComparisonFixtureDigest();

/** WCAG 2.2 relative luminance, so contrast intent is computed rather than claimed. */
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

type ContrastPair = {
  name: string;
  fg: string;
  bg: string;
  kind: "text" | "non-text";
  threshold: number;
  ratio: number;
  passesAA: boolean;
};

/**
 * Two thresholds, not one. WCAG 2.2 SC 1.4.3 requires 4.5:1 for body text; SC 1.4.11 requires 3:1
 * for non-text graphical objects such as the attention marker. Scoring the marker against the text
 * threshold reported a failure that the standard does not describe — and scoring it against no
 * threshold at all would have hidden a real one, since the original accent was below 3:1 too.
 */
function contrastPairs(style: CandidateStyle): ContrastPair[] {
  const p = style.palette;
  const pairs: Array<[string, string, string, "text" | "non-text"]> = [
    ["Agent label on scene ground", p.ink, p.sceneGround, "text"],
    ["Zone label on floor", p.inkMuted, p.floorZoneA, "text"],
    ["Zone label on alternate floor", p.inkMuted, p.floorZoneB, "text"],
    ["Body text on plaster", p.ink, p.plaster, "text"],
    ["Attention marker on scene ground", p.attention, p.sceneGround, "non-text"],
    ["Attention marker on its own halo", p.attention, p.attentionSoft, "non-text"],
  ];
  return pairs.map(([name, fg, bg, kind]) => {
    const threshold = kind === "text" ? 4.5 : 3;
    const ratio = contrastRatio(fg, bg);
    return { name, fg, bg, kind, threshold, ratio, passesAA: ratio >= threshold };
  });
}

const swatch = (label: string, value: string): string =>
  `<figure class="swatch"><span style="background:${value}"></span><figcaption>${label}<code>${value}</code></figcaption></figure>`;

function boardPage(style: CandidateStyle): string {
  const p = style.palette;
  const pairs = contrastPairs(style);
  const failing = pairs.filter((pair) => !pair.passesAA);

  return `<meta charset="utf-8">
<title>${style.name} — Phase 6 candidate</title>
<style>
  :root { color-scheme: light; --ink:${p.ink}; --muted:${p.inkMuted}; --ground:${p.pageGround}; --paper:${p.paper}; --accent:${p.attention}; }
  body { margin:0; background:var(--ground); color:var(--ink); font-family:${style.typography.display}; }
  .wrap { max-width:1520px; margin:0 auto; padding-block:40px; padding-inline:24px; }
  header { border-bottom:2px solid var(--ink); padding-bottom:18px; margin-bottom:30px; }
  h1 { font-size:30px; margin:0 0 6px; letter-spacing:-0.01em; }
  .status { display:inline-block; margin-top:12px; padding:6px 12px; border:1.5px solid var(--accent); color:var(--accent); font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
  .lede { font-size:16px; max-width:70ch; color:var(--muted); margin:10px 0 0; }
  section { margin-block:44px; }
  h2 { font-size:13px; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); border-bottom:1px solid ${p.zoneEdge}; padding-bottom:8px; margin-bottom:18px; }
  .figure-frame { background:var(--paper); border:1px solid ${p.zoneEdge}; overflow-x:auto; }
  .figure-frame svg { display:block; max-width:100%; height:auto; }
  figcaption, .note { font-size:13px; color:var(--muted); margin-top:10px; max-width:78ch; }
  .grid { display:flex; flex-wrap:wrap; gap:14px; }
  .swatch { margin:0; width:132px; }
  .swatch span { display:block; height:56px; border:1px solid ${p.zoneEdge}; }
  .swatch figcaption { font-size:11px; margin-top:6px; }
  .swatch code { display:block; font-family:${style.typography.mono}; font-size:10px; color:var(--muted); }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid ${p.zoneEdge}; vertical-align:top; }
  th { font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); }
  code, .mono { font-family:${style.typography.mono}; font-size:12px; }
  .pass { color:#2f6b3a; font-weight:600; } .fail { color:#a2371f; font-weight:600; }
  ul { max-width:78ch; } li { margin-bottom:8px; font-size:14px; }
  .cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:28px; }
  .rule { background:var(--paper); border-left:3px solid var(--accent); padding:12px 16px; font-size:14px; }
  @media (max-width:700px) { .wrap { padding-inline:16px; } h1 { font-size:23px; } }
</style>
<div class="wrap">
<header>
  <h1>Candidate ${style.name}</h1>
  <p class="lede">${style.emphasis}</p>
  <p class="status">Candidate — not selected, not promoted, not implementable</p>
</header>

<section>
  <h2>1 · Default-office composition — 1440 × 900</h2>
  <div class="figure-frame">${renderComposition(style, 1440, 900)}</div>
  <p class="note">Rendered from the frozen comparison frame <code class="mono">${DIGEST.slice(0, 16)}…</code>. Geometry, agent placement, labels and state come from <code class="mono">scripts/phase6-candidate-geometry.ts</code>, shared byte-for-byte with the other two candidates. Only treatment differs.</p>
</section>

<section>
  <h2>2 · 1280 × 800 accommodation</h2>
  <div class="figure-frame">${renderComposition(style, 1280, 800)}</div>
  <p class="note">The camera is fixed, so accommodation is a uniform scale-to-fit with the same margins — not a reflow and not a crop. Every zone, agent and label present at 1440 × 900 is present here; nothing is dropped to make the narrower viewport fit, which is what would quietly change the information hierarchy between candidates.</p>
</section>

<section>
  <h2>3 · Semantic palette and contrast intent</h2>
  <div class="grid">
    ${swatch("Scene ground", p.sceneGround)}${swatch("Floor zone A", p.floorZoneA)}${swatch("Floor zone B", p.floorZoneB)}${swatch("Plaster", p.plaster)}${swatch("Wood", p.wood)}${swatch("Metal", p.metal)}${swatch("Textile", p.textile)}${swatch("Greenery", p.greenery)}${swatch("Attention (reserved)", p.attention)}${swatch("Ink", p.ink)}
  </div>
  <table>
    <thead><tr><th>Pair</th><th>Kind</th><th>Required</th><th>Ratio</th><th>Result</th></tr></thead>
    <tbody>${pairs
      .map(
        (pair) =>
          `<tr><td>${pair.name}</td><td>${pair.kind === "text" ? "text (SC 1.4.3)" : "graphical (SC 1.4.11)"}</td><td class="mono">${pair.threshold.toFixed(1)}:1</td><td class="mono">${pair.ratio.toFixed(2)}:1</td><td class="${pair.passesAA ? "pass" : "fail"}">${pair.passesAA ? "pass" : "below threshold"}</td></tr>`,
      )
      .join("")}</tbody>
  </table>
  <p class="note">${
    failing.length === 0
      ? "Every measured pair meets its WCAG 2.2 threshold at canonical scale: 4.5:1 for text, 3:1 for the graphical attention marker."
      : `${failing.length} pair(s) fall below AA and are recorded as open, not waived: ${failing.map((pair) => pair.name).join("; ")}. Contrast is computed from the declared palette in this page, so a palette change re-measures rather than re-asserts.`
  } Status never relies on colour alone — the attention marker carries position and a distinct halo shape as well as hue.</p>
</section>

<section>
  <h2>4 · Material samples</h2>
  <div class="grid">
    ${[
      ["Wood", p.wood],
      ["Wood, shaded", p.woodShade],
      ["Plaster", p.plaster],
      ["Plaster, shaded", p.plasterShade],
      ["Charcoal metal", p.metal],
      ["Textile", p.textile],
      ["Greenery", p.greenery],
      ["Glass", p.glass],
      ["Paper", p.paper],
    ]
      .map(([label, value]) => swatch(label as string, value as string))
      .join("")}
  </div>
  <p class="note">Nine materials, one family each, no second wood and no second metal. Each is drawn with the same three-face volume primitive, so material reads come from value separation and edge treatment rather than from bespoke per-object shading.</p>
</section>

<section>
  <h2>5 · Typography hierarchy</h2>
  <div class="cols">
    <div>
      <p style="font-size:28px;margin:0">Manager language</p>
      <p style="font-size:15px;margin:6px 0 0;color:var(--muted)">Warm humanist sans for everything a manager reads: zone names, agent labels, outcomes, approvals.</p>
      <p class="note">Stack: <code class="mono">${style.typography.display.split(",")[0]}</code>, weight ${style.typography.labelWeight}, label size ${style.typography.labelSize}px at canonical scale.</p>
    </div>
    <div>
      <p class="mono" style="font-size:20px;margin:0">evidence · work_phase6_priority</p>
      <p style="font-size:15px;margin:6px 0 0;color:var(--muted)">Restrained monospace only for technical evidence, identifiers and syntax. It never carries management language.</p>
      <p class="note">Stack: <code class="mono">${style.typography.mono.split(",")[0]}</code>.</p>
    </div>
  </div>
</section>

<section>
  <h2>6 · Avatar silhouette and scale sheet</h2>
  <div class="figure-frame" style="padding:20px">${avatarSheet(style)}</div>
  <p class="note">Six silhouettes at canonical scale: varied height, body presentation, hair, and one wheelchair user. Facial detail is absent at this scale by contract. Role is never signalled by body or demographics — it is signalled by work area, tools and label, which is why the sheet is deliberately uncorrelated with seniority.</p>
</section>

<section>
  <h2>7 · Approved-system personalization</h2>
  <table>
    <thead><tr><th>Agent</th><th>Work area</th><th>Accessory</th><th>Desk object</th></tr></thead>
    <tbody>${AGENTS.map(
      (agent) =>
        `<tr><td>${agent.label}</td><td class="mono">${agent.workArea}</td><td>${agent.accessory}</td><td>${agent.deskObject}</td></tr>`,
    ).join("")}</tbody>
  </table>
  <p class="note">Two examples per agent, both inside the approved material system. None communicates workflow state, none implies verified consciousness, and none is required for the office to be readable — an agent with no personalization loses nothing operational. Novel details beyond this set stay Candidate pending safety, accessibility, art-system, asset and manager review.</p>
</section>

<section>
  <h2>8 · Lighting and contact shadow</h2>
  <ul>
    <li><strong>Key:</strong> fixed soft daylight, one direction, never status-dependent. A blocked office and a calm office are lit identically; severity is carried by the subject, not the room.</li>
    <li><strong>Practicals:</strong> ${style.practicalGlow > 0 ? `warm lamp glow at radius ${style.practicalGlow}px, subordinate to the key and confined to lamp objects.` : "none — this candidate carries warmth through material value alone, which is part of what it is being compared on."}</li>
    <li><strong>Contact shadow:</strong> blur ${style.shadow.blur}, opacity ${style.shadow.opacity}, spread ${style.shadow.spread}. Every object that touches the floor gets one; nothing floats.</li>
    <li><strong>Plinth:</strong> ${style.plinth > 0 ? `${style.plinth}px of visible floor thickness, containing the scene as an object.` : "none — the floor plane runs to the frame edge."}</li>
  </ul>
</section>

<section>
  <h2>9 · Prop density and negative space</h2>
  <div class="rule">Core props: ${ZONES.length} zones carry ${style.includeWarmProps ? "core and warm-density" : "core-density only"} props. Warm-density props are ${style.includeWarmProps ? "drawn" : "withheld"} in this candidate.</div>
  <ul>
    <li>No zone exceeds four objects, so every zone keeps a readable empty region.</li>
    <li>Circulation between zones stays clear; no prop sits on a boundary line.</li>
    <li>Props never encode state. A crate in Delivery does not mean work was delivered.</li>
    <li>Density is declared here, not discovered by drawing — the same prop list drives all three candidates, filtered by one flag.</li>
  </ul>
</section>

<section>
  <h2>10 · Amber attention and focus</h2>
  <div class="figure-frame" style="padding:24px">${amberSheet(style)}</div>
  <p class="note">One accent, three permitted uses: manager attention, keyboard focus, primary action. It is not used for role identity, not for severity, and not for the five non-active agents. In the frozen frame exactly one subject carries it.</p>
</section>

<section>
  <h2>11 · Motion character and reduced motion</h2>
  <table>
    <thead><tr><th>Change</th><th>Duration</th><th>Character</th><th>Reduced-motion translation</th></tr></thead>
    <tbody>
      <tr><td>Attention marker appears</td><td class="mono">100–150 ms</td><td>Opacity only, calm ease-out</td><td>Appears at full opacity, no transition</td></tr>
      <tr><td>Work item becomes active</td><td class="mono">150–200 ms</td><td>Single value shift on the subject</td><td>Instant value shift; state still legible</td></tr>
      <tr><td>Inspector opens</td><td class="mono">200–300 ms</td><td>Height, non-bouncy, faster exit</td><td>Instant open; focus moves identically</td></tr>
    </tbody>
  </table>
  <p class="note">No ambient loops, no travel, no parallax — in either mode. The frozen frame has exactly two semantic-motion subjects, the active work item and the agent working it, and both are backed by canonical events. Reduced motion removes transitions, never meaning.</p>
</section>

<section>
  <h2>12 · Strengths, risks, exclusions, complexity, assets</h2>
  <div class="cols">
    <div>
      <h3 style="font-size:14px">Strengths</h3>
      <ul>${strengths(style)
        .map((item) => `<li>${item}</li>`)
        .join("")}</ul>
    </div>
    <div>
      <h3 style="font-size:14px">Named risk, and how this board addresses it</h3>
      <p class="rule">${style.namedRisk}</p>
      <ul>${riskMitigations(style)
        .map((item) => `<li>${item}</li>`)
        .join("")}</ul>
    </div>
  </div>
  <h3 style="font-size:14px">Exclusions</h3>
  <ul>
    <li>No high-fidelity texture, no photographic material, no bespoke per-object art. Those are Phase 7 and unauthorized.</li>
    <li>No token promotion. Every value on this page is Candidate.</li>
    <li>No claim about any viewport, browser or interaction not directly exercised here.</li>
  </ul>
  <h3 style="font-size:14px">Implementation complexity and asset needs</h3>
  <ul>
    <li><strong>Feasibility:</strong> every surface is the same three-face volume primitive with flat fills — expressible as PixiJS meshes or sprites without a custom shader. ${style.practicalGlow > 0 ? "Lamp glow needs one additive sprite per practical." : "No additive pass is required."} ${style.plinth > 0 ? "The plinth is two extra quads on the scene root." : ""}</li>
    <li><strong>Asset count:</strong> ${assetCount(style)} distinct drawable kinds, before avatar variation.</li>
    <li><strong>DOM shell:</strong> all labels are real text and have accessible-outline equivalents; none is canvas-only.</li>
    <li><strong>Cost driver:</strong> ${style.includeWarmProps ? "prop variety — warm-density objects roughly double the staging pass." : "none beyond the core prop set."}</li>
  </ul>
</section>

<section>
  <h2>Task 6 · Accessible treatment for every canonical state</h2>
  <p class="note">All twenty states the office can express, each with a cue that survives greyscale and a reduced-motion equivalent. These treatments are <strong>identical in all three candidates</strong>: what a state means is canonical truth, and only its colour is art direction. A candidate that distinguished two states by a cue another candidate lacked would be offering a different semantics, not a different look.</p>
  <table>
    <thead><tr><th>State</th><th>Cues that are not colour</th><th>Reduced motion</th></tr></thead>
    <tbody>${STATE_TREATMENTS.map(
      (treatment) =>
        `<tr><td class="mono">${treatment.family}:${treatment.state}</td><td>${treatment.nonColourCues.join("; ")}</td><td>${treatment.reducedMotion}</td></tr>`,
    ).join("")}</tbody>
  </table>
  <h3 style="font-size:14px">Focus intent</h3>
  <p class="note">${FOCUS_INTENT.treatment}</p>
  <h3 style="font-size:14px">1280 × 800 accommodation</h3>
  <ul>${ACCOMMODATION_CHANGES.map((change) => `<li>${change}</li>`).join("")}</ul>
  <p class="note">Measured, not asserted: <code class="mono">docs/evidence/phase-6/accessibility-report.json</code> counts the rendered text in both compositions and the suite fails if the narrower viewport carries fewer labels.</p>
</section>
</div>`;
}

function avatarSheet(style: CandidateStyle): string {
  const p = style.palette;
  const heights: Record<string, number> = {
    tall: 116,
    broad: 106,
    medium: 107,
    slight: 102,
    short: 96,
    "seated-wheelchair": 80,
  };
  const widths: Record<string, number> = {
    tall: 26,
    broad: 34,
    medium: 28,
    slight: 24,
    short: 27,
    "seated-wheelchair": 30,
  };
  const figures = AGENTS.map((agent, index) => {
    const cx = 90 + index * 160;
    const h = heights[agent.build] ?? 105;
    const w = widths[agent.build] ?? 28;
    const baseY = 168;
    const seated = agent.build === "seated-wheelchair";
    return `<g>
      <ellipse cx="${cx}" cy="${baseY + 4}" rx="${w}" ry="7" fill="${p.shadow}" opacity="${style.shadow.opacity}"/>
      ${seated ? `<circle cx="${cx}" cy="${baseY - 20}" r="21" fill="none" stroke="${p.metalShade}" stroke-width="3"/>` : ""}
      <path d="M ${cx} ${baseY} L ${cx - w / 2} ${baseY - h + 26} Q ${cx} ${baseY - h + 12} ${cx + w / 2} ${baseY - h + 26} Z" fill="${p.figure}"/>
      <circle cx="${cx}" cy="${baseY - h + 12}" r="13" fill="${p.figureShade}"/>
      <text x="${cx}" y="${baseY + 26}" text-anchor="middle" font-size="10" font-family="${style.typography.display}" fill="${p.ink}">${agent.label}</text>
      <text x="${cx}" y="${baseY + 40}" text-anchor="middle" font-size="9" font-family="${style.typography.mono}" fill="${p.inkMuted}">${agent.build}</text>
    </g>`;
  }).join("");
  return `<svg viewBox="0 0 1020 220" width="1020" height="220" role="img" aria-label="Six avatar silhouettes at canonical scale"><rect width="1020" height="220" fill="${p.paper}"/><line x1="20" y1="172" x2="1000" y2="172" stroke="${p.zoneEdge}"/>${figures}</svg>`;
}

function amberSheet(style: CandidateStyle): string {
  const p = style.palette;
  return `<svg viewBox="0 0 900 150" width="900" height="150" role="img" aria-label="Permitted uses of the reserved amber accent"><rect width="900" height="150" fill="${p.paper}"/>
    <g><circle cx="90" cy="62" r="22" fill="${p.attentionSoft}"/><circle cx="90" cy="62" r="11" fill="${p.attention}"/><text x="90" y="116" text-anchor="middle" font-size="12" font-family="${style.typography.display}" fill="${p.ink}">Manager attention</text></g>
    <g><rect x="300" y="42" width="130" height="40" rx="3" fill="${p.plaster}" stroke="${p.attention}" stroke-width="3"/><text x="365" y="67" text-anchor="middle" font-size="12" font-family="${style.typography.display}" fill="${p.ink}">Focused</text><text x="365" y="116" text-anchor="middle" font-size="12" font-family="${style.typography.display}" fill="${p.ink}">Keyboard focus</text></g>
    <g><rect x="620" y="42" width="150" height="40" rx="3" fill="${p.attention}"/><text x="695" y="67" text-anchor="middle" font-size="12" font-family="${style.typography.display}" fill="${p.paper}">Approve</text><text x="695" y="116" text-anchor="middle" font-size="12" font-family="${style.typography.display}" fill="${p.ink}">Primary action</text></g>
  </svg>`;
}

function strengths(style: CandidateStyle): string[] {
  if (style.candidateId === "candidate-a-architectural-clarity") {
    return [
      "Zone boundaries are the strongest signal in the frame, so &ldquo;where is the Review station&rdquo; is answerable in one glance without a legend.",
      "Lowest prop count of the three: nothing competes with agents and state for attention.",
      "Flat fills and uniform outlines make it the cheapest to implement and the most predictable under scale.",
      "Highest tolerance for future state density — there is room to add escalations without the frame becoming busy.",
    ];
  }
  if (style.candidateId === "candidate-b-human-studio-warmth") {
    return [
      "Reads as a place people work rather than a diagram of one, which is the thesis&rsquo;s stated intent.",
      "Desk objects and accessories give agents visible individuality without touching workflow semantics.",
      "Practical lamps introduce warmth locally, leaving the key light fixed and status-independent.",
      "Soft edges keep the six silhouettes distinguishable without outlining every surface.",
    ];
  }
  return [
    "Material edges and contact shadows give the strongest sense of real, touchable surfaces.",
    "The plinth contains the office as a single object, which makes the fixed camera feel deliberate rather than arbitrary.",
    "Staged props read as considered rather than scattered; depth is legible at both viewports.",
    "Highest value separation between materials, which helps contrast at small scale.",
  ];
}

function riskMitigations(style: CandidateStyle): string[] {
  if (style.candidateId === "candidate-a-architectural-clarity") {
    return [
      "Warm wood and textile values are kept even at low prop density, so the restraint does not become grey.",
      "Agent silhouettes carry all the variation the avatar contract asks for; the sterility risk is answered in the figures, not the furniture.",
      "<strong>Unresolved:</strong> this is the candidate most likely to read as a floor plan. That judgement is the owner&rsquo;s at Task 8, and this board does not argue it away.",
    ];
  }
  if (style.candidateId === "candidate-b-human-studio-warmth") {
    return [
      "Prop density is capped per zone and every zone retains negative space, which is the direct control on visual noise.",
      "Personalization is restricted to accessory and desk object, neither of which can express state — that is the control on false sentiment.",
      "No facial detail, no gesture, no idle animation: warmth comes from the room, never from implied feeling in the agents.",
      "<strong>Unresolved:</strong> whether desk objects still read as individuality once six agents become twelve.",
    ];
  }
  return [
    "Adult proportions and work-realistic props keep it away from toy scale; nothing is stylised small.",
    "The plinth is flat and unlit rather than a display base, which is what would push it toward diorama.",
    "Muted palette and absence of ambient motion keep it from reading as a game scene.",
    "<strong>Unresolved:</strong> the contact-shadow weight that makes materials convincing is also what most invites the miniature reading. It cannot be tuned out of the risk without losing the strength.",
  ];
}

const assetCount = (style: CandidateStyle): number => (style.includeWarmProps ? 8 : 5) + 4;

async function buildCandidate(
  style: CandidateStyle,
): Promise<{ candidateId: string; manifestPath: string }> {
  const directory = resolve(OUT, style.candidateId);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "board.html"), `${boardPage(style)}\n`, "utf8");

  // The composition also ships standalone, so it can be opened, captured and diffed on its own
  // rather than only as a fragment inside the board page.
  const standalone = (width: number, height: number): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n${renderComposition(style, width, height).replace(
      "<svg ",
      '<svg xmlns="http://www.w3.org/2000/svg" ',
    )}\n`;
  await writeFile(resolve(directory, "composition-1440x900.svg"), standalone(1440, 900), "utf8");
  await writeFile(resolve(directory, "composition-1280x800.svg"), standalone(1280, 800), "utf8");

  const pairs = contrastPairs(style);
  const manifest = {
    schema: "cuckcode.phase6-candidate.v1",
    candidateId: style.candidateId,
    name: style.name,
    emphasis: style.emphasis,
    namedRisk: style.namedRisk,
    status:
      "Candidate. Not selected, not promoted, not implementable. Phase 7 remains unauthorized.",
    fixtureDigest: DIGEST,
    medium: {
      ruling: "6-C hybrid",
      composition: "in-repo-vector",
      note: "The fixture-accurate composition is authored in-tree and rendered by the project's own harness, so it is the artifact scored for feasibility and accessibility. No generated raster is included in this board; see the manifest's generatedExploration field.",
      generatedExploration: null,
    },
    board: {
      "1-composition": { artifact: "board.html#composition", medium: "in-repo-vector" },
      "2-accommodation-1280": { artifact: "board.html#accommodation", medium: "in-repo-vector" },
      "3-palette-and-contrast": { artifact: "board.html#palette", medium: "computed" },
      "4-material-samples": { artifact: "board.html#materials", medium: "in-repo-vector" },
      "5-typography": { artifact: "board.html#typography", medium: "in-repo-vector" },
      "6-avatar-scale-sheet": { artifact: "board.html#avatars", medium: "in-repo-vector" },
      "7-personalization": { artifact: "board.html#personalization", medium: "written" },
      "8-lighting-and-contact-shadow": { artifact: "board.html#lighting", medium: "written" },
      "9-prop-density-and-negative-space": { artifact: "board.html#density", medium: "written" },
      "10-amber-attention": { artifact: "board.html#amber", medium: "in-repo-vector" },
      "11-motion-and-reduced-motion": { artifact: "board.html#motion", medium: "written" },
      "12-strengths-risks-exclusions": { artifact: "board.html#analysis", medium: "written" },
    },
    contrast: pairs.map((pair) => ({
      pair: pair.name,
      kind: pair.kind,
      threshold: pair.threshold,
      ratio: Number(pair.ratio.toFixed(2)),
      passesAA: pair.passesAA,
    })),
    // Cited, not duplicated. The register is the authority; a manifest that restated the five
    // required fields would be a second copy free to drift from the reviewed one.
    provenanceRegister: "docs/evidence/phase-6/provenance-register.json",
    provenance: PROVENANCE_REFERENCES.filter((reference) =>
      reference.appliesTo.includes(style.candidateId),
    ).map((reference) => ({ referenceId: reference.id, kind: reference.kind })),
    originality: ORIGINALITY,
  };
  await writeFile(
    resolve(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return {
    candidateId: style.candidateId,
    manifestPath: `docs/evidence/phase-6/candidates/${style.candidateId}/manifest.json`,
  };
}

/**
 * The three candidates on one page, same frame, same size, in the brief's order. Task 8 asks the
 * owner to choose between them; choosing between three separate files means remembering the first
 * while looking at the third, which is not a comparison.
 */
function comparisonPage(): string {
  return `<meta charset="utf-8">
<title>Phase 6 candidate comparison</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#eceae5; color:#2f2e2b; font-family:'Iowan Old Style','Palatino Linotype','Segoe UI',system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding-block:36px; padding-inline:20px; }
  h1 { font-size:26px; margin:0 0 6px; }
  p.lede { color:#6d6a63; max-width:74ch; font-size:15px; margin:0 0 8px; }
  .status { display:inline-block; margin:10px 0 0; padding:6px 12px; border:1.5px solid #c8791f; color:#c8791f; font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
  article { margin-block:40px; border-top:1px solid #b3ab9b; padding-top:20px; }
  h2 { font-size:19px; margin:0 0 4px; }
  .emphasis { color:#6d6a63; font-size:14px; margin:0 0 4px; max-width:74ch; }
  .risk { color:#8a5a20; font-size:13px; margin:0 0 14px; }
  .frame { background:#fbfaf7; border:1px solid #b3ab9b; overflow-x:auto; }
  .frame svg { display:block; width:100%; height:auto; }
  a { color:#8a5a20; font-size:13px; }
  @media (max-width:700px) { .wrap { padding-inline:14px; } }
</style>
<div class="wrap">
  <h1>Phase 6 — three art-direction candidates</h1>
  <p class="lede">All three render one frozen comparison frame, digest <code>${DIGEST.slice(0, 16)}…</code>. Geometry, agent placement, labels and state are shared byte-for-byte; only treatment differs. Scores determine nothing — selection is the owner's at Task 8.</p>
  <p class="status">Candidates — none selected, none promoted, none implementable</p>
  ${CANDIDATE_STYLES.map(
    (style) => `<article>
    <h2>${style.name}</h2>
    <p class="emphasis">${style.emphasis}</p>
    <p class="risk"><strong>Named risk:</strong> ${style.namedRisk}</p>
    <div class="frame">${renderComposition(style, 1440, 900)}</div>
    <p><a href="${style.candidateId}/board.html">Full candidate board — twelve deliverables</a></p>
  </article>`,
  ).join("\n  ")}
</div>`;
}

const built = [];
for (const style of CANDIDATE_STYLES) built.push(await buildCandidate(style));
await writeFile(resolve(OUT, "comparison.html"), `${comparisonPage()}\n`, "utf8");

// The register is written from the same module the manifests cite, so the review and the citations
// cannot disagree with each other.
await writeFile(
  resolve(ROOT, "docs/evidence/phase-6/provenance-register.json"),
  `${JSON.stringify(
    {
      schema: "cuckcode.phase6-provenance.v1",
      status:
        "Task 5 review complete 2026-09-13. Candidate provenance only; approves no candidate and promotes nothing.",
      reviewedAt: "2026-09-13",
      originality: ORIGINALITY,
      references: PROVENANCE_REFERENCES,
      gaps: PROVENANCE_GAPS,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify({ ok: true, digest: DIGEST, built: built.length })}\n`);
