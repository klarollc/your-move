import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Captures Phase 5 RED evidence by running the suite and recording how each test actually failed.
 *
 * The declared expectation is `NOT_IMPLEMENTED` for every criterion, because the core exists and does
 * nothing. Recording the expectation *and* the observation is the whole point: a test that failed for
 * a different reason — a typo, a bad import, a broken fixture — is not evidence for its criterion, it
 * is evidence that the harness is wrong. This script is what tells those two apart.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5");
const EXPECTED_REASON = "NOT_IMPLEMENTED";

type VitestJson = {
  testResults: Array<{
    assertionResults: Array<{ title: string; status: string; failureMessages?: string[] }>;
  }>;
};

let raw: string;
try {
  const { stdout } = await run(
    "npx",
    [
      "vitest",
      "run",
      "--project",
      "unit",
      "packages/domain/src/decision-notice.unit.test.ts",
      "--reporter=json",
    ],
    // shell:true is needed to resolve npx on Windows. Every argument below is a fixed literal;
    // nothing here is interpolated from input, so there is no injection surface to escape.
    { cwd: ROOT, shell: true, maxBuffer: 32 * 1024 * 1024 },
  );
  raw = stdout;
} catch (cause) {
  // A failing suite exits non-zero. That is the expected outcome at RED, so the output is still read.
  raw = (cause as { stdout?: string }).stdout ?? "";
}

const start = raw.indexOf("{");
if (start === -1) throw new Error("RED_REPORT_UNREADABLE");
const report = JSON.parse(raw.slice(start)) as VitestJson;

const assertions = report.testResults.flatMap((file) => file.assertionResults);
const observations = assertions.map((assertion) => {
  const message = (assertion.failureMessages ?? []).join("\n");
  const criterion = assertion.title.match(/^(C-\d+)/u)?.[1] ?? null;
  return {
    criterion,
    title: assertion.title,
    status: assertion.status,
    expectedFailureReason: EXPECTED_REASON,
    observedFailureReason: message.includes(EXPECTED_REASON)
      ? EXPECTED_REASON
      : message.split("\n")[0]?.trim() || "(none)",
  };
});

const failedForTheRightReason = observations.filter(
  (entry) => entry.status === "failed" && entry.observedFailureReason === EXPECTED_REASON,
);
const wrongReason = observations.filter(
  (entry) => entry.status === "failed" && entry.observedFailureReason !== EXPECTED_REASON,
);
const notFailed = observations.filter((entry) => entry.status !== "failed");

/** Every ready criterion carrying behavioral evidence must have a test named for it. */
const contract = JSON.parse(await readFile(resolve(OUT, "acceptance-contract.json"), "utf8")) as {
  criteria: Array<{ id: string; status: string; evidenceClasses: string[] }>;
};

const expectUnitTest = contract.criteria.filter(
  (criterion) => criterion.status === "ready" && criterion.evidenceClasses.includes("behavioral"),
);
const tested = new Set(observations.map((entry) => entry.criterion).filter(Boolean));
const untested = expectUnitTest.filter((criterion) => !tested.has(criterion.id)).map((c) => c.id);

await mkdir(OUT, { recursive: true });
await writeFile(
  resolve(OUT, "red-evidence.json"),
  `${JSON.stringify(
    {
      schema: "cuckcode.phase5-red-evidence.v1",
      status:
        "RED recorded. The suite is failing by design; Task 5 turns it green. A red tree here is the evidence, not a defect.",
      recordedAt: new Date().toISOString(),
      expectedFailureReason: EXPECTED_REASON,
      totals: {
        assertions: observations.length,
        failedForTheRightReason: failedForTheRightReason.length,
        failedForAnotherReason: wrongReason.length,
        didNotFail: notFailed.length,
      },
      criteriaRequiringAUnitTest: expectUnitTest.map((criterion) => criterion.id),
      criteriaWithoutATest: untested,
      observations,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({
    ok: wrongReason.length === 0 && notFailed.length === 0 && untested.length === 0,
    assertions: observations.length,
    rightReason: failedForTheRightReason.length,
    wrongReason: wrongReason.map((entry) => entry.title),
    didNotFail: notFailed.map((entry) => entry.title),
    criteriaWithoutATest: untested,
  })}\n`,
);
