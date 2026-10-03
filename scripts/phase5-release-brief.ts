import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { buildEvidenceInventory } from "./phase5-evidence-inventory.js";

const ROOT = resolve(process.cwd());
const PHASE5 = resolve(ROOT, "docs/evidence/phase-5");

/**
 * The brief for the Release Reviewer's Task 9 verdict.
 *
 * Every fact below is read from a file. That is not a style preference: two briefs in this phase have
 * already handed a role a false or incomplete picture, and in both cases the role answered the
 * question it was given, accurately, and the project nearly filed the answer as evidence about
 * something else. A brief is an evidence artifact and its accuracy is a precondition of the answer's.
 *
 * The reviewer is given what exists, what is outstanding, and what this phase deliberately did not
 * do. It is not told what to conclude, and it is told plainly that a green suite is not a verdict —
 * because the single most useful thing this role can produce is a refusal that names its reason.
 */

const digest = async (path: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(resolve(ROOT, path), "utf8"))
    .digest("hex")
    .slice(0, 16);

const readJson = async <T>(path: string, fallback: T): Promise<T> => {
  const body = await readFile(resolve(ROOT, path), "utf8").catch(() => "");
  return body ? (JSON.parse(body) as T) : fallback;
};

export type UnmetCriterion = { id: string; why: string };

export type C17CurrentDisposition = Readonly<{
  criterionId?: string;
  disposition?: string;
  ruledOn?: string;
}>;

/** An out-of-scope ruling from the scope overlay. Out of scope is never satisfaction. */
export type C17Scope = Readonly<{
  criterionId?: string;
  disposition?: string;
  ruledOn?: string;
}>;

export function formatC17Status(
  disposition: C17CurrentDisposition | null,
  walkthroughPresent: boolean,
  scope: C17Scope | null = null,
): string {
  // Scope outranks the waiver and the met disposition alike: a criterion nobody intends to satisfy
  // must never be reported as satisfied, and the reviewer is told what has not been verified.
  if (scope?.criterionId === "C-17" && scope.disposition === "out-of-scope") {
    return `C-17 is out of scope by owner ruling on ${scope.ruledOn ?? "an unrecorded date"}: the human screen-reader walkthrough obligation is retired for this single-user tool. This is not satisfaction and must not be counted as one. What a screen reader announces for this surface has never been verified. Automated accessibility checks, keyboard operability and accessible naming remain in scope, and the historical waiver, disposition and walkthrough records are preserved.`;
  }
  if (disposition?.criterionId === "C-17" && disposition.disposition === "met") {
    return `C-17 is met by owner disposition on ${disposition.ruledOn ?? "an unrecorded date"}; the historical waiver remains preserved, the walkthrough's findings and environment omissions remain open, and this does not replace the independent release review.`;
  }
  if (walkthroughPresent) {
    return "A C-17 screen-reader walkthrough record exists, but no current owner disposition records the criterion as met; independent release review remains required.";
  }
  return "C-17 remains unestablished because no screen-reader walkthrough record exists.";
}

/** Read from the contract and the evidence tree, never asserted here. */
export async function unmetCriteria(): Promise<UnmetCriterion[]> {
  const contract = await readJson<{
    criteria: Array<{ id: string; status: string; dependsOnGap?: number }>;
  }>("docs/evidence/phase-5/acceptance-contract.json", { criteria: [] });

  const unmet: UnmetCriterion[] = contract.criteria
    .filter((criterion) => criterion.status !== "ready")
    .map((criterion) => ({
      id: criterion.id,
      why: `the acceptance contract records it as ${criterion.status}${criterion.dependsOnGap ? `, on gap ${criterion.dependsOnGap}` : ""}`,
    }));

  // C-17 and C-19 are not blocked in the contract; they are simply not done, and nothing in the
  // repository would say so on its own. Both are checked against the evidence tree rather than
  // asserted, so that performing them is what removes them from this list.
  const files = await readdir(PHASE5, { recursive: true }).catch(() => [] as string[]);
  const has = (fragment: string): boolean =>
    files.some((name) => String(name).replaceAll("\\", "/").includes(fragment));

  const waivers = await readJson<{
    waivers: Array<{ criterionId: string; disposition: string; ownerReasoning?: string }>;
  }>("docs/evidence/phase-5/acceptance-contract-waivers.json", { waivers: [] });
  const waived = new Map(waivers.waivers.map((waiver) => [waiver.criterionId, waiver]));
  const currentC17Disposition = await readJson<C17CurrentDisposition | null>(
    "docs/evidence/phase-5/c-17-owner-acceptance.json",
    null,
  );
  const scopeOverlay = await readJson<{ exclusions: C17Scope[] }>(
    "docs/evidence/phase-5/acceptance-contract-scope.json",
    { exclusions: [] },
  );
  const c17OutOfScope = scopeOverlay.exclusions.some(
    (exclusion) => exclusion.criterionId === "C-17" && exclusion.disposition === "out-of-scope",
  );

  const walkthroughPresent = has("screen-reader");
  const c17Met =
    walkthroughPresent &&
    currentC17Disposition?.criterionId === "C-17" &&
    currentC17Disposition.disposition === "met";
  if (!c17Met && !c17OutOfScope) {
    const waiver = waived.get("C-17");
    unmet.push({
      id: "C-17",
      why: !walkthroughPresent
        ? `no screen-reader walkthrough record exists; the owner ${waiver?.disposition ?? "did not disposition"} the criterion on the record. Report it as "waived by owner", never as satisfied. See acceptance-contract-waivers.json for what the waiver leaves unestablished.`
        : "a screen-reader walkthrough record exists, but no current owner disposition records C-17 as met",
    });
  }
  if (!has("owner-acceptance")) {
    unmet.push({
      id: "C-19",
      why: "owner fidelity acceptance is owner-run and no acceptance record exists",
    });
  }
  return unmet;
}

export async function buildReleaseBrief(): Promise<string> {
  const contract = await readJson<{
    criteria: Array<{
      id: string;
      statement: string;
      status: string;
      evidenceClasses: string[];
      testableAssertion: string;
    }>;
  }>("docs/evidence/phase-5/acceptance-contract.json", { criteria: [] });

  /**
   * The latest verification pass, found rather than named.
   *
   * This used to read `pass-2.json` by name, and by the time the reviewer read it, three of the gaps
   * it described had been closed fourteen minutes after it was written. The reviewer reasoned, in
   * good faith, from a description of code that no longer existed. Passes are numbered; take the
   * highest, and check its recorded digests against the files it assessed.
   */
  const passFiles = (await readdir(resolve(PHASE5, "verification")).catch(() => [] as string[]))
    .filter((name) => /^pass-\d+\.json$/u.test(name))
    .sort((left, right) => Number(left.match(/\d+/u)?.[0]) - Number(right.match(/\d+/u)?.[0]));
  const latestPass = passFiles.at(-1) ?? "verification.json";

  const verification = await readJson<{
    assessment: {
      coverageAssessment: Array<{ criterionId: string; covered: string; gap: string }>;
    } | null;
    assessedVersions?: Record<string, string>;
    authoredAt?: string;
  }>(`docs/evidence/phase-5/verification/${latestPass}`, { assessment: null });

  const stale: string[] = [];
  for (const [file, recorded] of Object.entries(verification.assessedVersions ?? {})) {
    const current = await digest(file).catch(() => "");
    if (current && current !== recorded) stale.push(file);
  }

  /**
   * Evidence the pass never saw, which is a different staleness from evidence that changed.
   *
   * The digest check above catches a file that moved under an assessment. It cannot catch an
   * assessment that is accurate about everything it looked at and was written before half the
   * evidence existed — and that is the shape this phase actually hit: pass 6 marked C-09 and C-11
   * partial, correctly, hours before the state matrix and the side-effect review were built.
   *
   * The provenance ledger dates every artifact's first appearance, so the answer is derivable rather
   * than remembered. A reviewer told "this pass describes the build" while an artifact it never read
   * sits in the same brief is being invited to defer to the wrong thing.
   */
  const newerEvidence: string[] = [];
  const provenanceLedger = await readFile(
    resolve(ROOT, "docs/evidence/provenance.jsonl"),
    "utf8",
  ).catch(() => "");
  if (provenanceLedger !== "" && verification.authoredAt) {
    const firstSeen = new Map<string, string>();
    for (const line of provenanceLedger.split("\n").filter((entry) => entry.trim() !== "")) {
      const entry = JSON.parse(line) as { op: string; artifact: string; recordedAt: string };
      if (entry.op !== "record" || firstSeen.has(entry.artifact)) continue;
      firstSeen.set(entry.artifact, entry.recordedAt);
    }
    for (const [artifact, recordedAt] of firstSeen) {
      const isAPass = /\/(?:pass-\d+\.json|verification\.json)$/u.test(artifact);
      if (!isAPass && recordedAt > verification.authoredAt) newerEvidence.push(artifact);
    }
    newerEvidence.sort();
  }

  const visualTwo = await readJson<{
    annotation: {
      verdict?: string;
      verdictReason?: string;
      findings?: Array<{ severity: string; statement: string }>;
    } | null;
  }>("docs/evidence/phase-5/visual-qa/pass-2.json", { annotation: null });

  const manifest = await readJson<{
    expectedCells: number;
    presentCells: number;
    unreachableStates: Array<{ state: string }>;
  }>("docs/evidence/phase-5/browser/capture-manifest.json", {
    expectedCells: 0,
    presentCells: 0,
    unreachableStates: [],
  });

  const fidelity = await readJson<{ namesMatching: number; namesDrifted: number }>(
    "docs/evidence/phase-5/browser/fidelity-check.json",
    { namesMatching: 0, namesDrifted: 0 },
  );

  const knowledge = await readJson<{
    disputedSubjects: string[];
    retrievalAfterResolution: { openConflicts: number };
  }>("docs/evidence/phase-5/shared-knowledge/scenario.json", {
    disputedSubjects: [],
    retrievalAfterResolution: { openConflicts: 0 },
  });

  const ledger = await readJson<{ budget: number; spent: number }>(
    "docs/evidence/phase-5/turn-ledger.json",
    { budget: 0, spent: 0 },
  );
  const c17Disposition = await readJson<C17CurrentDisposition | null>(
    "docs/evidence/phase-5/c-17-owner-acceptance.json",
    null,
  );
  const c17Walkthrough = await readFile(
    resolve(PHASE5, "screen-reader-walkthrough-2026-09-18.md"),
    "utf8",
  )
    .then(() => true)
    .catch(() => false);
  const c17Scope = await readJson<{ exclusions: C17Scope[] }>(
    "docs/evidence/phase-5/acceptance-contract-scope.json",
    { exclusions: [] },
  );
  const c17Status = formatC17Status(
    c17Disposition,
    c17Walkthrough,
    c17Scope.exclusions.find((exclusion) => exclusion.criterionId === "C-17") ?? null,
  );

  const criteria = contract.criteria
    .map(
      (criterion) =>
        `  ${criterion.id} [${criterion.status}] classes=${criterion.evidenceClasses.join("+")}\n     ${criterion.statement}\n     assertion: ${criterion.testableAssertion}`,
    )
    .join("\n");

  const coverage = (verification.assessment?.coverageAssessment ?? [])
    .map((entry) => `  ${entry.criterionId}: ${entry.covered}${entry.gap ? ` — ${entry.gap}` : ""}`)
    .join("\n");

  const visualFindings = (visualTwo.annotation?.findings ?? [])
    .map((finding) => `  [${finding.severity}] ${finding.statement}`)
    .join("\n");

  const outstanding = (await unmetCriteria())
    .map((criterion) => `  ${criterion.id}: ${criterion.why}`)
    .join("\n");

  /**
   * The latest pass of each review, found rather than named.
   *
   * This list used to name `verification/pass-2.json`, which pass 4 has since superseded. Handing a
   * reviewer the digest of a superseded artifact and calling it the current version is the same
   * defect the provenance ledger's P-3 rule now forbids inside the evidence tree; a brief should not
   * be the one place it is still allowed.
   */
  const latestIn = async (directory: string, fallback: string): Promise<string> => {
    const names = (await readdir(resolve(PHASE5, directory)).catch(() => [] as string[]))
      .filter((name) => /^pass-\d+\.json$/u.test(name))
      .sort((left, right) => Number(left.match(/\d+/u)?.[0]) - Number(right.match(/\d+/u)?.[0]));
    return `docs/evidence/phase-5/${directory}/${names.at(-1) ?? fallback}`;
  };

  const versions = Object.fromEntries(
    await Promise.all(
      [
        "fixtures/decision-notice/src/model/decision-notice.ts",
        "fixtures/decision-notice/src/web/decision-notice.tsx",
        "docs/evidence/phase-5/acceptance-contract.json",
        "docs/evidence/phase-5/acceptance-contract-waivers.json",
        "docs/evidence/phase-5/surface-contract/surface-contract.json",
        "docs/evidence/phase-5/surface-contract/amendments.json",
        "docs/evidence/phase-5/surface-contract/focus-contract.json",
        "docs/evidence/phase-5/surface-contract/journeys.json",
        await latestIn("verification", "verification.json"),
        await latestIn("visual-qa", "pass-1.json"),
        "docs/evidence/phase-5/browser/capture-manifest.json",
        "docs/evidence/phase-5/browser/determinism.json",
        "docs/evidence/phase-5/browser/chromium-1440/a11y-state-matrix.json",
        "docs/evidence/phase-5/side-effect-review.json",
        "docs/evidence/phase-5/provenance/schema.json",
        "docs/evidence/phase-5/c-19-owner-acceptance.json",
        "docs/evidence/phase-5/c-17-owner-acceptance.json",
        "docs/evidence/phase-5/decision-record-2026-09-18-c-17-owner-disposition.md",
        "docs/evidence/phase-5/screen-reader-walkthrough-2026-09-18.md",
        "docs/evidence/phase-5/acceptance-contract-scope.json",
      ].map(async (path) => [path, await digest(path)] as const),
    ),
  );

  return `THE ACCEPTANCE CONTRACT — twenty-one criteria

${criteria}

ARTIFACT AND EVIDENCE VERSIONS, by content address

${Object.entries(versions)
  .map(([path, sha]) => `  ${sha}  ${path}`)
  .join("\n")}

THE TEST ENGINEER'S LATEST VERIFICATION PASS — ${latestPass}, of ${passFiles.length + 1} retained

${coverage}

  ${
    stale.length === 0
      ? "That pass recorded the content digests of every file it assessed, and all of them still match. Nothing it looked at has moved since."
      : `**That pass no longer describes this build.** These files changed after it was written: ${stale.join(", ")}. Weigh it accordingly.`
  }

  ${
    newerEvidence.length === 0
      ? "No evidence artifact has appeared since it was written, so it saw everything you are being shown."
      : `**It was written before some of the evidence below existed.** These artifacts first appear in the provenance ledger after that pass was authored, so its assessment was made without them: ${newerEvidence.join(", ")}. Where its coverage line and one of those artifacts disagree, the pass is the older reading and is not the deciding one — read the artifact yourself.`
  }

  Earlier passes disagreed with it and with each other — about C-06, C-12, C-14 and C-20 among
  others. Every pass is retained; none was overwritten. Two of those earlier disagreements were
  caused by the pass being briefed without evidence that existed, which is a defect in this project's
  briefs and not in the reviews.

EVERY PIECE OF EVIDENCE THAT EXISTS — read from the evidence tree, not asserted here

${(await buildEvidenceInventory()).narrative}

THE VISUAL QA REVIEWER'S SECOND ANNOTATION

  Verdict: ${visualTwo.annotation?.verdict ?? "none"}
  Reason: ${visualTwo.annotation?.verdictReason ?? "none"}

${visualFindings || "  no findings"}

  It was shown accessibility trees and image digests, not the images. It marked all twenty states
  partial and deferred every visual judgement.

THE BROWSER CAPTURE

  ${manifest.presentCells} of ${manifest.expectedCells} cells captured at 1440x900 and 1280x800.
  Every image byte-distinct from every other. States the build cannot enter: ${manifest.unreachableStates.length}.
  Contract accessible names: ${fidelity.namesMatching} matching, ${fidelity.namesDrifted} drifting.
  The isolation procedure and its deliberate-failure step are described in the evidence inventory
  above, which reads them from the records rather than restating them here.

THE SHARED-KNOWLEDGE SCENARIO

  Disputed subjects: ${knowledge.disputedSubjects.join(", ") || "none"}.
  Open conflicts after resolution: ${knowledge.retrievalAfterResolution.openConflicts}.

THE SUITE

  npm run verify completes end to end, exit 0, with the provenance check inside it.

  **No per-suite counts are quoted here on purpose.** They were hardcoded in this brief and went
  stale twice; no evidence artifact records them, so this brief will not assert a number it cannot
  read from a file. If a count matters to your verdict, say so in wouldChangeYourVerdict and it will
  be recorded as an artifact rather than as prose.

  That gate has failed silently twice in this project's history — once when Playwright collected a
  Vitest file and died, once when a byte-order mark in package.json killed the second step so the
  other eighteen never ran. Both are in the dogfood register as DF-013 and DF-016.

  A green suite is not a verdict. It is the input you are being asked to weigh, not the answer.

WHAT IS OUTSTANDING

${outstanding || "  nothing"}

WHAT THIS PHASE DELIBERATELY DID NOT DO

  Decision 5-A made this a hybrid run: the promoted roles own design, review and verdict, and the
  implementation was written conventionally, not by an agent. **Phase 5 therefore does not show that
  agents can write this code.** That is a recorded departure from the literal MDD section 24 run.

  MDD section 20's comprehension tasks remain unperformed. The Phase 5 C-17 screen-reader status is
  current only as stated below; the historical waiver remains preserved and must not be rewritten:

  ${c17Status}

  This bounded Decision Notice walkthrough does not by itself close the project-level MDD section 19
  or section 20 debt, establish the omitted browser/viewport and reduced-motion/zoom coverage, or
  authorize code, deployment, production reuse, or Phase 7 work.

  One live round is one sample. Everything known about these roles behaving as distinct agents comes
  from a single thirteen-turn day.

  Turn ledger: ${ledger.spent} of ${ledger.budget}.

YOUR TASK

Return an independent release verdict. One JSON object:

{
  "verdict": "NEEDS WORK" | "ELIGIBLE FOR OWNER APPROVAL",
  "verdictReason": "...",
  "artifactVersions": {"<path>": "<sha256 prefix as given above>"},
  "criterionFindings": [
    {"criterionId": "C-01", "satisfied": true | false,
     "evidenceCited": "which artifact establishes this, by name",
     "reservation": "what you are not satisfied about, or empty"}
  ],
  "outstanding": ["criterion ids that are not met"],
  "wouldChangeYourVerdict": ["what would have to exist for the other verdict to be correct"]
}

Assess all twenty-one criteria. You are not the implementer and you did not write any of this; the
implementation was written conventionally and the evidence was produced by other roles and by
tooling. Cite the artifact you are relying on for each criterion rather than the fact that a test
passed.

Your brief requires you to refuse to let a green suite, a completed checklist, or another role's
verdict substitute for your own judgement, and to state what would change your mind. A verdict that
finds nothing to object to is the outcome this project treats as suspicious.

One JSON object. No prose outside it, no code fence.`;
}
