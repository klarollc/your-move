import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * The Phase 5 gate's shared-knowledge condition, checked against the produced scenario.
 *
 * The gate wording is "contribution, retrieval and conflict resolution exercised and passing", and
 * each of those is a separate assertion below. The scenario itself is built by
 * `npm run phase5:knowledge` from two real Test Engineer passes; this file is what stops it being
 * a JSON document that merely looks like evidence.
 */
const scenario = JSON.parse(
  readFileSync(resolve("docs/evidence/phase-5/shared-knowledge/scenario.json"), "utf8"),
);

test("the scenario still derives from the sources it names", () => {
  // A scenario built from a superseded version of its inputs is a record of a disagreement that no
  // longer exists. Digests, not filenames, are what make that visible.
  for (const [path, digest] of Object.entries(scenario.sources)) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(path), "utf8"))
      .digest("hex");
    assert.equal(actual, digest, `${path} changed since the scenario was built; rebuild it`);
  }
});

test("contribution: agent findings enter provisional however they are requested", () => {
  const statuses = Object.values(scenario.contribution.statuses);
  assert.ok(statuses.length > 0, "the scenario contributed nothing");
  assert.deepEqual(
    [...new Set(statuses)],
    ["provisional"],
    "every contribution requested authoritative; none may have been granted it",
  );
  assert.ok(
    scenario.contribution.issues.every((code) => code === "AGENT_FINDING_REQUIRES_PROMOTION"),
    "the refusal to self-promote must be recorded, not merely applied",
  );
});

test("retrieval: results carry their lifecycle label and their source locator", () => {
  const { results } = scenario.retrievalBeforeResolution;
  assert.ok(results.length >= 2, "a disputed subject should return both claims");
  for (const entry of results) {
    assert.ok(entry.status, `${entry.knowledgeId} has no lifecycle label`);
    assert.ok(entry.provenance?.sourceId, `${entry.knowledgeId} has no source locator`);
    assert.ok(
      Number.isInteger(entry.provenance?.sourceVersion),
      `${entry.knowledgeId} has no source version`,
    );
  }
});

test("retrieval: a superseded claim is withheld and named, never dropped", () => {
  const { results, omissions } = scenario.retrievalAfterResolution;
  assert.equal(results.length, 1, "one claim should survive the resolution");
  assert.equal(omissions.length, 1, "the other must be reported, not silently absent");
  assert.equal(omissions[0].status, "superseded");
  assert.equal(
    omissions[0].supersededBy,
    results[0].knowledgeId,
    "a supersession must name the record that replaced it",
  );
});

test("conflict resolution: every dispute is surfaced, then settled, and retained", () => {
  assert.ok(scenario.disputedSubjects.length > 0, "the scenario exercises no disagreement at all");
  assert.equal(
    scenario.retrievalBeforeResolution.openConflicts,
    scenario.disputedSubjects.length,
    "every disagreement must be open before anyone resolves it",
  );
  assert.equal(
    scenario.retrievalAfterResolution.openConflicts,
    0,
    "every disagreement must be settled by the end of the scenario",
  );

  // Stored and surfaced, per MDD section 15: settling a dispute does not erase that it happened.
  assert.equal(
    scenario.conflictsAfterResolution.length,
    scenario.conflictsBeforeResolution.length,
    "a resolved conflict must be retained, not removed",
  );
  for (const conflict of scenario.conflictsAfterResolution) {
    assert.equal(conflict.resolution === null, false, `${conflict.subject} is still unresolved`);
    assert.ok(
      conflict.resolution.survivingKnowledgeId,
      `${conflict.subject} was resolved without naming a survivor`,
    );
    assert.ok(
      conflict.resolution.disposedOf.length > 0,
      `${conflict.subject} disposed of nothing, so nothing was actually decided`,
    );
    assert.ok(
      conflict.statements.length >= 2,
      `${conflict.subject} is recorded as a conflict without two competing statements`,
    );
  }
});

test("conflict resolution: promotion alone never settles a dispute", () => {
  // The failure this guards is the silent merge: one claim promoted while its contradiction is left
  // live and retrievable. Every resolution here disposes of the losing record explicitly.
  for (const conflict of scenario.conflictsAfterResolution) {
    for (const disposed of conflict.resolution.disposedOf) {
      assert.ok(
        disposed.status === "superseded" || disposed.status === "rejected",
        `${disposed.knowledgeId} was left live with status ${disposed.status}`,
      );
    }
  }
});
