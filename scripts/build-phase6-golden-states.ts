import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { STATE_TREATMENTS } from "./phase6-accessibility.js";
import { RECONCILIATION_B_CLARITY } from "./phase6-candidate-styles.js";
import { renderComposition, type SceneState } from "./phase6-candidate-render.js";
import { projectAllGoldenStates, type ProjectedGoldenState } from "./phase6-golden-states.js";

/**
 * Renders the golden states in the approved system and records each one's evidence.
 *
 * Reduced-motion equivalence is established by checking that each capture contains no animation
 * construct at all. Rendering the frame twice and comparing would have been vacuous — the same call
 * returns the same string. The claim worth proving is that there is no motion to remove, which is
 * what makes a reduced-motion viewer receive exactly what everyone else does.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-6/golden-states");
const style = RECONCILIATION_B_CLARITY;
const VIEWPORTS: Array<[string, number, number]> = [
  ["1440x900", 1440, 900],
  ["1280x800", 1280, 800],
];

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

/**
 * The owner's approval of these states, recorded once and referenced.
 *
 * An approval written inline per state would be an approval a build script could invent. This points
 * at the decision record instead, and the suite refuses any approval whose record is not on disk.
 */
const OWNER_APPROVAL = {
  approvedAt: "2026-09-13",
  record: "docs/evidence/phase-6/decision-record-2026-09-13-golden-states-approved.md",
  scope:
    "The five golden states as rendered in reconciliation-b-clarity at both approved viewports. Does not promote the visual system to Active and does not authorize Phase 7.",
};

/** Turns canonical descriptors into the declared render state. Nothing is invented here. */
function sceneStateFrom(projected: ProjectedGoldenState): SceneState {
  const agentStates: Record<string, string> = {};
  let work: { state: string } | undefined;
  const collaborationParticipants: string[] = [];

  for (const descriptor of projected.scene) {
    if (descriptor.subjectType === "agent") agentStates[descriptor.subjectId] = descriptor.state;
    if (descriptor.subjectType === "work") work = { state: descriptor.state };
  }
  for (const collaboration of Object.values(projected.snapshot.collaborations)) {
    if (collaboration.active) collaborationParticipants.push(...collaboration.participantIds);
  }
  // `work` is omitted rather than set to `undefined`. `SceneState.work` is optional and the
  // renderer tests it with `if (scene.work)`, so the two are identical at runtime — but under
  // `exactOptionalPropertyTypes` an explicit `undefined` is not assignable to an optional property.
  // Type-only; proven no-op against the five golden states at both viewports, digests unchanged.
  // Owner ruling 2026-09-14, `docs/evidence/decision-record-2026-09-14-scripts-typecheck.md`.
  return { agentStates, collaborationParticipants, ...(work ? { work } : {}) };
}

/** The pinned environment every capture was produced in. */
const ENVIRONMENT = {
  node: process.version,
  platform: process.platform,
  renderer: "scripts/phase6-candidate-render.ts, deterministic SVG",
  system: style.candidateId,
  systemStatus:
    "Approved by the owner 2026-09-13 as the Task 8 reconciliation. Still Candidate until Task 10 promotion.",
  capturedAt: "2026-09-13",
};

await mkdir(OUT, { recursive: true });

const records = [];
const motionOnlyFindings: string[] = [];

for (const projected of projectAllGoldenStates()) {
  const scene = sceneStateFrom(projected);
  const captures: Record<
    string,
    { sha256: string; animationConstructs: number; reducedMotionEquivalent: boolean }
  > = {};

  for (const [label, width, height] of VIEWPORTS) {
    const normal = renderComposition(style, width, height, scene);

    // Rendering the same call twice and comparing would prove nothing. The claim that reduced
    // motion preserves all meaning is only meaningful if the frame carries no motion to remove, so
    // that is what is checked: the capture must contain no animation construct at all. A frame with
    // an <animate> element would be carrying something a reduced-motion viewer never receives.
    const animation =
      normal.match(/<animate|<set[\s>/]|animation:|@keyframes|dur=|repeatCount=/gu) ?? [];
    const identical = animation.length === 0;
    if (!identical)
      motionOnlyFindings.push(`${projected.state.id}/${label}: ${animation.join(", ")}`);

    await writeFile(
      resolve(OUT, `${projected.state.id}-${label}.svg`),
      `<?xml version="1.0" encoding="UTF-8"?>\n${normal.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')}\n`,
      "utf8",
    );
    captures[label] = {
      sha256: sha256(normal),
      animationConstructs: animation.length,
      reducedMotionEquivalent: identical,
    };
  }

  // Accessibility notes are the Task 6 treatments for the states this frame actually contains,
  // rather than a restatement of all twenty-two.
  const present = new Set(
    projected.scene.map((descriptor) =>
      descriptor.subjectType === "collaboration"
        ? `collaboration:${descriptor.state}`
        : `${descriptor.subjectType}:${descriptor.state}`,
    ),
  );
  const accessibilityNotes = STATE_TREATMENTS.filter((treatment) =>
    present.has(`${treatment.family}:${treatment.state}`),
  ).map((treatment) => ({
    state: `${treatment.family}:${treatment.state}`,
    nonColourCues: treatment.nonColourCues,
    reducedMotion: treatment.reducedMotion,
  }));

  records.push({
    id: projected.state.id,
    name: projected.state.name,
    purpose: projected.state.purpose,
    digest: projected.digest,
    eventIds: projected.snapshot.eventIds,
    sceneDescriptors: projected.scene,
    outline: projected.outline,
    visibleChecklist: projected.state.visibleChecklist,
    accessibilityNotes,
    semanticMotionSubjects: projected.scene
      .filter((descriptor) => descriptor.semanticMotion)
      .map((descriptor) => `${descriptor.subjectType}:${descriptor.state}`),
    captures,
    environment: ENVIRONMENT,
    ownerApproval: OWNER_APPROVAL,
  });
}

await writeFile(
  resolve(OUT, "golden-states.json"),
  `${JSON.stringify(
    {
      schema: "cuckcode.phase6-golden-states.v1",
      status:
        "Task 9 produced and owner-approved 2026-09-13. The states are approved; the visual system is still Candidate until the Task 10 promotion, which is owner-run. Phase 7 remains unauthorized.",
      producedAt: "2026-09-13",
      // The capture sha256 covers the rendered SVG string, not the file as written: the file adds an
      // XML declaration and an xmlns attribute afterwards. Hashing the file directly will not match,
      // and a baseline whose relationship to its artifact is unstated is a baseline someone checks
      // the obvious way and misreads as drift. `phase6-promotion.unit.test.ts` asserts the reversal.
      digestScope:
        "sha256 of the rendered SVG string, before the XML declaration and xmlns attribute are added on write",
      system: style.candidateId,
      environment: ENVIRONMENT,
      motionOnlyFindings,
      states: records,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

await writeFile(
  resolve(OUT, "index.html"),
  `<meta charset="utf-8">
<title>Phase 6 golden states</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#f2ece2; color:#332e27; font-family:'Iowan Old Style','Palatino Linotype','Segoe UI',system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding-block:36px; padding-inline:20px; }
  h1 { font-size:25px; margin:0 0 6px; }
  p.lede { color:#585149; max-width:76ch; font-size:15px; margin:0 0 10px; }
  .status { display:inline-block; margin:8px 0 0; padding:6px 12px; border:1.5px solid #a16218; color:#a16218; font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
  article { margin-block:36px; border-top:1px solid #ab9576; padding-top:18px; }
  h2 { font-size:18px; margin:0 0 4px; }
  .purpose { color:#585149; font-size:14px; margin:0 0 12px; max-width:76ch; }
  .frame { background:#fdfbf6; border:1px solid #ab9576; overflow-x:auto; }
  .frame svg { display:block; width:100%; height:auto; }
  ul { font-size:13px; color:#585149; max-width:76ch; } li { margin-bottom:5px; }
  code { font-family:'Cascadia Mono',Consolas,ui-monospace,monospace; font-size:12px; }
  @media (max-width:700px) { .wrap { padding-inline:14px; } }
</style>
<div class="wrap">
  <h1>Phase 6 golden states — ${style.name}</h1>
  <p class="lede">Five canonical states rendered in the approved system, each built from canonical events through the same projectors the graybox uses. Every capture contains zero animation constructs, which is why the reduced-motion equivalent of each state is the same frame: there is no motion to remove, so nothing in these states is carried by motion alone.</p>
  <p class="status">Owner-approved 2026-09-13 — the visual system is still Candidate until the Task 10 promotion; Phase 7 unauthorized</p>
  ${projectAllGoldenStates()
    .map((projected) => {
      const scene = sceneStateFrom(projected);
      const moving = projected.scene.filter((descriptor) => descriptor.semanticMotion).length;
      return `<article>
    <h2>${projected.state.name}</h2>
    <p class="purpose">${projected.state.purpose}</p>
    <div class="frame">${renderComposition(style, 1440, 900, scene)}</div>
    <ul>
      <li>digest <code>${projected.digest.slice(0, 16)}…</code>, ${projected.snapshot.eventIds.length} canonical events, ${moving} semantic-motion subject${moving === 1 ? "" : "s"}</li>
      ${projected.state.visibleChecklist.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  </article>`;
    })
    .join("\n  ")}
</div>
`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({
    ok: motionOnlyFindings.length === 0,
    states: records.length,
    captures: records.length * VIEWPORTS.length,
    motionOnlyFindings,
  })}\n`,
);
