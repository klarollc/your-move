import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createManualClock } from "./fixtures/manual-clock.js";
import { CodexStdioSupervisor, type SpawnRuntimeProcess } from "./supervisor.js";
import { createRetryBudget, runTurn, type TurnRunResult } from "./turn-runner.js";

const fixture = fileURLToPath(new URL("./fixtures/fake-app-server.mjs", import.meta.url));
const spawner =
  (mode: string): SpawnRuntimeProcess =>
  () =>
    spawn(process.execPath, [fixture], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, CUCKCODE_FAKE_MODE: mode },
    });

/** Drives a manual clock until the run settles, yielding to real I/O between steps. */
async function settle(
  run: Promise<TurnRunResult>,
  clock: ReturnType<typeof createManualClock>,
  stepMs: number,
): Promise<TurnRunResult> {
  let result: TurnRunResult | undefined;
  void run.then((value) => (result = value));
  for (let step = 0; step < 200 && result === undefined; step += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    clock.advance(stepMs);
  }
  if (result === undefined) throw new Error("run did not settle");
  return result;
}

async function withSession(
  mode: string,
  body: (supervisor: CodexStdioSupervisor) => Promise<void>,
) {
  const supervisor = new CodexStdioSupervisor({
    executable: "C:/fixture/codex.exe",
    spawnProcess: spawner(mode),
  });
  try {
    await supervisor.start();
    await supervisor.request("thread/start", {}, 2_000);
    await body(supervisor);
  } finally {
    await supervisor.stop();
  }
}

const input = [{ type: "text", text: "go" }];

describe("the turn runner against a real child process", () => {
  it("recovers from one transport failure after the backoff", async () => {
    await withSession("transport-fail-once", async (supervisor) => {
      const clock = createManualClock();
      const result = await settle(
        runTurn(supervisor, {
          threadId: "thread_fixture",
          input,
          clock,
          retryBudget: createRetryBudget(2),
        }),
        clock,
        10_000,
      );
      expect(result.ok).toBe(true);
      expect(result.attempts.map((attempt) => attempt.outcome)).toEqual(["failed", "completed"]);
    });
  });

  it("stops after a second transport failure", async () => {
    await withSession("transport-fail-twice", async (supervisor) => {
      const clock = createManualClock();
      const result = await settle(
        runTurn(supervisor, {
          threadId: "thread_fixture",
          input,
          clock,
          retryBudget: createRetryBudget(2),
        }),
        clock,
        10_000,
      );
      expect(result).toMatchObject({ ok: false, code: "TURN_FAILED" });
      expect(result.attempts).toHaveLength(2);
    });
  });

  it("does not retry a usage limit", async () => {
    await withSession("non-transport-fail", async (supervisor) => {
      const clock = createManualClock();
      const result = await settle(
        runTurn(supervisor, {
          threadId: "thread_fixture",
          input,
          clock,
          retryBudget: createRetryBudget(2),
        }),
        clock,
        10_000,
      );
      expect(result).toMatchObject({ ok: false, code: "TURN_FAILED" });
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]?.failure?.variant).toBe("usageLimitExceeded");
    });
  });

  it("interrupts a silent turn through the real protocol and records it", async () => {
    await withSession("silent-turn", async (supervisor) => {
      const clock = createManualClock();
      const result = await settle(
        runTurn(supervisor, { threadId: "thread_fixture", input, clock }),
        clock,
        30_000,
      );
      expect(result).toMatchObject({ ok: false, code: "TURN_IDLE_TIMEOUT" });
      expect(result.attempts[0]).toMatchObject({
        status: "interrupted",
        lastMethod: "turn/started",
      });
    });
  });

  it("fails a turn by name when the server sends a request", async () => {
    await withSession("server-request", async (supervisor) => {
      const clock = createManualClock();
      const result = await settle(
        runTurn(supervisor, { threadId: "thread_fixture", input, clock }),
        clock,
        1_000,
      );
      expect(result).toMatchObject({ ok: false, code: "SERVER_REQUEST_REFUSED" });
      expect(result.attempts[0]?.refusedServerRequest).toBe("item/tool/requestUserInput");
    });
  });
});
