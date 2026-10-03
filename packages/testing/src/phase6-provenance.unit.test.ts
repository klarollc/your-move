import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const REGISTER_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/provenance-register.json");
const FIXTURE_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/comparison-fixture.json");

/** The five fields the brief requires for every reference, plus the kind that decides how to check it. */
const REQUIRED_FIELDS = [
  "source",
  "creator",
  "licenceBasis",
  "retrievedAt",
  "qualityReferenced",
] as const;

type Reference = Record<(typeof REQUIRED_FIELDS)[number], string> & {
  id: string;
  kind: "in-tree" | "external-normative" | "typeface-by-name";
  appliesTo: string[];
  embedding?: {
    embeddedInRepository: boolean;
    redistributed: boolean;
    embeddingWouldRequireLicenceReview: boolean;
  };
};

type Register = {
  schema: string;
  reviewedAt: string;
  originality: {
    imitatesNamedLivingArtist: boolean;
    reproducesCommercialVisualIdentity: boolean;
    attestation: string;
  };
  references: Reference[];
  gaps: Array<{ id: string; finding: string; disposition: string }>;
};

const register = (): Register => JSON.parse(readFileSync(REGISTER_PATH, "utf8")) as Register;

const candidateIds = (): string[] =>
  (
    JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
      candidates: Array<{ candidateId: string }>;
    }
  ).candidates.map((entry) => entry.candidateId);

describe("Phase 6 provenance and originality review", () => {
  it("records every required field for every reference", () => {
    for (const reference of register().references) {
      for (const field of REQUIRED_FIELDS) {
        expect(
          typeof reference[field] === "string" && reference[field].trim().length > 0,
          `${reference.id} is missing ${field}; an unsourced reference blocks its candidate`,
        ).toBe(true);
      }
    }
  });

  it("names a creator explicitly, including when it is unknown", () => {
    // "where known" is not licence to omit the field. An absent creator and an unknown creator are
    // different claims, and only one of them is honest about what was checked.
    for (const reference of register().references) {
      expect(reference.creator.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * Phase 7 Task 2 moved the Phase 6 primitives into `@cuckcode/ui-system/scene`. The register is
   * frozen evidence and keeps the paths they had when Phase 6 was approved; this map says where
   * each now lives. A map entry must describe a real move: the old path gone, the new one present.
   */
  const MOVED_SOURCES: Readonly<Record<string, string>> = {
    "scripts/phase6-candidate-geometry.ts": "packages/ui-system/src/scene/geometry.ts",
    "scripts/phase6-candidate-render.ts": "packages/ui-system/src/scene/render.ts",
    "scripts/phase6-candidate-styles.ts": "packages/ui-system/src/scene/styles.ts",
  };

  it("resolves every in-tree source to a file that exists, at its recorded or moved path", () => {
    for (const reference of register().references.filter((entry) => entry.kind === "in-tree")) {
      const current = MOVED_SOURCES[reference.source] ?? reference.source;
      expect(
        existsSync(resolve(REPOSITORY_ROOT, current)),
        `${reference.id} cites ${reference.source}, which is not in the tree`,
      ).toBe(true);
    }
  });

  it("maps only real moves", () => {
    for (const [from, to] of Object.entries(MOVED_SOURCES)) {
      expect(existsSync(resolve(REPOSITORY_ROOT, from)), `${from} still exists`).toBe(false);
      expect(existsSync(resolve(REPOSITORY_ROOT, to)), `${to} does not exist`).toBe(true);
    }
  });

  it("covers all three candidates, and cites nothing against a candidate that does not exist", () => {
    const known = new Set(candidateIds());
    const covered = new Set<string>();
    for (const reference of register().references) {
      expect(reference.appliesTo.length).toBeGreaterThan(0);
      for (const candidateId of reference.appliesTo) {
        expect(
          known.has(candidateId),
          `${reference.id} cites unknown candidate ${candidateId}`,
        ).toBe(true);
        covered.add(candidateId);
      }
    }
    expect([...covered].sort()).toEqual([...known].sort());
  });

  it("ties every candidate manifest's provenance to a register reference", () => {
    const ids = new Set(register().references.map((entry) => entry.id));
    for (const candidateId of candidateIds()) {
      const manifest = JSON.parse(
        readFileSync(
          resolve(REPOSITORY_ROOT, `docs/evidence/phase-6/candidates/${candidateId}/manifest.json`),
          "utf8",
        ),
      ) as { provenance: Array<{ referenceId: string }> };
      expect(manifest.provenance.length).toBeGreaterThan(0);
      for (const entry of manifest.provenance) {
        expect(
          ids.has(entry.referenceId),
          `${candidateId} cites unknown reference ${entry.referenceId}`,
        ).toBe(true);
      }
    }
  });

  it("attests originality in the two terms the brief actually forbids", () => {
    const { originality } = register();
    expect(originality.imitatesNamedLivingArtist).toBe(false);
    expect(originality.reproducesCommercialVisualIdentity).toBe(false);
    expect(originality.attestation.trim().length).toBeGreaterThan(40);
  });

  it("records gaps rather than leaving the register silently complete", () => {
    // A review that finds nothing is the outcome this project treats as suspicious. Gaps must be
    // stated with a disposition, so "no reference was consulted" cannot read as "all clear".
    const { gaps } = register();
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.finding.trim().length).toBeGreaterThan(0);
      expect(gap.disposition.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps structured embedding metadata for every typeface named in a candidate", () => {
    const named = register().references.filter((entry) => entry.kind === "typeface-by-name");
    expect(named.length).toBeGreaterThan(0);
    for (const reference of named) {
      // Naming a face in a stack distributes nothing, but the claim has to be a field rather than a
      // sentence. The first version of this test grepped the prose and passed or failed on phrasing,
      // which is a guard that checks how something is written instead of what it says.
      expect(reference.embedding, `${reference.id} has no embedding record`).toBeDefined();
      expect(reference.embedding?.embeddedInRepository).toBe(false);
      expect(reference.embedding?.redistributed).toBe(false);
      expect(typeof reference.embedding?.embeddingWouldRequireLicenceReview).toBe("boolean");
    }
  });
});
