import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const REVIEW_ROOT = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/scored-review");
const RUNS_PATH = resolve(REVIEW_ROOT, "runs.json");
const REGISTER_PATH = resolve(REVIEW_ROOT, "disagreement-register.md");

/** The two roles the brief names for Task 7. Nothing else may review. */
const REVIEWER_ROLE_IDS = ["product-designer", "visual-qa-reviewer"];
const CRITERIA_PER_CANDIDATE = 14;
const CANDIDATES = 3;

type Runs = {
  packetSha256: string;
  independent: boolean;
  reviewers: Array<{
    roleId: string;
    performed: boolean;
    evidencePath?: string;
    transcriptSha256?: string;
    model?: string;
    reasoningEffort?: string;
  }>;
};

const runs = (): Runs => JSON.parse(readFileSync(RUNS_PATH, "utf8")) as Runs;

/** Counts only the review body, so the header note explaining the limit is not miscounted. */
function verdicts(markdown: string): { scored: number; refused: number } {
  const body = markdown.slice(markdown.indexOf("## Review"));
  return {
    scored: body.match(/SCORE \d/gu)?.length ?? 0,
    refused: body.match(/NOT-ASSESSABLE/gu)?.length ?? 0,
  };
}

describe("Phase 6 Task 7 scored review", () => {
  it("was performed by exactly the two roles the brief names", () => {
    const performed = runs().reviewers.filter((entry) => entry.performed);
    expect(performed.map((entry) => entry.roleId).sort()).toEqual([...REVIEWER_ROLE_IDS].sort());
  });

  it("bound every reviewer to the approved model and effort", () => {
    for (const reviewer of runs().reviewers.filter((entry) => entry.performed)) {
      expect(reviewer.model).toBe("gpt-5.6-luna");
      expect(reviewer.reasoningEffort).toBe("medium");
    }
  });

  it("produced two separate artifacts, not one opinion recorded twice", () => {
    const performed = runs().reviewers.filter((entry) => entry.performed);
    const digests = performed.map((entry) => entry.transcriptSha256);
    // Independence has to be observable. Identical transcripts would mean one review was copied,
    // which is the failure the rubric's "separate artifacts" requirement exists to catch.
    expect(new Set(digests).size).toBe(performed.length);
    for (const reviewer of performed) {
      expect(existsSync(resolve(REPOSITORY_ROOT, reviewer.evidencePath as string))).toBe(true);
    }
  });

  it("records a verdict for every criterion of every candidate, in both reviews", () => {
    for (const reviewer of runs().reviewers.filter((entry) => entry.performed)) {
      const markdown = readFileSync(
        resolve(REPOSITORY_ROOT, reviewer.evidencePath as string),
        "utf8",
      );
      const { scored, refused } = verdicts(markdown);
      expect(
        scored + refused,
        `${reviewer.roleId} covered ${scored + refused} of ${CRITERIA_PER_CANDIDATE * CANDIDATES}`,
      ).toBe(CRITERIA_PER_CANDIDATE * CANDIDATES);
    }
  });

  it("keeps refusals visible rather than letting an unfounded score stand in", () => {
    // Every refusal is a criterion the reviewer could not judge from a text-only turn. A review
    // with no refusals would mean the limit was ignored, which is the outcome to catch.
    for (const reviewer of runs().reviewers.filter((entry) => entry.performed)) {
      const markdown = readFileSync(
        resolve(REPOSITORY_ROOT, reviewer.evidencePath as string),
        "utf8",
      );
      expect(verdicts(markdown).refused).toBeGreaterThan(0);
      expect(markdown).toMatch(/not\*{0,2} shown the/iu);
    }
  });

  it("records disagreements rather than averaging them away", () => {
    expect(existsSync(REGISTER_PATH)).toBe(true);
    const register = readFileSync(REGISTER_PATH, "utf8");
    const entries = register.match(/^### D-\d/gmu) ?? [];
    expect(entries.length).toBeGreaterThan(0);
    for (const roleId of REVIEWER_ROLE_IDS) {
      expect(register).toContain(
        roleId === "product-designer" ? "Product Designer" : "Visual QA Reviewer",
      );
    }
    // The rubric forbids resolution by arithmetic. If a mean ever appears here, it is a finding.
    expect(register).not.toMatch(/\baverage(d)? score\b|\bmean score\b/iu);
  });

  it("states that scores select nothing", () => {
    const register = readFileSync(REGISTER_PATH, "utf8");
    expect(register).toMatch(/select(s)? nothing/iu);
  });

  it("leaves no reviewer transcript outside the recorded runs", () => {
    const recorded = new Set(
      runs()
        .reviewers.filter((entry) => entry.performed)
        .map((entry) => (entry.evidencePath as string).split("/").pop()),
    );
    const onDisk = readdirSync(REVIEW_ROOT).filter(
      (name) => name.endsWith(".md") && name !== "disagreement-register.md",
    );
    // A transcript on disk that runs.json does not mention would be an unrecorded review.
    for (const name of onDisk) {
      expect(recorded.has(name), `${name} is on disk but absent from runs.json`).toBe(true);
    }
  });
});
