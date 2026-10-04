/**
 * The log-mode launcher (workflow-proof W5/W12 prerequisite).
 *
 * Starts the loopback server against one event log. It takes the single-writer lock before it
 * listens and holds it until it closes, so the runner, the evidence recorder and the review CLI
 * refuse to run while it is up. Session and CSRF tokens are random per start; the web surface reads
 * them from `/api/session`, which only answers the exact allowed origin.
 */
import { randomBytes } from "node:crypto";

import { readEventLog } from "./event-log.js";
import { acquireLogLock } from "./log-lock.js";
import { createLoopbackApp, type LoopbackApp } from "./loopback-session.js";

export const DEFAULT_PORT = 4180;
export const DEFAULT_ORIGIN = "http://127.0.0.1:4173";

export type LaunchArgs = Readonly<{
  logPath: string;
  projectId: string;
  port: number;
  allowedOrigin: string;
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
    if (!["log", "project", "port", "origin"].includes(key)) {
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
  if (issues.length > 0 || !logPath) return { ok: false, issues };
  return {
    ok: true,
    value: {
      logPath,
      projectId: values.get("project") ?? "project_workflow_proof",
      port,
      allowedOrigin,
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
  const { lock } = acquired;
  try {
    // Refuse a damaged log up front rather than serving a surface that cannot append.
    const log = await readEventLog(args.logPath);
    if (log.truncated || log.problems.length > 0) {
      await lock.release();
      return {
        ok: false,
        code: "LOG_DAMAGED",
        detail: log.truncated
          ? "the log ends in a truncated line"
          : `the log has ${String(log.problems.length)} unreadable line(s); first: line ${String(log.problems[0]?.line)}`,
      };
    }
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
    });
    await app.listen({ host: "127.0.0.1", port: args.port });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : args.port;
    return {
      ok: true,
      server: {
        app,
        url: `http://127.0.0.1:${String(port)}`,
        lockPath: lock.lockPath,
        ...(lock.reclaimed
          ? {
              reclaimedNote: `reclaimed a lock left by ${lock.reclaimed.role} (pid ${String(lock.reclaimed.pid)}, since ${lock.reclaimed.since}), which is no longer running`,
            }
          : {}),
        close: async () => {
          await app.close();
          await lock.release();
        },
      },
    };
  } catch (error) {
    await lock.release();
    return {
      ok: false,
      code: "LISTEN_FAILED",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
