import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalJson(nested)]),
    );
  return value;
}

async function schemaFiles(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) result.push(absolute);
    }
  }
  await visit(root);
  return result.sort((left, right) => left.localeCompare(right));
}

export async function buildProtocolManifest({ schemaRoot, version, executable }) {
  const files = {};
  for (const absolute of await schemaFiles(schemaRoot)) {
    const name = relative(schemaRoot, absolute).split(sep).join("/");
    files[name] = sha256(
      JSON.stringify(canonicalJson(JSON.parse(await readFile(absolute, "utf8")))),
    );
  }
  const bundleHash = sha256(
    Object.entries(files)
      .map(([name, hash]) => `${name}\0${hash}\n`)
      .join(""),
  );
  return {
    schema: "cuckcode.codex-protocol-manifest.v1",
    version,
    executable,
    command: "app-server generate-json-schema --out <schemas>",
    experimental: false,
    fileCount: Object.keys(files).length,
    bundleHash,
    files,
  };
}

export async function checkProtocolBundle({ bundleRoot, expectedVersion }) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(bundleRoot, "manifest.json"), "utf8"));
  } catch {
    return { ok: false, code: "MANIFEST_INVALID" };
  }
  if (manifest.version !== expectedVersion) return { ok: false, code: "CODEX_VERSION_MISMATCH" };
  if (manifest.experimental !== false)
    return { ok: false, code: "EXPERIMENTAL_PROTOCOL_FORBIDDEN" };
  const schemas = resolve(bundleRoot, "schemas");
  let actual;
  try {
    actual = await buildProtocolManifest({
      schemaRoot: schemas,
      version: manifest.version,
      executable: manifest.executable,
    });
  } catch {
    return { ok: false, code: "SCHEMA_DRIFT" };
  }

  if (
    actual.fileCount !== manifest.fileCount ||
    actual.bundleHash !== manifest.bundleHash ||
    JSON.stringify(actual.files) !== JSON.stringify(manifest.files)
  )
    return { ok: false, code: "SCHEMA_DRIFT" };
  return { ok: true, fileCount: actual.fileCount, version: manifest.version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const bundleRoot = resolve(process.argv[2] ?? "packages/runtime-codex/protocol/0.146.0");
  const result = await checkProtocolBundle({ bundleRoot, expectedVersion: "0.146.0" });
  if (!result.ok) {
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  } else console.log(JSON.stringify(result));
}
