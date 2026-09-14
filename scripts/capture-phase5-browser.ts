import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Phase 5 Task 7 — produce the durable browser evidence and then check it against the contract.
 *
 * Running the captures is the easy half. The half that matters is the join afterwards: the surface
 * contract names twenty states and two viewports, and this script fails unless every one of those
 * forty cells is present or explicitly recorded as unreachable. A capture directory is otherwise
 * complete exactly when nobody counts it.
 *
 * Nothing here is high-fidelity evidence and nothing here is a promoted baseline. Diffs detect
 * change; C-19 still needs the owner's own eyes.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/browser");
const CONTRACT = resolve(ROOT, "docs/evidence/phase-5/surface-contract/surface-contract.json");
const VIEWPORTS = ["chromium-1440", "chromium-1280"] as const;

const contract = JSON.parse(await readFile(CONTRACT, "utf8")) as {
  requiredStates: string[];
  contract: { stateInventory: Array<{ id: string; nonColourCue: string; accessibleName: string }> };
};

await mkdir(OUT, { recursive: true });

const playwright = async (grep: string): Promise<{ ok: boolean; output: string }> => {
  try {
    const { stdout, stderr } = await run(
      "npx",
      ["playwright", "test", "--grep", grep, ...VIEWPORTS.flatMap((name) => ["--project", name])],
      {
        cwd: ROOT,
        shell: true,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, CUCKCODE_REGENERATE_EVIDENCE: "1" },
      },
    );
    return { ok: true, output: `${stdout}${stderr}` };
  } catch (cause) {
    const error = cause as { stdout?: string; stderr?: string };
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};

const suites = {
  visual: await playwright("@visual Phase 5"),
  accessibility: await playwright("@a11y Phase 5"),
  isolation: await playwright("@e2e Phase 5"),
};

const sha256 = (body: Buffer | string): string =>
  createHash("sha256").update(body).digest("hex").slice(0, 16);

type Cell = {
  state: string;
  viewport: string;
  capture: string | null;
  captureSha256: string | null;
  ariaSnapshot: string | null;
  captured: boolean;
  unreachableBecause: string | null;
  externalRequests: string[];
};

const cells: Cell[] = [];
const missing: string[] = [];

for (const viewport of VIEWPORTS) {
  for (const state of contract.requiredStates) {
    const png = resolve(OUT, viewport, `${state}.png`);
    const aria = resolve(OUT, viewport, `${state}.aria.yaml`);
    const journeyPath = resolve(OUT, viewport, `${state}.journey.json`);
    if (!existsSync(journeyPath)) {
      missing.push(`${viewport}/${state}: no journey record`);
      continue;
    }
    const journey = JSON.parse(await readFile(journeyPath, "utf8")) as {
      captured: boolean;
      unreachableBecause: string | null;
      externalRequests: string[];
    };
    if (!existsSync(png)) missing.push(`${viewport}/${state}: no capture`);
    if (!existsSync(aria)) missing.push(`${viewport}/${state}: no accessibility snapshot`);
    cells.push({
      state,
      viewport,
      capture: existsSync(png) ? `${viewport}/${state}.png` : null,
      captureSha256: existsSync(png) ? sha256(await readFile(png)) : null,
      ariaSnapshot: existsSync(aria) ? `${viewport}/${state}.aria.yaml` : null,
      captured: journey.captured,
      unreachableBecause: journey.unreachableBecause,
      externalRequests: journey.externalRequests,
    });
  }
}

/**
 * Two captures of different states that are byte-identical are one capture filed twice. The Phase 6
 * golden-state work found this the hard way, and the check is cheap enough to keep permanently.
 */
const byDigest = new Map<string, string[]>();
for (const cell of cells) {
  if (!cell.captureSha256) continue;
  const key = `${cell.viewport}:${cell.captureSha256}`;
  byDigest.set(key, [...(byDigest.get(key) ?? []), cell.state]);
}
const indistinct = [...byDigest.values()].filter((states) => states.length > 1);

const unreachable = cells.filter((cell) => !cell.captured);
const record = {
  schema: "cuckcode.phase5-browser-capture.v1",
  status:
    "Current-build evidence. Not a promoted baseline, not high-fidelity, and not owner acceptance.",
  capturedAt: new Date().toISOString(),
  viewports: VIEWPORTS,
  requiredStates: contract.requiredStates.length,
  expectedCells: contract.requiredStates.length * VIEWPORTS.length,
  presentCells: cells.length,
  suites: Object.fromEntries(Object.entries(suites).map(([name, result]) => [name, result.ok])),
  missing,
  indistinctCaptures: indistinct,
  unreachableStates: [...new Set(unreachable.map((cell) => cell.state))].map((state) => ({
    state,
    reason: unreachable.find((cell) => cell.state === state)?.unreachableBecause ?? "",
  })),
  cells,
};

await writeFile(
  resolve(OUT, "capture-manifest.json"),
  `${JSON.stringify(record, null, 2)}\n`,
  "utf8",
);

const suiteFailures = Object.entries(suites)
  .filter(([, result]) => !result.ok)
  .map(([name]) => name);
const ok = suiteFailures.length === 0 && missing.length === 0 && indistinct.length === 0;

process.stdout.write(
  `${JSON.stringify({
    ok,
    cells: `${cells.length}/${record.expectedCells}`,
    suiteFailures,
    missing: missing.length,
    indistinctCaptures: indistinct.length,
    unreachableStates: record.unreachableStates.map((entry) => entry.state),
  })}\n`,
);
if (!ok) {
  for (const [name, result] of Object.entries(suites)) {
    if (!result.ok) process.stderr.write(`${name}:\n${result.output.slice(-4000)}\n`);
  }
  process.exitCode = 1;
}

const files = await readdir(OUT, { recursive: true });
process.stdout.write(`${JSON.stringify({ artifacts: files.length })}\n`);
