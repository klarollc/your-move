import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * Phase 5, C-19 — the contact sheet the owner looks at.
 *
 * C-19 is the one criterion that no amount of passing machinery can close. Its testable assertion
 * says so in as many words: "Captures and diffs cannot satisfy the acceptance half." Forty images
 * exist, every one byte-distinct, every declared name matching the contract. None of that is a
 * judgement about whether the thing looks right, and MDD §18 forbids letting rendered evidence
 * stand in for human-visual-acceptance.
 *
 * So this builds a lens, not evidence. Every image, paired at both D-07 viewports, sitting beside
 * the treatment the contract declared for it and beside what the Visual QA agent said it could not
 * settle from an accessibility tree. The output is written to the ignored test-results directory
 * and is regenerable from committed evidence in one command; the evidence remains the captures and
 * the manifest, and the artifact that closes C-19 remains an owner ruling.
 */
const ROOT = resolve(process.cwd());
const BROWSER = resolve(ROOT, "docs/evidence/phase-5/browser");
const CONTRACT = resolve(ROOT, "docs/evidence/phase-5/surface-contract");
const VIEWPORTS = ["chromium-1440", "chromium-1280"] as const;

const outArg = process.argv.indexOf("--out");
const OUT = resolve(
  ROOT,
  outArg === -1 ? "test-results/phase-5-contact-sheet.html" : (process.argv[outArg + 1] as string),
);

/**
 * Plates captured element-scoped rather than whole-card, declared here and checked against the spec
 * below. Four severity rows and four evidence rows are identical as whole cards — the state lives
 * in one row — and capturing the card would have produced duplicate images that look like coverage.
 * A reader seeing a cropped plate with no explanation would reasonably think something was wrong,
 * so the sheet says which plates are fragments and why.
 */
const ELEMENT_SCOPED = new Set([
  "severity-routine",
  "severity-significant",
  "severity-critical",
  "severity-unknown",
  "link-resolved",
  "link-missing",
  "link-invalid",
  "link-unavailable",
  "undo-available",
]);

type StateInventoryEntry = {
  id: string;
  visualTreatment: string;
  nonColourCue: string;
  accessibleName: string;
};

type Amendment = { stateId: string; field: string; authored: string; amendedTo: string; reason: string };

type Cell = { state: string; viewport: string; capture: string; captureSha256: string };

type Annotation = {
  stateId: string;
  contractSatisfied: string;
  observed: string;
  gap: string | null;
};

const json = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

/** PNG intrinsic size, straight from IHDR. A plate's real pixel size is part of what is being judged. */
const pngSize = (body: Buffer): { width: number; height: number } => ({
  width: body.readUInt32BE(16),
  height: body.readUInt32BE(20),
});

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] as string,
  );

const surface = await json<{
  contract: { stateInventory: StateInventoryEntry[] };
  requiredStates: string[];
}>(resolve(CONTRACT, "surface-contract.json"));
const amendments = await json<{ amendments: Amendment[] }>(resolve(CONTRACT, "amendments.json"));
const manifest = await json<{ capturedAt: string; cells: Cell[] }>(
  resolve(BROWSER, "capture-manifest.json"),
);
const fidelity = await json<{ statesChecked: number; namesDrifted: number }>(
  resolve(BROWSER, "fidelity-check.json"),
);
const determinism = await json<{ artifactsCompared: number; identical: boolean }>(
  resolve(BROWSER, "determinism.json"),
);
const visualQa = await json<{
  pass: number;
  annotation: { stateAnnotations: Annotation[]; verdict: string };
}>(resolve(ROOT, "docs/evidence/phase-5/visual-qa/pass-2.json"));

/**
 * Declared, then asserted — the 9-D shape. A hand-kept list of which plates are fragments drifts
 * silently the moment someone changes a capture target, and a note explaining a crop that is no
 * longer a crop is worse than no note.
 */
const spec = await readFile(resolve(ROOT, "tests/visual/phase-5-decision-notice-states.spec.ts"), "utf8");
const journeyBlocks = spec.slice(spec.indexOf("const JOURNEYS")).split(/\n {2}\{\n/u).slice(1);
const scopedInSpec = new Set(
  journeyBlocks
    .filter((block) => /\n\s*target:/u.test(block))
    .map((block) => /id:\s*"([^"]+)"/u.exec(block)?.[1] ?? ""),
);
const declaredNotScoped = [...ELEMENT_SCOPED].filter((id) => !scopedInSpec.has(id)).sort();
const scopedNotDeclared = [...scopedInSpec].filter((id) => !ELEMENT_SCOPED.has(id)).sort();
if (declaredNotScoped.length > 0 || scopedNotDeclared.length > 0) {
  process.stderr.write(
    `the element-scoped list no longer matches the capture spec\n` +
      `  declared here but captured whole: ${declaredNotScoped.join(", ") || "none"}\n` +
      `  captured scoped but not declared: ${scopedNotDeclared.join(", ") || "none"}\n`,
  );
  process.exit(1);
}

const byState = new Map(surface.contract.stateInventory.map((entry) => [entry.id, entry]));
const annotationByState = new Map(
  visualQa.annotation.stateAnnotations.map((entry) => [entry.stateId, entry]),
);
const amendmentByState = new Map(amendments.amendments.map((entry) => [entry.stateId, entry]));
const cellFor = (state: string, viewport: string): Cell | undefined =>
  manifest.cells.find((cell) => cell.state === state && cell.viewport === viewport);

const plates: Array<{ state: string; viewport: string; dataUri: string; width: number; height: number; sha: string }> = [];
for (const state of surface.requiredStates) {
  for (const viewport of VIEWPORTS) {
    const cell = cellFor(state, viewport);
    if (!cell) {
      process.stderr.write(`no capture recorded for ${state} at ${viewport}\n`);
      process.exit(1);
    }
    const body = await readFile(resolve(BROWSER, cell.capture));
    const sha = createHash("sha256").update(body).digest("hex").slice(0, 16);
    if (sha !== cell.captureSha256) {
      process.stderr.write(
        `${cell.capture} no longer matches the manifest (${sha} vs ${cell.captureSha256}); ` +
          `re-run npm run phase5:capture before looking at a sheet built from it\n`,
      );
      process.exit(1);
    }
    const { width, height } = pngSize(body);
    plates.push({
      state,
      viewport,
      dataUri: `data:image/png;base64,${body.toString("base64")}`,
      width,
      height,
      sha,
    });
  }
}

const plateFor = (state: string, viewport: string): (typeof plates)[number] =>
  plates.find((plate) => plate.state === state && plate.viewport === viewport) as (typeof plates)[number];

const section = (state: string): string => {
  const entry = byState.get(state) as StateInventoryEntry;
  const annotation = annotationByState.get(state);
  const amendment = amendmentByState.get(state);
  const scoped = ELEMENT_SCOPED.has(state);

  const platesHtml = VIEWPORTS.map((viewport) => {
    const plate = plateFor(state, viewport);
    const label = viewport === "chromium-1440" ? "1440 × 900" : "1280 × 800";
    return `
      <figure class="plate">
        <figcaption>
          <span class="vp">${label}</span>
          <span class="dim">${plate.width}×${plate.height}px</span>
          <code class="sha">${plate.sha}</code>
        </figcaption>
        <button class="frame" type="button" data-zoom aria-label="Toggle actual size for ${escape(state)} at ${label}">
          <img src="${plate.dataUri}" alt="${escape(state)} rendered at ${label}" width="${plate.width}" height="${plate.height}">
        </button>
      </figure>`;
  }).join("");

  return `
  <section class="state" id="state-${escape(state)}" data-state="${escape(state)}">
    <header class="state-head">
      <h2><span class="idx"></span>${escape(state)}</h2>
      ${scoped ? '<span class="tag tag-scope">element-scoped plate</span>' : ""}
      ${amendment ? '<span class="tag tag-amend">name amended by overlay</span>' : ""}
    </header>

    <div class="cols">
      <div class="contract">
        <dl>
          <dt>Declared visual treatment</dt>
          <dd>${escape(entry.visualTreatment)}</dd>
          <dt>Declared non-colour cue</dt>
          <dd>${escape(entry.nonColourCue)}</dd>
          <dt>Accessible name</dt>
          <dd><code>${escape(amendment ? amendment.amendedTo : entry.accessibleName)}</code>${
            amendment
              ? `<p class="amend">Authored as <code>${escape(amendment.authored)}</code>. ${escape(amendment.reason)}</p>`
              : ""
          }</dd>
        </dl>
        ${
          annotation
            ? `<div class="qa">
          <p class="qa-head">Visual QA, pass ${visualQa.pass} — <strong>${escape(annotation.contractSatisfied)}</strong></p>
          <p><span class="qa-label">Established from the tree</span> ${escape(annotation.observed)}</p>
          ${annotation.gap ? `<p class="qa-gap"><span class="qa-label">Left to your eyes</span> ${escape(annotation.gap)}</p>` : ""}
        </div>`
            : ""
        }
        ${
          scoped
            ? `<p class="scope-note">This plate is one row of the card, not the whole card. The four
               severity rows and four evidence rows differ only inside that row; capturing the card
               would have produced identical images that read as coverage.</p>`
            : ""
        }
      </div>

      <div class="plates">${platesHtml}</div>
    </div>

    <fieldset class="verdict">
      <legend>Fidelity to the declared treatment</legend>
      <label><input type="radio" name="v-${escape(state)}" value="matches"> Matches</label>
      <label><input type="radio" name="v-${escape(state)}" value="does-not-match"> Does not match</label>
      <label><input type="radio" name="v-${escape(state)}" value="needs-a-closer-look"> Needs a closer look</label>
      <input class="note" type="text" data-note="${escape(state)}" placeholder="What you saw (optional, and the part worth keeping)">
    </fieldset>
  </section>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phase 5 contact sheet — C-19 fidelity look</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfaf8; --surface: #ffffff; --ink: #1c1b19; --muted: #5d5a54;
    --line: #dcd8d1; --accent: #1f4b73; --warn-bg: #fdf6e6; --warn-line: #d8c48c;
    --plate-ground: #ffffff; --plate-line: #c9c4bc;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17181a; --surface: #202224; --ink: #e9e7e3; --muted: #a09c96;
      --line: #34373a; --accent: #8fbde8; --warn-bg: #2b2721; --warn-line: #5f5535;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 20px 80px; }
  code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 0.88em; }

  header.top { padding-block: 40px 24px; border-bottom: 1px solid var(--line); }
  h1 { font-size: 1.6rem; margin: 0 0 6px; letter-spacing: -0.01em; }
  .lede { color: var(--muted); margin: 0 0 20px; max-width: 68ch; }
  .facts { display: flex; flex-wrap: wrap; gap: 8px 10px; margin: 0; padding: 0; list-style: none; }
  .facts li {
    font-size: 0.82rem; color: var(--muted); background: var(--surface);
    border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px;
  }
  .facts b { color: var(--ink); font-weight: 600; }

  .callout {
    margin: 22px 0 0; padding: 14px 16px; background: var(--warn-bg);
    border: 1px solid var(--warn-line); border-radius: 8px; max-width: 76ch;
  }
  .callout p { margin: 0 0 8px; font-size: 0.92rem; }
  .callout p:last-child { margin-bottom: 0; }

  .bar {
    position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 14px;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
    padding: 10px 20px; margin: 0 -20px 8px; flex-wrap: wrap;
  }
  .bar .count { font-variant-numeric: tabular-nums; font-size: 0.88rem; color: var(--muted); }
  .bar .count b { color: var(--ink); }
  button.act {
    font: inherit; font-size: 0.86rem; padding: 5px 13px; border-radius: 6px;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer;
  }
  button.act:hover { border-color: var(--accent); color: var(--accent); }

  section.state { border-bottom: 1px solid var(--line); padding-block: 30px; scroll-margin-top: 64px; }
  .state-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .state-head h2 { font-size: 1.08rem; margin: 0; font-family: ui-monospace, Consolas, monospace; font-weight: 600; }
  .idx { color: var(--muted); font-weight: 400; margin-right: 8px; }
  .tag {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em;
    border: 1px solid var(--line); border-radius: 4px; padding: 2px 7px; color: var(--muted);
  }

  .cols { display: grid; grid-template-columns: minmax(280px, 34%) 1fr; gap: 26px; align-items: start; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }

  dl { margin: 0 0 16px; }
  dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 12px; }
  dt:first-child { margin-top: 0; }
  dd { margin: 3px 0 0; }
  .amend { margin: 6px 0 0; font-size: 0.85rem; color: var(--muted); }

  .qa { border-left: 2px solid var(--line); padding-left: 13px; margin-top: 18px; font-size: 0.88rem; }
  .qa p { margin: 0 0 7px; }
  .qa-head { color: var(--muted); }
  .qa-label {
    display: block; font-size: 0.7rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted);
  }
  .qa-gap { color: var(--ink); }
  .scope-note { font-size: 0.85rem; color: var(--muted); margin: 16px 0 0; }

  .plates { display: flex; flex-direction: column; gap: 18px; }
  figure.plate { margin: 0; }
  figcaption { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; font-size: 0.78rem; color: var(--muted); }
  .vp { font-weight: 600; color: var(--ink); }
  .sha { margin-left: auto; opacity: 0.7; }
  /* The plate ground stays white in both themes: the page's own theme must not tint a judgement
     about the component's. */
  button.frame {
    display: block; width: 100%; padding: 0; cursor: zoom-in; overflow: auto;
    background: var(--plate-ground); border: 1px solid var(--plate-line); border-radius: 6px;
  }
  button.frame img { display: block; width: 100%; height: auto; }
  button.frame[data-actual] { cursor: zoom-out; }
  button.frame[data-actual] img { width: auto; max-width: none; }

  fieldset.verdict {
    margin: 22px 0 0; border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px 14px;
    display: flex; align-items: center; gap: 18px; flex-wrap: wrap; background: var(--surface);
  }
  legend { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 0 6px; }
  fieldset.verdict label { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer; }
  input.note {
    flex: 1 1 260px; font: inherit; font-size: 0.88rem; padding: 5px 9px;
    border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--ink);
  }
  section.state[data-marked] { background: color-mix(in srgb, var(--accent) 4%, transparent); }

  footer.bottom { padding-top: 34px; }
  textarea#out {
    width: 100%; min-height: 220px; font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--surface); color: var(--ink);
  }
</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <h1>Decision Notice — contact sheet for the C-19 look</h1>
  <p class="lede">
    Twenty contract states, each rendered at both approved viewports, paired with the treatment the
    surface contract declared for it. This is the criterion no test can close.
  </p>
  <ul class="facts">
    <li><b>40</b> plates</li>
    <li><b>20</b> states</li>
    <li>captured <b>${escape(manifest.capturedAt.slice(0, 16).replace("T", " "))}</b> UTC</li>
    <li>names matching contract <b>${fidelity.statesChecked - fidelity.namesDrifted}/${fidelity.statesChecked}</b></li>
    <li>determinism <b>${determinism.artifactsCompared} compared, ${determinism.identical ? "0 differing" : "DIFFERING"}</b></li>
    <li>Visual QA pass ${visualQa.pass} verdict <b>${escape(visualQa.annotation.verdict)}</b></li>
  </ul>

  <div class="callout">
    <p>
      <strong>This sheet is a lens, not evidence.</strong> It is generated from the committed
      captures and the manifest, written to an ignored directory, and rebuilt with
      <code>npm run phase5:contact-sheet</code>. Every plate is verified against the manifest digest
      before it is embedded, so a sheet cannot show you an image the record no longer describes.
    </p>
    <p>
      <strong>Marking every state here does not close C-19.</strong> Only an owner ruling does. The
      Copy button at the bottom produces a block to paste into the decision record, carrying the
      digest of each plate you actually looked at.
    </p>
  </div>
</header>

<div class="bar">
  <span class="count"><b id="done">0</b> of 20 marked</span>
  <button class="act" type="button" id="next">Next unmarked</button>
  <button class="act" type="button" id="expand">Show every plate at actual size</button>
  <button class="act" type="button" id="jump-out">Go to verdict block</button>
</div>

${surface.requiredStates.map(section).join("\n")}

<footer class="bottom">
  <h2 id="verdict-block">Verdict block</h2>
  <p class="lede">
    Paste this into the C-19 decision record. Unmarked states are listed as
    <code>not-looked-at</code> rather than omitted — a state you skipped and a state you accepted are
    not the same claim.
  </p>
  <button class="act" type="button" id="copy">Copy verdict block</button>
  <textarea id="out" readonly spellcheck="false"></textarea>
</footer>

</div>
<script>
(() => {
  const STATES = ${JSON.stringify(surface.requiredStates)};
  const SHAS = ${JSON.stringify(
    Object.fromEntries(
      surface.requiredStates.map((state) => [
        state,
        Object.fromEntries(VIEWPORTS.map((vp) => [vp, plateFor(state, vp).sha])),
      ]),
    ),
  )};
  const KEY = "cuckcode.phase5.c19";

  const sections = [...document.querySelectorAll("section.state")];
  sections.forEach((el, i) => {
    el.querySelector(".idx").textContent = String(i + 1).padStart(2, "0");
  });

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
  };
  const save = (data) => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private window; the page still works */ }
  };

  const collect = () => {
    const marks = {};
    for (const state of STATES) {
      const chosen = document.querySelector('input[name="v-' + state + '"]:checked');
      const note = document.querySelector('input[data-note="' + state + '"]').value.trim();
      marks[state] = { fidelity: chosen ? chosen.value : "not-looked-at", note };
    }
    return marks;
  };

  const render = () => {
    const marks = collect();
    const looked = STATES.filter((s) => marks[s].fidelity !== "not-looked-at");
    document.getElementById("done").textContent = String(looked.length);
    for (const el of sections) {
      const state = el.dataset.state;
      if (marks[state].fidelity !== "not-looked-at") el.setAttribute("data-marked", "");
      else el.removeAttribute("data-marked");
    }
    document.getElementById("out").value = JSON.stringify({
      schema: "cuckcode.phase5-c19-owner-look.v1",
      criterion: "C-19",
      evidenceClass: "human-visual-acceptance",
      lookedAt: "docs/evidence/phase-5/browser, both D-07 viewports",
      capturedAt: ${JSON.stringify(manifest.capturedAt)},
      statesLookedAt: looked.length,
      statesTotal: STATES.length,
      states: Object.fromEntries(
        STATES.map((s) => [s, { ...marks[s], plates: SHAS[s] }])
      ),
      ruling: "REPLACE ME: accept, accept with the noted exceptions, or refuse",
      ruledBy: "owner",
      ruledOn: new Date().toISOString().slice(0, 10),
    }, null, 2);
    save(marks);
  };

  const restore = () => {
    const marks = read();
    for (const [state, mark] of Object.entries(marks)) {
      if (mark.fidelity && mark.fidelity !== "not-looked-at") {
        const input = document.querySelector('input[name="v-' + state + '"][value="' + mark.fidelity + '"]');
        if (input) input.checked = true;
      }
      const note = document.querySelector('input[data-note="' + state + '"]');
      if (note && mark.note) note.value = mark.note;
    }
  };

  document.addEventListener("change", (event) => {
    if (event.target.matches('input[type="radio"], input.note')) render();
  });
  document.addEventListener("input", (event) => {
    if (event.target.matches("input.note")) render();
  });

  document.addEventListener("click", (event) => {
    const frame = event.target.closest("button.frame");
    if (!frame) return;
    if (frame.hasAttribute("data-actual")) frame.removeAttribute("data-actual");
    else frame.setAttribute("data-actual", "");
  });

  document.getElementById("next").addEventListener("click", () => {
    const target = sections.find((el) => !el.hasAttribute("data-marked"));
    (target ?? document.getElementById("verdict-block")).scrollIntoView({ behavior: "smooth", block: "start" });
  });

  let expanded = false;
  document.getElementById("expand").addEventListener("click", (event) => {
    expanded = !expanded;
    for (const frame of document.querySelectorAll("button.frame")) {
      if (expanded) frame.setAttribute("data-actual", "");
      else frame.removeAttribute("data-actual");
    }
    event.target.textContent = expanded ? "Fit every plate to width" : "Show every plate at actual size";
  });

  document.getElementById("jump-out").addEventListener("click", () => {
    document.getElementById("verdict-block").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("copy").addEventListener("click", async (event) => {
    const out = document.getElementById("out");
    try {
      await navigator.clipboard.writeText(out.value);
      event.target.textContent = "Copied";
    } catch {
      out.select();
      event.target.textContent = "Select-and-copy: the clipboard is blocked here";
    }
    setTimeout(() => { event.target.textContent = "Copy verdict block"; }, 2200);
  });

  restore();
  render();
})();
</script>
</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, "utf8");

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    out: OUT.replace(`${ROOT}\\`, "").replaceAll("\\", "/"),
    states: surface.requiredStates.length,
    plates: plates.length,
    elementScoped: ELEMENT_SCOPED.size,
    bytes: Buffer.byteLength(html, "utf8"),
  })}\n`,
);
