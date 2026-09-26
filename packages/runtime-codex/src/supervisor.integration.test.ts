import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CODEX_PIN } from "./codex-pin.js";
import {
  CodexStdioSupervisor,
  type SpawnRuntimeProcess,
  type SupervisorEvent,
} from "./supervisor.js";

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
      executable: "C:/fixture/codex.exe",
      spawnProcess: fixtureSpawner("normal", capture),
    });

    const initialized = await supervisor.start();
    const ready = await supervisor.waitForNotification("fixture/ready");

    expect(capture).toEqual({
      executable: "C:/fixture/codex.exe",
      args: ["app-server", "--stdio", "--strict-config"],
      shell: false,
    });
    expect(initialized.userAgent).toBe(`codex_cli_rs/${CODEX_PIN}`);
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
  it("runs a session in the instruction environment it was configured with", async () => {
    // Not an optional property: an absent env is the fact under test, so it must be storable
    // rather than indistinguishable from a key that was never set.
    const seen: { env: NodeJS.ProcessEnv | undefined }[] = [];
    const recordingSpawner: SpawnRuntimeProcess = (_executable, _args, options) => {
      seen.push({ env: options.env });
      return spawn(process.execPath, [fixture], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, CUCKCODE_FAKE_MODE: "normal" },
      });
    };

    const configured = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: recordingSpawner,
      codexHome: "C:/synthetic/role-home",
    });
    await configured.start();
    await configured.stop();

    const inherited = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: recordingSpawner,
    });
    await inherited.start();
    await inherited.stop();

    // A role runs under exactly its own contract only if the session's instruction environment is
    // chosen rather than inherited. Unconfigured, the child inherits this process's environment,
    // and that is stated by passing no env at all rather than by copying one.
    expect(seen[0]?.env?.CODEX_HOME).toBe("C:/synthetic/role-home");
    expect(seen[1]?.env).toBeUndefined();
  });
});

describe("multi-turn notification consumption", () => {
  it("returns each turn's own completion, not the first one cached", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: fixtureSpawner("multiturn"),
    });
    await supervisor.start();

    const first = (await supervisor.request("turn/start", { threadId: "thread_fixture" })) as {
      turn: { id: string };
    };
    const firstCompleted = await supervisor.waitForTurnCompleted(first.turn.id, 2_000);

    const second = (await supervisor.request("turn/start", { threadId: "thread_fixture" })) as {
      turn: { id: string };
    };
    const secondCompleted = await supervisor.waitForTurnCompleted(second.turn.id, 2_000);

    // Without consuming by turn id, the second wait returns the first turn's completion and a
    // thirteen-turn kickoff would replay turn one twelve times while reporting success.
    expect(first.turn.id).toBe("turn_1");
    expect(second.turn.id).toBe("turn_2");
    expect((firstCompleted.params as { turn: { id: string } }).turn.id).toBe("turn_1");
    expect((secondCompleted.params as { turn: { id: string } }).turn.id).toBe("turn_2");

    await supervisor.stop();
  });

  it("answers a server request with an error instead of dropping it, and never mistakes it for a reply", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "C:/fixture/codex.exe",
      spawnProcess: fixtureSpawner("server-request"),
    });
    const events: SupervisorEvent[] = [];
    try {
      await supervisor.start();
      supervisor.subscribe((event) => events.push(event));
      await supervisor.request("thread/start", {}, 2_000);

      // The fake reuses turn/start's request id for its own request. Routed by id alone, the
      // request would be taken as turn/start's answer, and this would resolve without a turn.
      await expect(supervisor.request("turn/start", {}, 2_000)).resolves.toMatchObject({
        turn: { id: "turn_fixture" },
      });

      const answered = await supervisor.waitForNotification("fixture/serverRequestAnswered", 2_000);
      expect(answered.params).toMatchObject({
        response: { error: { code: -32601 } },
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          kind: "serverRequestRefused",
          method: "item/tool/requestUserInput",
        }),
      );
    } finally {
      await supervisor.stop();
    }
  });

  it("delivers every notification to a subscriber, in arrival order", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "C:/fixture/codex.exe",
      spawnProcess: fixtureSpawner("retry-then-fail"),
    });
    const events: SupervisorEvent[] = [];
    try {
      await supervisor.start();
      await supervisor.request("thread/start", {}, 2_000);
      const unsubscribe = supervisor.subscribe((event) => events.push(event));
      await supervisor.request("turn/start", {}, 2_000);
      await supervisor.waitForTurnCompleted("turn_fixture", 2_000);
      unsubscribe();

      const notifications = events.filter((event) => event.kind === "notification");
      expect(notifications.map((event) => event.method)).toEqual([
        "error",
        "error",
        "error",
        "turn/completed",
      ]);
      expect(
        notifications
          .filter((event) => event.method === "error")
          .map((event) => (event.params as { willRetry: boolean }).willRetry),
      ).toEqual([true, true, false]);
    } finally {
      await supervisor.stop();
    }
  });

  it("stops delivering to a subscriber once it unsubscribes", async () => {
    const supervisor = new CodexStdioSupervisor({
      executable: "C:/fixture/codex.exe",
      spawnProcess: fixtureSpawner("retry-then-fail"),
    });
    const events: SupervisorEvent[] = [];
    try {
      await supervisor.start();
      // The fake announces readiness after the handshake; let it land before subscribing.
      await supervisor.waitForNotification("fixture/ready", 2_000);
      const unsubscribe = supervisor.subscribe((event) => events.push(event));
      await supervisor.request("thread/start", {}, 2_000);
      unsubscribe();
      await supervisor.request("turn/start", {}, 2_000);
      await supervisor.waitForTurnCompleted("turn_fixture", 2_000);
      expect(events).toEqual([]);
    } finally {
      await supervisor.stop();
    }
  });
});
