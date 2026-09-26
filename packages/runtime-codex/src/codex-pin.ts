import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * The one place CuckCode learns which Codex it runs.
 *
 * The pin is the exact version of `@openai/codex` declared in this package's manifest, and the
 * lockfile's integrity hash is the provenance of the binary. Everything that needs a Codex version
 * — the handshake check, every binding expectation, the protocol bundle, the drift preflight —
 * derives from `CODEX_PIN`. A second copy anywhere is how the 0.146.0 pin outlived the binary it
 * described (DF-021); `scripts/codex-pin.test.mjs` refuses one.
 */
export const CODEX_PACKAGE = "@openai/codex";

const EXACT_VERSION = /^\d+\.\d+\.\d+$/u;

export function readCodexPin(manifestText: string): string {
  const manifest = JSON.parse(manifestText) as { devDependencies?: Record<string, unknown> };
  const declared = manifest.devDependencies?.[CODEX_PACKAGE];
  if (declared === undefined) throw new Error("CODEX_PIN_MISSING");
  if (typeof declared !== "string" || !EXACT_VERSION.test(declared)) {
    throw new Error(`CODEX_PIN_NOT_EXACT: ${String(declared)}`);
  }
  return declared;
}

const MANIFEST_PATH = join(import.meta.dirname, "..", "package.json");

export const CODEX_PIN: string = readCodexPin(readFileSync(MANIFEST_PATH, "utf8"));

export type CodexTarget = { triple: string; platformPackage: string };

// The same table the package's own launcher (`@openai/codex/bin/codex.js`) uses, so the binary
// resolved here is the one `npx codex` would run.
const TARGETS: Readonly<Record<string, CodexTarget>> = {
  "linux-x64": { triple: "x86_64-unknown-linux-musl", platformPackage: "@openai/codex-linux-x64" },
  "linux-arm64": {
    triple: "aarch64-unknown-linux-musl",
    platformPackage: "@openai/codex-linux-arm64",
  },
  "darwin-x64": { triple: "x86_64-apple-darwin", platformPackage: "@openai/codex-darwin-x64" },
  "darwin-arm64": { triple: "aarch64-apple-darwin", platformPackage: "@openai/codex-darwin-arm64" },
  "win32-x64": { triple: "x86_64-pc-windows-msvc", platformPackage: "@openai/codex-win32-x64" },
  "win32-arm64": {
    triple: "aarch64-pc-windows-msvc",
    platformPackage: "@openai/codex-win32-arm64",
  },
};

export function codexTargetFor(platform: string, arch: string): CodexTarget {
  const target = TARGETS[`${platform}-${arch}`];
  if (!target) throw new Error(`CODEX_PLATFORM_UNSUPPORTED: ${platform}-${arch}`);
  return target;
}

type CodexLayout = { layoutVersion?: unknown; version?: unknown; entrypoint?: unknown };

/**
 * The executable the harness spawns.
 *
 * `CUCKCODE_CODEX_EXE` overrides the path but not the pin: the drift preflight checks whatever
 * this returns. Otherwise the binary comes from the installed platform package, and the package's
 * own layout file names the entrypoint and the version it carries. There is deliberately no
 * fallback to any other installation — the desktop app's copy is what drifted.
 */
export function resolveCodexExecutable(input: {
  env: Record<string, string | undefined>;
  platform: string;
  arch: string;
  pin: string;
  locatePackageDir: (packageName: string) => string;
  readText: (path: string) => string;
}): string {
  const override = input.env.CUCKCODE_CODEX_EXE;
  if (override !== undefined && override.length > 0) return override;

  const target = codexTargetFor(input.platform, input.arch);
  let layout: CodexLayout;
  let vendorDir: string;
  try {
    vendorDir = join(input.locatePackageDir(target.platformPackage), "vendor", target.triple);
    layout = JSON.parse(input.readText(join(vendorDir, "codex-package.json"))) as CodexLayout;
  } catch (cause) {
    throw new Error(`CODEX_EXECUTABLE_UNRESOLVED: ${target.platformPackage}`, { cause });
  }
  if (layout.layoutVersion !== 1 || typeof layout.entrypoint !== "string") {
    throw new Error(
      `CODEX_EXECUTABLE_UNRESOLVED: unrecognised layout in ${target.platformPackage}`,
    );
  }
  if (layout.version !== input.pin) {
    throw new Error(
      `CODEX_PACKAGE_VERSION_MISMATCH: installed ${String(layout.version)}, pinned ${input.pin}`,
    );
  }
  return join(vendorDir, layout.entrypoint);
}

const requireFromHere = createRequire(import.meta.url);

/** `resolveCodexExecutable` against this process and the installed dependency tree. */
export function resolveInstalledCodexExecutable(
  env: Record<string, string | undefined> = process.env,
): string {
  return resolveCodexExecutable({
    env,
    platform: process.platform,
    arch: process.arch,
    pin: CODEX_PIN,
    locatePackageDir: (name) => dirname(requireFromHere.resolve(`${name}/package.json`)),
    readText: (path) => readFileSync(path, "utf8"),
  });
}
