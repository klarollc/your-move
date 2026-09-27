import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import {
  CODEX_PIN,
  CodexStdioSupervisor,
  createControlledCodexHome,
  type SpawnRuntimeProcess,
} from "@cuckcode/runtime-codex";

import { PROBE_MAX_LINE_BYTES, probeRuntime, runCodexProbeSurface } from "./codex-probe-surface.js";

const fixture = fileURLToPath(
  new URL("../packages/runtime-codex/src/fixtures/fake-app-server.mjs", import.meta.url),
);

it("rehearses the probe end to end against a fake Codex whose codex_apps follows the apps feature", async () => {
  const parent = await mkdtemp(join(tmpdir(), "cuckcode-probe-"));
  const credentialSourcePath = join(parent, "source-auth.json");
  await writeFile(credentialSourcePath, '{"synthetic":"not-a-real-credential"}', "utf8");
  const records: Array<Record<string, unknown>> = [];
  let supervisor: CodexStdioSupervisor | undefined;
  try {
    const outcome = await runCodexProbeSurface({
      optIn: true,
      pin: CODEX_PIN,
      cwd: parent,
      expected: { requestedModel: "gpt-5.6-sol", expectedReasoningEffort: "medium" },
      checkDrift: async () => {},
      openRuntime: async () => {
        const home = await createControlledCodexHome({
          parentDirectory: parent,
          credentialSourcePath,
          instruction: "# Probe\n\nNo task. This session starts no turn.",
        });
        supervisor = new CodexStdioSupervisor({
          executable: "codex.exe",
          spawnProcess: spawner(),
          codexHome: home.path,
        });
        await supervisor.start();
        return probeRuntime(supervisor, async () => "session-log.jsonl", home.dispose);
      },
      writeRecord: async (record) => {
        records.push(record);
        return "record.json";
      },
      now: () => new Date().toISOString(),
    });

    expect(outcome).toEqual({ ok: true, code: "PROBE_OK", recordPath: "record.json" });
    expect(records[0]).toMatchObject({
      control: { servers: [{ name: "codex_apps" }] },
      policy: { servers: [] },
      sessionLog: "session-log.jsonl",
    });
    expect(supervisor?.stderr.join("\n")).not.toContain("turn/start reached");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

function spawner(mode = "apps-by-feature"): SpawnRuntimeProcess {
  return (_executable, _args, options) =>
    spawn(process.execPath, [fixture], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...options.env, CUCKCODE_FAKE_MODE: mode },
    });
}

async function rehearse(mode: string, maxLineBytes?: number) {
  const parent = await mkdtemp(join(tmpdir(), "cuckcode-probe-"));
  const credentialSourcePath = join(parent, "source-auth.json");
  await writeFile(credentialSourcePath, '{"synthetic":"not-a-real-credential"}', "utf8");
  const records: Array<Record<string, unknown>> = [];
  try {
    const outcome = await runCodexProbeSurface({
      optIn: true,
      pin: CODEX_PIN,
      cwd: parent,
      expected: { requestedModel: "gpt-5.6-sol", expectedReasoningEffort: "medium" },
      checkDrift: async () => {},
      openRuntime: async () => {
        const home = await createControlledCodexHome({
          parentDirectory: parent,
          credentialSourcePath,
          instruction: "# Probe\n\nNo task. This session starts no turn.",
        });
        const supervisor = new CodexStdioSupervisor({
          executable: "codex.exe",
          spawnProcess: spawner(mode),
          codexHome: home.path,
          ...(maxLineBytes === undefined ? {} : { maxLineBytes }),
        });
        await supervisor.start();
        return probeRuntime(supervisor, async () => null, home.dispose);
      },
      writeRecord: async (record) => {
        records.push(record);
        return "record.json";
      },
      now: () => new Date().toISOString(),
    });
    return { outcome, record: records[0] };
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

it("reads a control listing over 1 MiB with the probe's bound, which the default refuses", async () => {
  // 2026-09-27: the signed-in control's codex_apps listing exceeded the supervisor's default 1 MiB
  // line cap, and the probe stopped with LINE_TOO_LARGE before it could compare anything.
  const refused = await rehearse("apps-large-by-feature");
  expect(refused.record).toMatchObject({ code: "PROBE_RUNTIME_FAILURE", detail: "LINE_TOO_LARGE" });

  const read = await rehearse("apps-large-by-feature", PROBE_MAX_LINE_BYTES);
  expect(read.outcome).toMatchObject({ ok: true, code: "PROBE_OK" });
  expect(read.record).toMatchObject({ control: { servers: [{ name: "codex_apps" }] } });
}, 30_000);
