import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const PROMOTION_PATH = resolve(
  REPOSITORY_ROOT,
  "docs/evidence/phase-6/visual-system-promotion.json",
);
const PACKET_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/phase-6-evidence-packet.md");
const SYSTEM_ID = "reconciliation-b-clarity";

type Promotion = {
  status: string;
  system: string;
  fixtureDigest: string;
  goldenStateDigests: Record<string, string>;
  captureBaselines: Record<string, Record<string, string>>;
  preconditions: Array<{ id: string; satisfied: boolean }>;
  limits: string[];
};

const promotion = (): Promotion | null =>
  existsSync(PROMOTION_PATH)
    ? (JSON.parse(readFileSync(PROMOTION_PATH, "utf8")) as Promotion)
    : null;

describe("Phase 6 Task 10 promotion", () => {
  it("ships an evidence packet that states the open items rather than only the wins", () => {
    const packet = readFileSync(PACKET_PATH, "utf8");
    expect(packet).toMatch(/What this phase does not prove/iu);
    // A packet listing only outcomes would be the shape this project exists to refuse.
    expect(packet).toMatch(/no external visual reference/iu);
    expect(packet).toMatch(/generated half/iu);
    expect(packet).toMatch(/Phase 7 high-fidelity implementation remains unauthorized/iu);
  });

  it("keeps promotion owner-run: nothing here promotes on the owner's behalf", () => {
    const script = readFileSync(
      resolve(REPOSITORY_ROOT, "scripts/promote-phase6-visual-system.ts"),
      "utf8",
    );
    expect(script).toContain("CUCKCODE_OWNER_PROMOTION");
    expect(script).toContain("OWNER_EXECUTION_REQUIRED");
  });

  it("is Candidate until the owner runs it, and says so", () => {
    const record = promotion();
    if (record === null) {
      // Not yet promoted. The absence of the record is the honest state, not a missing test.
      expect(existsSync(PROMOTION_PATH)).toBe(false);
      return;
    }
    expect(record.system).toBe(SYSTEM_ID);
    expect(record.status).toMatch(/ACTIVE/u);
  });

  it("records a baseline for every golden state at every approved viewport, once promoted", () => {
    const record = promotion();
    if (record === null) return;
    const states = Object.keys(record.goldenStateDigests);
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      for (const viewport of ["1440x900", "1280x800"]) {
        expect(
          record.captureBaselines[state]?.[viewport],
          `${state} has no ${viewport} baseline`,
        ).toBeTruthy();
      }
    }
    // Baselines must be distinct, or two states share a baseline and a diff can never separate them.
    const all = Object.values(record.captureBaselines).flatMap((entry) => Object.values(entry));
    expect(new Set(all).size).toBe(all.length);
  });

  it("records every precondition as satisfied, once promoted", () => {
    const record = promotion();
    if (record === null) return;
    expect(record.preconditions.length).toBeGreaterThanOrEqual(8);
    for (const precondition of record.preconditions) {
      expect(precondition.satisfied, `${precondition.id} was not satisfied at promotion`).toBe(
        true,
      );
    }
  });

  it("lets every recorded baseline be verified against the capture on disk", () => {
    const record = promotion();
    if (record === null) return;
    // The baseline hashes the rendered string; the file adds an XML declaration and xmlns on write.
    // Reversing that transform must reproduce the baseline exactly, or the recorded digest is not a
    // digest of the artifact it claims to describe and no later diff could be trusted.
    for (const [state, viewports] of Object.entries(record.captureBaselines)) {
      for (const [viewport, baseline] of Object.entries(viewports)) {
        const file = readFileSync(
          resolve(REPOSITORY_ROOT, `docs/evidence/phase-6/golden-states/${state}-${viewport}.svg`),
          "utf8",
        );
        const lines = file.split("\n");
        const rendered = lines
          .slice(1, lines.length - 1)
          .join("\n")
          .replace('<svg xmlns="http://www.w3.org/2000/svg" ', "<svg ");
        expect(
          createHash("sha256").update(rendered).digest("hex"),
          `${state}/${viewport} does not reverse to its recorded baseline`,
        ).toBe(baseline);
      }
    }
  });

  it("carries its limits, including that Phase 7 stays unauthorized", () => {
    const record = promotion();
    if (record === null) return;
    expect(record.limits.join(" ")).toMatch(/Phase 7 .*unauthorized/iu);
    expect(record.limits.join(" ")).toMatch(/never approves taste/iu);
  });
});
