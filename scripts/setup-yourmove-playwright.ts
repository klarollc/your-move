import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { preview } from "vite";

import { startLogServer } from "../apps/server/src/launch.js";
import { setYourMovePlaywrightRuntime } from "./yourmove-playwright-runtime.js";

export default async function setupYourMovePlaywright(): Promise<void> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cuckcode-playwright-log-"));
  delete process.env.CUCKCODE_LIVE_WORKFLOW;

  const started = await startLogServer({
    logPath: join(temporaryDirectory, "events.jsonl"),
    projectId: "project_your_move_browser_test",
    port: 4180,
    allowedOrigin: "http://127.0.0.1:4174",
  });

  if (!started.ok) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw new Error(`Your Move test API refused startup (${started.code}): ${started.detail}`);
  }

  try {
    const web = await preview({
      configFile: resolve("apps/web/vite.config.ts"),
      root: resolve("apps/web"),
      preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    });
    setYourMovePlaywrightRuntime({
      close: async () => {
        await web.close();
        await started.server.close();
        await rm(temporaryDirectory, { recursive: true, force: true });
      },
    });
    console.log("Your Move browser checks use an ephemeral empty log and no runner.");
  } catch (error) {
    await started.server.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}
