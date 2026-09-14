import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  detectKnowledgeConflicts,
  openKnowledgeConflicts,
  reduceKnowledgeTruth,
  retrieveKnowledge,
} from "@cuckcode/domain";

/**
 * Phase 5 Task 8 — the shared-knowledge scenario, built from a disagreement that actually happened.
 *
 * The gate asks for contribution, retrieval and conflict resolution exercised and passing. Inventing
 * two agents who disagree about a fictional subject would exercise the code and prove nothing about
 * the project, so the scenario is assembled from the real record: the Test Engineer's two
 * verification passes reached different conclusions about the same acceptance criteria, days apart,
 * and the owner's Task 7 rulings are what settled the subjects underneath them.
 *
 * Every record here is derived from a file in `docs/evidence`. Nothing is authored for the scenario.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/shared-knowledge");
const PHASE5 = resolve(ROOT, "docs/evidence/phase-5");

type Assessment = { criterionId: string; covered: string; evidence: string; gap: string };
type Pass = {
  authoredAt: string;
  roleId: string;
  assessment: { coverageAssessment: Assessment[] } | null;
};

const readPass = async (relative: string): Promise<Pass> =>
  JSON.parse(await readFile(resolve(PHASE5, relative), "utf8")) as Pass;

const passOne = await readPass("verification/verification.json");
const passTwo = await readPass("verification/pass-2.json");

const claims = (pass: Pass): Map<string, Assessment> =>
  new Map((pass.assessment?.coverageAssessment ?? []).map((entry) => [entry.criterionId, entry]));

const first = claims(passOne);
const second = claims(passTwo);

/** The criteria the two passes actually disagreed about, discovered rather than listed. */
const disputed = [...first.keys()]
  .filter((criterionId) => first.get(criterionId)?.covered !== second.get(criterionId)?.covered)
  .sort();

let sequence = 0;
const nextEventId = (): string => `event_${String(++sequence).padStart(2, "0")}`;

const contribution = (
  knowledgeId: string,
  subject: string,
  statement: string,
  sourceId: string,
  sourceVersion: number,
): Record<string, unknown> => ({
  schemaVersion: 1,
  eventId: nextEventId(),
  projectId: "project_cuckcode",
  kind: "knowledge.recorded",
  occurredAt: "2026-09-14T09:00:00.000Z",
  receivedAt: "2026-09-14T09:00:00.000Z",
  // Agent-authored findings arrive through the adapter and enter provisional, whatever they request.
  source: "adapter",
  trust: "reported",
  payload: {
    knowledgeId,
    subject,
    statement,
    provenance: { sourceId, sourceVersion },
    requestedStatus: "authoritative",
    authorized: true,
  },
});

const managerTransition = (
  knowledgeId: string,
  toStatus: string,
  fromRevision: number,
  supersededBy?: string,
): Record<string, unknown> => ({
  schemaVersion: 1,
  eventId: nextEventId(),
  projectId: "project_cuckcode",
  kind: "knowledge.status_changed",
  occurredAt: "2026-09-14T18:00:00.000Z",
  receivedAt: "2026-09-14T18:00:00.000Z",
  source: "manager",
  trust: "verified",
  payload: { knowledgeId, toStatus, fromRevision, ...(supersededBy ? { supersededBy } : {}) },
});

// ---- 1. Contribution. Both passes contribute what they concluded, about the same subjects. ----
const contributions: Array<Record<string, unknown>> = [];
for (const criterionId of disputed) {
  const one = first.get(criterionId);
  const two = second.get(criterionId);
  if (!one || !two) continue;
  contributions.push(
    contribution(
      `knowledge_${criterionId.toLowerCase().replace("-", "")}_pass1`,
      criterionId,
      `${criterionId} is ${one.covered}: ${one.evidence}`,
      "artifact_verification-pass-1",
      1,
    ),
    contribution(
      `knowledge_${criterionId.toLowerCase().replace("-", "")}_pass2`,
      criterionId,
      `${criterionId} is ${two.covered}: ${two.evidence}`,
      "artifact_verification-pass-2",
      2,
    ),
  );
}

const contributed = reduceKnowledgeTruth(contributions);

// ---- 2. Retrieval. A reader asks about a disputed subject before anyone has settled it. ----
const firstDisputed = disputed[0] ?? "";
const beforeResolution = retrieveKnowledge(contributed, { subject: firstDisputed });

// ---- 3. Conflict resolution. The later pass supersedes the earlier, by manager authority. ----
const resolutions: Array<Record<string, unknown>> = [];
for (const criterionId of disputed) {
  const key = criterionId.toLowerCase().replace("-", "");
  resolutions.push(
    managerTransition(`knowledge_${key}_pass1`, "superseded", 0, `knowledge_${key}_pass2`),
    managerTransition(`knowledge_${key}_pass2`, "authoritative", 0),
  );
}

const resolved = reduceKnowledgeTruth([...contributions, ...resolutions]);
const afterResolution = retrieveKnowledge(resolved, { subject: firstDisputed });

const record = {
  schema: "cuckcode.phase5-knowledge-scenario.v1",
  status:
    "The Phase 5 gate's shared-knowledge scenario, assembled from the two Test Engineer passes. Every record derives from a file in docs/evidence; none was authored for the scenario.",
  builtAt: new Date().toISOString(),
  // Digested, not merely named. A scenario that quietly derives from a superseded version of its
  // sources is a guard as current as whoever last remembered to rebuild it.
  sources: Object.fromEntries(
    await Promise.all(
      [
        "docs/evidence/phase-5/verification/verification.json",
        "docs/evidence/phase-5/verification/pass-2.json",
      ].map(
        async (path) =>
          [
            path,
            createHash("sha256")
              .update(await readFile(resolve(ROOT, path), "utf8"))
              .digest("hex"),
          ] as const,
      ),
    ),
  ),
  disputedSubjects: disputed,
  contribution: {
    events: contributions.length,
    records: Object.keys(contributed.records).length,
    // Every contribution requested `authoritative` and every one of them landed provisional.
    statuses: Object.fromEntries(
      Object.values(contributed.records).map((entry) => [entry.knowledgeId, entry.status]),
    ),
    issues: contributed.issues.map((issue) => issue.code),
  },
  retrievalBeforeResolution: {
    subject: firstDisputed,
    results: beforeResolution.results.map((entry) => ({
      knowledgeId: entry.knowledgeId,
      status: entry.status,
      provenance: entry.provenance,
      statement: entry.statement,
    })),
    omissions: beforeResolution.omissions,
    openConflicts: openKnowledgeConflicts(contributed).length,
  },
  conflictsBeforeResolution: detectKnowledgeConflicts(contributed),
  conflictsAfterResolution: detectKnowledgeConflicts(resolved),
  retrievalAfterResolution: {
    subject: firstDisputed,
    results: afterResolution.results.map((entry) => ({
      knowledgeId: entry.knowledgeId,
      status: entry.status,
    })),
    // The superseded claim is withheld from the answer and named in the omissions, never dropped.
    omissions: afterResolution.omissions,
    openConflicts: openKnowledgeConflicts(resolved).length,
  },
};

await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, "scenario.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify({
    ok:
      disputed.length > 0 &&
      openKnowledgeConflicts(contributed).length === disputed.length &&
      openKnowledgeConflicts(resolved).length === 0,
    disputedSubjects: disputed,
    openBefore: openKnowledgeConflicts(contributed).length,
    openAfter: openKnowledgeConflicts(resolved).length,
  })}\n`,
);
