import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { CodexStdioSupervisor } from "./supervisor.js";

/**
 * Task 17c-1b — can a role be given its own instruction environment?
 *
 * The 17c-1 probe found that every thread reports an instruction source in the owner's Codex home
 * (DF-010): a file no digest covers, shared by all six roles, which itself points at a further
 * skill directory. Digesting that file would pin a pointer rather than the content it names.
 *
 * The stronger fix is to spawn each role against a Codex home containing only its promoted
 * overlay, and then assert the reported instruction sources are exactly that. This probe asks the
 * one question that decides whether that is possible: does Codex honour CODEX_HOME?
 *
 * No turn is started, so this costs no model tokens. `instructionSources` is reported by
 * thread/start, which is as far as it needs to go.
 *
 * It requires no production change: the supervisor passes no `env` to spawn, so the child inherits
 * this process's environment.
 */
const live = process.env.CUCKCODE_LIVE_CODEX === "1" ? it : it.skip;

const EXECUTABLE =
  process.env.CUCKCODE_CODEX_EXE ??
  "C:/Users/nater/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe";

const MARKER = "CUCKCODE_CONTROLLED_HOME_MARKER";

live(
  "reports whether a controlled CODEX_HOME replaces the default instruction sources",
  async () => {
    const controlledHome = mkdtempSync(join(tmpdir(), "cuckcode-home-"));
    const syntheticRoot = mkdtempSync(join(tmpdir(), "cuckcode-home-cwd-"));
    writeFileSync(
      join(controlledHome, "AGENTS.md"),
      `# ${MARKER}\n\nThis file exists only to be detected by the Task 17c-1b probe.\n`,
      "utf8",
    );

    const priorHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = controlledHome;

    const supervisor = new CodexStdioSupervisor({
      executable: EXECUTABLE,
      handshakeTimeoutMs: 10_000,
    });

    try {
      const initialized = await supervisor.start();
      const threadResult = await supervisor.request(
        "thread/start",
        {
          cwd: syntheticRoot,
          ephemeral: true,
          sandbox: "read-only",
          approvalPolicy: "never",
          approvalsReviewer: "user",
          baseInstructions: "Bounded probe. Do not act.",
        },
        30_000,
      );

      const sources = instructionSources(threadResult);
      const controlled = sources.filter((source) => isInside(source, controlledHome));
      const foreign = sources.filter((source) => !isInside(source, controlledHome));

      process.stdout.write(
        [
          "",
          "===== controlled CODEX_HOME probe =====",
          `requested CODEX_HOME     = ${controlledHome}`,
          `initialize.codexHome     = ${initialized.codexHome}`,
          `honoured by initialize   = ${isInside(initialized.codexHome, controlledHome) || initialized.codexHome === controlledHome}`,
          `instructionSources       = ${JSON.stringify(sources)}`,
          `  inside controlled home = ${controlled.length}`,
          `  outside it             = ${foreign.length}`,
          "",
          foreign.length === 0
            ? "VERDICT: a controlled Codex home fully replaces the default instruction sources."
            : "VERDICT: instruction sources outside the controlled home still load. The controlled-home fix does NOT close DF-010 on its own.",
          "",
        ].join("\n"),
      );

      // The verdict is the output, not an assertion. Asserting the outcome would decide the
      // question this probe exists to ask.
      expect(initialized.codexHome).toBeTruthy();
    } finally {
      if (priorHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = priorHome;
      await supervisor.stop();
      await removeTree(syntheticRoot);
      await removeTree(controlledHome);
    }
  },
  120_000,
);

function instructionSources(value: unknown): string[] {
  const sources = record(value)?.instructionSources;
  return Array.isArray(sources) ? sources.filter((entry) => typeof entry === "string") : [];
}

/** Windows paths differ in separator and case between what is set and what is reported back. */
function isInside(candidate: string, root: string): boolean {
  return normalise(candidate).startsWith(normalise(root));
}

function normalise(value: string): string {
  return value.replaceAll("\\", "/").toLowerCase();
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function removeTree(root: string): Promise<void> {
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
