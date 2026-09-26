import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { CODEX_PIN } from "./codex-pin.js";
import { createControlledCodexHome } from "./controlled-home.js";
import { runRoleExercise } from "./role-exercise.js";
import { CodexStdioSupervisor, type SpawnRuntimeProcess } from "./supervisor.js";

const fixture = fileURLToPath(new URL("./fixtures/fake-app-server.mjs", import.meta.url));

it("carries a controlled role home through supervisor, observed handshake, and one text turn", async () => {
  const parent = await mkdtemp(join(tmpdir(), "cuckcode-exercise-"));
  const credentialSourcePath = join(parent, "source-auth.json");
  await writeFile(credentialSourcePath, '{"synthetic":"not-a-real-credential"}', "utf8");
  const home = await createControlledCodexHome({
    parentDirectory: parent,
    credentialSourcePath,
    instruction: "# Role\n\nThis is the reviewed Delivery Lead instruction.",
  });
  try {
    const supervisor = new CodexStdioSupervisor({
      executable: "codex.exe",
      spawnProcess: exerciseSpawner(),
      codexHome: home.path,
    });
    const result = await runRoleExercise({
      supervisor,
      cwd: parent,
      expectedInstructionSource: home.instructionPath,
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected: {
        requestedModel: "gpt-5.6-luna",
        expectedReasoningEffort: "medium",
        expectedAuthMode: "chatgpt",
        protocolVersion: CODEX_PIN,
        promotedContentSha256: "authored-delivery-lead-v1",
      },
    });

    expect(result).toMatchObject({
      performed: true,
      binding: { model: "gpt-5.6-luna", reasoningEffort: "medium" },
    });
  } finally {
    await home.dispose();
    await rm(parent, { recursive: true, force: true });
  }
});

function exerciseSpawner(): SpawnRuntimeProcess {
  return (_executable, _args, options) =>
    spawn(process.execPath, [fixture], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...options.env, CUCKCODE_FAKE_MODE: "exercise" },
    });
}
