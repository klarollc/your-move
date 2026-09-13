import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ControlledCodexHome = Readonly<{
  path: string;
  instructionPath: string;
  dispose: () => Promise<void>;
}>;

/**
 * Creates the entire instruction environment for one bounded role session.
 *
 * The caller supplies an ordinary temporary parent; this function allocates the child itself, so
 * cleanup has an exact, known target. No user Codex configuration is copied or read. The
 * supervisor receives `path` as `CODEX_HOME`, which the 17c-1b probe established replaces the
 * inherited instruction sources.
 */
export async function createControlledCodexHome(options: {
  parentDirectory: string;
  instruction: string;
}): Promise<ControlledCodexHome> {
  if (options.instruction.trim().length === 0) throw new Error("ROLE_INSTRUCTION_REQUIRED");

  const path = await mkdtemp(join(options.parentDirectory, "cuckcode-role-"));
  const instructionPath = join(path, "AGENTS.md");
  await writeFile(instructionPath, `${options.instruction.trimEnd()}\n`, "utf8");

  return {
    path,
    instructionPath,
    dispose: async () => await rm(path, { recursive: true, force: true }),
  };
}
