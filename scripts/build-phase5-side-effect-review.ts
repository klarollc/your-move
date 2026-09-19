import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
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
const OUT = resolve(ROOT, "docs/evidence/phase-5/side-effect-review.json");

/**
 * The entry points, declared.
 *
 * The component as the browser loads it, the capture surface the evidence is taken through, and the
 * pure core beneath both. Declaring them is the honest move: "all reachable code" is meaningless
 * without saying reachable *from where*, and a reader can disagree with this list where they could
 * not disagree with an unstated one.
 */
const ENTRY_POINTS = [
  "apps/web/src/decision-notice.tsx",
  "apps/web/src/decision-notice-capture.tsx",
  "packages/domain/src/decision-notice.ts",
];

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
    "The component as the browser loads it, the capture surface the evidence is taken through, and the pure core beneath both. 'All reachable code' means nothing without saying reachable from where, and a reader can disagree with a list they can see.",
  reachable,
  scans,
});
const { ok, findings: byCategory } = review;

await writeFile(OUT, `${JSON.stringify(review, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify({
    ok,
    modulesScanned: reachable.modules.length,
    externalPackages: reachable.external.length,
    unreadable: reachable.unreadable,
    findings: Object.fromEntries(
      Object.entries(byCategory).map(([category, found]) => [category, found.length]),
    ),
  })}\n`,
);

if (!ok) process.exitCode = 1;
