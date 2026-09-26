import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openSessionLog, sessionLogPath, type SessionLogSource } from "./session-log.js";
import type { SupervisorEvent } from "./supervisor.js";

function source() {
  const listeners = new Set<(event: SupervisorEvent) => void>();
  const stderr: string[] = [];
  const log: SessionLogSource = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    stderr,
  };
  const emit = (event: SupervisorEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  return { log, emit, stderr, listening: () => listeners.size };
}

const clockAt = () => {
  let now = 0;
  return {
    clock: { now: () => now, iso: () => "2026-09-26T12:00:00.000Z" },
    tick: (ms: number) => (now += ms),
  };
};

async function lines(path: string) {
  return (await readFile(path, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("the session log", () => {
  it("is named per script and role, with no colon, so it is a valid Windows file name", () => {
    expect(
      sessionLogPath("/r", "run-codex-smoke", "2026-09-26T12:00:00.000Z", "release-reviewer"),
    ).toBe(join("/r", "run-codex-smoke", "2026-09-26T12-00-00-000Z-release-reviewer.jsonl"));
  });

  it("writes a header, then every notification in order, with the time it arrived", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, emit } = source();
    const { clock, tick } = clockAt();
    const session = openSessionLog(log, {
      root,
      script: "run-codex-smoke",
      roleId: "release-reviewer",
      pin: "0.157.1",
      clock,
    });
    tick(10);
    emit({ kind: "notification", method: "turn/started", params: { turnId: "t1" } });
    tick(5);
    emit({
      kind: "notification",
      method: "turn/completed",
      params: { turn: { id: "t1", status: "completed", items: [] } },
    });
    const path = await session.close();
    const [header, ...rest] = await lines(path);
    expect(header).toMatchObject({
      kind: "session",
      script: "run-codex-smoke",
      roleId: "release-reviewer",
      codexPin: "0.157.1",
      startedAt: "2026-09-26T12:00:00.000Z",
      deltaCounts: {},
      refusedServerRequests: [],
    });
    expect(rest.map((line) => [line.kind, line.method, line.atMs])).toEqual([
      ["notification", "turn/started", 10],
      ["notification", "turn/completed", 15],
    ]);
  });

  it("counts streaming deltas instead of storing them", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, emit } = source();
    const session = openSessionLog(log, {
      root,
      script: "s",
      roleId: "r",
      pin: "p",
      clock: clockAt().clock,
    });
    for (let index = 0; index < 3; index += 1)
      emit({
        kind: "notification",
        method: "item/agentMessage/delta",
        params: { delta: "secret words" },
      });
    emit({
      kind: "notification",
      method: "item/reasoning/summaryTextDelta",
      params: { delta: "x" },
    });
    const path = await session.close();
    const text = await readFile(path, "utf8");
    const [header, ...rest] = await lines(path);
    expect(header?.deltaCounts).toEqual({
      "item/agentMessage/delta": 3,
      "item/reasoning/summaryTextDelta": 1,
    });
    expect(rest).toEqual([]);
    expect(text).not.toContain("secret words");
  });

  it("keeps what an item was but not the words in it", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, emit } = source();
    const session = openSessionLog(log, {
      root,
      script: "s",
      roleId: "r",
      pin: "p",
      clock: clockAt().clock,
    });
    emit({
      kind: "notification",
      method: "item/completed",
      params: {
        threadId: "th",
        turnId: "t1",
        item: { id: "i1", type: "agentMessage", text: "the whole verdict" },
      },
    });
    const path = await session.close();
    const text = await readFile(path, "utf8");
    const [, item] = await lines(path);
    expect(item?.params).toEqual({
      threadId: "th",
      turnId: "t1",
      item: { id: "i1", type: "agentMessage", text: { redactedLength: 17 } },
    });
    expect(text).not.toContain("the whole verdict");
  });

  it("records a refused server request and appends the supervisor's stderr", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, emit, stderr } = source();
    const session = openSessionLog(log, {
      root,
      script: "s",
      roleId: "r",
      pin: "p",
      clock: clockAt().clock,
    });
    emit({ kind: "serverRequestRefused", method: "item/tool/requestUserInput", id: 7, params: {} });
    stderr.push("Authorization: Bearer [REDACTED]", "warn: something");
    const path = await session.close();
    const all = await lines(path);
    expect(all[0]?.refusedServerRequests).toEqual(["item/tool/requestUserInput"]);
    expect(all.filter((line) => line.kind === "stderr").map((line) => line.line)).toEqual([
      "Authorization: Bearer [REDACTED]",
      "warn: something",
    ]);
  });

  it("stops listening once closed", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, listening } = source();
    const session = openSessionLog(log, {
      root,
      script: "s",
      roleId: "r",
      pin: "p",
      clock: clockAt().clock,
    });
    expect(listening()).toBe(1);
    await session.close();
    expect(listening()).toBe(0);
  });

  it("keeps no identity or home path from a log shaped like the real smoke session", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, emit, stderr } = source();
    const home = "C:\\Users\\nater";
    const session = openSessionLog(log, {
      root,
      script: "run-codex-smoke",
      roleId: "release-reviewer",
      pin: "0.157.1",
      clock: clockAt().clock,
      home,
    });
    emit({
      kind: "notification",
      method: "remoteControl/status/changed",
      params: {
        status: "disabled",
        serverName: "Nate_PC",
        installationId: "470fd39b-d4c5-47c6-b8dc-173f81c3e44a",
      },
    });
    emit({
      kind: "notification",
      method: "account/updated",
      params: { authMode: "chatgpt", planType: "plus" },
    });
    emit({
      kind: "notification",
      method: "account/rateLimits/updated",
      params: { rateLimits: { primary: { usedPercent: 5, windowDurationMins: 300 } } },
    });
    emit({
      kind: "notification",
      method: "thread/started",
      params: {
        thread: {
          id: "t",
          environments: [
            {
              cwd: "C:\\Users\\nater\\AppData\\Local\\Temp\\cuckcode-codex-smoke-HpOA1g",
              runtimeWorkspaceRoots: [
                "c:/users/NATER/AppData/Local/Temp/cuckcode-codex-smoke-HpOA1g",
              ],
            },
          ],
        },
      },
    });
    stderr.push(
      'Refusing to create helper binaries under temporary dir "C:\\\\Users\\\\nater\\\\AppData\\\\Local\\\\Temp\\\\"',
    );
    const path = await session.close();
    const text = await readFile(path, "utf8");
    const all = await lines(path);

    for (const secret of ["Nate_PC", "470fd39b", "plus", "usedPercent", "nater", "NATER"]) {
      expect(text, secret).not.toContain(secret);
    }
    expect(all[0]).toMatchObject({ redaction: "v1" });
    expect(all.slice(1, 4).map((line) => [line.method, line.params])).toEqual([
      ["remoteControl/status/changed", { redacted: "identity" }],
      ["account/updated", { redacted: "identity" }],
      ["account/rateLimits/updated", { redacted: "identity" }],
    ]);
    expect(text).toContain("~");
    expect(text).toContain("cuckcode-codex-smoke-HpOA1g");
  });

  it("folds the home directory only where it ends, not a sibling that shares its prefix", async () => {
    const root = await mkdtemp(join(tmpdir(), "cuckcode-session-log-"));
    const { log, emit } = source();
    const session = openSessionLog(log, {
      root,
      script: "s",
      roleId: "r",
      pin: "p",
      clock: clockAt().clock,
      home: "/home/nate",
    });
    emit({
      kind: "notification",
      method: "thread/started",
      params: { a: "/home/nate/work", b: "/home/nate", c: "/home/nate-old/work" },
    });
    const [, started] = await lines(await session.close());
    expect(started?.params).toEqual({ a: "~/work", b: "~", c: "/home/nate-old/work" });
  });
});
