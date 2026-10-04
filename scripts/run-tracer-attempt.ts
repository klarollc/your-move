/**
 * run-tracer-attempt.ts — v0.2 (2026-10-03)
 *
 * Status: NOT YET RUN LIVE. Prepared as a patch for owner review; the live opt-in and every live
 * run stay owner-run. Supersedes run-tracer-attempt.draft.ts (v0.1).
 *
 * Purpose: one bounded live attempt of the tracer (DF-007 timestamp test) by the
 * implementation-engineer role, in a linked worktree, under the existing live-run discipline.
 *
 * What changed from v0.1, and why (each item is a defect found by reading the real code):
 *  1. thread/start comes from `exerciseThreadStartParams`, the one builder every live caller
 *     shares. v0.1 sent `task` and `reasoningEffort`, which are not thread/start parameters, and
 *     dropped sandbox, approvalPolicy, baseInstructions, ephemeral and the feature-disable config.
 *     The task rides in `baseInstructions`, the approved channel split.
 *  2. The handshake is complete: instruction-source check, MCP server enumeration, handshake
 *     facts, and `buildBindingReport` (model, effort, auth mode and protocol read back from the
 *     runtime). v0.1 skipped all of it, so a model or effort mismatch would have gone unseen.
 *  3. OWNER RULING 2026-10-03 — scoped file edits. The sandbox is `workspace-write` through the
 *     builder's typed `sandbox` option (P-1, approved), and the posture is READ BACK from
 *     thread/start rather than trusted. After each turn, `judgeTracerTurn` allows `fileChange`
 *     items only when every path stays inside the worktree; any other effect stops the run.
 *  4. The result line is parsed from the last agent message, at the start of a line, instead of
 *     searching the last 2000 characters of a JSON dump of the turn.
 *  5. Shutdown order fixed: stop the process, close the session log, THEN dispose the controlled
 *     home. v0.1 deleted the home under a running process.
 *  6. Turns are counted from the runner's own attempts, so a transport re-submission spends
 *     allowance instead of being invisible.
 *  7. Preconditions: the worktree must be clean at start; its HEAD and per-turn `git status` are
 *     recorded, and a per-attempt transcript is written and hashed.
 *
 * Owner approvals 2026-10-03: P-1 (sandbox option on `exerciseThreadStartParams`), P-2
 * (`hasExactInstructionSource` exported), P-3 (tests: scripts/tracer-guards.unit.test.ts and the
 * role-exercise additions). `checkCompletedTurn` stays private: it enforces text-only turns, which
 * the tracer is not; `judgeTracerTurn` is the tracer's own rule. The runner's wiring itself is
 * untested because it needs a live Codex process.
 *
 * RESIDUAL SURFACE, reported rather than hidden (DF-027 practice): `workspace-write` also makes
 * the temp directory writable, and `thread/start` accepts only a sandbox MODE, not a policy with
 * a narrower writable-root list. The post-turn check sees `fileChange` items only; it cannot see
 * a write the runtime did not report as one. The worktree `git status` after each turn is the
 * second detector for in-tree changes; nothing detects a stray write under the temp directory.
 *
 * One invocation = one attempt. No auto-retry. The script refuses to start when the approved
 * allowance (3 attempts, 30 cumulative turns) is exhausted.
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { composeRole, type RoleBrief } from "@cuckcode/domain";
import {
  CODEX_PIN,
  CodexStdioSupervisor,
  attemptRecords,
  buildBindingReport,
  classifyItem,
  collectHandshakeFacts,
  createControlledCodexHome,
  createRetryBudget,
  enumerateMcpServers,
  exerciseThreadStartParams,
  hasExactInstructionSource,
  openSessionLog,
  resolveInstalledCodexExecutable,
  runTurn,
  type BindingExpectation,
} from "@cuckcode/runtime-codex";

import { assertNoCodexDrift } from "./codex-drift.js";
import {
  RESULT_MARKER,
  checkObservedPosture,
  hostPathApi,
  judgeTracerTurn,
  type FileChangeRecord,
} from "./tracer-guards.js";

const execFileAsync = promisify(execFile);

const ROOT = resolve(process.cwd());
const ROLES_ROOT = resolve(ROOT, "roles");
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/tracer");
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const SCRIPT_NAME = "run-tracer-attempt";
const EXECUTABLE = resolveInstalledCodexExecutable();

const ROLE_ID = "implementation-engineer";
const MAX_TURNS_PER_ATTEMPT = 10;
const MAX_ATTEMPTS = 3;
const TURN_ALLOWANCE = 30;
const RECORD_SCHEMA = "cuckcode.tracer-record.v1";

const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

function arg(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) throw new Error(`TRACER_ARG_REQUIRED:${name}`);
  return hit.slice(name.length + 1);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type TurnNote = {
  turn: number;
  turnId: string | null;
  itemTypes: string[];
  fileChanges: FileChangeRecord[];
  worktreeStatus: string[];
  agentText: string | null;
  runtimeAttempts: number;
};

type AttemptOutcome = {
  attempt: number;
  observedAt: string;
  turnsUsed: number;
  code: string;
  detail: string;
  contractSha256: string;
  roleContentSha256: string;
  worktree: string;
  baseCommit: string;
  model: string;
  reasoningEffort: string;
  bindingFingerprint: string | null;
  transcriptPath: string | null;
  transcriptSha256: string | null;
};

type TracerRecord = {
  schema: string;
  task: string;
  turnAllowance: number;
  maxAttempts: number;
  maxTurnsPerAttempt: number;
  recordedAt: string;
  status: string;
  attempts: AttemptOutcome[];
};

async function loadRecord(path: string): Promise<TracerRecord> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as Partial<TracerRecord>;
    if (raw.schema !== RECORD_SCHEMA || !Array.isArray(raw.attempts)) {
      throw new Error("TRACER_RECORD_INVALID");
    }
    return raw as TracerRecord;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        schema: RECORD_SCHEMA,
        task: "df-007-timestamp-test",
        turnAllowance: TURN_ALLOWANCE,
        maxAttempts: MAX_ATTEMPTS,
        maxTurnsPerAttempt: MAX_TURNS_PER_ATTEMPT,
        recordedAt: "",
        status: "tracer-not-started",
        attempts: [],
      };
    }
    throw err;
  }
}

async function git(worktree: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", worktree, ...args]);
  return stdout;
}

/** A linked worktree has a `.git` FILE; the owner's live working copy has a `.git` directory. */
async function assertLinkedWorktree(worktree: string): Promise<string> {
  const s = await stat(join(worktree, ".git")).catch(() => {
    throw new Error(`TRACER_WORKTREE_NOT_GIT:${worktree}`);
  });
  if (s.isDirectory()) throw new Error(`TRACER_WORKTREE_IS_MAIN_CHECKOUT:${worktree}`);
  if (resolve((await git(worktree, "rev-parse", "--show-toplevel")).trim()) === ROOT) {
    throw new Error(`TRACER_WORKTREE_IS_REPO_ROOT:${worktree}`);
  }
  const dirty = (await git(worktree, "status", "--porcelain")).trim();
  if (dirty.length > 0) throw new Error("TRACER_WORKTREE_NOT_CLEAN");
  return (await git(worktree, "rev-parse", "HEAD")).trim();
}

function nestedId(value: unknown, key: string): string | undefined {
  const inner = isRecord(value) ? value[key] : undefined;
  return isRecord(inner) && typeof inner.id === "string" && inner.id.length > 0
    ? inner.id
    : undefined;
}

/** The task rides in baseInstructions: the approved channel split, one shared builder. */
function livePrompt(contractText: string): string {
  return [
    "You are working on the CuckCode tracer task in the current directory, a linked git worktree.",
    "Edit files only inside this worktree. Do not run commands, use the network, or call tools other than editing files.",
    `End your final turn with exactly one line starting with "${RESULT_MARKER}" followed by "done" or "blocked" and a one-line summary.`,
    "",
    "--- BOUNDED WORK CONTRACT ---",
    contractText,
  ].join("\n");
}

if (process.env.CUCKCODE_LIVE_TRACER !== "1") {
  throw new Error("LIVE_TRACER_EXPLICIT_OPT_IN_REQUIRED");
}
// R1.2: refuse before any session opens if the installed Codex is not the pinned one.
await assertNoCodexDrift();

const worktree = resolve(arg("--worktree"));
const contractPath = resolve(arg("--contract"));
const model = arg("--model");
const reasoningEffort = arg("--reasoning-effort");
const baseCommit = await assertLinkedWorktree(worktree);

const contractText = await readFile(contractPath, "utf8");
const contractSha256 = sha256(contractText);

// Role content is checked against the pinned digest, read-only. This script never writes
// roles/exercises.json and never touches the performed flags.
const exerciseRecord = JSON.parse(
  await readFile(resolve(ROLES_ROOT, "exercises.json"), "utf8"),
) as {
  exercises: Array<{ roleId: string; contentSha256: string }>;
};
const roleEntry = exerciseRecord.exercises.find((e) => e.roleId === ROLE_ID);
if (!roleEntry) throw new Error(`TRACER_ROLE_UNKNOWN:${ROLE_ID}`);
const artifact = await readFile(resolve(ROLES_ROOT, "authored", `${ROLE_ID}.json`));
if (sha256(artifact) !== roleEntry.contentSha256)
  throw new Error(`TRACER_ROLE_ARTIFACT_DRIFT:${ROLE_ID}`);
const composed = composeRole(JSON.parse(artifact.toString("utf8")) as RoleBrief);
if (!composed.ok) throw new Error(`TRACER_COMPOSITION_REFUSED:${composed.refusal.code}`);

await mkdir(EVIDENCE_ROOT, { recursive: true });
const recordPath = resolve(EVIDENCE_ROOT, "tracer-record.json");
const record = await loadRecord(recordPath);
const cumulativeTurns = record.attempts.reduce((n, a) => n + a.turnsUsed, 0);
if (record.attempts.length >= MAX_ATTEMPTS || cumulativeTurns >= TURN_ALLOWANCE) {
  throw new Error(
    `TRACER_ALLOWANCE_EXHAUSTED:attempts=${record.attempts.length}/${MAX_ATTEMPTS} turns=${cumulativeTurns}/${TURN_ALLOWANCE} — owner review required before any further live work`,
  );
}
const attemptNumber = record.attempts.length + 1;
const turnsAvailable = Math.min(MAX_TURNS_PER_ATTEMPT, TURN_ALLOWANCE - cumulativeTurns);

const expected: BindingExpectation = {
  requestedModel: model,
  expectedReasoningEffort: reasoningEffort,
  expectedAuthMode: "chatgpt",
  protocolVersion: CODEX_PIN,
  promotedContentSha256: roleEntry.contentSha256,
};

const home = await createControlledCodexHome({
  parentDirectory: tmpdir(),
  instruction: composed.text,
  credentialSourcePath: CREDENTIAL_SOURCE,
});
const observedAt = new Date().toISOString();
const supervisor = new CodexStdioSupervisor({ executable: EXECUTABLE, codexHome: home.path });
const sessionLog = openSessionLog(supervisor, {
  root: SESSIONS_ROOT,
  script: SCRIPT_NAME,
  roleId: ROLE_ID,
  pin: CODEX_PIN,
});

const notes: TurnNote[] = [];
let bindingFingerprint: string | null = null;
let turnsUsed = 0;
let code: string;
let detail: string;

try {
  const initialized = await supervisor.start();
  const auth = await supervisor.readAccountStatus();
  if (!auth.ok) {
    code = "TRACER_AUTH_REQUIRED";
    detail = "managed runtime authentication absent";
  } else {
    // The ONE deliberate difference from the exercise posture is the sandbox mode, passed through
    // the shared builder's typed option. Everything else (approvalPolicy never, ephemeral,
    // baseInstructions, feature-disable config) is the builder's.
    const params = exerciseThreadStartParams(worktree, expected, livePrompt(contractText), {
      sandbox: "workspace-write",
    });
    const threadStart = await supervisor.request("thread/start", params, 30_000);

    const posture = checkObservedPosture(threadStart);
    if (!hasExactInstructionSource(threadStart, home.instructionPath)) {
      code = "TRACER_INSTRUCTION_SOURCE_MISMATCH";
      detail = "the session did not load exactly the controlled role instruction file";
    } else if (!posture.ok) {
      code = "TRACER_POSTURE_REFUSED";
      detail = posture.detail;
    } else {
      const threadId = nestedId(threadStart, "thread");
      if (!threadId) throw new Error("TRACER_THREAD_START_INVALID");
      const mcpServers = await enumerateMcpServers(supervisor, threadId);
      const facts = collectHandshakeFacts({
        agentId: `tracer-${ROLE_ID}`,
        bindingId: `tracer-${ROLE_ID}-${observedAt}`,
        roleId: ROLE_ID,
        userAgent: initialized.userAgent,
        auth,
        threadStart,
        mcpServers,
      });
      const binding = buildBindingReport(facts, expected);
      if (!binding.ok) {
        code = "TRACER_BINDING_REFUSED";
        detail = `${binding.failure.code}: ${binding.failure.detail}`;
      } else {
        bindingFingerprint = binding.report.materialFingerprint;
        code = "TRACER_TURN_CAP_REACHED";
        detail = `stopped at the ${turnsAvailable}-turn cap without a ${RESULT_MARKER} line`;
        const retryBudget = createRetryBudget(2); // CX-4, per attempt rather than per process
        const pathApi = hostPathApi(platform());

        while (turnsUsed < turnsAvailable) {
          const run = await runTurn(supervisor, {
            threadId,
            retryBudget,
            input: [
              {
                type: "text",
                text:
                  turnsUsed === 0
                    ? "Begin the tracer task."
                    : `Continue. If the task is finished or blocked, end your turn with a line starting exactly with "${RESULT_MARKER}" followed by "done" or "blocked" and a one-line summary.`,
              },
            ],
          });
          // A transport re-submission is a real turn on the thread: it spends allowance.
          turnsUsed += Math.max(1, run.attempts.length);
          const runtime = attemptRecords(run.attempts);
          if (!run.ok) {
            code = "TRACER_TURN_FAILED";
            detail = `${run.code}: ${run.detail}`;
            notes.push({
              turn: turnsUsed,
              turnId: run.turn?.id ?? null,
              itemTypes: [],
              fileChanges: [],
              worktreeStatus: [],
              agentText: null,
              runtimeAttempts: runtime.length,
            });
            break;
          }
          const verdict = judgeTracerTurn({
            turn: run.turn,
            threadId,
            expectedTurnId: run.turn.id,
            worktree,
            classify: classifyItem,
            pathApi,
          });
          const status = (await git(worktree, "status", "--porcelain")).split("\n").filter(Boolean);
          const agentText =
            run.turn.items
              .map((i) =>
                isRecord(i) && i.type === "agentMessage" && typeof i.text === "string"
                  ? i.text
                  : null,
              )
              .filter((t): t is string => t !== null)
              .at(-1) ?? null;
          notes.push({
            turn: turnsUsed,
            turnId: run.turn.id,
            itemTypes: run.turn.items.map((i) =>
              isRecord(i) && typeof i.type === "string" ? i.type : "unknown",
            ),
            fileChanges: verdict.ok ? verdict.fileChanges : [],
            worktreeStatus: status,
            agentText,
            runtimeAttempts: runtime.length,
          });
          if (!verdict.ok) {
            code = verdict.code;
            detail = verdict.detail;
            break;
          }
          if (verdict.resultLine) {
            code = verdict.resultLine.verdict === "done" ? "TRACER_COMPLETED" : "TRACER_BLOCKED";
            detail = verdict.resultLine.summary;
            break;
          }
        }
      }
    }
  }
} catch (err) {
  code = "TRACER_RUNNER_FAILURE";
  detail = err instanceof Error ? err.message : String(err);
} finally {
  // Order matters: the process must stop before its CODEX_HOME is deleted.
  await supervisor.stop().catch(() => {});
  await sessionLog.close();
  await home.dispose();
}

// Per-attempt transcript, hashed, so the attempt record can cite exactly what was reviewed.
const stamp = observedAt.replace(/[:.]/gu, "-");
const transcriptPath = join(EVIDENCE_ROOT, `attempt-${attemptNumber}-${stamp}.json`);
const transcript = `${JSON.stringify({ attempt: attemptNumber, observedAt, baseCommit, notes }, null, 2)}\n`;
await writeFile(transcriptPath, transcript, "utf8");

const outcome: AttemptOutcome = {
  attempt: attemptNumber,
  observedAt,
  turnsUsed,
  code,
  detail,
  contractSha256,
  roleContentSha256: roleEntry.contentSha256,
  worktree,
  baseCommit,
  model,
  reasoningEffort,
  bindingFingerprint,
  transcriptPath: transcriptPath.slice(ROOT.length + 1).replaceAll("\\", "/"),
  transcriptSha256: sha256(transcript),
};

record.attempts.push(outcome);
record.recordedAt = observedAt.slice(0, 10);
record.status =
  code === "TRACER_COMPLETED" || code === "TRACER_BLOCKED"
    ? "tracer-attempt-complete-awaiting-owner-review"
    : "tracer-attempt-ended-awaiting-owner-review";
// Write-then-rename so an interrupted write cannot leave a half-written allowance ledger.
await writeFile(`${recordPath}.tmp`, `${JSON.stringify(record, null, 2)}\n`, "utf8");
await rename(`${recordPath}.tmp`, recordPath);
// The worktree is deliberately left in place: the owner inspects it and runs verify.
process.stdout.write(JSON.stringify(outcome) + "\n");
