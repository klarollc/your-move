import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

/**
 * The brief for the Test Engineer's verification pass.
 *
 * It is given the contract, the surface contract, the implementation's public surface and the exact
 * list of tests that exist. What it is *not* given is any suggestion of what the answer should be,
 * because the single most useful thing this role can produce is an honest statement of what is not
 * covered — and a brief that hints at the expected shortfall would be writing that statement itself.
 */
export async function buildVerificationBrief(): Promise<string> {
  const contract = JSON.parse(
    await readFile(resolve(ROOT, "docs/evidence/phase-5/acceptance-contract.json"), "utf8"),
  ) as {
    criteria: Array<{
      id: string;
      statement: string;
      status: string;
      evidenceClasses: string[];
      testableAssertion: string;
    }>;
  };

  const red = JSON.parse(
    await readFile(resolve(ROOT, "docs/evidence/phase-5/red-evidence.json"), "utf8"),
  ) as { observations: Array<{ criterion: string | null; title: string }> };

  const surface = await readFile(
    resolve(ROOT, "docs/evidence/phase-5/surface-contract/surface-contract.json"),
    "utf8",
  );

  const core = await readFile(resolve(ROOT, "packages/domain/src/decision-notice.ts"), "utf8");
  const exported = core
    .split("\n")
    .filter((line) => line.startsWith("export function") || line.startsWith("export type"))
    .map((line) => `  ${line.replace(/\s*\{?$/u, "")}`)
    .join("\n");

  const criteria = contract.criteria
    .map(
      (criterion) =>
        `  ${criterion.id} [${criterion.status}] classes=${criterion.evidenceClasses.join("+")}\n     ${criterion.statement}\n     assertion: ${criterion.testableAssertion}`,
    )
    .join("\n");

  const tests = red.observations.map((entry) => `  ${entry.title}`).join("\n");

  return `THE ACCEPTANCE CONTRACT — twenty-one criteria

${criteria}

THE SURFACE CONTRACT authored by the Product Designer

${surface}

THE IMPLEMENTATION — public surface of the pure core, packages/domain/src/decision-notice.ts

${exported}

THE TESTS THAT EXIST — every test currently in the repository for this component

${tests}

That is the complete list. There are no other tests for this component: no component tests, no
browser tests, no visual captures, no accessibility runs.

YOUR TASK

Assess verification coverage and say what is not covered. Return one JSON object:

{
  "coverageAssessment": [
    {"criterionId": "C-01", "covered": "full" | "partial" | "none",
     "evidence": "which existing test or artifact supports this, or none",
     "gap": "what is missing, or empty when covered"}
  ],
  "missingNegativePaths": ["negative cases the existing tests do not exercise"],
  "isolationProcedure": {
    "steps": ["..."],
    "passCondition": "...",
    "failureEvidence": "what a deliberate failure must produce to count as evidence"
  },
  "deterministicBrowserEvidence": {
    "required": ["what browser evidence each rendered criterion needs"],
    "blockedBy": "what prevents producing it today, or empty if nothing does"
  },
  "notCovered": ["a plain statement of everything this component is not verified for"]
}

Assess all twenty-one criteria. Do not assess a criterion as covered because a test is named for it;
assess it against what the test actually exercises.

Your brief requires you to refuse to treat builds, snapshots, probes, skipped tests, or green suites
alone as proof, and to report coverage gaps rather than restating what passes. A coverage assessment
that finds nothing missing is the outcome this project treats as suspicious.

One JSON object. No prose outside it, no code fence.`;
}
