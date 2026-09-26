import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { CODEX_PIN, attemptRecords, parseApprovedRoleExercisePlan } from "@cuckcode/runtime-codex";

import { buildKickoffPreflightInput } from "./phase4-kickoff-preflight.js";
import { openKickoffSession, parseTurnJson } from "./phase4-kickoff-session.js";
import { buildVisualQaBrief } from "./phase5-visual-qa-brief.js";
import { visualQaOverclaims } from "./phase5-visual-qa-crosscheck.js";

/**
 * Phase 5 Task 7 — the Visual QA Reviewer's annotation of the current build.
 *
 * The reviewer is shown accessibility trees, not images. So the cross-check here asks the question
 * that limit creates: did it claim to have judged something it could not see? A reviewer that
 * annotates twenty states "yes" from twenty trees has produced a fidelity sign-off backed by no
 * fidelity evidence, which is precisely the artifact MDD section 18 separates evidence classes to
 * prevent. Claiming a state the build cannot even enter is the same fault, more obvious.
 */
const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, "docs/evidence/phase-5/visual-qa");
const BROWSER = resolve(ROOT, "docs/evidence/phase-5/browser");
const LEDGER = resolve(ROOT, "docs/evidence/phase-5/turn-ledger.json");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
const ROLE_ID = "visual-qa-reviewer";
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
  await readFile(
    resolve(ROOT, "docs/evidence/phase-5/surface-contract/surface-contract.json"),
    "utf8",
  ),
) as { requiredStates: string[] };

const manifest = JSON.parse(await readFile(resolve(BROWSER, "capture-manifest.json"), "utf8")) as {
  unreachableStates: Array<{ state: string }>;
  cells: Array<{ state: string; captured: boolean }>;
};
const unreachable = new Set(manifest.unreachableStates.map((entry) => entry.state));

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
const configuration = approved.plan.find((entry) => entry.roleId === ROLE_ID);
if (!configuration) throw new Error("ROLE_NOT_IN_APPROVED_PLAN");

const preflight = await buildKickoffPreflightInput();
const candidate = preflight.bindings.find((entry) => entry.roleId === ROLE_ID);
if (!candidate) throw new Error("ROLE_NOT_BOUND");

const workspace = await mkdtemp(join(tmpdir(), "cuckcode-phase5-visualqa-"));
await mkdir(OUT, { recursive: true });

/** Passes are appended, never overwritten. A later annotation does not erase an earlier one. */
const nextPassPath = async (): Promise<{ path: string; pass: number; previous: string[] }> => {
  const existing = await readdir(OUT).catch(() => [] as string[]);
  const previous = existing.filter((name) => name.endsWith(".json")).sort();
  const pass = previous.length + 1;
  const path = resolve(OUT, `pass-${pass}.json`);
  if (existsSync(path)) throw new Error(`VISUAL_QA_PASS_PATH_OCCUPIED:${path}`);
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

  /** Structural completeness only. Whether the annotation is honest is the cross-check below. */
  const shortfalls = (value: Record<string, unknown>): string[] => {
    const missing: string[] = [];
    const annotations = Array.isArray(value.stateAnnotations) ? value.stateAnnotations : [];
    const seen = new Set(
      annotations.map((entry) => String((entry as { stateId?: unknown }).stateId ?? "")),
    );
    for (const state of contract.requiredStates) {
      if (!seen.has(state)) missing.push(`state ${state} was not annotated`);
    }
    if (!Array.isArray(value.findings)) missing.push("findings is absent");
    if (!Array.isArray(value.requiresHumanEyes) || value.requiresHumanEyes.length === 0) {
      missing.push("requiresHumanEyes is absent or empty");
    }
    const verdict = String(value.verdict ?? "");
    if (verdict !== "NEEDS WORK" && verdict !== "READY FOR OWNER FIDELITY ACCEPTANCE") {
      missing.push("verdict is not one of the two allowed values");
    }
    if (!String(value.verdictReason ?? "").trim()) missing.push("verdictReason is absent");
    return missing;
  };

  /** Extracted and unit-tested, because it got this wrong once in the direction that matters. */
  const claimCrossCheck = (value: Record<string, unknown>): string[] =>
    visualQaOverclaims(value, unreachable);

  let prompt = await buildVisualQaBrief();

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
      prompt = `Your reply could not be parsed as one JSON object: ${parsed.detail}. Return the annotation again as a single JSON object, nothing else.`;
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
    prompt = `Your annotation is structurally incomplete. Nothing has been filled in for you:\n\n${missing.map((item) => `  - ${item}`).join("\n")}\n\nReturn the complete annotation again as one JSON object. Keep what was already right.`;
  }

  await session.close();
  await rm(workspace, { recursive: true, force: true });

  const destination = await nextPassPath();

  ledger.spent += turnsSpent;
  ledger.entries.push({
    task: "phase-5-task-7-visual-qa",
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
        schema: "cuckcode.phase5-visual-qa.v1",
        pass: destination.pass,
        previousPasses: destination.previous,
        status:
          accepted === null
            ? "NOT ACCEPTED. The Visual QA Reviewer did not produce a complete annotation within its allowance."
            : "Authored by the promoted visual-qa-reviewer from accessibility trees, not images. Class 3 evidence at most; C-19 still requires the owner's own eyes.",
        roleId: ROLE_ID,
        authoredAt: new Date().toISOString(),
        turnsSpent,
        overclaims,
        crossCheck: {
          unreachableStates: [...unreachable],
          capturedCells: manifest.cells.filter((cell) => cell.captured).length,
        },
        attempts,
        annotation: accepted,
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
