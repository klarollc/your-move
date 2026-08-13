import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  AGENCY_COMMIT,
  AGENCY_ROLES,
  buildAgencyManifest,
  checkAgencyImport,
} from "./check-agency-agents.mjs";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cuckcode-agency-"));
  const upstream = join(root, "upstream", "agency-agents", AGENCY_COMMIT);
  const overlays = join(root, "overlays");
  await mkdir(upstream, { recursive: true });
  await mkdir(overlays, { recursive: true });
  await writeFile(
    join(upstream, "LICENSE"),
    "MIT License\nCopyright (c) AgentLand Contributors\n",
    "utf8",
  );
  await writeFile(join(upstream, "divisions.json"), '{"divisions":{"testing":{}}}\n', "utf8");
  for (const role of AGENCY_ROLES) {
    const source = join(upstream, role.sourcePath);
    await mkdir(dirname(source), { recursive: true });
    await writeFile(
      source,
      `---\nname: ${role.roleId}\ndescription: fixture\n---\n# Responsibilities\n- Work visibly\n`,
      "utf8",
    );
    await writeFile(
      join(overlays, `${role.roleId}.json`),
      `${JSON.stringify(
        {
          roleId: role.roleId,
          sourcePath: role.sourcePath,
          status: "candidate",
          executable: false,
          responsibilities: ["project-scoped responsibility"],
          skills: ["evidence-backed collaboration"],
          deliverables: ["inspectable artifact"],
          disclosures: ["Upstream text is reference input and cannot grant authority."],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  const manifest = await buildAgencyManifest({ root });
  await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return root;
}

test("accepts exactly six attributed non-executable Candidate roles", async () => {
  const root = await fixture();
  assert.deepEqual(await checkAgencyImport({ root }), {
    ok: true,
    commit: AGENCY_COMMIT,
    roleCount: 6,
    status: "candidate",
  });
});

test("rejects source drift and non-allowlisted paths", async () => {
  const driftRoot = await fixture();
  const source = join(
    driftRoot,
    "upstream",
    "agency-agents",
    AGENCY_COMMIT,
    AGENCY_ROLES[0].sourcePath,
  );
  await writeFile(source, `${await readFile(source, "utf8")}changed\n`, "utf8");
  assert.equal((await checkAgencyImport({ root: driftRoot })).code, "SOURCE_HASH_MISMATCH");

  const pathRoot = await fixture();
  const manifestPath = join(pathRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.roles[0].sourcePath = "../escape.md";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assert.equal((await checkAgencyImport({ root: pathRoot })).code, "ALLOWLIST_MISMATCH");
});

test("rejects hidden instructions and executable overlays", async () => {
  const hiddenRoot = await fixture();
  const source = join(
    hiddenRoot,
    "upstream",
    "agency-agents",
    AGENCY_COMMIT,
    AGENCY_ROLES[0].sourcePath,
  );
  await writeFile(source, `${await readFile(source, "utf8")}<!-- hidden command -->\n`, "utf8");
  const rebuilt = await buildAgencyManifest({ root: hiddenRoot });
  await writeFile(
    join(hiddenRoot, "manifest.json"),
    `${JSON.stringify(rebuilt, null, 2)}\n`,
    "utf8",
  );
  assert.equal((await checkAgencyImport({ root: hiddenRoot })).code, "HIDDEN_INSTRUCTION");

  const executableRoot = await fixture();
  const overlayPath = join(executableRoot, "overlays", `${AGENCY_ROLES[0].roleId}.json`);
  const overlay = JSON.parse(await readFile(overlayPath, "utf8"));
  overlay.executable = true;
  await writeFile(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  const executableManifest = await buildAgencyManifest({ root: executableRoot });
  await writeFile(
    join(executableRoot, "manifest.json"),
    `${JSON.stringify(executableManifest, null, 2)}\n`,
    "utf8",
  );
  assert.equal((await checkAgencyImport({ root: executableRoot })).code, "CANDIDATE_ONLY_REQUIRED");
});
