/**
 * The log-mode launcher (workflow-proof W5/W12 prerequisite).
 *
 * Starts the loopback server against one event log. It takes the single-writer lock before it
 * listens and holds it until it closes, so the runner, the evidence recorder and the review CLI
 * refuse to run while it is up. Session and CSRF tokens are random per start; the web surface reads
 * them from `/api/session`, which only answers the exact allowed origin.
 */
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";

import { readEventLog } from "./event-log.js";
import { acquireLogLock, type LogLock } from "./log-lock.js";
import { createLoopbackApp, type LoopbackApp } from "./loopback-session.js";
import { createWorkflowRunnerControl } from "./workflow-runner.js";
import {
  createCodexContractDraftSessionAdapter,
  createContractDraftService,
} from "./contract-draft-service.js";

export const DEFAULT_PORT = 4180;
export const DEFAULT_ORIGIN = "http://127.0.0.1:4173";

export type LaunchArgs = Readonly<{
  logPath: string;
  projectId: string;
  port: number;
  allowedOrigin: string;
  runner?: Readonly<{
    worktree: string;
    model: string;
    reasoningEffort: string;
    needs: readonly string[];
  }>;
}>;

export type ArgsResult =
  Readonly<{ ok: true; value: LaunchArgs }> | Readonly<{ ok: false; issues: readonly string[] }>;

export function parseLaunchArgs(argv: readonly string[]): ArgsResult {
  const values = new Map<string, string>();
  const issues: string[] = [];
  for (const arg of argv) {
    const index = arg.indexOf("=");
    if (index <= 0) {
      issues.push(`unrecognised argument "${arg}"; use key=value`);
      continue;
    }
    values.set(arg.slice(0, index), arg.slice(index + 1));
  }
  for (const key of values.keys()) {
    if (
      ![
        "log",
        "project",
        "port",
        "origin",
        "runner-worktree",
        "runner-model",
        "runner-reasoning-effort",
        "runner-needs",
      ].includes(key)
    ) {
      issues.push(`unknown option "${key}"`);
    }
  }
  const logPath = values.get("log");
  if (!logPath) issues.push("log=<events.jsonl> is required");
  const portText = values.get("port");
  const port = portText === undefined ? DEFAULT_PORT : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push(`port must be an integer from 1 to 65535, got "${String(portText)}"`);
  }
  const allowedOrigin = values.get("origin") ?? DEFAULT_ORIGIN;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/u.test(allowedOrigin)) {
    issues.push(`origin must look like http://127.0.0.1:<port>, got "${allowedOrigin}"`);
  }
  const runnerKeys = ["runner-worktree", "runner-model", "runner-reasoning-effort"] as const;
  const runnerValues = runnerKeys.map((key) => values.get(key));
  const anyRunnerValue = runnerValues.some((value) => value !== undefined);
  let runner: LaunchArgs["runner"];
  if (anyRunnerValue) {
    const [worktree, model, reasoningEffort] = runnerValues;
    if (!worktree || !model || !reasoningEffort) {
      issues.push(
        "runner-worktree, runner-model and runner-reasoning-effort must be supplied together",
      );
    } else {
      if (!isAbsolute(worktree)) issues.push("runner-worktree must be an absolute path");
      if (!/^[A-Za-z0-9._/-]+$/u.test(model))
        issues.push("runner-model contains unsupported characters");
      if (!["low", "medium", "high", "xhigh", "max", "ultra"].includes(reasoningEffort)) {
        issues.push("runner-reasoning-effort must be low, medium, high, xhigh, max or ultra");
      }
      const needsText = values.get("runner-needs") ?? "";
      const needs = needsText.length === 0 ? [] : needsText.split(",");
      if (
        needs.some(
          (path) =>
            !/^[A-Za-z0-9._/-]+$/u.test(path) ||
            path.startsWith("/") ||
            path.split("/").some((part) => part === ".." || part.length === 0),
        )
      ) {
        issues.push("runner-needs must contain comma-separated relative paths without '..'");
      }
      runner = { worktree, model, reasoningEffort, needs };
    }
  } else if (values.has("runner-needs")) {
    issues.push("runner-needs requires the complete runner configuration");
  }
  if (issues.length > 0 || !logPath) return { ok: false, issues };
  return {
    ok: true,
    value: {
      logPath,
      projectId: values.get("project") ?? "project_workflow_proof",
      port,
      allowedOrigin,
      ...(runner ? { runner } : {}),
    },
  };
}

export type StartedServer = Readonly<{
  app: LoopbackApp;
  url: string;
  lockPath: string;
  reclaimedNote?: string;
  close: () => Promise<void>;
}>;

export type StartResult =
  | Readonly<{ ok: true; server: StartedServer }>
  | Readonly<{ ok: false; code: string; detail: string }>;

export async function startLogServer(args: LaunchArgs): Promise<StartResult> {
  const acquired = await acquireLogLock(args.logPath, "server");
  if (!acquired.ok) return { ok: false, code: acquired.code, detail: acquired.detail };
  let lock: LogLock | undefined = acquired.lock;
  try {
    // Refuse a damaged log up front rather than serving a surface that cannot append.
    const log = await readEventLog(args.logPath);
    if (log.truncated || log.problems.length > 0) {
      await lock.release();
      lock = undefined;
      return {
        ok: false,
        code: "LOG_DAMAGED",
        detail: log.truncated
          ? "the log ends in a truncated line"
          : `the log has ${String(log.problems.length)} unreadable line(s); first: line ${String(log.problems[0]?.line)}`,
      };
    }
    const runnerConfig = args.runner;
    const liveOptIn = process.env.CUCKCODE_LIVE_WORKFLOW === "1";
    const runner = createWorkflowRunnerControl({
      available: Boolean(runnerConfig) && liveOptIn,
      releaseLock: async () => {
        if (!lock) throw new Error("SERVER_LOG_LOCK_MISSING");
        await lock.release();
        lock = undefined;
      },
      reacquireLock: async () => {
        if (lock) return false;
        const next = await acquireLogLock(args.logPath, "server");
        if (!next.ok) return false;
        lock = next.lock;
        return true;
      },
      launch: async (workItemId) => {
        if (!runnerConfig) throw new Error("WORKFLOW_RUNNER_NOT_CONFIGURED");
        const script = resolve(process.cwd(), "scripts/run-workflow-attempt.ts");
        const tsx = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
        const child = spawn(
          process.execPath,
          [
            tsx,
            script,
            `--log=${resolve(args.logPath)}`,
            `--work=${workItemId}`,
            `--worktree=${runnerConfig.worktree}`,
            `--model=${runnerConfig.model}`,
            `--reasoning-effort=${runnerConfig.reasoningEffort}`,
            "--surface=B",
            ...(runnerConfig.needs.length > 0 ? [`--needs=${runnerConfig.needs.join(",")}`] : []),
          ],
          {
            cwd: process.cwd(),
            env: { ...process.env, CUCKCODE_LIVE_WORKFLOW: "1" },
            stdio: "ignore",
            windowsHide: true,
          },
        );
        const completion = new Promise<number | null>((resolveCompletion) => {
          let settled = false;
          const settle = (code: number | null) => {
            if (settled) return;
            settled = true;
            resolveCompletion(code);
          };
          child.once("error", () => settle(null));
          child.once("close", (code) => settle(code));
        });
        return { completion };
      },
    });
    const app = createLoopbackApp({
      mode: "development",
      host: "127.0.0.1",
      allowedOrigin: args.allowedOrigin,
      projectId: args.projectId,
      initialRevision: log.revision,
      sessionId: `session_${randomBytes(12).toString("hex")}`,
      csrfToken: `csrf_${randomBytes(12).toString("hex")}`,
      readModel: { schemaVersion: 1, projectId: args.projectId, revision: log.revision },
      logPath: args.logPath,
      worktreeRoot: process.cwd(),
      runner,
      contractDraftService: createContractDraftService({
        mode: "development",
        adapter: createCodexContractDraftSessionAdapter(),
        now: () => new Date().toISOString(),
      }),
    });
    await app.listen({ host: "127.0.0.1", port: args.port });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : args.port;
    return {
      ok: true,
      server: {
        app,
        url: `http://127.0.0.1:${String(port)}`,
        lockPath: acquired.lock.lockPath,
        ...(acquired.lock.reclaimed
          ? {
              reclaimedNote: `reclaimed a lock left by ${acquired.lock.reclaimed.role} (pid ${String(acquired.lock.reclaimed.pid)}, since ${acquired.lock.reclaimed.since}), which is no longer running`,
            }
          : {}),
        close: async () => {
          await runner.waitUntilIdle();
          await app.close();
          await lock?.release();
          lock = undefined;
        },
      },
    };
  } catch (error) {
    await lock?.release();
    return {
      ok: false,
      code: "LISTEN_FAILED",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
