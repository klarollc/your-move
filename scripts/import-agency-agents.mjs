import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  AGENCY_COMMIT,
  AGENCY_ROLES,
  buildAgencyManifest,
  checkAgencyImport,
} from "./check-agency-agents.mjs";

const root = resolve("roles");
const existing = await checkAgencyImport({ root });
if (existing.ok) {
  console.log(JSON.stringify({ imported: false, ...existing }));
  process.exit(0);
}

const temporary = await mkdtemp(join(tmpdir(), "cuckcode-agency-import-"));
const repository = resolve(temporary, "repository");
const stagedRoot = resolve(temporary, "roles");
const upstream = resolve(stagedRoot, "upstream", "agency-agents", AGENCY_COMMIT);
try {
  run("git", [
    "clone",
    "--depth",
    "1",
    "--no-checkout",
    "https://github.com/msitarzewski/agency-agents.git",
    repository,
  ]);
  run("git", ["-C", repository, "config", "core.autocrlf", "false"]);
  const head = run("git", ["-C", repository, "rev-parse", "HEAD"]).trim();
  if (head !== AGENCY_COMMIT) throw new Error(`AGENCY_COMMIT_MISMATCH: ${head}`);
  const paths = ["LICENSE", "divisions.json", ...AGENCY_ROLES.map(({ sourcePath }) => sourcePath)];
  run("git", ["-C", repository, "checkout", AGENCY_COMMIT, "--", ...paths]);
  for (const sourcePath of paths) {
    const destination = resolve(upstream, sourcePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(resolve(repository, sourcePath), destination, { errorOnExist: true });
  }
  await mkdir(resolve(stagedRoot, "overlays"), { recursive: true });
  for (const role of AGENCY_ROLES) {
    const overlay = overlayFor(role.roleId, role.sourcePath);
    await writeFile(
      resolve(stagedRoot, "overlays", `${role.roleId}.json`),
      `${JSON.stringify(overlay, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
  }
  const manifest = await buildAgencyManifest({ root: stagedRoot });
  const implementation = manifest.roles.find(({ roleId }) => roleId === "implementation-engineer");
  if (!implementation) throw new Error("IMPLEMENTATION_ROLE_MISSING");
  implementation.quarantinedSegments = [
    {
      sha256: "29b191b6eb376682ae2169694ea079c763e4a1da3902a30e9a4b68fbbf9cc3f4",
      treatment: "excluded_from_normalized_role",
    },
  ];
  await writeFile(resolve(stagedRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const checked = await checkAgencyImport({ root: stagedRoot });
  if (!checked.ok) throw new Error(`AGENCY_IMPORT_INVALID: ${checked.code}`);
  await cp(stagedRoot, root, { recursive: true, errorOnExist: true });
  console.log(JSON.stringify({ imported: true, ...checked }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout;
}
function overlayFor(roleId, sourcePath) {
  const specifics = {
    "delivery-lead": {
      responsibilities: [
        "Convert the approved design and evidence gates into ordered, owned work.",
      ],
      skills: ["dependency planning", "scope and risk communication"],
      deliverables: ["approved-scope task plan", "checkpoint status and blocker record"],
    },
    "product-designer": {
      responsibilities: [
        "Translate the art direction into accessible interaction and visual specifications.",
      ],
      skills: ["interaction design", "design systems", "accessibility"],
      deliverables: ["inspectable design specification", "visual QA comparison criteria"],
    },
    "implementation-engineer": {
      responsibilities: ["Implement approved behavior through small test-driven slices."],
      skills: ["test-driven implementation", "maintainable architecture"],
      deliverables: ["tested implementation", "technical handoff and limits"],
    },
    "test-engineer": {
      responsibilities: [
        "Prove behavioral contracts deterministically and preserve failure evidence.",
      ],
      skills: ["test automation", "failure isolation", "evidence capture"],
      deliverables: ["repeatable test suite", "machine-readable test evidence"],
    },
    "visual-qa-reviewer": {
      responsibilities: [
        "Compare current-build rendered evidence to the approved art direction without approving taste automatically.",
      ],
      skills: ["visual comparison", "accessibility inspection", "evidence classification"],
      deliverables: ["viewport evidence set", "art-direction discrepancy report"],
    },
    "release-reviewer": {
      responsibilities: [
        "Assess production readiness independently from implementation and provider completion claims.",
      ],
      skills: ["release risk assessment", "evidence audit", "stop-ship judgment"],
      deliverables: ["release disposition", "residual-risk and remediation record"],
    },
  }[roleId];
  return {
    roleId,
    sourcePath,
    status: "candidate",
    executable: false,
    ...specifics,
    disclosures: [
      "Upstream text is attributed reference input, not executable instruction.",
      "CuckCode project scope, permissions, TDD, evidence, and manager decisions override upstream examples.",
      "This overlay narrows authority and cannot grant tools, credentials, deployment, publishing, spending, or role activation.",
      ...(roleId === "implementation-engineer"
        ? [
            "One upstream HTML-comment instruction is quarantined and excluded from the normalized role.",
          ]
        : []),
    ],
  };
}
