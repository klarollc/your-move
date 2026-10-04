/**
 * run-workflow-attempt.ts — workflow-proof live runner (W5, live round).
 *
 * Status: NOT YET RUN LIVE. Owner-run only; it needs a live Codex process and cannot be tested in
 * the container. It is checked by tsc and eslint only. The pure logic it relies on is tested:
 * workflow-bridge, workflow-attempt, workflow-live-helpers.
 *
 * One invocation = one attempt on one surface. No auto-retry. It reads the work item's contract
 * from the event log, inlines the contract's files into the prompt (R-1), opens a Codex session
 * with the contract's permission ceiling, and drives `runWorkflowAttempt`. Every fact is appended
 * to the event log DIRECTLY (never over HTTP: the runner must not hold the server's session
 * credentials). It is the second writer beside the server: do not run it while the evidence
 * recorder or another runner appends to the same log (single-writer assumption).
 *
 * Refuses to start when: the opt-in is absent, Codex has drifted from the pin, the worktree is not
 * a clean linked worktree, a context file's digest differs from the contract, the log is damaged,
 * or the surface allowance / stop rule says no.
 *
 * Usage (PowerShell, from the repo root):
 *   $env:CUCKCODE_LIVE_WORKFLOW = "1"
 *   npx tsx scripts/run-workflow-attempt.ts --log=<path> --work=<workItemId> --worktree=<path> \
 *     --model=<id> --reasoning-effort=<level> --surface=A|B [--needs=a.ts,b.ts] [--max-turns=10] \
 *     [--run-id=<id>]
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { composeRole, replayProject, type RoleBrief } from "@cuckcode/domain";
import {
  CODEX_PIN,
  CodexStdioSupervisor,
  buildBindingReport,
  buildPostureRecord,
  classifyItem,
  collectHandshakeFacts,
  createControlledCodexHome,
  createRetryBudget,
  enumerateMcpServers,
  exerciseThreadStartParams,
  hasExactInstructionSource,
  openSessionLog,
  reconcileTurnRecord,
  requestedPostureOf,
  resolveInstalledCodexExecutable,
  runTurn,
  type BindingExpectation,
} from "@cuckcode/runtime-codex";

import { appendEventLog, readEventLog } from "../apps/server/src/event-log.js";
import { acquireLogLock } from "../apps/server/src/log-lock.js";
import { assertNoCodexDrift } from "./codex-drift.js";
import {
  RESULT_MARKER,
  describeInstructionSources,
  hostPathApi,
  judgeTracerTurn,
  lastAgentMessageText,
  mergeTurnItems,
  parseResultLine,
} from "./tracer-guards.js";
import { runWorkflowAttempt, type AttemptDeps } from "./workflow-attempt.js";
import {
  buildWorkflowPrompt,
  checkAllowance,
  parsePorcelain,
  relativizeChanges,
  verifyContextFiles,
  type AttemptLedgerEntry,
} from "./workflow-live-helpers.js";

const execFileAsync = promisify(execFile);

const ROOT = resolve(process.cwd());
const ROLES_ROOT = resolve(ROOT, "roles");
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/workflow");
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const SCRIPT_NAME = "run-workflow-attempt";
const EXECUTABLE = resolveInstalledCodexExecutable();

const ROLE_ID = "implementation-engineer";
// Owner ruling: 10 turns per attempt, up to 10 attempts per surface, ceiling 100 turns per surface.
const LIMITS = { maxAttempts: 10, maxTurnsPerAttempt: 10, turnCeiling: 100 } as const;
const LEDGER_SCHEMA = "cuckcode.workflow-attempts.v1";

const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function arg(name: string, fallback?: string): string {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (hit) return hit.slice(name.length + 1);
  if (fallback !== undefined) return fallback;
  throw new Error(`WORKFLOW_ARG_REQUIRED:${name}`);
}

const itemTypesOf = (items: readonly unknown[]): string[] =>
  items.map((i) => (isRecord(i) && typeof i.type === "string" ? i.type : "unknown"));

function nestedId(value: unknown, key: string): string | undefined {
  const inner = isRecord(value) ? value[key] : undefined;
  return isRecord(inner) && typeof inner.id === "string" && inner.id.length > 0
    ? inner.id
    : undefined;
}

async function git(worktree: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", worktree, ...args], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

/** A linked worktree has a `.git` FILE; the owner's live working copy has a `.git` directory. */
async function assertCleanLinkedWorktree(worktree: string): Promise<string> {
  const s = await stat(join(worktree, ".git")).catch(() => {
    throw new Error(`WORKFLOW_WORKTREE_NOT_GIT:${worktree}`);
  });
  if (s.isDirectory()) throw new Error(`WORKFLOW_WORKTREE_IS_MAIN_CHECKOUT:${worktree}`);
  if (resolve((await git(worktree, "rev-parse", "--show-toplevel")).trim()) === ROOT) {
    throw new Error(`WORKFLOW_WORKTREE_IS_REPO_ROOT:${worktree}`);
  }
  if ((await git(worktree, "status", "--porcelain", "--untracked-files=all")).trim().length > 0) {
    throw new Error("WORKFLOW_WORKTREE_NOT_CLEAN");
  }
  return (await git(worktree, "rev-parse", "HEAD")).trim();
}

type Ledger = { schema: string; attempts: AttemptLedgerEntry[] };

async function loadLedger(path: string): Promise<Ledger> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as Partial<Ledger>;
    if (raw.schema !== LEDGER_SCHEMA || !Array.isArray(raw.attempts)) {
      throw new Error("WORKFLOW_LEDGER_INVALID");
    }
    return raw as Ledger;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { schema: LEDGER_SCHEMA, attempts: [] };
    }
    throw err;
  }
}

if (process.env.CUCKCODE_LIVE_WORKFLOW !== "1") {
  throw new Error("LIVE_WORKFLOW_EXPLICIT_OPT_IN_REQUIRED");
}
// Refuse before any session opens if the installed Codex is not the pinned one.
await assertNoCodexDrift();

const logPath = resolve(arg("--log"));
const workItemId = arg("--work");
const worktree = resolve(arg("--worktree"));
const model = arg("--model");
const reasoningEffort = arg("--reasoning-effort");
const surface = arg("--surface");
if (surface !== "A" && surface !== "B") throw new Error(`WORKFLOW_SURFACE_INVALID:${surface}`);
const needs = arg("--needs", "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const requestedMaxTurns = Number(arg("--max-turns", String(LIMITS.maxTurnsPerAttempt)));
if (!Number.isInteger(requestedMaxTurns) || requestedMaxTurns < 1) {
  throw new Error("WORKFLOW_MAX_TURNS_INVALID");
}
const observedAt = new Date().toISOString();
const runId = arg("--run-id", `run_${observedAt.replace(/[^0-9]/gu, "")}`);

// One writer at a time: refuse while the server or another runner holds the log.
const logLock = await acquireLogLock(logPath, "runner");
if (!logLock.ok) throw new Error(`WORKFLOW_${logLock.code}:${logLock.detail}`);
process.once("exit", logLock.lock.releaseSync);

// The log must be whole, and name exactly one project and a work item that carries a contract.
const initialLog = await readEventLog(logPath);
if (initialLog.truncated || initialLog.problems.length > 0) {
  throw new Error("WORKFLOW_LOG_DAMAGED:the event log has a truncated or unreadable record");
}
const snapshot = replayProject(initialLog.events);
const projectId = snapshot.project.projectId;
if (projectId === null || snapshot.replayIssues.some((i) => i.code === "MULTIPLE_PROJECTS")) {
  throw new Error("WORKFLOW_PROJECT_UNRESOLVED:the log must name exactly one project");
}
const item = snapshot.work.workItems[workItemId];
if (!item) throw new Error(`WORKFLOW_WORK_ITEM_NOT_FOUND:${workItemId}`);
const contract = item.contract;
if (!contract) throw new Error(`WORKFLOW_CONTRACT_MISSING:${workItemId}`);
// Preflight requires an assigned item, so each attempt needs its own work item (rehearsal finding
// F-2). Refuse here, before a Codex session is opened, rather than after.
if (item.state !== "assigned") {
  throw new Error(
    `WORKFLOW_ITEM_NOT_ASSIGNED:${workItemId} is ${item.state}; create and assign a new work item for each attempt`,
  );
}

const baseCommit = await assertCleanLinkedWorktree(worktree);

// Every file the contract references must match its digest, or nothing launches.
const context = verifyContextFiles(contract.contextRefs, (path) => {
  try {
    return readFileSyncOrNull(resolve(worktree, path));
  } catch {
    return null;
  }
});
if (!context.ok) throw new Error(`WORKFLOW_CONTEXT_REFUSED:${context.issues.join("; ")}`);

await mkdir(EVIDENCE_ROOT, { recursive: true });
const ledgerPath = resolve(EVIDENCE_ROOT, "attempts.json");
const ledger = await loadLedger(ledgerPath);
const allowance = checkAllowance(ledger.attempts, surface, LIMITS);
if (!allowance.ok) throw new Error(`WORKFLOW_${allowance.code}:${allowance.detail}`);
const maxTurns = Math.min(requestedMaxTurns, allowance.turnsAvailable);

// Role content is checked against the pinned digest, read-only; roles/exercises.json is never written.
const exerciseRecord = JSON.parse(
  await readFile(resolve(ROLES_ROOT, "exercises.json"), "utf8"),
) as { exercises: Array<{ roleId: string; contentSha256: string }> };
const roleEntry = exerciseRecord.exercises.find((e) => e.roleId === ROLE_ID);
if (!roleEntry) throw new Error(`WORKFLOW_ROLE_UNKNOWN:${ROLE_ID}`);
const artifact = await readFile(resolve(ROLES_ROOT, "authored", `${ROLE_ID}.json`));
if (sha256(artifact) !== roleEntry.contentSha256) {
  throw new Error(`WORKFLOW_ROLE_ARTIFACT_DRIFT:${ROLE_ID}`);
}
const composed = composeRole(JSON.parse(artifact.toString("utf8")) as RoleBrief);
if (!composed.ok) throw new Error(`WORKFLOW_COMPOSITION_REFUSED:${composed.refusal.code}`);

const prompt = buildWorkflowPrompt({
  contract,
  contextFiles: context.files,
  marker: RESULT_MARKER,
});
const contractSha256 = sha256(JSON.stringify(contract));
const requested = requestedPostureOf({
  sandbox: contract.permissionCeiling.sandboxMode,
  ...(contract.permissionCeiling.windowsSandbox !== null
    ? { windowsSandbox: contract.permissionCeiling.windowsSandbox }
    : {}),
});

const expected: BindingExpectation = {
  requestedModel: model,
  expectedReasoningEffort: reasoningEffort,
  expectedAuthMode: "chatgpt",
  protocolVersion: CODEX_PIN,
  promotedContentSha256: roleEntry.contentSha256,
};

type TurnNote = Record<string, unknown>;
const notes: TurnNote[] = [];
let turnsSpent = 0;
let bindingFingerprint: string | null = null;
const pathApi = hostPathApi(platform());

let turnRunner: AttemptDeps["runTurn"] = () =>
  Promise.reject(new Error("WORKFLOW_SESSION_NOT_STARTED"));

const deps: AttemptDeps = {
  readLog: async () => {
    const log = await readEventLog(logPath);
    if (log.truncated || log.problems.length > 0) {
      throw new Error("WORKFLOW_LOG_DAMAGED:the event log has a truncated or unreadable record");
    }
    return { events: log.events, revision: log.revision };
  },
  append: async (events, expectedRevision) => {
    const result = await appendEventLog(logPath, events, expectedRevision);
    return result.ok
      ? { ok: true, revision: result.revision }
      : { ok: false, code: result.code, detail: result.detail };
  },
  now: () => new Date().toISOString(),
  startSession: async () => {
    const home = await createControlledCodexHome({
      parentDirectory: tmpdir(),
      instruction: composed.text,
      credentialSourcePath: CREDENTIAL_SOURCE,
    });
    const supervisor = new CodexStdioSupervisor({ executable: EXECUTABLE, codexHome: home.path });
    const sessionLog = openSessionLog(supervisor, {
      root: SESSIONS_ROOT,
      script: SCRIPT_NAME,
      roleId: ROLE_ID,
      pin: CODEX_PIN,
    });
    const close = async (): Promise<void> => {
      // Order matters: the process must stop before its CODEX_HOME is deleted.
      await supervisor.stop().catch(() => {});
      await sessionLog.close();
      await home.dispose();
    };
    try {
      const initialized = await supervisor.start();
      const auth = await supervisor.readAccountStatus();
      if (!auth.ok) throw new Error("WORKFLOW_AUTH_REQUIRED:managed runtime authentication absent");
      const params = exerciseThreadStartParams(worktree, expected, prompt, {
        sandbox: contract.permissionCeiling.sandboxMode,
        ...(contract.permissionCeiling.windowsSandbox !== null
          ? { windowsSandbox: contract.permissionCeiling.windowsSandbox }
          : {}),
      });
      const threadStart = await supervisor.request("thread/start", params, 30_000);
      if (!hasExactInstructionSource(threadStart, home.instructionPath)) {
        throw new Error(
          `WORKFLOW_INSTRUCTION_SOURCE_MISMATCH:expected ${JSON.stringify(home.instructionPath)}; observed ${describeInstructionSources(threadStart)}`,
        );
      }
      // Approval and network are never negotiable. The sandbox TYPE is not checked here: a
      // difference from the request is recorded in the posture and blocked by preflight.
      const start = isRecord(threadStart) ? threadStart : {};
      const sandbox = isRecord(start.sandbox) ? start.sandbox : null;
      if (start.approvalPolicy !== "never" || !sandbox || sandbox.networkAccess !== false) {
        throw new Error(
          "WORKFLOW_POSTURE_REFUSED:approvalPolicy must be never and network access must be off",
        );
      }
      const threadId = nestedId(threadStart, "thread");
      if (!threadId) throw new Error("WORKFLOW_THREAD_START_INVALID");
      const mcpServers = await enumerateMcpServers(supervisor, threadId);
      const facts = collectHandshakeFacts({
        agentId: `workflow-${ROLE_ID}`,
        bindingId: `workflow-${ROLE_ID}-${observedAt}`,
        roleId: ROLE_ID,
        userAgent: initialized.userAgent,
        auth,
        threadStart,
        mcpServers,
      });
      const binding = buildBindingReport(facts, expected);
      if (!binding.ok) {
        throw new Error(
          `WORKFLOW_BINDING_REFUSED:${binding.failure.code}: ${binding.failure.detail}`,
        );
      }
      bindingFingerprint = binding.report.materialFingerprint;
      const retryBudget = createRetryBudget(2); // CX-4, per attempt
      const posture = buildPostureRecord(requested, facts.sandboxPosture);

      turnRunner = async (number) => {
        const run = await runTurn(supervisor, {
          threadId,
          retryBudget,
          input: [
            {
              type: "text",
              text:
                number === 1
                  ? "Begin the task."
                  : `Continue. If the task is finished or you are blocked, end your turn with a line starting exactly with "${RESULT_MARKER} done" or "${RESULT_MARKER} blocked" and a one-line summary.`,
            },
          ],
        });
        // A transport re-submission is a real turn on the thread: it spends allowance.
        turnsSpent += Math.max(1, run.attempts.length);
        if (!run.ok) throw new Error(`${run.code}: ${run.detail}`);
        const reconciled = reconcileTurnRecord({
          completedItems: run.turn.items,
          streamedItems: run.streamedItems,
          startedItemIds: run.startedItemIds,
        });
        const verdict = judgeTracerTurn({
          turn: run.turn,
          threadId,
          expectedTurnId: run.turn.id,
          streamedItems: run.streamedItems,
          worktree,
          classify: classifyItem,
          pathApi,
        });
        const status = parsePorcelain(
          await git(worktree, "status", "--porcelain", "--untracked-files=all"),
        );
        const agentText = lastAgentMessageText(mergeTurnItems(run.turn.items, run.streamedItems));
        notes.push({
          turn: number,
          turnId: run.turn.id,
          itemTypes: itemTypesOf(run.turn.items),
          streamedItemTypes: itemTypesOf(run.streamedItems),
          recordPartial: reconciled.partial,
          recordPartialReasons: reconciled.reasons,
          fileChanges: verdict.ok ? verdict.fileChanges : [],
          worktreeStatus: status,
          agentText,
        });
        // A refused verdict (stray effect, outside path, unclassified item) halts the run with the
        // reason recorded; the loop turns this throw into a run-halt event.
        if (!verdict.ok) throw new Error(`${verdict.code}: ${verdict.detail}`);
        const result = agentText === null ? null : parseResultLine(agentText);
        return {
          summary: {
            number,
            itemTypes: itemTypesOf(mergeTurnItems(run.turn.items, run.streamedItems)),
            streamedPaths: relativizeChanges(worktree, verdict.fileChanges, pathApi),
            worktreePaths: status,
            partial: reconciled.partial,
            partialReasons: reconciled.reasons,
          },
          claimDone: result?.verdict === "done",
          ...(result?.verdict === "blocked"
            ? { claimBlocked: result.summary.length > 0 ? result.summary : "blocked" }
            : {}),
        };
      };
      return { posture, close };
    } catch (error) {
      await close();
      throw error;
    }
  },
  // Delegates to the runner startSession installs once the thread exists.
  runTurn: (number) => turnRunner(number),
};

const result = await runWorkflowAttempt({
  deps,
  projectId,
  workItemId,
  runId,
  neededPaths: needs,
  maxTurns,
});

// Per-attempt transcript, hashed, so the ledger can cite exactly what was reviewed.
const attemptNumber = ledger.attempts.filter((e) => e.surface === surface).length + 1;
const stamp = observedAt.replace(/[:.]/gu, "-");
const transcriptPath = join(
  EVIDENCE_ROOT,
  `surface-${surface}-attempt-${attemptNumber}-${stamp}.json`,
);
const transcript = `${JSON.stringify(
  {
    surface,
    attempt: attemptNumber,
    runId,
    observedAt,
    baseCommit,
    model,
    reasoningEffort,
    contractSha256,
    bindingFingerprint,
    result,
    notes,
  },
  null,
  2,
)}\n`;
await writeFile(transcriptPath, transcript, "utf8");

const entry: AttemptLedgerEntry = {
  runId,
  surface,
  workItemId,
  observedAt,
  turnsUsed: Math.max(result.turnsRun, turnsSpent),
  outcome: result.outcome,
  transcriptSha256: sha256(transcript),
};
ledger.attempts.push(entry);
// Write-then-rename so an interrupted write cannot leave a half-written allowance ledger.
await writeFile(`${ledgerPath}.tmp`, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
await rename(`${ledgerPath}.tmp`, ledgerPath);

// The worktree is left in place: the owner inspects it, runs the checks, and records evidence.
process.stdout.write(`${JSON.stringify({ ...entry, notes: result.notes })}\n`);
if (result.outcome === "runtime_failure" || result.outcome === "log_refused") process.exitCode = 1;

function readFileSyncOrNull(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}
