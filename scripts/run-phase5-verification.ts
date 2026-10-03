import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { CODEX_PIN, attemptRecords, parseApprovedRoleExercisePlan } from "@cuckcode/runtime-codex";

import { buildKickoffPreflightInput } from "./phase4-kickoff-preflight.js";
import { openKickoffSession, parseTurnJson } from "./phase4-kickoff-session.js";
import { criteriaWithATest, readTestInventory } from "./phase5-test-inventory.js";
import { buildVerificationBrief } from "./phase5-verification-brief.js";

/**
 * Phase 5 Task 6 — the Test Engineer's verification pass.
 *
 * Its coverage claims are cross-checked against what actually exists rather than accepted. A role
 * that reports a criterion as covered when no test exercises it has produced the exact artifact this
 * project refuses: a green-looking assessment of something nobody verified. The cross-check is how
 * that becomes visible instead of persuasive.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/verification");
const LEDGER = resolve(ROOT, "docs/evidence/phase-5/turn-ledger.json");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
const ROLE_ID = "test-engineer";
const MAX_TURNS = 3;

/**
 * Each pass is written to its own file and no pass ever overwrites another.
 *
 * This runner used to write `verification.json` unconditionally. A second pass would have replaced
 * the Task 6 assessment — two full, thirteen partial, six none — with a later one, and the record
 * that the component was once unverified would simply be gone. That is the same defect that
 * destroyed the RED capture: a guard that checks the present against the present, and cannot see a
 * history being overwritten. `verification.json` is pass 1 and stays where it is.
 */
const nextPassPath = async (): Promise<{ path: string; pass: number; previous: string[] }> => {
  const existing = await readdir(OUT).catch(() => [] as string[]);
  const previous = existing.filter((name) => name.endsWith(".json")).sort();
  const pass = previous.length + 1;
  const path = resolve(OUT, `pass-${pass}.json`);
  if (existsSync(path)) throw new Error(`VERIFICATION_PASS_PATH_OCCUPIED:${path}`);
  return { path, pass, previous };
};

if (process.env.CUCKCODE_LIVE_PHASE5 !== "1") {
  throw new Error("LIVE_PHASE5_EXPLICIT_OPT_IN_REQUIRED");
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

type Ledger = { budget: number; spent: number; entries: Array<Record<string, unknown>> };
const ledger = JSON.parse(await readFile(LEDGER, "utf8")) as Ledger;
if (ledger.spent + MAX_TURNS > ledger.budget) {
  throw new Error(`PHASE5_BUDGET_EXHAUSTED:${ledger.spent}/${ledger.budget}`);
}

const contract = JSON.parse(
  await readFile(resolve(ROOT, "docs/evidence/phase-5/acceptance-contract.json"), "utf8"),
) as { criteria: Array<{ id: string; evidenceClasses: string[]; status: string }> };
const criterionIds = contract.criteria.map((criterion) => criterion.id);
/**
 * Which criteria have a test named for them, read from the test files rather than from the RED
 * record. The RED record lists the seventeen tests that existed at RED and nothing since; a guard
 * built on it would report an honest citation of a component test as an overclaim.
 */
const inventory = await readTestInventory(ROOT);
const hasUnitTest = criteriaWithATest(inventory);

/**
 * What the code looked like when this assessment was made.
 *
 * A coverage assessment is a statement about a particular build, and it stops being true the moment
 * that build changes. Pass 2 was authored fourteen minutes before the commit that closed three of
 * the gaps it named, and the Release Reviewer was later handed it as current — reasoning, in good
 * faith, from a description of code that no longer existed. Recording the digests is what lets a
 * later reader ask whether this assessment still describes anything.
 */
const assessedFiles = [
  "fixtures/decision-notice/src/model/decision-notice.ts",
  "fixtures/decision-notice/src/web/decision-notice.tsx",
  ...inventory.map((entry) => entry.file),
];
const assessedVersions = Object.fromEntries(
  await Promise.all(
    assessedFiles.map(
      async (file) =>
        [file, sha256(await readFile(resolve(ROOT, file), "utf8")).slice(0, 16)] as const,
    ),
  ),
);
/** Nothing in the repository renders this component yet, so no rendered evidence can exist. */
const renderedArtifactsExist = existsSync(resolve(OUT, "..", "browser"));

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
const configuration = approved.plan.find((entry) => entry.roleId === ROLE_ID);
if (!configuration) throw new Error("ROLE_NOT_IN_APPROVED_PLAN");

const preflight = await buildKickoffPreflightInput();
const candidate = preflight.bindings.find((entry) => entry.roleId === ROLE_ID);
if (!candidate) throw new Error("ROLE_NOT_BOUND");

const workspace = await mkdtemp(join(tmpdir(), "cuckcode-phase5-verify-"));
await mkdir(OUT, { recursive: true });

const opened = await openKickoffSession({
  roleId: ROLE_ID,
  agentId: candidate.agentId,
  bindingId: candidate.bindingId,
  cwd: workspace,
  expected: {
    requestedModel: configuration.model,
    expectedReasoningEffort: configuration.reasoningEffort,
    expectedAuthMode: "chatgpt",
    protocolVersion: CODEX_PIN,
    promotedContentSha256: candidate.roleContractVersion.replace(/^content:/u, ""),
  },
});

if (!opened.ok) {
  await rm(workspace, { recursive: true, force: true });
  process.stderr.write(
    `${JSON.stringify({ ok: false, code: opened.code, detail: opened.detail })}\n`,
  );
  process.exitCode = 1;
} else {
  const session = opened.session;
  const attempts: Array<Record<string, unknown>> = [];
  let accepted: Record<string, unknown> | null = null;
  let overclaims: string[] = [];
  let turnsSpent = 0;

  /** Structural completeness only. Whether the claims are *true* is the cross-check below. */
  const shortfalls = (value: Record<string, unknown>): string[] => {
    const missing: string[] = [];
    const assessment = Array.isArray(value.coverageAssessment) ? value.coverageAssessment : [];
    const assessed = new Set(
      assessment.map((entry) => String((entry as { criterionId?: unknown }).criterionId ?? "")),
    );
    for (const id of criterionIds) {
      if (!assessed.has(id)) missing.push(`criterion ${id} was not assessed`);
    }
    const procedure = value.isolationProcedure as Record<string, unknown> | undefined;
    if (!procedure || !Array.isArray(procedure.steps) || procedure.steps.length === 0) {
      missing.push("isolationProcedure.steps is absent or empty");
    }
    if (!procedure || !String(procedure.passCondition ?? "").trim()) {
      missing.push("isolationProcedure.passCondition is absent");
    }
    if (!procedure || !String(procedure.failureEvidence ?? "").trim()) {
      missing.push("isolationProcedure.failureEvidence is absent");
    }
    if (!Array.isArray(value.notCovered)) missing.push("notCovered is absent");
    return missing;
  };

  /**
   * Does the assessment claim coverage that does not exist?
   *
   * A criterion claimed `full` with no unit test and no rendered artifact is an overclaim. This is
   * the check that matters: structural completeness is easy to satisfy and proves nothing.
   */
  const claimCrossCheck = (value: Record<string, unknown>): string[] => {
    const found: string[] = [];
    const assessment = Array.isArray(value.coverageAssessment) ? value.coverageAssessment : [];
    for (const entry of assessment) {
      const id = String((entry as { criterionId?: unknown }).criterionId ?? "");
      const covered = String((entry as { covered?: unknown }).covered ?? "");
      if (covered !== "full") continue;
      const criterion = contract.criteria.find((item) => item.id === id);
      if (!criterion) continue;
      const needsRendered = criterion.evidenceClasses.includes("rendered");
      if (!hasUnitTest.has(id) && !(needsRendered && renderedArtifactsExist)) {
        found.push(
          `${id} claimed fully covered, but no test exercises it and no rendered artifact exists`,
        );
      }
      if (needsRendered && !renderedArtifactsExist) {
        found.push(
          `${id} claimed fully covered though it requires rendered evidence that does not exist`,
        );
      }
    }
    return [...new Set(found)];
  };

  let prompt = await buildVerificationBrief();

  while (turnsSpent < MAX_TURNS && accepted === null) {
    const turn = await session.turn(prompt);
    turnsSpent += 1;

    if (!turn.ok || turn.effects.length > 0) {
      attempts.push({
        turn: turnsSpent,
        runtime: attemptRecords(turn.attempts),
        accepted: false,
        code: turn.ok ? "EXTERNAL_EFFECT_OBSERVED" : turn.code,
      });
      break;
    }

    const parsed = parseTurnJson(turn.text);
    if (!parsed.ok) {
      attempts.push({
        turn: turnsSpent,
        runtime: attemptRecords(turn.attempts),
        accepted: false,
        code: "PAYLOAD_UNPARSEABLE",
        detail: parsed.detail,
      });
      prompt = `Your reply could not be parsed as one JSON object: ${parsed.detail}. Return the assessment again as a single JSON object, nothing else.`;
      continue;
    }

    const missing = shortfalls(parsed.value);
    overclaims = claimCrossCheck(parsed.value);
    attempts.push({
      turn: turnsSpent,
      runtime: attemptRecords(turn.attempts),
      accepted: missing.length === 0,
      shortfalls: missing,
      overclaims,
      responseSha256: sha256(turn.text),
    });

    if (missing.length === 0) {
      accepted = parsed.value;
      break;
    }
    prompt = `Your assessment is structurally incomplete. Nothing has been filled in for you:\n\n${missing.map((item) => `  - ${item}`).join("\n")}\n\nReturn the complete assessment again as one JSON object. Keep what was already right.`;
  }

  await session.close();
  await rm(workspace, { recursive: true, force: true });

  const destination = await nextPassPath();

  ledger.spent += turnsSpent;
  ledger.entries.push({
    task: "phase-5-task-6-verification",
    pass: destination.pass,
    roleId: ROLE_ID,
    turns: turnsSpent,
    accepted: accepted !== null,
    at: new Date().toISOString(),
  });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  await writeFile(
    destination.path,
    `${JSON.stringify(
      {
        schema: "cuckcode.phase5-verification.v1",
        pass: destination.pass,
        previousPasses: destination.previous,
        status:
          accepted === null
            ? "NOT ACCEPTED. The Test Engineer did not produce a complete assessment within its allowance."
            : "Authored by the promoted test-engineer. Coverage claims were cross-checked against what exists.",
        roleId: ROLE_ID,
        authoredAt: new Date().toISOString(),
        turnsSpent,
        assessedVersions,
        overclaims,
        crossCheck: {
          criteriaWithAUnitTest: [...hasUnitTest],
          renderedArtifactsExist,
        },
        attempts,
        assessment: accepted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify({
      ok: accepted !== null,
      pass: destination.pass,
      wrote: destination.path,
      turnsSpent,
      budget: `${ledger.spent}/${ledger.budget}`,
      overclaims: overclaims.length,
    })}\n`,
  );
  if (accepted === null) process.exitCode = 1;
}
