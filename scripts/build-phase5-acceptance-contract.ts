import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { BLOCKED_GAPS, BULLET_COVERAGE, CRITERIA } from "./phase5-acceptance-contract.ts";

/**
 * Emits the acceptance contract and its traceability matrix.
 *
 * The bullets are read out of the MDD at build time rather than copied here. A copy would drift, and
 * the copy is exactly what a completeness check would then be verifying against itself.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5");

const document = await readFile(resolve(ROOT, "docs/master-design-document-v0.1.md"), "utf8");
const start = document.indexOf("### Decision Notice acceptance contract");
const end = document.indexOf("Required evidence includes", start);
const bullets = document
  .slice(start, end)
  .split("\n")
  .filter((line) => line.trim().startsWith("- "))
  .map((line) => line.trim().replace(/^- /u, "").replace(/;$/u, "").replace(/\.$/u, ""));

const unmatched: string[] = [];
const contractBulletCoverage = bullets.map((bullet) => {
  const mapping = BULLET_COVERAGE.find((entry) => bullet.includes(entry.match));
  if (!mapping) unmatched.push(bullet);
  return { bullet, criterionIds: mapping?.criterionIds ?? [] };
});

const known = new Set(CRITERIA.map((criterion) => criterion.id));
const danglingIds = contractBulletCoverage
  .flatMap((entry) => entry.criterionIds)
  .filter((id) => !known.has(id));

await mkdir(OUT, { recursive: true });
await writeFile(
  resolve(OUT, "acceptance-contract.json"),
  `${JSON.stringify(
    {
      schema: "cuckcode.phase5-acceptance-contract.v1",
      status:
        "Frozen 2026-09-14 against approved-charter-v1. The three gaps dispositioned as work rather than answers have all closed — 7 by the Task 3 surface contract, 8 by the Task 6 isolation procedure, 3 by the provenance schema ruled on 2026-09-14 — so every criterion can now be assessed. That is not a claim that any of them is met. No implementation is authorized by this document.",
      frozenAt: "2026-09-14",
      charter: "docs/evidence/phase-5/approved-charter-v1.md",
      evidenceClassRule:
        "MDD §18: the four classes are never conflated, and only human-visual-acceptance approves art direction. Passing static, behavioral and rendered evidence cannot substitute for it.",
      blockedGaps: BLOCKED_GAPS,
      criteria: CRITERIA,
      contractBulletCoverage,
      unmatchedBullets: unmatched,
      danglingCriterionIds: danglingIds,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const ready = CRITERIA.filter((criterion) => criterion.status === "ready").length;
process.stdout.write(
  `${JSON.stringify({
    ok: unmatched.length === 0 && danglingIds.length === 0,
    bullets: bullets.length,
    criteria: CRITERIA.length,
    ready,
    blocked: CRITERIA.length - ready,
    unmatchedBullets: unmatched,
    danglingCriterionIds: danglingIds,
  })}\n`,
);
