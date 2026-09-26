import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { CODEX_PIN } from "./codex-pin.js";
import { createControlledCodexHome } from "./controlled-home.js";
import { openSessionLog } from "./session-log.js";
import { CodexStdioSupervisor } from "./supervisor.js";

const fixture = fileURLToPath(new URL("./fixtures/fake-app-server.mjs", import.meta.url));

it("never carries the credential or a bearer token into the session log", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "cuckcode-session-canary-"));
  const sentinel = "CUCKCODE_CREDENTIAL_SENTINEL_7f3a";
  const credential = join(scratch, "auth.json");
  await writeFile(credential, JSON.stringify({ tokens: { access_token: sentinel } }), "utf8");
  const home = await createControlledCodexHome({
    parentDirectory: scratch,
    instruction: "role brief",
    credentialSourcePath: credential,
  });
  const supervisor = new CodexStdioSupervisor({
    executable: "C:/fixture/codex.exe",
    codexHome: home.path,
    // The fake writes "Authorization: Bearer secret-canary" to stderr during the handshake.
    spawnProcess: (_executable, _args, options) =>
      spawn(process.execPath, [fixture], {
        ...options,
        env: { ...options.env, CUCKCODE_FAKE_MODE: "multiturn" },
      }),
  });
  const log = openSessionLog(supervisor, {
    root: join(scratch, "sessions"),
    script: "canary",
    roleId: "release-reviewer",
    pin: CODEX_PIN,
  });
  try {
    await supervisor.start();
    await supervisor.request("thread/start", {}, 2_000);
    await supervisor.request("turn/start", { threadId: "thread_fixture", input: [] }, 2_000);
    await supervisor.waitForTurnCompleted("turn_1", 2_000);
  } finally {
    await supervisor.stop();
  }
  const text = await readFile(await log.close(), "utf8");
  await home.dispose();

  expect(text).toContain('"method":"turn/completed"');
  expect(text).toContain("[REDACTED]");
  expect(text).not.toContain("secret-canary");
  expect(text).not.toContain(sentinel);
  expect(text).not.toContain("TURN_1_OK");
});
