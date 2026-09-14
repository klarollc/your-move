import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Phase 6 Task 10 — promote the approved visual system from Candidate to Active.
 *
 * Owner-run, like role promotion. Building the request and refusing to execute it is the point: the
 * Phase 6 gate is worded as *explicit owner promotion*, and an agent that promoted on the owner's
 * behalf would have converted an approval into an action the owner never took.
 *
 * All-or-nothing. Every precondition is recomputed here from the artifacts on disk rather than
 * trusted from a summary, and a single failure refuses the whole promotion. A partial promotion
 * would leave some of the system Active under an approval that was given for the whole of it.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-6/visual-system-promotion.json");
const SYSTEM_ID = "reconciliation-b-clarity";

type Precondition = { id: string; requirement: string; satisfied: boolean; detail: string };

const readJson = async <T>(relative: string): Promise<T> =>
  JSON.parse(await readFile(resolve(ROOT, relative), "utf8")) as T;

const goldenStates = await readJson<{
  system: string;
  motionOnlyFindings: string[];
  states: Array<{
    id: string;
    digest: string;
    captures: Record<string, { sha256: string; animationConstructs: number }>;
    ownerApproval: null | { approvedAt: string; record: string; scope: string };
  }>;
}>("docs/evidence/phase-6/golden-states/golden-states.json");

const reconciliation = await readJson<{
  baseCandidate: string;
  fixtureDigest: string;
  failing: unknown[];
}>("docs/evidence/phase-6/reconciliation/reconciliation.json");

const accessibility = await readJson<{ treatments: unknown[]; failing: string[] }>(
  "docs/evidence/phase-6/accessibility-report.json",
);

const provenance = await readJson<{
  references: Array<Record<string, string>>;
  originality: { imitatesNamedLivingArtist: boolean; reproducesCommercialVisualIdentity: boolean };
  gaps: Array<{ id: string }>;
}>("docs/evidence/phase-6/provenance-register.json");

const frozen = await readJson<{ digest: string }>("docs/evidence/phase-6/comparison-fixture.json");

const review = await readJson<{ reviewers: Array<{ roleId: string; performed: boolean }> }>(
  "docs/evidence/phase-6/scored-review/runs.json",
);

const approvals = goldenStates.states.map((state) => state.ownerApproval);
const missingRecord = approvals.filter(
  (approval) => approval !== null && !existsSync(resolve(ROOT, approval.record)),
);

const preconditions: Precondition[] = [
  {
    id: "P1-system-selected",
    requirement: "One coherent visual system is named by the owner's Task 8 ruling.",
    satisfied:
      goldenStates.system === SYSTEM_ID &&
      existsSync(
        resolve(ROOT, "docs/evidence/phase-6/decision-record-2026-09-13-task-8-selection.md"),
      ),
    detail: `golden states were produced in "${goldenStates.system}"`,
  },
  {
    id: "P2-states-approved",
    requirement: "Every golden state carries an owner approval whose record exists on disk.",
    satisfied: approvals.every((approval) => approval !== null) && missingRecord.length === 0,
    detail: `${approvals.filter((a) => a !== null).length} of ${approvals.length} approved, ${missingRecord.length} citing a missing record`,
  },
  {
    id: "P3-frame-unchanged",
    requirement: "The system renders the frozen comparison frame the candidates were compared on.",
    satisfied: reconciliation.fixtureDigest === frozen.digest,
    detail: `reconciliation ${reconciliation.fixtureDigest.slice(0, 16)} vs frozen ${frozen.digest.slice(0, 16)}`,
  },
  {
    id: "P4-contrast",
    requirement: "No contrast or accessibility result is failing, in the system or per state.",
    satisfied: reconciliation.failing.length === 0 && accessibility.failing.length === 0,
    detail: `${reconciliation.failing.length} system failures, ${accessibility.failing.length} state failures`,
  },
  {
    id: "P5-no-motion-only",
    requirement: "No golden-state capture carries meaning through animation.",
    satisfied:
      goldenStates.motionOnlyFindings.length === 0 &&
      goldenStates.states.every((state) =>
        Object.values(state.captures).every((capture) => capture.animationConstructs === 0),
      ),
    detail: `${goldenStates.motionOnlyFindings.length} findings`,
  },
  {
    id: "P6-captures-distinct",
    requirement: "Every golden state is a distinct artifact at every approved viewport.",
    satisfied: ["1440x900", "1280x800"].every((viewport) => {
      const shas = goldenStates.states.map((state) => state.captures[viewport]?.sha256);
      return shas.every(Boolean) && new Set(shas).size === shas.length;
    }),
    detail: `${goldenStates.states.length} states at two viewports`,
  },
  {
    id: "P7-provenance",
    requirement: "Provenance is complete and neither forbidden originality condition is true.",
    satisfied:
      provenance.references.length > 0 &&
      provenance.references.every((reference) =>
        ["source", "creator", "licenceBasis", "retrievedAt", "qualityReferenced"].every(
          (field) => typeof reference[field] === "string" && reference[field].trim().length > 0,
        ),
      ) &&
      !provenance.originality.imitatesNamedLivingArtist &&
      !provenance.originality.reproducesCommercialVisualIdentity,
    detail: `${provenance.references.length} references, ${provenance.gaps.length} open gaps recorded`,
  },
  {
    id: "P8-review-performed",
    requirement: "Both named reviewers performed the Task 7 scored review.",
    satisfied: ["product-designer", "visual-qa-reviewer"].every((roleId) =>
      review.reviewers.some((entry) => entry.roleId === roleId && entry.performed),
    ),
    detail: `${review.reviewers.filter((entry) => entry.performed).length} reviewers performed`,
  },
];

const unmet = preconditions.filter((entry) => !entry.satisfied);

if (unmet.length > 0) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, code: "PROMOTION_PRECONDITION_UNMET", unmet: unmet.map((entry) => entry.id) }, null, 2)}\n`,
  );
  process.exitCode = 1;
} else if (process.env.CUCKCODE_OWNER_PROMOTION !== "1") {
  // The request is built and every precondition holds. The promotion itself is the owner's.
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        code: "OWNER_EXECUTION_REQUIRED",
        system: SYSTEM_ID,
        preconditions: preconditions.map((entry) => ({ id: entry.id, satisfied: entry.satisfied })),
        run: "CUCKCODE_OWNER_PROMOTION=1 npm run phase6:promote",
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
} else {
  await writeFile(
    OUT,
    `${JSON.stringify(
      {
        schema: "cuckcode.phase6-visual-promotion.v1",
        status: "ACTIVE. Promoted from Candidate by the owner under the Phase 6 gate.",
        system: SYSTEM_ID,
        baseCandidate: reconciliation.baseCandidate,
        promotedAt: new Date().toISOString(),
        fixtureDigest: frozen.digest,
        goldenStateDigests: Object.fromEntries(
          goldenStates.states.map((state) => [state.id, state.digest]),
        ),
        captureBaselines: Object.fromEntries(
          goldenStates.states.map((state) => [
            state.id,
            Object.fromEntries(
              Object.entries(state.captures).map(([viewport, capture]) => [
                viewport,
                capture.sha256,
              ]),
            ),
          ]),
        ),
        preconditions,
        limits: [
          "Promotes one visual system to Active. Candidates A and C remain Candidate and are not revoked.",
          "Phase 7 high-fidelity implementation remains unauthorized.",
          "These capture digests are the reviewed baselines. An automated diff against them detects change; it never approves taste.",
          "Three provenance gaps remain open and are not closed by this promotion.",
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({ ok: true, system: SYSTEM_ID, promoted: "Candidate -> Active" })}\n`,
  );
}
