import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { CODEX_PIN, resolveInstalledCodexExecutable } from "@cuckcode/runtime-codex";

import { buildProtocolManifest } from "./check-codex-protocol.mjs";

/**
 * R3: the drift preflight. No provider call, no turn spent.
 *
 * DF-021 was a pin the project owned on paper and a vendor owned in practice: the binary changed
 * underneath a green `protocol:codex:check`, because that check reads the committed bundle, not the
 * program the harness spawns. This asks the program. It runs exactly two local subcommands —
 * `--version`, and `app-server generate-json-schema` into a temporary directory — and compares
 * them with the pin and the committed bundle for the pin.
 */
export type DriftFailure = { code: string; detail: string; observed?: string; expected?: string };
export type DriftResult =
  | { ok: true; pin: string; executable: string; bundleHash: string }
  | { ok: false; pin: string; failures: DriftFailure[] };
export type SpawnResult = { status: number | null; stdout: string; stderr: string };
export type DriftDependencies = {
  pin: string;
  resolveExecutable: () => string;
  spawn: (executable: string, args: readonly string[]) => SpawnResult;
  makeTempDir: () => Promise<string>;
  removeDir: (path: string) => Promise<void>;
  hashSchemas: (schemaRoot: string) => Promise<string>;
  readCommittedHash: (pin: string) => Promise<string | null>;
};

export async function checkCodexDrift(deps: DriftDependencies): Promise<DriftResult> {
  const { pin } = deps;
  let executable: string;
  try {
    executable = deps.resolveExecutable();
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return {
      ok: false,
      pin,
      failures: [{ code: "CODEX_EXECUTABLE_UNRESOLVED", detail }],
    };
  }

  const failures: DriftFailure[] = [];
  const expectedVersion = `codex-cli ${pin}`;
  const reported = deps.spawn(executable, ["--version"]);
  const observedVersion = reported.stdout.trim();
  if (reported.status !== 0 || observedVersion !== expectedVersion) {
    failures.push({
      code: "CODEX_BINARY_VERSION_DRIFT",
      detail: `${executable} reports "${observedVersion || reported.stderr.trim()}", pin is ${pin}`,
      observed: observedVersion,
      expected: expectedVersion,
    });
  }

  const committed = await deps.readCommittedHash(pin);
  if (committed === null) {
    failures.push({
      code: "PINNED_BUNDLE_MISSING",
      detail: `no committed schema bundle for ${pin}; run protocol:codex:upgrade -- ${pin}`,
    });
  }

  const temporary = await deps.makeTempDir();
  let generatedHash = "";
  try {
    const schemas = join(temporary, "schemas").split("\\").join("/");
    const generated = deps.spawn(executable, [
      "app-server",
      "generate-json-schema",
      "--out",
      schemas,
    ]);
    if (generated.status !== 0) {
      failures.push({
        code: "CODEX_SCHEMA_UNGENERATED",
        detail: generated.stderr.trim() || "schema generation failed",
      });
    } else {
      generatedHash = await deps.hashSchemas(schemas);
      if (committed !== null && generatedHash !== committed) {
        failures.push({
          code: "CODEX_SCHEMA_DRIFT",
          detail: `the installed binary's app-server schema differs from protocol/${pin}`,
          observed: generatedHash,
          expected: committed,
        });
      }
    }
  } finally {
    await deps.removeDir(temporary);
  }

  return failures.length === 0
    ? { ok: true, pin, executable, bundleHash: generatedHash }
    : { ok: false, pin, failures };
}

const PROTOCOL_ROOT = resolve("packages/runtime-codex/protocol");

/** The check against this machine's installed dependency tree. */
export function installedDriftDependencies(): DriftDependencies {
  return {
    pin: CODEX_PIN,
    resolveExecutable: () => resolveInstalledCodexExecutable(),
    spawn: (executable, args) => {
      const result = spawnSync(executable, [...args], { encoding: "utf8", shell: false });
      return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    },
    makeTempDir: async () => await mkdtemp(join(tmpdir(), "cuckcode-codex-drift-")),
    removeDir: async (path) => await rm(path, { recursive: true, force: true }),
    hashSchemas: async (schemaRoot) =>
      (await buildProtocolManifest({ schemaRoot, version: CODEX_PIN, executable: "drift" }))
        .bundleHash,
    readCommittedHash: async (pin) => {
      try {
        const manifest = JSON.parse(
          await readFile(join(PROTOCOL_ROOT, pin, "manifest.json"), "utf8"),
        ) as { bundleHash?: unknown };
        return typeof manifest.bundleHash === "string" ? manifest.bundleHash : null;
      } catch {
        return null;
      }
    },
  };
}

let once: Promise<DriftResult> | undefined;

/**
 * For live scripts: run the check once per process and throw on drift, before any session opens.
 * A kickoff opens six sessions; the binary cannot change between them in a way this would catch.
 */
export async function assertNoCodexDrift(): Promise<void> {
  once ??= checkCodexDrift(installedDriftDependencies());
  const result = await once;
  if (!result.ok) {
    throw new Error(
      `CODEX_DRIFT: ${result.failures.map((failure) => `${failure.code} — ${failure.detail}`).join("; ")}`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/gu, "/").split("/").pop() ?? "")
) {
  const result = await checkCodexDrift(installedDriftDependencies());
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}
