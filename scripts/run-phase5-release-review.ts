import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { CODEX_PIN, attemptRecords, parseApprovedRoleExercisePlan } from "@cuckcode/runtime-codex";

import { buildKickoffPreflightInput } from "./phase4-kickoff-preflight.js";
import { openKickoffSession, parseTurnJson } from "./phase4-kickoff-session.js";
import { buildReleaseBrief, unmetCriteria } from "./phase5-release-brief.js";
import { ELIGIBLE, NEEDS_WORK, releaseOverclaims } from "./phase5-release-crosscheck.js";

/**
 * Phase 5 Task 9 — the Release Reviewer's independent verdict.
 *
 * "The reviewer may not be the implementer" is structural here rather than a promise: the
 * implementation was written conventionally under Decision 5-A, and this role has never seen the
 * working tree. What it is given is the contract, the evidence, and what is outstanding.
 *
 * The cross-check is one-sided on purpose. A refusal needs no defending; an eligibility claim made
 * while the reviewer's own answer names unmet criteria is a contradiction inside one document.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/release-review");
const LEDGER = resolve(ROOT, "docs/evidence/phase-5/turn-ledger.json");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
const ROLE_ID = "release-reviewer";
const MAX_TURNS = 3;

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
) as { criteria: Array<{ id: string }> };
const criterionIds = contract.criteria.map((criterion) => criterion.id);
const unmet = await unmetCriteria();

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
const configuration = approved.plan.find((entry) => entry.roleId === ROLE_ID);
if (!configuration) throw new Error("ROLE_NOT_IN_APPROVED_PLAN");

const preflight = await buildKickoffPreflightInput();
const candidate = preflight.bindings.find((entry) => entry.roleId === ROLE_ID);
if (!candidate) throw new Error("ROLE_NOT_BOUND");

const workspace = await mkdtemp(join(tmpdir(), "cuckcode-phase5-release-"));
await mkdir(OUT, { recursive: true });

/** Passes are appended, never overwritten. A later verdict does not erase an earlier one. */
const nextPassPath = async (): Promise<{ path: string; pass: number; previous: string[] }> => {
  const existing = await readdir(OUT).catch(() => [] as string[]);
  const previous = existing.filter((name) => name.endsWith(".json")).sort();
  const pass = previous.length + 1;
  const path = resolve(OUT, `pass-${pass}.json`);
  if (existsSync(path)) throw new Error(`RELEASE_PASS_PATH_OCCUPIED:${path}`);
  return { path, pass, previous };
};

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

  const shortfalls = (value: Record<string, unknown>): string[] => {
    const missing: string[] = [];
    const findings = Array.isArray(value.criterionFindings) ? value.criterionFindings : [];
    const seen = new Set(
      findings.map((entry) => String((entry as { criterionId?: unknown }).criterionId ?? "")),
    );
    for (const id of criterionIds) {
      if (!seen.has(id)) missing.push(`criterion ${id} was not assessed`);
    }
    const verdict = String(value.verdict ?? "");
    if (verdict !== NEEDS_WORK && verdict !== ELIGIBLE) {
      missing.push(`verdict must be exactly "${NEEDS_WORK}" or "${ELIGIBLE}"`);
    }
    if (!String(value.verdictReason ?? "").trim()) missing.push("verdictReason is absent");
    if (!Array.isArray(value.outstanding)) missing.push("outstanding is absent");
    if (!Array.isArray(value.wouldChangeYourVerdict) || value.wouldChangeYourVerdict.length === 0) {
      missing.push("wouldChangeYourVerdict is absent or empty");
    }
    return missing;
  };

  let prompt = await buildReleaseBrief();

  while (turnsSpent < MAX_TURNS && accepted === null) {
    const turn = await session.turn(prompt);
    turnsSpent += 1;

    if (!turn.ok || turn.effects.length > 0) {
      attempts.push({
        turn: turnsSpent,
        runtime: attemptRecords(turn.attempts),
        accepted: false,
        code: turn.ok ? "EXTERNAL_EFFECT_OBSERVED" : turn.code,
        ...(turn.ok ? {} : { detail: turn.detail }),
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
      prompt = `Your reply could not be parsed as one JSON object: ${parsed.detail}. Return the verdict again as a single JSON object, nothing else.`;
      continue;
    }

    const missing = shortfalls(parsed.value);
    overclaims = releaseOverclaims(parsed.value, unmet);
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
    prompt = `Your verdict is structurally incomplete. Nothing has been filled in for you:\n\n${missing.map((item) => `  - ${item}`).join("\n")}\n\nReturn the complete verdict again as one JSON object. Keep what was already right.`;
  }

  await session.close();
  await rm(workspace, { recursive: true, force: true });

  const destination = await nextPassPath();

  ledger.spent += turnsSpent;
  ledger.entries.push({
    task: "phase-5-task-9-release-review",
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
        schema: "cuckcode.phase5-release-review.v1",
        pass: destination.pass,
        previousPasses: destination.previous,
        status:
          accepted === null
            ? "NOT ACCEPTED. The Release Reviewer did not produce a complete verdict within its allowance."
            : "Authored by the promoted release-reviewer, which is not the implementer and has never seen the working tree. A verdict, not an approval: Task 10 is owner-run.",
        roleId: ROLE_ID,
        authoredAt: new Date().toISOString(),
        turnsSpent,
        overclaims,
        crossCheck: { unmetAtReviewTime: unmet },
        attempts,
        verdict: accepted,
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
      turnsSpent,
      budget: `${ledger.spent}/${ledger.budget}`,
      overclaims: overclaims.length,
      verdict: accepted?.verdict ?? null,
    })}\n`,
  );
  if (accepted === null) process.exitCode = 1;
}
