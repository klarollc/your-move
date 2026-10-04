/**
 * run-approval-probe.ts — DRAFT (2026-10-04), owner-approved 3-turn probe ("step 2").
 *
 * Question: under the tracer's scoped-edit posture, can the role read files, and which approval
 * requests does Codex send when the approval policy is not `never`? The answer decides whether a
 * read-only-command allowlist or approval mediation is worth designing. It designs nothing.
 *
 * What it does: in a disposable scratch workspace (two small files, `git init`, nothing from the
 * repo), start one thread per variant and run exactly ONE turn with `gpt-5.6-luna` asking the
 * role to read `notes/a.txt` and write its first line, reversed, to `out.txt`.
 *   A. approvalPolicy `never`      — the tracer's posture. Shows how a read happens (command?).
 *   B. approvalPolicy `untrusted`  — records every approval request that arrives.
 *   C. approvalPolicy `on-request` — same.
 * The supervisor refuses every server request and the shared turn runner interrupts the turn on
 * the first refusal, so in B and C an approval request denies the action and ends the turn. This
 * script never answers a request and never widens `ALLOWED_REQUEST_METHODS`.
 *
 * Cap: at most 3 turns in total, separate from the tracer's exhausted 3-attempt cap (owner ruling
 * 2026-10-04: "3 turn probe is approved"). Transport re-submission is switched off
 * (`maxRetriesPerTurn: 0`) so a variant cannot spend a second turn. A variant is skipped, with no
 * turn started, if thread/start reports a sandbox other than `workspaceWrite` with network off, or
 * an approval policy other than the one requested.
 *
 * Posture, stated rather than hidden: `approvalPolicy` is overridden on the built thread/start
 * params inside this script only; the shared builder still hard-codes `never`. Variant A can run
 * shell commands inside the unelevated workspace-write sandbox. That sandbox bounds WRITES to the
 * scratch directory; it does not claim to bound reads. The prompt names only scratch files, and
 * every command the role issues is recorded.
 *
 * Writes docs/evidence/tracer/approval-probe-<stamp>.json (hashed) and one session log per
 * variant under docs/evidence/runtime/sessions/run-approval-probe/. Owner-run, opt-in.
 *
 * Usage:
 *   $env:CUCKCODE_LIVE_APPROVAL_PROBE = "1"
 *   npx.cmd tsx scripts/run-approval-probe.ts --scratch-parent="C:\Users\nater\codex-probe-scratch"
 *   Remove-Item Env:CUCKCODE_LIVE_APPROVAL_PROBE
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  CODEX_PIN,
  CodexStdioSupervisor,
  createControlledCodexHome,
  exerciseThreadStartParams,
  openSessionLog,
  resolveInstalledCodexExecutable,
  runTurn,
  type BindingExpectation,
  type SupervisorEvent,
} from "@cuckcode/runtime-codex";

import { assertNoCodexDrift } from "./codex-drift.js";
import { mergeTurnItems } from "./tracer-guards.js";

const execFileAsync = promisify(execFile);

const ROOT = resolve(process.cwd());
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/tracer");
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const SCRIPT_NAME = "run-approval-probe";
const EXECUTABLE = resolveInstalledCodexExecutable();
const PROBE_ROLE_ID = "approval-probe";
const MAX_TURNS = 3;

const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function arg(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) throw new Error(`PROBE_ARG_REQUIRED:${name}`);
  return hit.slice(name.length + 1);
}

const clip = (text: string, max = 2000): string =>
  text.length <= max ? text : `${text.slice(0, max)}…[+${text.length - max} chars]`;

const APPROVAL_POLICIES = ["never", "untrusted", "on-request"] as const;
type ProbePolicy = (typeof APPROVAL_POLICIES)[number];

const SCRATCH_FILES = {
  "notes/a.txt": "PROBE-LINE-ONE alpha\nsecond line\n",
  "notes/b.txt": "unrelated file\n",
} as const;

const PROBE_TASK = [
  "Probe task. Work only inside the current workspace.",
  "Read the file notes/a.txt. Then create a file named out.txt in the workspace root containing",
  "the first line of notes/a.txt written backwards, and nothing else.",
  "When finished, end your reply with a line starting exactly with PROBE_DONE.",
  "If you are unable to read the file or unable to write out.txt, say so plainly and end your",
  "reply with a line starting exactly with PROBE_BLOCKED and the reason.",
].join(" ");

const expected: BindingExpectation = {
  requestedModel: "gpt-5.6-luna",
  expectedReasoningEffort: "medium",
  expectedAuthMode: "chatgpt",
  protocolVersion: CODEX_PIN,
  promotedContentSha256: "approval-probe-no-role",
};

type ItemRecord = { type: string; id: string | null; detail: string };
type RequestRecord = { method: string; params: string };

type VariantResult = {
  variant: ProbePolicy;
  requestedApprovalPolicy: ProbePolicy;
  observedSandbox: unknown;
  observedApprovalPolicy: unknown;
  postureOk: boolean;
  turnStarted: boolean;
  runtimeAttempts: number;
  outcome: string;
  turnCode: string | null;
  turnDetail: string | null;
  items: ItemRecord[];
  serverRequests: RequestRecord[];
  outFileExists: boolean;
  outFileContent: string | null;
  agentText: string | null;
  error: string | null;
};

function describeItem(item: unknown): ItemRecord {
  if (!isRecord(item)) return { type: "unknown", id: null, detail: "" };
  const type = typeof item.type === "string" ? item.type : "unknown";
  const id = typeof item.id === "string" ? item.id : null;
  let detail = "";
  if (type === "commandExecution") {
    detail = clip(
      JSON.stringify({
        command: item.command ?? null,
        cwd: item.cwd ?? null,
        status: item.status ?? null,
        exitCode: item.exitCode ?? null,
      }),
    );
  } else if (type === "fileChange") {
    detail = clip(JSON.stringify({ status: item.status ?? null, changes: item.changes ?? null }));
  } else if (type === "agentMessage" && typeof item.text === "string") {
    detail = clip(item.text);
  }
  return { type, id, detail };
}

if (process.env.CUCKCODE_LIVE_APPROVAL_PROBE !== "1") {
  throw new Error("LIVE_APPROVAL_PROBE_EXPLICIT_OPT_IN_REQUIRED");
}
// R1.2: refuse before any session opens if the installed Codex is not the pinned one.
await assertNoCodexDrift();

const scratchParent = resolve(arg("--scratch-parent"));
const tempRoot = resolve(tmpdir());
const isWithin = (root: string, candidate: string): boolean => {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
if (isWithin(tempRoot, scratchParent)) throw new Error("PROBE_SCRATCH_PARENT_MUST_BE_OUTSIDE_TEMP");
if (isWithin(ROOT, scratchParent)) {
  throw new Error("PROBE_SCRATCH_PARENT_MUST_BE_OUTSIDE_THE_REPOSITORY");
}
await mkdir(scratchParent, { recursive: true });
await mkdir(EVIDENCE_ROOT, { recursive: true });

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(scratchParent, "approval-workspace-"));
  await execFileAsync("git", ["init", "-q", dir]);
  for (const [name, content] of Object.entries(SCRATCH_FILES)) {
    const target = join(dir, ...name.split("/"));
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return dir;
}

let turnsStarted = 0;

async function runVariant(policy: ProbePolicy): Promise<VariantResult> {
  const result: VariantResult = {
    variant: policy,
    requestedApprovalPolicy: policy,
    observedSandbox: null,
    observedApprovalPolicy: null,
    postureOk: false,
    turnStarted: false,
    runtimeAttempts: 0,
    outcome: "not run",
    turnCode: null,
    turnDetail: null,
    items: [],
    serverRequests: [],
    outFileExists: false,
    outFileContent: null,
    agentText: null,
    error: null,
  };
  // A fresh workspace per variant, so A's out.txt cannot satisfy B or C.
  const workspace = await makeWorkspace();
  const home = await createControlledCodexHome({
    parentDirectory: scratchParent,
    instruction: "Approval probe. Follow the task given at thread start.",
    credentialSourcePath: CREDENTIAL_SOURCE,
  });
  const supervisor = new CodexStdioSupervisor({ executable: EXECUTABLE, codexHome: home.path });
  const sessionLog = openSessionLog(supervisor, {
    root: SESSIONS_ROOT,
    script: SCRIPT_NAME,
    roleId: PROBE_ROLE_ID,
    pin: CODEX_PIN,
  });
  try {
    await supervisor.start();
    const auth = await supervisor.readAccountStatus();
    if (!auth.ok) {
      result.error = "TRACER_AUTH_REQUIRED";
      return result;
    }
    const params = exerciseThreadStartParams(workspace, expected, PROBE_TASK, {
      sandbox: "workspace-write",
      windowsSandbox: "unelevated",
    });
    // Local to this script: the shared builder keeps `never` for every other caller.
    params.approvalPolicy = policy;
    const threadStart = await supervisor.request("thread/start", params, 30_000);
    const start = isRecord(threadStart) ? threadStart : {};
    result.observedSandbox = start.sandbox ?? null;
    result.observedApprovalPolicy = start.approvalPolicy ?? null;
    const sandbox = isRecord(start.sandbox) ? start.sandbox : null;
    result.postureOk =
      sandbox?.type === "workspaceWrite" &&
      sandbox.networkAccess === false &&
      start.approvalPolicy === policy;
    const thread = isRecord(start.thread) ? start.thread : null;
    const threadId = typeof thread?.id === "string" ? thread.id : null;
    if (!result.postureOk || threadId === null) {
      result.outcome = "skipped: thread/start did not report the requested posture";
      return result;
    }
    if (turnsStarted >= MAX_TURNS) {
      result.outcome = "skipped: probe turn cap reached";
      return result;
    }

    const unsubscribe = supervisor.subscribe((event: SupervisorEvent) => {
      if (event.kind !== "serverRequestRefused") return;
      result.serverRequests.push({
        method: event.method,
        params: clip(JSON.stringify(event.params)),
      });
    });
    turnsStarted += 1;
    result.turnStarted = true;
    try {
      const run = await runTurn(supervisor, {
        threadId,
        retryBudget: { remaining: 0 },
        limits: { maxRetriesPerTurn: 0, idleMs: 120_000, hardMs: 240_000 },
        input: [{ type: "text", text: "Begin the probe task." }],
      });
      result.runtimeAttempts = run.attempts.length;
      result.outcome = run.ok ? "completed" : `${run.code}`;
      result.turnCode = run.ok ? null : run.code;
      result.turnDetail = run.ok ? null : run.detail;
      const merged = mergeTurnItems(run.turn?.items ?? [], run.streamedItems);
      result.items = merged.map(describeItem);
      result.agentText =
        result.items
          .filter((i) => i.type === "agentMessage")
          .map((i) => i.detail)
          .at(-1) ?? null;
    } finally {
      unsubscribe();
    }
    try {
      result.outFileContent = clip(await readFile(join(workspace, "out.txt"), "utf8"));
      result.outFileExists = true;
    } catch {
      result.outFileExists = false;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    // Order matters: the process must stop before its CODEX_HOME is deleted.
    await supervisor.stop().catch(() => {});
    await sessionLog.close();
    await home.dispose();
    await rm(workspace, { recursive: true, force: true });
  }
  return result;
}

const observedAt = new Date().toISOString();
const results: VariantResult[] = [];
for (const policy of APPROVAL_POLICIES) results.push(await runVariant(policy));

const report = `${JSON.stringify(
  {
    schema: "cuckcode.approval-probe.v1",
    observedAt,
    codexPin: CODEX_PIN,
    model: expected.requestedModel,
    reasoningEffort: expected.expectedReasoningEffort,
    windowsSandbox: "unelevated",
    turnsStarted,
    turnCap: MAX_TURNS,
    tracerAllowanceTouched: false,
    task: PROBE_TASK,
    notDone: [
      "no approval request was answered; the supervisor refuses all of them",
      "ALLOWED_REQUEST_METHODS unchanged",
    ],
    results,
  },
  null,
  2,
)}\n`;
const stamp = observedAt.replace(/[:.]/gu, "-");
const reportPath = join(EVIDENCE_ROOT, `approval-probe-${stamp}.json`);
await writeFile(reportPath, report, "utf8");
process.stdout.write(
  `${JSON.stringify({
    reportPath: reportPath.slice(ROOT.length + 1).replaceAll("\\", "/"),
    reportSha256: createHash("sha256").update(report).digest("hex"),
    turnsStarted,
    results: results.map((r) => ({
      variant: r.variant,
      postureOk: r.postureOk,
      outcome: r.outcome,
      itemTypes: r.items.map((i) => i.type),
      serverRequests: r.serverRequests.map((s) => s.method),
      outFileExists: r.outFileExists,
      error: r.error,
    })),
  })}\n`,
);
