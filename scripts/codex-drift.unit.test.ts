import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { checkCodexDrift, type DriftDependencies, type SpawnResult } from "./codex-drift.js";

const HASH = "a".repeat(64);

function deps(overrides: Partial<DriftDependencies> & { version?: string; hash?: string } = {}) {
  const calls: Array<readonly string[]> = [];
  const removed: string[] = [];
  const base: DriftDependencies = {
    pin: "0.157.1",
    resolveExecutable: () => "/repo/node_modules/@openai/codex-linux-x64/vendor/t/bin/codex",
    spawn: (_executable, args): SpawnResult => {
      calls.push(args);
      if (args[0] === "--version")
        return { status: 0, stdout: `codex-cli ${overrides.version ?? "0.157.1"}\n`, stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    },
    makeTempDir: async () => "/tmp/drift-1",
    removeDir: async (path) => {
      removed.push(path);
    },
    hashSchemas: async () => overrides.hash ?? HASH,
    readCommittedHash: async () => HASH,
  };
  return { deps: { ...base, ...overrides }, calls, removed };
}

describe("the Codex drift preflight", () => {
  it("passes when the binary and its schema both match the pin", async () => {
    const { deps: input, removed } = deps();
    const result = await checkCodexDrift(input);
    expect(result).toEqual({
      ok: true,
      pin: "0.157.1",
      executable: "/repo/node_modules/@openai/codex-linux-x64/vendor/t/bin/codex",
      bundleHash: HASH,
    });
    expect(removed).toEqual(["/tmp/drift-1"]);
  });

  it("refuses a binary that reports another version, naming both", async () => {
    const result = await checkCodexDrift(deps({ version: "0.156.1" }).deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        code: "CODEX_BINARY_VERSION_DRIFT",
        observed: "codex-cli 0.156.1",
        expected: "codex-cli 0.157.1",
      }),
    );
  });

  it("refuses a schema that differs from the committed bundle, naming both hashes", async () => {
    const result = await checkCodexDrift(deps({ hash: "b".repeat(64) }).deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures).toEqual([
      expect.objectContaining({
        code: "CODEX_SCHEMA_DRIFT",
        observed: "b".repeat(64),
        expected: HASH,
      }),
    ]);
  });

  it("refuses when the pinned version has no committed bundle", async () => {
    const result = await checkCodexDrift(deps({ readCommittedHash: async () => null }).deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((failure) => failure.code)).toEqual(["PINNED_BUNDLE_MISSING"]);
  });

  it("refuses an unresolvable executable without spawning anything", async () => {
    const { deps: input, calls } = deps({
      resolveExecutable: () => {
        throw new Error("CODEX_EXECUTABLE_UNRESOLVED: @openai/codex-linux-x64");
      },
    });
    const result = await checkCodexDrift(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures).toEqual([
      expect.objectContaining({
        code: "CODEX_EXECUTABLE_UNRESOLVED",
        detail: "CODEX_EXECUTABLE_UNRESOLVED: @openai/codex-linux-x64",
      }),
    ]);
    expect(calls).toEqual([]);
  });

  it("runs only the two local subcommands, so it can make no provider call", async () => {
    const { deps: input, calls } = deps();
    await checkCodexDrift(input);
    expect(calls).toEqual([
      ["--version"],
      ["app-server", "generate-json-schema", "--out", "/tmp/drift-1/schemas"],
    ]);
  });

  it("removes its temporary schema directory even when generation fails", async () => {
    const { deps: input, removed } = deps({
      spawn: (_executable, args) =>
        args[0] === "--version"
          ? { status: 0, stdout: "codex-cli 0.157.1\n", stderr: "" }
          : { status: 1, stdout: "", stderr: "boom" },
    });
    const result = await checkCodexDrift(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((failure) => failure.code)).toEqual(["CODEX_SCHEMA_UNGENERATED"]);
    expect(removed).toEqual(["/tmp/drift-1"]);
  });
});

describe("where the drift preflight runs", () => {
  const scripts = resolve(import.meta.dirname);
  const source = (name: string) => readFileSync(join(scripts, name), "utf8");

  it("runs in the shared session opener before any supervisor is constructed", () => {
    const text = source("phase4-kickoff-session.ts");
    const check = text.indexOf("await assertNoCodexDrift()");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(text.indexOf("new CodexStdioSupervisor("));
  });

  it("runs in every live script that constructs its own supervisor, before it does", () => {
    const direct = readdirSync(scripts).filter(
      (name) => /^run-.*\.ts$/u.test(name) && source(name).includes("new CodexStdioSupervisor("),
    );
    expect(direct.sort()).toEqual([
      "run-codex-probe-surface.ts",
      "run-phase6-review.ts",
      "run-role-exercises.ts",
      "run-tracer-attempt.ts",
    ]);
    for (const name of direct) {
      const text = source(name);
      const check = text.indexOf("await assertNoCodexDrift()");
      expect(check, name).toBeGreaterThan(-1);
      expect(check, name).toBeLessThan(text.indexOf("new CodexStdioSupervisor("));
    }
  });

  it("every other live Codex script opens its sessions through the shared opener", () => {
    const viaOpener = readdirSync(scripts).filter(
      (name) => /^run-.*\.ts$/u.test(name) && source(name).includes("openKickoffSession("),
    );
    expect(viaOpener.sort()).toEqual([
      "run-codex-smoke.ts",
      "run-phase4-kickoff.ts",
      "run-phase5-release-review.ts",
      "run-phase5-surface-contract.ts",
      "run-phase5-verification.ts",
      "run-phase5-visual-qa.ts",
    ]);
  });
});
