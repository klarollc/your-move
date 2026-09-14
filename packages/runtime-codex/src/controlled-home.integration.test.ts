import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createControlledCodexHome } from "./controlled-home.js";

/**
 * Never the owner's real credential. The provisioning contract is about which bytes land where,
 * so a synthetic file proves it exactly and leaks nothing.
 */
const SYNTHETIC_CREDENTIAL = '{"synthetic":"not-a-real-credential"}';

describe("controlled Codex home", () => {
  let parentDirectory: string;
  let credentialSourcePath: string;

  beforeEach(async () => {
    parentDirectory = await mkdtemp(join(tmpdir(), "cuckcode-home-test-"));
    credentialSourcePath = join(parentDirectory, "source-auth.json");
    await writeFile(credentialSourcePath, SYNTHETIC_CREDENTIAL, "utf8");
  });

  afterEach(async () => {
    await rm(parentDirectory, { recursive: true, force: true });
  });

  it("creates a fresh home containing exactly the composed role instruction", async () => {
    const instruction = "# Role\n\nUse only the reviewed role contract.";
    const home = await createControlledCodexHome({
      parentDirectory,
      instruction,
      credentialSourcePath,
    });

    expect(await readFile(home.instructionPath, "utf8")).toBe(`${instruction}\n`);
    await home.dispose();
  });

  it("loads exactly one instruction source and no inherited Codex configuration", async () => {
    const home = await createControlledCodexHome({
      parentDirectory,
      instruction: "# Role",
      credentialSourcePath,
    });

    const entries = await readdir(home.path);
    // The DF-010 guarantee: one instruction file, and no config.toml or inherited AGENTS.md
    // reaching the session from the owner's Codex home.
    expect(entries.filter((entry) => entry.endsWith(".md"))).toEqual(["AGENTS.md"]);
    expect(entries).not.toContain("config.toml");
    await home.dispose();
  });

  it("provisions the runtime credential so the session can authenticate", async () => {
    const home = await createControlledCodexHome({
      parentDirectory,
      instruction: "# Role",
      credentialSourcePath,
    });

    expect(await readFile(join(home.path, "auth.json"), "utf8")).toBe(SYNTHETIC_CREDENTIAL);
    expect(home.credentialPath).toBe(join(home.path, "auth.json"));
    await home.dispose();
  });

  it("refuses to build an unauthenticated home when the credential is absent", async () => {
    await expect(
      createControlledCodexHome({
        parentDirectory,
        instruction: "# Role",
        credentialSourcePath: join(parentDirectory, "missing-auth.json"),
      }),
    ).rejects.toThrow("RUNTIME_CREDENTIAL_UNAVAILABLE");
  });

  it("removes the provisioned credential when the home is disposed", async () => {
    const home = await createControlledCodexHome({
      parentDirectory,
      instruction: "# Role",
      credentialSourcePath,
    });

    // Proves the assertion below is not vacuous: the credential must exist to be removed.
    expect(await readFile(home.credentialPath, "utf8")).toBe(SYNTHETIC_CREDENTIAL);
    await home.dispose();

    await expect(readFile(join(home.path, "auth.json"), "utf8")).rejects.toThrow();
    expect(await readdir(parentDirectory)).toEqual(["source-auth.json"]);
  });
});
