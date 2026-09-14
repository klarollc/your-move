import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const ROOT = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/golden-states");
const STATES_PATH = resolve(ROOT, "golden-states.json");
const TREATMENTS_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/accessibility-report.json");

/** The six the brief names; the sixth is the reduced-motion equivalent of the other five. */
const REQUIRED_STATE_IDS = [
  "01-default-office",
  "02-active-collaboration",
  "03-manager-escalation",
  "04-blocked-work",
  "05-visual-review",
];

type Capture = { sha256: string; animationConstructs: number; reducedMotionEquivalent: boolean };
type GoldenState = {
  id: string;
  digest: string;
  eventIds: string[];
  sceneDescriptors: Array<{
    subjectType: string;
    subjectId: string;
    state: string;
    semanticMotion: boolean;
  }>;
  visibleChecklist: string[];
  accessibilityNotes: Array<{ state: string }>;
  semanticMotionSubjects: string[];
  captures: Record<string, Capture>;
  environment: Record<string, string>;
  ownerApproval: null | { approvedAt: string; record: string; scope: string };
};

const report = (): { states: GoldenState[]; motionOnlyFindings: string[] } =>
  JSON.parse(readFileSync(STATES_PATH, "utf8")) as {
    states: GoldenState[];
    motionOnlyFindings: string[];
  };

const documentedStates = (): Set<string> =>
  new Set(
    (
      JSON.parse(readFileSync(TREATMENTS_PATH, "utf8")) as {
        treatments: Array<{ family: string; state: string }>;
      }
    ).treatments.map((entry) => `${entry.family}:${entry.state}`),
  );

describe("Phase 6 golden states", () => {
  it("produces every state the brief names", () => {
    expect(report().states.map((state) => state.id)).toEqual(REQUIRED_STATE_IDS);
  });

  it("gives each state a distinct canonical digest", () => {
    const digests = report().states.map((state) => state.digest);
    expect(new Set(digests).size).toBe(digests.length);
  });

  it("renders each state as a distinct artifact at both viewports", () => {
    // Two golden states that render identically are one golden state and a duplicate. The
    // collaboration state did exactly that until its participants were drawn.
    for (const viewport of ["1440x900", "1280x800"]) {
      const shas = report().states.map((state) => state.captures[viewport]?.sha256);
      expect(shas.every(Boolean)).toBe(true);
      expect(new Set(shas).size, `two states share a capture at ${viewport}`).toBe(shas.length);
    }
  });

  it("writes both captures for every state", () => {
    for (const state of report().states) {
      for (const viewport of ["1440x900", "1280x800"]) {
        expect(existsSync(resolve(ROOT, `${state.id}-${viewport}.svg`))).toBe(true);
      }
    }
  });

  it("carries no animation construct, which is what makes reduced motion equivalent", () => {
    expect(report().motionOnlyFindings).toEqual([]);
    for (const state of report().states) {
      for (const capture of Object.values(state.captures)) {
        expect(capture.animationConstructs).toBe(0);
        expect(capture.reducedMotionEquivalent).toBe(true);
      }
    }
  });

  it("has a documented accessible treatment for every state it actually contains", () => {
    // Ties Task 9 back to Task 6. A golden state containing a subject whose state nobody documented
    // would be a frame the office cannot explain without colour.
    const documented = documentedStates();
    for (const state of report().states) {
      for (const descriptor of state.sceneDescriptors) {
        const key = `${descriptor.subjectType === "collaboration" ? "collaboration" : descriptor.subjectType}:${descriptor.state}`;
        expect(documented.has(key), `${state.id} contains undocumented state ${key}`).toBe(true);
      }
    }
  });

  it("shows no activity while work is blocked", () => {
    // The brief forbids fake activity by name. Building these states exposed that a work transition
    // does not move the holding agent's presence, so a naive fixture animated an agent beside
    // blocked work.
    const blocked = report().states.find((state) => state.id === "04-blocked-work");
    expect(blocked?.semanticMotionSubjects).toEqual([]);
  });

  it("keeps the default office identical to the frozen comparison frame's state", () => {
    const base = report().states.find((state) => state.id === "01-default-office");
    expect(base?.semanticMotionSubjects.sort()).toEqual(["agent:active", "work:active"]);
  });

  it("binds the collaboration to recorded participants and does not move them", () => {
    const collaboration = report().states.find((state) => state.id === "02-active-collaboration");
    const agents = new Set(
      collaboration?.sceneDescriptors
        .filter((descriptor) => descriptor.subjectType === "agent")
        .map((descriptor) => descriptor.subjectId),
    );
    const descriptor = collaboration?.sceneDescriptors.find(
      (entry) => entry.subjectType === "collaboration",
    );
    expect(descriptor).toBeDefined();
    // Both recorded participants must exist as agents in the same frame; a collaboration naming an
    // agent who is not present would be a gathering with no one in it.
    for (const participant of ["agent_delivery_lead", "agent_product_designer"]) {
      expect(agents.has(participant)).toBe(true);
    }
  });

  it("cannot claim an approval that has no decision record on disk", () => {
    // An approval written inline is one a build script could invent. Every non-null approval must
    // point at a record that exists, so the claim and the evidence cannot drift apart.
    for (const state of report().states) {
      expect(state.visibleChecklist.length).toBeGreaterThan(0);
      expect(state.eventIds.length).toBeGreaterThan(0);
      expect(state.environment.node).toBeTruthy();
      if (state.ownerApproval === null) continue;
      expect(
        existsSync(resolve(REPOSITORY_ROOT, state.ownerApproval.record)),
        `${state.id} cites approval record ${state.ownerApproval.record}, which is not on disk`,
      ).toBe(true);
      expect(state.ownerApproval.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(state.ownerApproval.scope.trim().length).toBeGreaterThan(0);
    }
  });
});
