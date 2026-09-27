import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import {
  CODEX_PIN,
  CodexStdioSupervisor,
  createControlledCodexHome,
  openSessionLog,
  parseApprovedRoleExercisePlan,
  resolveInstalledCodexExecutable,
} from "@cuckcode/runtime-codex";

import { PROBE_MAX_LINE_BYTES, probeRuntime, runCodexProbeSurface } from "./codex-probe-surface.js";
import { assertNoCodexDrift } from "./codex-drift.js";
import { CREDENTIAL_SOURCE } from "./phase4-kickoff-session.js";

/**
 * `$env:CUCKCODE_LIVE_PROBE='1'; npm run codex:probe-surface` — owner-run only (F1.5).
 *
 * One signed-in session in a controlled home, two threads, no turn. It writes one record under
 * `docs/evidence/runtime/probe/` and one redacted session log, and touches no ledger. It uses the
 * Release Reviewer's approved model and effort only because thread/start needs a model; no role
 * is exercised.
 */
const ROOT = resolve(process.cwd());
const RECORDS = resolve(ROOT, "docs/evidence/runtime/probe");
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
const MODEL_SOURCE_ROLE = "release-reviewer";
const SCRIPT_NAME = basename(process.argv[1] ?? "run-codex-probe-surface").replace(
  /\.[cm]?[jt]s$/u,
  "",
);

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
const configuration = approved.plan.find((entry) => entry.roleId === MODEL_SOURCE_ROLE);
if (!configuration) throw new Error("ROLE_NOT_IN_APPROVED_PLAN");

const workspace = await mkdtemp(join(tmpdir(), "cuckcode-codex-probe-"));
try {
  const outcome = await runCodexProbeSurface({
    optIn: process.env.CUCKCODE_LIVE_PROBE === "1",
    pin: CODEX_PIN,
    cwd: workspace,
    expected: {
      requestedModel: configuration.model,
      expectedReasoningEffort: configuration.reasoningEffort,
    },
    // R3: runs before openRuntime constructs the supervisor; the core calls it first.
    checkDrift: async () => await assertNoCodexDrift(),
    openRuntime: async () => {
      const home = await createControlledCodexHome({
        parentDirectory: tmpdir(),
        instruction: "# Surface probe\n\nNo task. This session starts no turn.",
        credentialSourcePath: CREDENTIAL_SOURCE,
      });
      const supervisor = new CodexStdioSupervisor({
        executable: resolveInstalledCodexExecutable(),
        codexHome: home.path,
        maxLineBytes: PROBE_MAX_LINE_BYTES,
      });
      const log = openSessionLog(supervisor, {
        root: SESSIONS_ROOT,
        script: SCRIPT_NAME,
        roleId: "surface-probe",
        pin: CODEX_PIN,
      });
      try {
        await supervisor.start();
      } catch (cause) {
        await supervisor.stop();
        await log.close();
        await home.dispose();
        throw cause;
      }
      return probeRuntime(
        supervisor,
        async () =>
          relative(ROOT, await log.close())
            .split("\\")
            .join("/"),
        home.dispose,
      );
    },
    writeRecord: async (record) => {
      await mkdir(RECORDS, { recursive: true });
      const path = resolve(
        RECORDS,
        `${String(record.startedAt).replace(/[:.]/gu, "-")}-surface-probe.json`,
      );
      await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      return relative(ROOT, path).split("\\").join("/");
    },
    now: () => new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify(outcome)}\n`);
  if (!outcome.ok) process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
