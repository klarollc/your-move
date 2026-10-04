/**
 * run-sandbox-probe.ts — DRAFT (2026-10-04), owner-approved probe plan.
 *
 * Purpose: answer one question with the cheapest instrument that can answer it. The tracer's
 * attempt 2 asked for a `workspace-write` sandbox and the runtime reported `readOnly`
 * (TRACER_POSTURE_REFUSED, 0 turns). Two candidate causes, neither verified:
 *   (a) the feature policy disables the Windows sandbox features on every thread/start;
 *   (b) the controlled CODEX_HOME sits under the temp directory, where the runtime refuses to
 *       create the helper binaries ("Refusing to create helper binaries under temporary dir").
 *
 * What it does: for each variant, start a fresh app-server with its own controlled home, send ONE
 * `thread/start` built by the shared `exerciseThreadStartParams` with `sandbox: "workspace-write"`,
 * record the posture the runtime reports back, and stop. No turn is started, so no model is
 * called, no role is exercised and the tracer allowance is not touched. The scratch workspace is a
 * fresh empty directory with `git init`; it is not the tracer worktree and nothing in the repo
 * is written other than the evidence files named below.
 *
 * Variants. The first three are the original plan; their result (2026-10-04) was: only
 * variant 3 reported `workspaceWrite`. Variants 4-6 narrow that to the least set of features:
 *   1. baseline          — home under the OS temp dir, feature policy as shipped. Reproduces
 *                          attempt 2; if this does NOT report readOnly, the cause is not stable.
 *   2. home-outside-temp — home under --scratch-parent, feature policy as shipped.
 *   3. all-three-windows-sandbox-features-on — as 2, with the three Windows sandbox features true.
 *   7. three-keys-omitted — as 2, with the three keys not sent at all (neither false nor true).
 *        Separates "the feature must be enabled" from "the explicit false is what breaks it".
 *   8-9. windows-sandbox-unelevated / -elevated — as 2, with the DOCUMENTED config key
 *        `windows.sandbox` set, and the shipped feature policy untouched. The two flags that
 *        flipped variants 3-5 are `removed` in the pinned features list, so this tests the
 *        supported mechanism instead of a legacy alias.
 *   4-6. one feature alone set to true (as 2 otherwise), for each of the three. The minimal
 *        set is the one that flips the posture with the fewest features on.
 *
 * Deliberately NOT done: the `windowsSandbox/readiness` request. It is not in
 * `ALLOWED_REQUEST_METHODS`, and widening the runtime's request surface is a separate ruling.
 * `windowsSandbox/setupStart` is never called: this script changes nothing on the host.
 *
 * Writes docs/evidence/tracer/sandbox-probe-<stamp>.json (hashed) and one session log per
 * variant under docs/evidence/runtime/sessions/run-sandbox-probe/. Owner-run, opt-in.
 *
 * Usage:
 *   $env:CUCKCODE_LIVE_SANDBOX_PROBE = "1"
 *   npx.cmd tsx scripts/run-sandbox-probe.ts --scratch-parent="C:\Users\nater\codex-probe-scratch"
 *   Remove-Item Env:CUCKCODE_LIVE_SANDBOX_PROBE
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  CODEX_PIN,
  CodexStdioSupervisor,
  FEATURE_POLICY,
  createControlledCodexHome,
  exerciseThreadStartParams,
  openSessionLog,
  resolveInstalledCodexExecutable,
  type BindingExpectation,
} from "@cuckcode/runtime-codex";

import { assertNoCodexDrift } from "./codex-drift.js";
import { describeInstructionSources } from "./tracer-guards.js";

const execFileAsync = promisify(execFile);

const ROOT = resolve(process.cwd());
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/tracer");
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const SCRIPT_NAME = "run-sandbox-probe";
const EXECUTABLE = resolveInstalledCodexExecutable();
const PROBE_ROLE_ID = "sandbox-probe";

const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

const WINDOWS_SANDBOX_FEATURES = [
  "elevated_windows_sandbox",
  "experimental_windows_sandbox",
  "windows_sandbox_service",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function arg(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) throw new Error(`PROBE_ARG_REQUIRED:${name}`);
  return hit.slice(name.length + 1);
}

type Variant = Readonly<{
  name: string;
  homeUnderTemp: boolean;
  /** Features set to `true` for this variant; everything else is the shipped policy. */
  featuresOn: readonly string[];
  /** Keys removed from the sent feature config; the runtime applies its own default. */
  featuresOmitted: readonly string[];
  /** The documented `windows.sandbox` config key; null leaves it unset. */
  windowsSandboxMode: "elevated" | "unelevated" | null;
}>;

const variant = (name: string, over: Partial<Variant> = {}): Variant => ({
  name,
  homeUnderTemp: false,
  featuresOn: [],
  featuresOmitted: [],
  windowsSandboxMode: null,
  ...over,
});

const VARIANTS: readonly Variant[] = [
  variant("baseline", { homeUnderTemp: true }),
  variant("home-outside-temp"),
  variant("all-three-windows-sandbox-features-on", { featuresOn: WINDOWS_SANDBOX_FEATURES }),
  ...WINDOWS_SANDBOX_FEATURES.map((feature) =>
    variant(`only-${feature}`, { featuresOn: [feature] }),
  ),
  variant("three-keys-omitted", { featuresOmitted: WINDOWS_SANDBOX_FEATURES }),
  variant("windows-sandbox-unelevated", { windowsSandboxMode: "unelevated" }),
  variant("windows-sandbox-elevated", { windowsSandboxMode: "elevated" }),
];

type VariantResult = {
  variant: string;
  homeUnderTemp: boolean;
  featuresOn: readonly string[];
  featuresOmitted: readonly string[];
  windowsSandboxMode: string | null;
  requestedSandbox: "workspace-write";
  observedSandbox: unknown;
  observedApprovalPolicy: unknown;
  instructionSources: string;
  workspaceWriteHonoured: boolean | null;
  error: string | null;
};

const expected: BindingExpectation = {
  requestedModel: "gpt-5.6-luna",
  expectedReasoningEffort: "medium",
  expectedAuthMode: "chatgpt",
  protocolVersion: CODEX_PIN,
  promotedContentSha256: "sandbox-probe-no-role",
};

if (process.env.CUCKCODE_LIVE_SANDBOX_PROBE !== "1") {
  throw new Error("LIVE_SANDBOX_PROBE_EXPLICIT_OPT_IN_REQUIRED");
}
// R1.2: refuse before any session opens if the installed Codex is not the pinned one.
await assertNoCodexDrift();

const scratchParent = resolve(arg("--scratch-parent"));
const tempRoot = resolve(tmpdir());
const isWithin = (root: string, candidate: string): boolean => {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
if (isWithin(tempRoot, scratchParent)) throw new Error("PROBE_SCRATCH_PARENT_MUST_BE_OUTSIDE_TEMP");
if (isWithin(ROOT, scratchParent)) {
  throw new Error("PROBE_SCRATCH_PARENT_MUST_BE_OUTSIDE_THE_REPOSITORY");
}
await mkdir(scratchParent, { recursive: true });
await mkdir(EVIDENCE_ROOT, { recursive: true });

// One scratch workspace shared by every variant, so only the stated variable changes.
const scratch = await mkdtemp(join(scratchParent, "probe-workspace-"));
await execFileAsync("git", ["init", "-q", scratch]);

async function runVariant(variant: Variant): Promise<VariantResult> {
  const result: VariantResult = {
    variant: variant.name,
    homeUnderTemp: variant.homeUnderTemp,
    featuresOn: variant.featuresOn,
    featuresOmitted: variant.featuresOmitted,
    windowsSandboxMode: variant.windowsSandboxMode,
    requestedSandbox: "workspace-write",
    observedSandbox: null,
    observedApprovalPolicy: null,
    instructionSources: "not observed",
    workspaceWriteHonoured: null,
    error: null,
  };
  const home = await createControlledCodexHome({
    parentDirectory: variant.homeUnderTemp ? tempRoot : scratchParent,
    instruction: "Sandbox probe. There is no task; do nothing.",
    credentialSourcePath: CREDENTIAL_SOURCE,
  });
  const supervisor = new CodexStdioSupervisor({ executable: EXECUTABLE, codexHome: home.path });
  const sessionLog = openSessionLog(supervisor, {
    root: SESSIONS_ROOT,
    script: SCRIPT_NAME,
    roleId: PROBE_ROLE_ID,
    pin: CODEX_PIN,
  });
  try {
    await supervisor.start();
    const auth = await supervisor.readAccountStatus();
    if (!auth.ok) {
      result.error = "TRACER_AUTH_REQUIRED";
      return result;
    }
    const params = exerciseThreadStartParams(
      scratch,
      expected,
      "Sandbox probe. There is no task; do nothing.",
      { sandbox: "workspace-write" },
    );
    if (variant.featuresOn.length > 0 || variant.featuresOmitted.length > 0) {
      const config = params.config;
      if (!isRecord(config) || !isRecord(config.features)) {
        throw new Error("PROBE_FEATURE_CONFIG_SHAPE_UNEXPECTED");
      }
      for (const name of variant.featuresOn) {
        if (!(name in FEATURE_POLICY)) throw new Error(`PROBE_UNKNOWN_FEATURE:${name}`);
        config.features[name] = true;
      }
      for (const name of variant.featuresOmitted) {
        if (!(name in FEATURE_POLICY)) throw new Error(`PROBE_UNKNOWN_FEATURE:${name}`);
        if (!(name in config.features)) throw new Error(`PROBE_FEATURE_NOT_PRESENT:${name}`);
        delete config.features[name];
      }
    }
    if (variant.windowsSandboxMode !== null) {
      const config = params.config;
      if (!isRecord(config)) throw new Error("PROBE_CONFIG_SHAPE_UNEXPECTED");
      if ("windows" in config) throw new Error("PROBE_WINDOWS_CONFIG_ALREADY_PRESENT");
      config.windows = { sandbox: variant.windowsSandboxMode };
    }
    const threadStart = await supervisor.request("thread/start", params, 30_000);
    const start = isRecord(threadStart) ? threadStart : {};
    result.observedSandbox = start.sandbox ?? null;
    result.observedApprovalPolicy = start.approvalPolicy ?? null;
    result.instructionSources = describeInstructionSources(threadStart);
    result.workspaceWriteHonoured = isRecord(start.sandbox)
      ? start.sandbox.type === "workspaceWrite"
      : null;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    // Order matters: the process must stop before its CODEX_HOME is deleted.
    await supervisor.stop().catch(() => {});
    await sessionLog.close();
    await home.dispose();
  }
  return result;
}

const observedAt = new Date().toISOString();
const results: VariantResult[] = [];
try {
  for (const variant of VARIANTS) results.push(await runVariant(variant));
} finally {
  await rm(scratch, { recursive: true, force: true });
}

const report = `${JSON.stringify(
  {
    schema: "cuckcode.sandbox-probe.v1",
    observedAt,
    codexPin: CODEX_PIN,
    turnsStarted: 0,
    tracerAllowanceTouched: false,
    notDone: ["windowsSandbox/readiness (not in ALLOWED_REQUEST_METHODS)"],
    results,
  },
  null,
  2,
)}\n`;
const stamp = observedAt.replace(/[:.]/gu, "-");
const reportPath = join(EVIDENCE_ROOT, `sandbox-probe-${stamp}.json`);
await writeFile(reportPath, report, "utf8");
process.stdout.write(
  `${JSON.stringify({
    reportPath: reportPath.slice(ROOT.length + 1).replaceAll("\\", "/"),
    reportSha256: createHash("sha256").update(report).digest("hex"),
    results: results.map((r) => ({
      variant: r.variant,
      observedSandbox: r.observedSandbox,
      workspaceWriteHonoured: r.workspaceWriteHonoured,
      error: r.error,
    })),
  })}\n`,
);
