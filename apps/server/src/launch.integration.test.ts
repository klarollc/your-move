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
