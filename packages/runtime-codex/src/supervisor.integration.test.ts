import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CodexStdioSupervisor, type SpawnRuntimeProcess } from "./supervisor.js";

const fixture = fileURLToPath(new URL("./fixtures/fake-app-server.mjs", import.meta.url));

function fixtureSpawner(
  mode = "normal",
  capture?: { executable?: string; args?: readonly string[]; shell?: boolean },
): SpawnRuntimeProcess {
  return (executable, args, options) => {
    if (capture) {
      capture.executable = executable;
      capture.args = args;
      capture.shell = options.shell;
    }
    return spawn(process.execPath, [fixture], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, CUCKCODE_FAKE_MODE: mode },
    });
  };
}

describe("Codex stdio supervisor", () => {
  it("uses fixed direct-spawn arguments and performs initialize then initialized", async () => {
    const capture: { executable?: string; args?: readonly string[]; shell?: boolean } = {};
    const supervisor = new CodexStdioSupervisor({
      executable: "C:/Programs/OpenAI/Codex/bin/codex.exe",
      spawnProcess: fixtureSpawner("normal", capture),
    });

    const initialized = await supervisor.start();
    const ready = await supervisor.waitForNotification("fixture/ready");

    expect(capture).toEqual({
      executable: "C:/Programs/OpenAI/Codex/bin/codex.exe",
      args: ["app-server", "--stdio", "--strict-config"],
      shell: false,
    });
    expect(initialized.userAgent).toBe("codex_cli_rs/0.146.0");
    expect(ready.method).toBe("fixture/ready");
    expect(supervisor.stderr).toEqual(["Authorization: Bearer [REDACTED]"]);
    await supervisor.stop();
  });

  it("reports missing managed authentication separately", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: fixtureSpawner(),
    });
    await supervisor.start();

    await expect(supervisor.readAccountStatus()).resolves.toEqual({
      ok: false,
      code: "AUTH_REQUIRED",
    });
    await supervisor.stop();
  });

  it("fails a silent handshake within the configured bound", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: fixtureSpawner("silent"),
      handshakeTimeoutMs: 25,
    });

    await expect(supervisor.start()).rejects.toThrow("HANDSHAKE_TIMEOUT");
    await supervisor.stop();
  });

  it("allows only the bounded stable live-run methods after handshake", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: fixtureSpawner(),
    });
    await supervisor.start();
    const thread = await supervisor.request("thread/start", {
      cwd: "C:/synthetic",
      ephemeral: true,
      sandbox: "read-only",
      approvalPolicy: "never",
    });
    await supervisor.request("turn/start", {
      threadId: "thread_fixture",
      input: [{ type: "text", text: "Reply only CUCKCODE_LIVE_OK" }],
    });
    const completed = await supervisor.waitForNotification("turn/completed");

    expect(thread).toEqual({ thread: { id: "thread_fixture" } });
    expect(completed).toMatchObject({ params: { turn: { status: "completed" } } });
    await expect(supervisor.request("account/login/start", {})).rejects.toThrow(
      "METHOD_NOT_ALLOWED",
    );
    await supervisor.stop();
  });
});
