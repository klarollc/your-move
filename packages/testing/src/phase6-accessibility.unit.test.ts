import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const REPORT_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/accessibility-report.json");

/**
 * Mirrors the canonical vocabularies in `@cuckcode/domain`. Listed here rather than imported so a
 * state added to the domain fails this suite as an undocumented state, instead of silently
 * expanding both sides of the comparison at once.
 */
const WORK_STATES = [
  "draft",
  "ready",
  "assigned",
  "active",
  "review_requested",
  "verified",
  "completed",
  "waiting_input",
  "blocked",
  "failed",
  "paused",
  "cancelled",
] as const;

const AGENT_PRESENCES = [
  "unavailable",
  "idle",
  "reserved",
  "active",
  "waiting",
  "blocked",
  "reviewing",
  "failed",
] as const;

type Treatment = {
  state: string;
  family: "work" | "agent";
  nonColourCues: string[];
  reducedMotion: string;
};

type CandidateAccessibility = {
  candidateId: string;
  focus: { treatment: string; ratio: number; threshold: number; passes: boolean };
  statePairs: Array<{ state: string; ratio: number; threshold: number; passes: boolean }>;
  accommodation: {
    declaredChanges: string[];
    textCount1440: number;
    textCount1280: number;
    zoneLabels1440: number;
    zoneLabels1280: number;
  };
};

type Report = {
  schema: string;
  treatments: Treatment[];
  candidates: CandidateAccessibility[];
};

const report = (): Report => JSON.parse(readFileSync(REPORT_PATH, "utf8")) as Report;

describe("Phase 6 accessibility and contrast intent", () => {
  it("documents every canonical work state", () => {
    const documented = new Set(
      report()
        .treatments.filter((entry) => entry.family === "work")
        .map((entry) => entry.state),
    );
    for (const state of WORK_STATES) {
      expect(documented.has(state), `work state "${state}" has no documented treatment`).toBe(true);
    }
    expect(documented.size).toBe(WORK_STATES.length);
  });

  it("documents every canonical agent presence", () => {
    const documented = new Set(
      report()
        .treatments.filter((entry) => entry.family === "agent")
        .map((entry) => entry.state),
    );
    for (const presence of AGENT_PRESENCES) {
      expect(
        documented.has(presence),
        `agent presence "${presence}" has no documented treatment`,
      ).toBe(true);
    }
    expect(documented.size).toBe(AGENT_PRESENCES.length);
  });

  it("gives every state a cue that is not colour", () => {
    for (const treatment of report().treatments) {
      expect(
        treatment.nonColourCues.length,
        `${treatment.state} would rely on colour alone`,
      ).toBeGreaterThan(0);
      for (const cue of treatment.nonColourCues) {
        expect(cue.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("makes states distinguishable from each other without colour, not merely annotated", () => {
    // The weaker version of this test checks that every state HAS a cue. Two states can each have a
    // cue and still be identical once colour is removed, which is the defect shape this repository
    // has already recorded against a role-distinctness check that compared only names.
    for (const family of ["work", "agent"] as const) {
      const inFamily = report().treatments.filter((entry) => entry.family === family);
      const signatures = inFamily.map((entry) => [...entry.nonColourCues].sort().join("|"));
      const duplicates = signatures.filter((value, index) => signatures.indexOf(value) !== index);
      expect(
        duplicates,
        `two ${family} states share an identical non-colour signature: ${duplicates.join(", ")}`,
      ).toEqual([]);
    }
  });

  it("gives every state a reduced-motion equivalent that preserves meaning", () => {
    for (const treatment of report().treatments) {
      expect(
        treatment.reducedMotion.trim().length,
        `${treatment.state} has no reduced-motion equivalent`,
      ).toBeGreaterThan(0);
    }
  });

  it("meets the focus-indicator threshold in every candidate", () => {
    for (const candidate of report().candidates) {
      expect(candidate.focus.threshold).toBe(3);
      expect(
        candidate.focus.passes,
        `${candidate.candidateId} focus indicator is ${candidate.focus.ratio}:1`,
      ).toBe(true);
    }
  });

  it("meets its contrast threshold for every state colour in every candidate", () => {
    for (const candidate of report().candidates) {
      expect(candidate.statePairs.length).toBeGreaterThan(0);
      for (const pair of candidate.statePairs) {
        expect(pair.passes, `${candidate.candidateId} / ${pair.state} is ${pair.ratio}:1`).toBe(
          true,
        );
      }
    }
  });

  it("proves the 1280x800 accommodation drops nothing, rather than asserting it", () => {
    // The board page claims nothing is dropped at the narrower viewport. This counts the rendered
    // text in both compositions so the claim is measured against the artifact.
    for (const candidate of report().candidates) {
      const { accommodation } = candidate;
      expect(accommodation.declaredChanges.length).toBeGreaterThan(0);
      expect(accommodation.textCount1280, `${candidate.candidateId} loses text at 1280x800`).toBe(
        accommodation.textCount1440,
      );
      expect(accommodation.zoneLabels1280).toBe(accommodation.zoneLabels1440);
    }
  });
});
