import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PHASE6_FIXTURE_SEED,
  PHASE6_ROLE_WORK_AREAS,
  PHASE6_VIEW_STATE,
  phase6ComparisonFixtureDigest,
  projectPhase6ComparisonFrame,
} from "@cuckcode/testing";

/**
 * Writes the frozen Phase 6 comparison frame.
 *
 * Regeneration is deliberate and separate from verification, the same split the Codex protocol
 * bundle uses: `npm run phase6:fixture:freeze` rewrites the artifact, and the unit suite fails when
 * the computed digest stops matching it. A frame that silently re-froze itself would make the
 * drift guard decorative.
 */
const ROOT = resolve(process.cwd());
const OUTPUT = resolve(ROOT, "docs/evidence/phase-6/comparison-fixture.json");

const frame = projectPhase6ComparisonFrame();
if (frame.snapshot.replayIssues.length > 0) {
  throw new Error("PHASE6_FIXTURE_REPLAY_ISSUES");
}

const record = {
  schema: "cuckcode.phase6-comparison-fixture.v1",
  status:
    "FROZEN. Every Phase 6 candidate renders this frame and nothing else. Regenerate only by owner-approved change to the frame.",
  frozenAt: "2026-09-13",
  digest: phase6ComparisonFixtureDigest(),
  seed: PHASE6_FIXTURE_SEED,
  viewState: PHASE6_VIEW_STATE,
  roleWorkAreas: PHASE6_ROLE_WORK_AREAS,
  visibleStateChecklist: [
    "six distinct admitted agents, each at the work area declared in roleWorkAreas",
    "one current priority, in the active state",
    "no escalation: no waiting_input, blocked, or failed subject",
    "runtime health connected for all six agents",
    "inspector closed",
    "attention rail collapsed",
    "camera at reset",
    "identical labels, content density, and state data across candidates",
    "exactly two semantic-motion subjects: the active work item and the agent working it",
  ],
  projection: {
    eventIds: frame.snapshot.eventIds,
    sceneDescriptorCount: frame.scene.length,
    outlineItemCount: frame.outline.items.length,
    agentCount: Object.keys(frame.snapshot.staffing.agents).length,
    assignmentCount: Object.keys(frame.snapshot.staffing.assignments).length,
  },
  candidates: [
    { candidateId: "candidate-a-architectural-clarity", manifestPath: null },
    { candidateId: "candidate-b-human-studio-warmth", manifestPath: null },
    { candidateId: "candidate-c-miniature-craft-precision", manifestPath: null },
  ],
};

await mkdir(resolve(ROOT, "docs/evidence/phase-6"), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(record, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, digest: record.digest })}\n`);
