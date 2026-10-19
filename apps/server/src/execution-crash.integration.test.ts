import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openExecutionStore } from "./execution-store.js";
import { createHostedApp, type HostedApp } from "./hosted-app.js";

const origin = "https://r3-crash.example.test";
const password = "r3-crash-tests-only-password";
const signingKey = Buffer.alloc(32, 3).toString("base64");
const encryptionKey = Buffer.alloc(32, 4).toString("base64");
const fixture = resolve(fileURLToPath(import.meta.url), "../execution-crash.fixture.ts");
const directories: string[] = [];
const apps: HostedApp[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

/** Runs the fixture until it is mid-turn, then kills it with SIGKILL: no shutdown hook runs. */
async function crashMidTurn(dataDir: string): Promise<void> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", fixture, dataDir, origin, password, signingKey, encryptionKey],
    { stdio: ["ignore", "pipe", "pipe"], cwd: process.cwd() },
  );
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  await new Promise<void>((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`fixture never became ready: ${stderr}`)),
      30_000,
    );
    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("READY")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    child.once("exit", (code) => reject(new Error(`fixture exited early (${code}): ${stderr}`)));
  });
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGKILL");
  await exited;
}

describe("R3 restart recovery after kill -9", () => {
  it("marks queued AND working runs interrupted, keeps the transcript, never auto-resumes, and restarts as a linked attempt", async () => {
    const dataDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r3-crash-"));
    directories.push(dataDir);
    await crashMidTurn(dataDir);

    // Before the next boot: the crash left one run working (mid-turn) and one queued behind it.
    const raw = openExecutionStore({ dataDir });
    const beforeBoot = raw.list();
    raw.close();
    expect(beforeBoot.map((record) => record.status).sort()).toEqual(["queued", "working"]);

    const chat = vi.fn<(input: unknown, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "Recovered." } }] }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const providerFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "gpt-4o-mini" }] }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/v1/chat/completions")) return chat(input, init);
      return new Response("{}", { status: 404 });
    });
    const app = createHostedApp({
      mode: "test",
      appOrigin: origin,
      accessPassword: password,
      sessionSigningKey: signingKey,
      credentialEncryptionKey: encryptionKey,
      dataDir,
      providerFetch,
      resolveHost: async () => ["93.184.216.34"],
    });
    apps.push(app);
    const login = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { origin },
      payload: { password },
    });
    const cookie = String(login.headers["set-cookie"]).split(";")[0]!;

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const list = await app.inject({
      method: "GET",
      url: "/api/work-executions",
      headers: { cookie },
    });
    const executions = list.json().executions as {
      id: string;
      status: string;
      error: string;
      turnCount: number;
    }[];
    expect(executions).toHaveLength(2);
    expect(executions.every((record) => record.status === "interrupted")).toBe(true);
    expect(executions.every((record) => record.error === "SERVER_RESTARTED")).toBe(true);
    expect(chat).not.toHaveBeenCalled();

    const crashed = beforeBoot.find((record) => record.status === "working")!;
    const store = openExecutionStore({ dataDir });
    const recovered = store.get(crashed.id)!;
    store.close();
    // Turn 1 was committed before the crash; turn 2 was in flight and left no partial state.
    expect(recovered.turnCount).toBe(1);
    expect(recovered.transcript).toEqual(crashed.transcript);
    expect(recovered.transcript.map((entry) => entry.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
    ]);

    const restarted = await app.inject({
      method: "POST",
      url: `/api/work-executions/${crashed.id}/restart`,
      headers: { origin, cookie },
    });
    expect(restarted.statusCode).toBe(201);
    expect(restarted.json()).toMatchObject({ attempt: 2, restartedFrom: crashed.id });
    for (let attempt = 0; attempt < 400 && chat.mock.calls.length === 0; attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
    expect(chat).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(chat.mock.calls[0]![1]?.body)) as {
      messages: { role: string; tool_call_id?: string; content: unknown }[];
    };
    expect(sent.messages.some((message) => message.tool_call_id === "call_crash_1")).toBe(true);
    expect(String(sent.messages.at(-1)!.content)).toContain("SERVER_RESTARTED");
  }, 60_000);
});
