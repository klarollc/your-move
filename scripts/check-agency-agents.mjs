import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const AGENCY_COMMIT = "ebe9c99acb5c96f9468de368d8bead775387d1a7";
export const AGENCY_ROLES = [
  { roleId: "delivery-lead", sourcePath: "project-management/project-manager-senior.md" },
  { roleId: "product-designer", sourcePath: "design/design-ui-designer.md" },
  { roleId: "implementation-engineer", sourcePath: "engineering/engineering-senior-developer.md" },
  { roleId: "test-engineer", sourcePath: "testing/testing-test-automation-engineer.md" },
  { roleId: "visual-qa-reviewer", sourcePath: "testing/testing-evidence-collector.md" },
  { roleId: "release-reviewer", sourcePath: "testing/testing-reality-checker.md" },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export async function buildAgencyManifest({ root }) {
  const upstream = resolve(root, "upstream", "agency-agents", AGENCY_COMMIT);
  const roles = [];
  for (const role of AGENCY_ROLES) {
    const source = await readFile(resolveInside(upstream, role.sourcePath));
    const overlayPath = resolve(root, "overlays", `${role.roleId}.json`);
    const overlay = await readFile(overlayPath);
    roles.push({
      roleId: role.roleId,
      sourcePath: role.sourcePath,
      sourceSha256: sha256(source),
      overlayPath: `overlays/${role.roleId}.json`,
      overlaySha256: sha256(overlay),
      originalRoleId: role.sourcePath.replace(/\.md$/u, ""),
      status: "candidate",
      executable: false,
    });
  }
  return {
    schema: "cuckcode.agency-agents-import.v1",
    upstreamRepository: "https://github.com/msitarzewski/agency-agents",
    commit: AGENCY_COMMIT,
    license: "MIT",
    licensePath: "LICENSE",
    licenseSha256: sha256(await readFile(resolve(upstream, "LICENSE"))),
    registryPath: "divisions.json",
    registrySha256: sha256(await readFile(resolve(upstream, "divisions.json"))),
    importedAt: "2026-08-13T00:00:00.000Z",
    roles,
  };
}

export async function checkAgencyImport({ root }) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  } catch {
    return failure("MANIFEST_INVALID");
  }
  if (
    manifest.schema !== "cuckcode.agency-agents-import.v1" ||
    manifest.upstreamRepository !== "https://github.com/msitarzewski/agency-agents" ||
    manifest.commit !== AGENCY_COMMIT ||
    manifest.license !== "MIT" ||
    !Array.isArray(manifest.roles) ||
    manifest.roles.length !== AGENCY_ROLES.length
  )
    return failure("PROVENANCE_INVALID");
  const upstream = resolve(root, "upstream", "agency-agents", AGENCY_COMMIT);
  let license;
  let registry;
  try {
    license = await readFile(resolve(upstream, "LICENSE"), "utf8");
    registry = JSON.parse(await readFile(resolve(upstream, "divisions.json"), "utf8"));
  } catch {
    return failure("PROVENANCE_INVALID");
  }
  if (!license.startsWith("MIT License") || !registry.divisions)
    return failure("LICENSE_OR_REGISTRY_INVALID");
  let actual;
  try {
    actual = await buildAgencyManifest({ root });
  } catch {
    return failure("SOURCE_MISSING");
  }
  if (
    actual.licenseSha256 !== manifest.licenseSha256 ||
    actual.registrySha256 !== manifest.registrySha256
  )
    return failure("SOURCE_HASH_MISMATCH");
  for (let index = 0; index < AGENCY_ROLES.length; index += 1) {
    const expected = AGENCY_ROLES[index];
    const recorded = manifest.roles[index];
    const computed = actual.roles[index];
    if (
      !recorded ||
      recorded.roleId !== expected.roleId ||
      recorded.sourcePath !== expected.sourcePath ||
      recorded.overlayPath !== `overlays/${expected.roleId}.json` ||
      recorded.originalRoleId !== expected.sourcePath.replace(/\.md$/u, "")
    )
      return failure("ALLOWLIST_MISMATCH");
    if (
      recorded.sourceSha256 !== computed.sourceSha256 ||
      recorded.overlaySha256 !== computed.overlaySha256
    )
      return failure("SOURCE_HASH_MISMATCH");
    const source = await readFile(resolveInside(upstream, expected.sourcePath), "utf8");
    if (!source.startsWith("---\n") || !/^#\s+/mu.test(source)) return failure("STRUCTURE_INVALID");
    if (hasForbiddenControl(source)) return failure("HIDDEN_INSTRUCTION");
    const hiddenSegments = source.match(/<!--[\s\S]*?-->/gu) ?? [];
    const quarantined = recorded.quarantinedSegments ?? [];
    if (
      hiddenSegments.length !== quarantined.length ||
      hiddenSegments.some(
        (segment, hiddenIndex) =>
          quarantined[hiddenIndex]?.sha256 !== sha256(segment) ||
          quarantined[hiddenIndex]?.treatment !== "excluded_from_normalized_role",
      )
    )
      return failure("HIDDEN_INSTRUCTION");
    const overlay = JSON.parse(
      await readFile(resolve(root, "overlays", `${expected.roleId}.json`), "utf8"),
    );
    if (
      overlay.roleId !== expected.roleId ||
      overlay.sourcePath !== expected.sourcePath ||
      overlay.status !== "candidate" ||
      overlay.executable !== false ||
      !nonEmptyStrings(overlay.responsibilities) ||
      !nonEmptyStrings(overlay.skills) ||
      !nonEmptyStrings(overlay.deliverables) ||
      !nonEmptyStrings(overlay.disclosures)
    )
      return failure("CANDIDATE_ONLY_REQUIRED");
    if (
      hiddenSegments.length > 0 &&
      !overlay.disclosures.some((value) => /quarantin/iu.test(value))
    )
      return failure("HIDDEN_INSTRUCTION");
  }
  return { ok: true, commit: AGENCY_COMMIT, roleCount: 6, status: "candidate" };
}

function resolveInside(root, path) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel.startsWith("..") || rel === "" || /(^|[\\/])\.\.([\\/]|$)/u.test(path))
    throw new Error("PATH_ESCAPE");
  return absolute;
}

function hasForbiddenControl(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  });
}
function nonEmptyStrings(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

function failure(code) {
  return { ok: false, code };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.argv[2] ?? "roles");
  const result = await checkAgencyImport({ root });
  if (!result.ok) {
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  } else console.log(JSON.stringify(result));
}
