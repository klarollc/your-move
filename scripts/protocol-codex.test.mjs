import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildProtocolManifest, checkProtocolBundle } from "./check-codex-protocol.mjs";

async function fixture(version = "0.146.0") {
  const root = await mkdtemp(join(tmpdir(), "cuckcode-protocol-"));
  const schemas = join(root, "schemas");
  await mkdir(schemas);
  await writeFile(join(schemas, "ClientRequest.json"), '{"title":"ClientRequest"}\n', "utf8");
  const manifest = await buildProtocolManifest({
    schemaRoot: schemas,
    version,
    executable: "C:/Codex/codex.exe",
  });
  await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return root;
}

test("accepts an unchanged stable exact-version protocol bundle", async () => {
  const root = await fixture();
  const result = await checkProtocolBundle({ bundleRoot: root, expectedVersion: "0.146.0" });
  assert.deepEqual(result, { ok: true, fileCount: 1, version: "0.146.0" });
});

test("rejects a wrong protocol version", async () => {
  const root = await fixture("0.145.0");
  const result = await checkProtocolBundle({ bundleRoot: root, expectedVersion: "0.146.0" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "CODEX_VERSION_MISMATCH");
});

test("rejects an edited or missing generated schema", async () => {
  const editedRoot = await fixture();
  await writeFile(join(editedRoot, "schemas", "ClientRequest.json"), "{}\n", "utf8");
  assert.equal(
    (await checkProtocolBundle({ bundleRoot: editedRoot, expectedVersion: "0.146.0" })).code,
    "SCHEMA_DRIFT",
  );

  const missingRoot = await fixture();
  await writeFile(join(missingRoot, "schemas", "Unexpected.json"), "{}\n", "utf8");
  assert.equal(
    (await checkProtocolBundle({ bundleRoot: missingRoot, expectedVersion: "0.146.0" })).code,
    "SCHEMA_DRIFT",
  );
});

test("rejects a bundle manifest marked as experimentally generated", async () => {
  const root = await fixture();
  const manifestPath = join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.experimental = true;
  manifest.command += " --experimental";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const result = await checkProtocolBundle({ bundleRoot: root, expectedVersion: "0.146.0" });
  assert.equal(result.code, "EXPERIMENTAL_PROTOCOL_FORBIDDEN");
});
