import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { CodexStdioSupervisor } from "./supervisor.js";

/**
 * Task 17c-1 — a read-only probe that answers two questions the tree cannot answer by inspection:
 *
 * 1. Does Codex report which model ran, anywhere in initialize, thread/start or turn/completed?
 *    `buildBindingReport` refuses a binding on MODEL_DRIFT, and that check is only meaningful if
 *    the model is read back. Filling it from the request would compare the request against itself.
 * 2. Does anything enumerate a tool surface? `toolIds: []` in a binding report is supposed to mean
 *    the session was observed to expose none, and nothing currently looks.
 *
 * This spec asserts almost nothing on purpose. It is an instrument, not a guard: it prints the
 * SHAPE of what came back so the answer is a fact on the record rather than an assumption. Values
 * are elided unless they are short and safe, so a dump can be pasted into evidence without
 * carrying transcript text or anything credential-shaped.
 */
const live = process.env.CUCKCODE_LIVE_CODEX === "1" ? it : it.skip;

const EXECUTABLE =
  process.env.CUCKCODE_CODEX_EXE ??
  "C:/Users/nater/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe";

live(
  "reports the shape of every fact a binding would need",
  async () => {
    const syntheticRoot = mkdtempSync(join(tmpdir(), "cuckcode-probe-"));
    const supervisor = new CodexStdioSupervisor({
      executable: EXECUTABLE,
      handshakeTimeoutMs: 10_000,
    });
    try {
      const initialized = await supervisor.start();
      report("initialize", initialized);

      const auth = await supervisor.readAccountStatus();
      report("account/read (normalised)", auth);

      const threadResult = await supervisor.request(
        "thread/start",
        {
          cwd: syntheticRoot,
          ephemeral: true,
          sandbox: "read-only",
          approvalPolicy: "never",
          approvalsReviewer: "user",
          baseInstructions:
            "This is a bounded read-only probe. Do not call tools, access files, use network tools, connectors, subagents, or perform external effects. Reply only with CUCKCODE_PROBE_OK.",
        },
        30_000,
      );
      report("thread/start", threadResult);

      const threadId = nestedId(threadResult, "thread");
      await supervisor.request(
        "turn/start",
        {
          threadId,
          input: [
            {
              type: "text",
              text: "Return exactly CUCKCODE_PROBE_OK. Do not call any tool or perform any external effect.",
            },
          ],
        },
        30_000,
      );

      const completed = await supervisor.waitForNotification("turn/completed", 90_000);
      report("turn/completed", completed);

      const readBack = await supervisor.request("thread/read", { threadId }, 30_000);
      report("thread/read", readBack);

      // The only assertions: the session came up and the probe turn completed. Everything else
      // this spec produces is observation, and an observation that asserts its own conclusion is
      // not an observation.
      expect(initialized.userAgent).toBeTruthy();
      expect(completed.method).toBe("turn/completed");
    } finally {
      await supervisor.stop();
      await removeSyntheticRoot(syntheticRoot);
    }
  },
  180_000,
);

/** Prints every key path and an elided description of its value. */
function report(label: string, value: unknown): void {
  const lines: string[] = [];
  walk(value, "", lines);
  process.stdout.write(`\n===== ${label} =====\n${lines.join("\n")}\n`);
}

function walk(value: unknown, path: string, lines: string[]): void {
  if (Array.isArray(value)) {
    lines.push(`${path || "."} = array(${value.length})`);
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`, lines));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) walk(nested, `${path}.${key}`, lines);
    return;
  }
  lines.push(`${path || "."} = ${describe(value)}`);
}

/**
 * Short, non-secret-shaped strings print verbatim, because the whole question is whether a model
 * name or a tool id appears somewhere. Everything else prints as a type and a length.
 */
function describe(value: unknown): string {
  if (typeof value !== "string") return `${typeof value}(${String(value)})`;
  if (/authorization|bearer|api[_-]?key|token|password|sk-/iu.test(value)) {
    return `string(len=${value.length}) [REDACTED]`;
  }
  return value.length <= 80 ? JSON.stringify(value) : `string(len=${value.length})`;
}

function nestedId(value: unknown, key: string): string {
  const nested = record(record(value)?.[key]);
  if (typeof nested?.id !== "string" || nested.id.length === 0)
    throw new Error(`PROBE_${key.toUpperCase()}_ID_MISSING`);
  return nested.id;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

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
