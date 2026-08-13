import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { buildProtocolManifest, checkProtocolBundle } from "./check-codex-protocol.mjs";

const version = "0.146.0";
const executable = resolve(
  process.env.LOCALAPPDATA ?? "C:/Users/nater/AppData/Local",
  "Programs/OpenAI/Codex/bin/codex.exe",
);
const target = resolve("packages/runtime-codex/protocol", version);
const parent = dirname(target);

const versionResult = spawnSync(executable, ["--version"], { encoding: "utf8", shell: false });
if (versionResult.status !== 0 || versionResult.stdout.trim() !== `codex-cli ${version}`)
  throw new Error(`CODEX_VERSION_MISMATCH: ${versionResult.stdout || versionResult.stderr}`);

await mkdir(parent, { recursive: true });
const temporary = await mkdtemp(join(parent, ".generate-"));
const schemas = join(temporary, "schemas");
try {
  const generated = spawnSync(
    executable,
    ["app-server", "generate-json-schema", "--out", schemas],
    { encoding: "utf8", shell: false },
  );
  if (generated.status !== 0) throw new Error(generated.stderr || "schema generation failed");
  const manifest = await buildProtocolManifest({ schemaRoot: schemas, version, executable });
  await writeFile(
    join(temporary, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  let exists = true;
  try {
    await access(target);
  } catch {
    exists = false;
  }
  if (!exists) {
    await rename(temporary, target);
    console.log(
      JSON.stringify({
        created: true,
        fileCount: manifest.fileCount,
        bundleHash: manifest.bundleHash,
      }),
    );
  } else {
    const current = await checkProtocolBundle({ bundleRoot: target, expectedVersion: version });
    const committed = JSON.parse(await readFile(join(target, "manifest.json"), "utf8"));
    if (!current.ok || committed.bundleHash !== manifest.bundleHash)
      throw new Error("SCHEMA_DRIFT: generated protocol differs from committed bundle");
    console.log(
      JSON.stringify({
        created: false,
        fileCount: manifest.fileCount,
        bundleHash: manifest.bundleHash,
      }),
    );
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
