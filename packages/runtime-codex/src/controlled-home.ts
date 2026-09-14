import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ControlledCodexHome = Readonly<{
  path: string;
  instructionPath: string;
  credentialPath: string;
  dispose: () => Promise<void>;
}>;

/** Codex reads managed authentication from exactly this file inside `CODEX_HOME`. */
const CREDENTIAL_FILENAME = "auth.json";

/**
 * Creates the entire instruction environment for one bounded role session.
 *
 * The caller supplies an ordinary temporary parent; this function allocates the child itself, so
 * cleanup has an exact, known target. The supervisor receives `path` as `CODEX_HOME`, which the
 * 17c-1b probe established replaces the inherited instruction sources.
 *
 * Exactly two files are written. `AGENTS.md` is the composed role brief and the only instruction
 * source the session can load — no `config.toml` and no inherited `AGENTS.md` is copied, which is
 * the DF-010 guarantee. `auth.json` is copied from the named source because replacing `CODEX_HOME`
 * also replaces the credential Codex reads, and a home without it authenticates as nobody: every
 * role exercise on 2026-09-13 stopped at `AUTH_REQUIRED` for exactly this reason.
 *
 * The copy is a credential on disk for the life of the session. It is confined to the child
 * directory `dispose` deletes, and is never logged, so the residual exposure is bounded by
 * cleanup — which is why an absent credential fails loudly here rather than producing a home that
 * would fail later and look like a provider problem.
 */
export async function createControlledCodexHome(options: {
  parentDirectory: string;
  instruction: string;
  credentialSourcePath: string;
}): Promise<ControlledCodexHome> {
  if (options.instruction.trim().length === 0) throw new Error("ROLE_INSTRUCTION_REQUIRED");

  const path = await mkdtemp(join(options.parentDirectory, "cuckcode-role-"));
  const dispose = async (): Promise<void> => await rm(path, { recursive: true, force: true });

  const instructionPath = join(path, "AGENTS.md");
  const credentialPath = join(path, CREDENTIAL_FILENAME);

  try {
    await writeFile(instructionPath, `${options.instruction.trimEnd()}\n`, "utf8");
    await copyFile(options.credentialSourcePath, credentialPath);
  } catch (cause) {
    await dispose();
    throw new Error("RUNTIME_CREDENTIAL_UNAVAILABLE", { cause });
  }

  return { path, instructionPath, credentialPath, dispose };
}
