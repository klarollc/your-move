import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const MATRIX_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-5/acceptance-contract.json");
const MDD_PATH = resolve(REPOSITORY_ROOT, "docs/master-design-document-v0.1.md");

/** MDD §18. These must never be conflated, and only class 4 approves art direction. */
const EVIDENCE_CLASSES = ["static", "behavioral", "rendered", "human-visual-acceptance"];

type Criterion = {
  id: string;
  statement: string;
  source: string;
  evidenceClasses: string[];
  testableAssertion: string;
  dependsOnGap: number | null;
  status: "ready" | "blocked-on-gap";
  approvesArtDirection?: boolean;
};

type Matrix = {
  schema: string;
  charter: string;
  criteria: Criterion[];
  contractBulletCoverage: Array<{ bullet: string; criterionIds: string[] }>;
  blockedGaps: number[];
};

const matrix = (): Matrix => JSON.parse(readFileSync(MATRIX_PATH, "utf8")) as Matrix;

/** The bullets of the MDD Decision Notice acceptance contract, read from the document, never copied. */
function mddContractBullets(): string[] {
  const document = readFileSync(MDD_PATH, "utf8");
  const start = document.indexOf("### Decision Notice acceptance contract");
  const end = document.indexOf("Required evidence includes", start);
  return document
    .slice(start, end)
    .split("\n")
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => line.trim().replace(/^- /u, "").replace(/;$/u, "").replace(/\.$/u, ""));
}

describe("Phase 5 acceptance contract", () => {
  it("gives every criterion at least one evidence class, from the approved four", () => {
    for (const criterion of matrix().criteria) {
      expect(
        criterion.evidenceClasses.length,
        `${criterion.id} names no evidence class`,
      ).toBeGreaterThan(0);
      for (const evidenceClass of criterion.evidenceClasses) {
        expect(EVIDENCE_CLASSES, `${criterion.id} names an unapproved class`).toContain(
          evidenceClass,
        );
      }
    }
  });

  it("requires human visual acceptance wherever art direction is the thing being judged", () => {
    // MDD §18: only class 4 approves art direction, and classes 1-3 cannot substitute for it. A
    // criterion about fidelity that listed only rendered evidence would be a screenshot diff
    // claiming to approve taste.
    for (const criterion of matrix().criteria.filter((entry) => entry.approvesArtDirection)) {
      expect(
        criterion.evidenceClasses,
        `${criterion.id} judges art direction without human visual acceptance`,
      ).toContain("human-visual-acceptance");
    }
  });

  it("gives every criterion a testable assertion", () => {
    for (const criterion of matrix().criteria) {
      expect(
        criterion.testableAssertion.trim().length,
        `${criterion.id} has no testable assertion`,
      ).toBeGreaterThan(0);
    }
  });

  it("traces every criterion to a source", () => {
    for (const criterion of matrix().criteria) {
      expect(criterion.source.trim().length, `${criterion.id} cites no source`).toBeGreaterThan(0);
    }
  });

  it("covers every bullet of the MDD acceptance contract", () => {
    // The completeness check. A contract that quietly dropped a bullet would narrow the fixture
    // while still calling itself the acceptance contract.
    const bullets = mddContractBullets();
    expect(bullets.length).toBeGreaterThan(0);

    const covered = matrix().contractBulletCoverage;
    expect(covered).toHaveLength(bullets.length);

    const knownIds = new Set(matrix().criteria.map((criterion) => criterion.id));
    for (const entry of covered) {
      expect(
        entry.criterionIds.length,
        `no criterion covers the MDD bullet: ${entry.bullet.slice(0, 60)}`,
      ).toBeGreaterThan(0);
      for (const id of entry.criterionIds) {
        expect(knownIds.has(id), `coverage cites unknown criterion ${id}`).toBe(true);
      }
    }
  });

  it("keeps the recorded bullets identical to the ones in the MDD", () => {
    // Paraphrasing a bullet into the matrix would let the contract drift from the approved document
    // while every other check still passed.
    const bullets = mddContractBullets();
    expect(matrix().contractBulletCoverage.map((entry) => entry.bullet)).toEqual(bullets);
  });

  it("blocks every criterion that depends on an unanswered gap", () => {
    const { criteria, blockedGaps } = matrix();
    expect(blockedGaps.length).toBeGreaterThan(0);
    for (const criterion of criteria) {
      if (criterion.dependsOnGap !== null && blockedGaps.includes(criterion.dependsOnGap)) {
        expect(
          criterion.status,
          `${criterion.id} depends on unanswered gap ${criterion.dependsOnGap} but is not blocked`,
        ).toBe("blocked-on-gap");
      }
    }
  });

  it("never marks a criterion ready while it names an unanswered gap", () => {
    for (const criterion of matrix().criteria.filter((entry) => entry.status === "ready")) {
      const blocked = matrix().blockedGaps;
      expect(
        criterion.dependsOnGap === null || !blocked.includes(criterion.dependsOnGap),
        `${criterion.id} is ready but depends on gap ${criterion.dependsOnGap}`,
      ).toBe(true);
    }
  });

  it("gives criteria unique identifiers", () => {
    const ids = matrix().criteria.map((criterion) => criterion.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the charter it was frozen against", () => {
    expect(matrix().charter).toContain("approved-charter-v1");
  });
});
