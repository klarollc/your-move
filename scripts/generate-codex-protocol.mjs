import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";

import * as prettier from "prettier";

import { resolveCodexExecutable } from "../packages/runtime-codex/src/codex-pin.ts";
import { buildProtocolManifest, checkProtocolBundle } from "./check-codex-protocol.mjs";
import {
  diffSurface,
  extractSurface,
  parseUpgradeArgs,
  renderSurfaceDiff,
  upgradeWritePaths,
} from "./codex-surface-diff.mjs";

/**
 * `npm run protocol:codex:upgrade -- <version> [--from <version>]` (R4).
 *
 * Generates the app-server schema bundle from the installed Codex whose own layout and
 * `--version` both say `<version>`, writes it to `packages/runtime-codex/protocol/<version>/`, and
 * writes `surface-diff.md` against the baseline bundle. It never edits the pin: moving
 * `@openai/codex` in `packages/runtime-codex/package.json` is a separate commit after the owner
 * rules on the diff (R4.3). To evaluate a candidate without moving the pin, install it with
 * `npm.cmd install --no-save @openai/codex@<version>` first; the drift preflight then refuses every
 * live run until the pinned version is reinstalled.
 */
const ROOT = resolve(".");
const PROTOCOL_ROOT = resolve("packages/runtime-codex/protocol");
const { version, from: requestedFrom } = parseUpgradeArgs(process.argv.slice(2));

const requireFromRuntime = createRequire(resolve("packages/runtime-codex/package.json"));
const executable = resolveCodexExecutable({
  env: process.env,
  platform: process.platform,
  arch: process.arch,
  pin: version,
  locatePackageDir: (name) => dirname(requireFromRuntime.resolve(`${name}/package.json`)),
  readText: (path) => readFileSync(path, "utf8"),
});

const reported = spawnSync(executable, ["--version"], { encoding: "utf8", shell: false });
if (reported.status !== 0 || reported.stdout.trim() !== `codex-cli ${version}`) {
  throw new Error(`CODEX_VERSION_MISMATCH: ${reported.stdout || reported.stderr}`);
}

const compareVersions = (left, right) => {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
};
const bundles = (await readdir(PROTOCOL_ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+$/u.test(entry.name))
  .map((entry) => entry.name);
const from =
  requestedFrom ??
  bundles
    .filter((name) => compareVersions(name, version) < 0)
    .sort(compareVersions)
    .at(-1);
if (!from) throw new Error("UPGRADE_BASELINE_MISSING: pass --from <version>");
if (!bundles.includes(from)) throw new Error(`UPGRADE_BASELINE_MISSING: ${from}`);

const target = join(PROTOCOL_ROOT, version);
const [schemasPath, manifestPath, diffPath] = upgradeWritePaths(PROTOCOL_ROOT, version);
// Recorded relative to the repository, so the manifest names the installed package rather than a
// machine's home directory.
const recordedExecutable = relative(ROOT, executable).split(sep).join("/");

const temporary = await mkdtemp(join(PROTOCOL_ROOT, ".generate-"));
let created = false;
let manifest;
try {
  const generated = spawnSync(
    executable,
    ["app-server", "generate-json-schema", "--out", join(temporary, "schemas")],
    { encoding: "utf8", shell: false },
  );
  if (generated.status !== 0) throw new Error(generated.stderr || "schema generation failed");
  manifest = await buildProtocolManifest({
    schemaRoot: join(temporary, "schemas"),
    version,
    executable: recordedExecutable,
  });

  const exists = await access(target).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await mkdir(target);
    await rename(join(temporary, "schemas"), schemasPath);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    created = true;
  } else {
    const current = await checkProtocolBundle({ bundleRoot: target, expectedVersion: version });
    const committed = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!current.ok || committed.bundleHash !== manifest.bundleHash)
      throw new Error("SCHEMA_DRIFT: generated protocol differs from committed bundle");
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

const readFrom = (root) => (name) => JSON.parse(readFileSync(join(root, name), "utf8"));
const diff = diffSurface(
  extractSurface(readFrom(join(PROTOCOL_ROOT, from, "schemas"))),
  extractSurface(readFrom(schemasPath)),
);
const report = await prettier.format(renderSurfaceDiff(diff, { from, to: version }), {
  ...(await prettier.resolveConfig(diffPath)),
  filepath: diffPath,
});
await writeFile(diffPath, report, "utf8");

console.log(
  JSON.stringify({
    created,
    version,
    from,
    fileCount: manifest.fileCount,
    bundleHash: manifest.bundleHash,
    needsRuling: diff.needsRuling.length,
    breaking: diff.breaking.length,
    report: relative(ROOT, diffPath).split(sep).join("/"),
  }),
);
