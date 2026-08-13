import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { CodexStdioSupervisor } from "./supervisor.js";

const live = process.env.CUCKCODE_LIVE_CODEX === "1" ? it : it.skip;

live(
  "completes one bounded authenticated local Codex contract turn",
  async () => {
    const syntheticRoot = mkdtempSync(join(tmpdir(), "cuckcode-live-"));
    const supervisor = new CodexStdioSupervisor({
      executable: "C:/Users/nater/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe",
      handshakeTimeoutMs: 10_000,
    });
    try {
      const initialized = await supervisor.start();
      expect(initialized.userAgent).toContain("0.146.0");
      const auth = await supervisor.readAccountStatus();
      expect(auth.ok).toBe(true);

      const threadResult = await supervisor.request(
        "thread/start",
        {
          cwd: syntheticRoot,
          ephemeral: true,
          sandbox: "read-only",
          approvalPolicy: "never",
          approvalsReviewer: "user",
          baseInstructions:
            "This is a bounded contract test. Do not call tools, access files, use network tools, connectors, subagents, or perform external effects. Reply only with CUCKCODE_LIVE_OK.",
        },
        30_000,
      );
      const threadId = nestedId(threadResult, "thread");
      expect(threadId).toBeTruthy();

      const turnResult = await supervisor.request(
        "turn/start",
        {
          threadId,
          input: [
            {
              type: "text",
              text: "Return exactly CUCKCODE_LIVE_OK. Do not call any tool or perform any external effect.",
            },
          ],
        },
        30_000,
      );
      const turnId = nestedId(turnResult, "turn");
      const completed = await supervisor.waitForNotification("turn/completed", 90_000);
      const params = record(completed.params);
      const turn = record(params?.turn);
      expect(params?.threadId).toBe(threadId);
      expect(turn?.id).toBe(turnId);
      expect(turn?.status).toBe("completed");
      expect(JSON.stringify(turn)).toContain("CUCKCODE_LIVE_OK");

      const items = Array.isArray(turn?.items) ? turn.items : [];
      const forbiddenItemTypes = new Set([
        "commandExecution",
        "fileChange",
        "mcpToolCall",
        "dynamicToolCall",
        "collabAgentToolCall",
        "webSearch",
        "imageGeneration",
      ]);
      expect(items.some((item) => forbiddenItemTypes.has(String(record(item)?.type)))).toBe(false);
      expect(
        supervisor.stderr.some(
          (line) => /authorization|api[_-]?key|sk-/iu.test(line) && !line.includes("[REDACTED]"),
        ),
      ).toBe(false);
    } finally {
      await supervisor.stop();
      await removeSyntheticRoot(syntheticRoot);
    }
  },
  120_000,
);

async function removeSyntheticRoot(root: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      rmSync(root, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}

function nestedId(value: unknown, key: string): string {
  const nested = record(record(value)?.[key]);
  if (typeof nested?.id !== "string" || nested.id.length === 0)
    throw new Error(`LIVE_${key.toUpperCase()}_ID_MISSING`);
  return nested.id;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
