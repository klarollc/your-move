import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  DECISION_NOTICE_ENTRY_POINTS,
  checkReview,
  composeSideEffectReview,
  reachableModules,
  scanModule,
  type ModuleScan,
} from "./phase5-side-effect-review.ts";

/**
 * Builds the C-11 static side-effect review. Closes the static half the Release Reviewer asked for.
 *
 * The behavioral half already exists and is not replaced: the isolation records show every contract
 * journey clean. This says something the journeys cannot — that the effect is absent from code no
 * journey reached.
 */
const ROOT = resolve(process.cwd());
/**
 * Phase 5 fixture removal (D-1, owner ruling 2026-10-03). The accepted review at
 * `docs/evidence/phase-5/side-effect-review.json` is frozen, and the provenance ledger guards its
 * digest. This builder now writes and checks its successor, over the fixture's own entry points.
 * `scripts/phase5-side-effect-successor.unit.test.ts` holds the successor to R-4: a subset of the
 * accepted modules under the declared mapping, with no new external package and no finding.
 */
const OUT = resolve(ROOT, "docs/evidence/phase-5-fixture-removal/side-effect-review.json");

/**
 * The entry points, declared.
 *
 * The component as the browser loads it, the capture surface the evidence is taken through, and the
 * pure core beneath both. Declaring them is the honest move: "all reachable code" is meaningless
 * without saying reachable *from where*, and a reader can disagree with this list where they could
 * not disagree with an unstated one.
 */
const ENTRY_POINTS = [...DECISION_NOTICE_ENTRY_POINTS];

const workspaceManifests = [
  "packages/application",
  "packages/contracts",
  "packages/domain",
  "packages/persistence",
  "packages/runtime-codex",
  "packages/testing",
  "packages/ui-system",
];

const workspaces = new Map<string, string>();
for (const directory of workspaceManifests) {
  const manifest = JSON.parse(await readFile(resolve(ROOT, directory, "package.json"), "utf8")) as {
    name: string;
    exports?: Record<string, string>;
  };
  const entry = manifest.exports?.["."] ?? "./src/index.ts";
  workspaces.set(manifest.name, `${directory}/${entry.replace(/^\.\//u, "")}`);
}

const reachable = await reachableModules(ROOT, ENTRY_POINTS, workspaces);

const scans: ModuleScan[] = [];
for (const file of reachable.modules) {
  const source = await readFile(resolve(ROOT, file), "utf8").catch(() => "");
  scans.push(scanModule(file, source));
}

const review = composeSideEffectReview({
  entryPoints: ENTRY_POINTS,
  entryPointsWhy:
    "The component as the browser loads it, the capture surface the evidence is taken through, and the pure core beneath both, at their paths in the fixture workspace since the Phase 5 fixture removal. 'All reachable code' means nothing without saying reachable from where, and a reader can disagree with a list they can see.",
  reachable,
  scans,
});
const { ok, findings: byCategory } = review;

/**
 * Checks by default; writes only with --write.
 *
 * DF-018: a verify stage that rewrites committed evidence on every run is idempotent only while its
 * output happens to be deterministic, and the failure surfaces a stage early on a later run. The
 * repository already states this rule for browser captures — they route through
 * tests/support/evidence-output.ts and write into docs/evidence only under
 * CUCKCODE_REGENERATE_EVIDENCE — and scripts/evidence-immutability.test.mjs enforces it against
 * specs but not against builders, which is how this script sat outside a rule it violated.
 * Regenerating is now a deliberate act: npm run phase5:sideeffects:write.
 */
const WRITE = process.argv.includes("--write");
const rendered = `${JSON.stringify(review, null, 2)}\n`;
const onDisk = await readFile(OUT, "utf8").catch(() => null);
const artifact = WRITE ? { ok: true, reason: "WRITTEN" as const } : checkReview(rendered, onDisk);

if (WRITE) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, rendered, "utf8");
}

process.stdout.write(
  `${JSON.stringify({
    ok: ok && artifact.ok,
    mode: WRITE ? "write" : "check",
    artifact: artifact.reason,
    findingsPass: ok,
    modulesScanned: reachable.modules.length,
    externalPackages: reachable.external.length,
    unreadable: reachable.unreadable,
    findings: Object.fromEntries(
      Object.entries(byCategory).map(([category, found]) => [category, found.length]),
    ),
    ...(artifact.ok ? {} : { remedy: "npm run phase5:sideeffects:write" }),
  })}\n`,
);

if (!ok || !artifact.ok) process.exitCode = 1;
