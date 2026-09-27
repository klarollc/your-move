import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PHASE6_ROLE_IDS,
  PHASE6_ROLE_WORK_AREAS,
  createPhase6ComparisonEvents,
  phase6ComparisonFixtureDigest,
  phase6ComparisonFixtureDigestV1,
  projectPhase6ComparisonFrame,
} from "./phase6-comparison-fixture.js";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const FROZEN_PATH = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/comparison-fixture.json");

type FrozenFixture = {
  schema: string;
  digest: string;
  candidates: Array<{ candidateId: string; manifestPath: string | null }>;
};

const frozen = (): FrozenFixture => JSON.parse(readFileSync(FROZEN_PATH, "utf8")) as FrozenFixture;

describe("Phase 6 comparison fixture", () => {
  it("replays without issues, which is what makes it usable as a shared frame", () => {
    const frame = projectPhase6ComparisonFrame();

    expect(frame.snapshot.replayIssues).toEqual([]);
    expect(frame.snapshot.project.projectId).toBe("project_phase6_comparison");
  });

  it("admits exactly the six promoted roles, each connected and distinctly assigned", () => {
    const { snapshot } = projectPhase6ComparisonFrame();
    const assignments = Object.values(snapshot.staffing.assignments);

    expect(assignments).toHaveLength(6);
    expect(assignments.map((entry) => entry.roleId).sort()).toEqual([...PHASE6_ROLE_IDS].sort());
    // Six distinct agents: two roles held by one agent would make the office unreadable in a way
    // no candidate could fix, and is the distinctness failure this project has hit before.
    expect(new Set(assignments.map((entry) => entry.agentId)).size).toBe(6);
    expect(
      Object.values(snapshot.staffing.agents).every((agent) => agent.health === "connected"),
    ).toBe(true);
  });

  it("places every role in a declared work area", () => {
    for (const roleId of PHASE6_ROLE_IDS) {
      expect(PHASE6_ROLE_WORK_AREAS[roleId]).toBeTruthy();
    }
    expect(Object.keys(PHASE6_ROLE_WORK_AREAS)).toHaveLength(6);
  });

  it("holds one current priority and no escalation", () => {
    const { snapshot, scene, viewState } = projectPhase6ComparisonFrame();
    const workItems = Object.values(snapshot.work.workItems);

    expect(workItems).toHaveLength(1);
    expect(workItems[0]?.state).toBe("active");

    const escalating = scene.filter((descriptor) =>
      ["waiting_input", "blocked", "failed"].includes(descriptor.state),
    );
    expect(escalating).toEqual([]);
    expect(viewState.escalations).toBe(0);
    expect(viewState.currentPriorities).toBe(1);
  });

  it("carries one moving work item and its one moving agent, and nothing else", () => {
    const { scene } = projectPhase6ComparisonFrame();
    const moving = scene.filter((descriptor) => descriptor.semanticMotion);

    // Two descriptors, not one: the active work item moves and so does the agent working it. That
    // is the projector behaving correctly, and the frame must state it rather than assert a
    // tidier number that would fail for the right reason and be "fixed" by weakening the frame.
    const movingWork = moving.filter((descriptor) => descriptor.subjectType === "work");
    const movingAgents = moving.filter((descriptor) => descriptor.subjectType === "agent");

    expect(movingWork).toHaveLength(1);
    expect(movingAgents).toHaveLength(1);
    expect(moving).toHaveLength(2);
    expect(movingAgents[0]?.subjectId).toBe("agent_implementation_engineer");
    // Motion must be backed by canonical state, never decoration.
    expect(movingWork[0]?.causeEventId).toBeTruthy();
  });

  it("is deterministic: the same frame digests identically across runs", () => {
    expect(phase6ComparisonFixtureDigest()).toBe(phase6ComparisonFixtureDigest());
    expect(createPhase6ComparisonEvents()).toEqual(createPhase6ComparisonEvents());
  });

  it("matches the frozen digest once the Phase 7-O additions are removed, so drift fails loudly", () => {
    // P-1, owner-approved 2026-09-25. Phase 7-O adds canonical fields to work truth; the frozen
    // record is never edited. Removing exactly those fields must reproduce it, which proves nothing
    // the owner accepted in Phase 6 moved. The full digest is pinned by the successor record.
    expect(phase6ComparisonFixtureDigestV1()).toBe(frozen().digest);
  });

  it("differs from the frozen digest only because the Phase 7-O additions are present", () => {
    // Without this, a strip function that removed nothing would pass the reduction proof while the
    // additions had no effect on the digest at all.
    expect(phase6ComparisonFixtureDigest()).not.toBe(frozen().digest);
  });

  it("declares exactly the three candidates the brief requires", () => {
    const record = frozen();

    expect(record.candidates.map((entry) => entry.candidateId)).toEqual([
      "candidate-a-architectural-clarity",
      "candidate-b-human-studio-warmth",
      "candidate-c-miniature-craft-precision",
    ]);
  });

  it("requires every produced candidate manifest to name the frozen digest", () => {
    const record = frozen();
    const produced = record.candidates.filter((entry) => entry.manifestPath !== null);

    // Not vacuous by omission: the count of produced manifests is asserted against what is on
    // disk, so a candidate that exists but is unlisted fails here rather than passing silently.
    for (const entry of produced) {
      const manifest = JSON.parse(
        readFileSync(resolve(REPOSITORY_ROOT, entry.manifestPath as string), "utf8"),
      ) as { candidateId: string; fixtureDigest: string };
      expect(manifest.candidateId).toBe(entry.candidateId);
      expect(manifest.fixtureDigest).toBe(record.digest);
    }

    expect(produced).toHaveLength(producedCandidateCount());
  });
});

/** Counts candidate manifests actually present on disk, independent of the registry's claim. */
function producedCandidateCount(): number {
  const root = resolve(REPOSITORY_ROOT, "docs/evidence/phase-6/candidates");
  if (!existsSync(root)) return 0;
  return readdirSync(root, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, "manifest.json")),
  ).length;
}
