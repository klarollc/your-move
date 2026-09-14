import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  EFFECT_PATTERNS,
  reachableModules,
  scanModule,
  type EffectCategory,
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

const hits = scans.filter((scan) => scan.hits.length > 0);
const byCategory = Object.fromEntries(
  (["network", "credential", "deployment", "destructive", "paid"] as EffectCategory[]).map(
    (category) => [
      category,
      hits.flatMap((scan) =>
        scan.hits
          .filter((hit) => hit.category === category)
          .map((hit) => `${scan.file}:${hit.line} ${hit.name}`),
      ),
    ],
  ),
) as Record<EffectCategory, string[]>;

const ok = hits.length === 0 && reachable.unreadable.length === 0;

const review = {
  schema: "cuckcode.phase5-side-effect-review.v1",
  criterion: "C-11",
  evidenceClass: "static",
  status:
    "The static half of C-11, ruled by the owner on 2026-09-14 after release review pass 4. It does not replace the behavioral isolation records; those show the defined journeys are clean, and this says the effect is absent from code no journey reached.",
  decisionRecord: "docs/evidence/phase-5/decision-record-2026-09-14-c-09-c-11.md",
  ranAt: new Date().toISOString(),
  entryPoints: ENTRY_POINTS,
  entryPointsWhy:
    "The component as the browser loads it, the capture surface the evidence is taken through, and the pure core beneath both. 'All reachable code' means nothing without saying reachable from where, and a reader can disagree with a list they can see.",
  categories: EFFECT_PATTERNS.reduce<Record<string, string[]>>((all, effect) => {
    all[effect.category] = [...(all[effect.category] ?? []), effect.name];
    return all;
  }, {}),
  modulesScanned: reachable.modules.length,
  modules: reachable.modules,
  externalPackagesImported: reachable.external,
  nonCodeImports: reachable.assets,
  unreadableModules: reachable.unreadable,
  findings: byCategory,
  findingDetail: hits,
  passCondition:
    "No module reachable from the declared entry points contains a network, credential, deployment, destructive, or paid surface, and every reachable module was readable.",
  ok,

  /**
   * The limits, in the artifact rather than in a footnote. A static scan that does not state what
   * it cannot see invites being read as a proof it is not.
   */
  whatThisCannotEstablish: [
    "Anything reached through dynamic dispatch, computed member access, or eval. The scan reads source text; a call assembled at runtime from strings is invisible to it.",
    "The internals of the external packages listed in externalPackagesImported. Their source is not walked, so this review speaks only for first-party code.",
    "Anything about code not reachable from the declared entry points. Widening the entry list widens the claim, and neither is done silently.",
    "That the behavioral result and this agree by more than coincidence. They are independent evidence of the same criterion and are both required; neither is a substitute for the other.",
  ],
};

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
