import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_ORIGIN,
  DEFAULT_PORT,
  parseLaunchArgs,
  startLogServer,
  type StartedServer,
} from "./launch.js";
import { acquireLogLock, lockPathFor } from "./log-lock.js";

let dir: string;
let log: string;
const started: StartedServer[] = [];
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ck-launch-"));
  log = join(dir, "events.jsonl");
});
afterEach(async () => {
  await Promise.all(started.splice(0).map((s) => s.close()));
  await rm(dir, { recursive: true, force: true });
});

const args = () => ({
  logPath: log,
  projectId: "project_alpha",
  port: 0,
  allowedOrigin: DEFAULT_ORIGIN,
});

async function start(): Promise<StartedServer> {
  const result = await startLogServer(args());
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
  started.push(result.server);
  return result.server;
}

describe("parseLaunchArgs", () => {
  it("requires a log and applies defaults", () => {
    expect(parseLaunchArgs([])).toEqual({ ok: false, issues: ["log=<events.jsonl> is required"] });
    const ok = parseLaunchArgs(["log=a.jsonl"]);
    expect(ok).toEqual({
      ok: true,
      value: {
        logPath: "a.jsonl",
        projectId: "project_workflow_proof",
        port: DEFAULT_PORT,
        allowedOrigin: DEFAULT_ORIGIN,
      },
    });
  });

  it("refuses unknown options, bad ports and non-loopback origins", () => {
    const result = parseLaunchArgs([
      "log=a",
      "port=99999",
      "origin=http://example.com",
      "x=1",
      "oops",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join("\n")).toMatch(/unknown option "x"/u);
    expect(result.issues.join("\n")).toMatch(/port must be/u);
    expect(result.issues.join("\n")).toMatch(/origin must look like/u);
    expect(result.issues.join("\n")).toMatch(/unrecognised argument "oops"/u);
  });

  it("accepts a complete, server-owned Surface B runner configuration", () => {
    const result = parseLaunchArgs([
      "log=a.jsonl",
      "runner-worktree=C:/worktrees/candidate",
      "runner-model=gpt-6.1-sol",
      "runner-reasoning-effort=high",
      "runner-needs=src/index.ts,src/index.test.ts",
    ]);
    expect(result).toMatchObject({
      ok: true,
      value: {
        runner: {
          worktree: "C:/worktrees/candidate",
          model: "gpt-6.1-sol",
          reasoningEffort: "high",
          needs: ["src/index.ts", "src/index.test.ts"],
        },
      },
    });
  });

  it("refuses partial or unsafe runner configuration", () => {
    expect(parseLaunchArgs(["log=a", "runner-worktree=C:/candidate"]).ok).toBe(false);
    expect(
      parseLaunchArgs([
        "log=a",
        "runner-worktree=C:/candidate",
        "runner-model=gpt-6.1-sol",
        "runner-reasoning-effort=high",
        "runner-needs=../outside.ts",
      ]).ok,
    ).toBe(false);
  });
});

describe("startLogServer", () => {
  it("serves the log on loopback with random tokens, to the allowed origin only", async () => {
    const server = await start();
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
    const session = await server.app.inject({
      method: "GET",
      url: "/api/session",
      headers: { origin: DEFAULT_ORIGIN },
    });
    expect(session.statusCode).toBe(200);
    const body = session.json() as { sessionId: string; csrfToken: string; revision: number };
    expect(body.sessionId).toMatch(/^session_[0-9a-f]{24}$/u);
    expect(body.csrfToken).toMatch(/^csrf_[0-9a-f]{24}$/u);
    expect(body.revision).toBe(0);
    const wrong = await server.app.inject({
      method: "GET",
      url: "/api/session",
      headers: { origin: "http://127.0.0.1:9999" },
    });
    expect(wrong.statusCode).toBe(403);
  });

  it("wires drafting but refuses it without the separate live-provider opt-in", async () => {
    const previous = process.env.CUCKCODE_LIVE_CONTRACT_DRAFT;
    delete process.env.CUCKCODE_LIVE_CONTRACT_DRAFT;
    try {
      const server = await start();
      const sessionResponse = await server.app.inject({
        method: "GET",
        url: "/api/session",
        headers: { origin: DEFAULT_ORIGIN },
      });
      const session = sessionResponse.json() as {
        sessionId: string;
        csrfToken: string;
        contractDraftingAvailable: boolean;
      };
      expect(session.contractDraftingAvailable).toBe(false);

      const response = await server.app.inject({
        method: "POST",
        url: "/api/contract-drafts",
        headers: {
          origin: DEFAULT_ORIGIN,
          "content-type": "application/json",
          "x-cuckcode-session": session.sessionId,
          "x-cuckcode-csrf": session.csrfToken,
        },
        payload: { expectedRevision: 0, description: "Draft a bounded work contract." },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: "CONTRACT_DRAFT_NOT_AUTHORIZED" });
    } finally {
      if (previous === undefined) delete process.env.CUCKCODE_LIVE_CONTRACT_DRAFT;
      else process.env.CUCKCODE_LIVE_CONTRACT_DRAFT = previous;
    }
  });

  it("exposes a configured Surface B runner only with the explicit live opt-in", async () => {
    const previous = process.env.CUCKCODE_LIVE_WORKFLOW;
    process.env.CUCKCODE_LIVE_WORKFLOW = "1";
    try {
      const parsed = parseLaunchArgs([
        `log=${log}`,
        "runner-worktree=C:/worktrees/candidate",
        "runner-model=gpt-6.1-sol",
        "runner-reasoning-effort=high",
      ]);
      if (!parsed.ok) throw new Error(parsed.issues.join("; "));
      const result = await startLogServer({ ...parsed.value, port: 0 });
      if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
      started.push(result.server);
      const response = await result.server.app.inject({
        method: "GET",
        url: "/api/workflow/status",
        headers: { origin: DEFAULT_ORIGIN, "x-cuckcode-session": "unknown" },
      });
      expect(response.statusCode).toBe(403);
      const session = await result.server.app.inject({
        method: "GET",
        url: "/api/session",
        headers: { origin: DEFAULT_ORIGIN },
      });
      expect(session.json()).toMatchObject({
        runner: { available: true, state: "idle" },
      });
    } finally {
      if (previous === undefined) delete process.env.CUCKCODE_LIVE_WORKFLOW;
      else process.env.CUCKCODE_LIVE_WORKFLOW = previous;
    }
  });

  it("holds the writer lock while up, so a second writer is refused, and frees it on close", async () => {
    const server = await start();
    expect(server.lockPath).toBe(lockPathFor(log));
    const second = await acquireLogLock(log, "runner", {
      pid: process.pid + 1,
      host: "elsewhere",
      now: () => "t",
      isAlive: () => false,
    });
    expect(second.ok).toBe(false);
    const again = await startLogServer(args());
    expect(again.ok).toBe(false);
    await server.close();
    const free = await acquireLogLock(log, "runner");
    expect(free.ok).toBe(true);
    if (free.ok) await free.lock.release();
  });

  it("refuses a damaged log and does not leave a lock behind", async () => {
    await writeFile(log, '{"not":"an event"}\n');
    const result = await startLogServer(args());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LOG_DAMAGED");
    const free = await acquireLogLock(log, "runner");
    expect(free.ok).toBe(true);
    if (free.ok) await free.lock.release();
  });
});
