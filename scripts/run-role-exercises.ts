import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { composeRole, type RoleBrief } from "@cuckcode/domain";
import {
  CodexStdioSupervisor,
  createControlledCodexHome,
  parseApprovedRoleExercisePlan,
  runRoleExercise,
  CODEX_PIN,
  openSessionLog,
  resolveInstalledCodexExecutable,
} from "@cuckcode/runtime-codex";

import { assertNoCodexDrift } from "./codex-drift.js";

const ROOT = resolve(process.cwd());
const ROLES_ROOT = resolve(ROOT, "roles");
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/role-exercises");
const SESSIONS_ROOT = resolve(ROOT, "docs/evidence/runtime/sessions");
const SCRIPT_NAME = "run-role-exercises";
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
// The pinned, installed Codex (R1.2). CUCKCODE_CODEX_EXE overrides the path, never the pin.
const EXECUTABLE = resolveInstalledCodexExecutable();

/**
 * Replacing `CODEX_HOME` also replaces the credential Codex reads, so the controlled home must be
 * given one explicitly. Exactly this one file is taken from the owner's Codex home — never its
 * `config.toml`, and never its `AGENTS.md`, which is the unpinned instruction source DF-010 found.
 */
const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

if (process.env.CUCKCODE_LIVE_ROLE_EXERCISE !== "1") {
  throw new Error("LIVE_ROLE_EXERCISE_EXPLICIT_OPT_IN_REQUIRED");
}
// R3: refuse before any session opens if the installed Codex is not the pinned one.
await assertNoCodexDrift();

const exerciseRecordPath = resolve(ROLES_ROOT, "exercises.json");
const exerciseRecord = JSON.parse(await readFile(exerciseRecordPath, "utf8")) as ExerciseRecord;
const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);
if (
  exerciseRecord.schema !== "cuckcode.role-exercise.v1" ||
  !Array.isArray(exerciseRecord.exercises)
) {
  throw new Error("EXERCISE_RECORD_INVALID");
}

await mkdir(EVIDENCE_ROOT, { recursive: true });
for (const configuration of approved.plan) {
  const record = exerciseRecord.exercises.find((entry) => entry.roleId === configuration.roleId);
  if (!record) throw new Error(`EXERCISE_RECORD_ROLE_MISSING:${configuration.roleId}`);
  if (record.performed) throw new Error(`EXERCISE_ALREADY_PERFORMED:${configuration.roleId}`);

  const artifactPath = resolve(ROLES_ROOT, "authored", `${configuration.roleId}.json`);
  const artifact = await readFile(artifactPath);
  if (sha256(artifact) !== record.contentSha256) {
    throw new Error(`EXERCISE_ARTIFACT_DRIFT:${configuration.roleId}`);
  }
  const composed = composeRole(JSON.parse(artifact.toString("utf8")) as RoleBrief);
  if (!composed.ok) throw new Error(`EXERCISE_COMPOSITION_REFUSED:${composed.refusal.code}`);

  const workspace = await mkdtemp(join(tmpdir(), "cuckcode-role-exercise-workspace-"));
  const home = await createControlledCodexHome({
    parentDirectory: tmpdir(),
    instruction: composed.text,
    credentialSourcePath: CREDENTIAL_SOURCE,
  });
  const observedAt = new Date().toISOString();
  const supervisor = new CodexStdioSupervisor({ executable: EXECUTABLE, codexHome: home.path });
  // CX-5: the session's diagnostic log, closed before the controlled home is deleted.
  const sessionLog = openSessionLog(supervisor, {
    root: SESSIONS_ROOT,
    script: SCRIPT_NAME,
    roleId: configuration.roleId,
    pin: CODEX_PIN,
  });
  try {
    const result = await runRoleExercise({
      supervisor,
      cwd: workspace,
      expectedInstructionSource: home.instructionPath,
      agentId: `exercise-${configuration.roleId}`,
      bindingId: `exercise-${configuration.roleId}-${observedAt}`,
      roleId: configuration.roleId,
      expected: {
        requestedModel: configuration.model,
        expectedReasoningEffort: configuration.reasoningEffort,
        expectedAuthMode: "chatgpt",
        protocolVersion: CODEX_PIN,
        promotedContentSha256: record.contentSha256,
      },
    });

    const outcome = result.performed
      ? await writeSuccessfulAttempt({
          roleId: configuration.roleId,
          contentSha256: record.contentSha256,
          observedAt,
          result,
        })
      : {
          performed: false,
          attempt: {
            observedAt,
            performed: false,
            code: result.code,
            detail: result.detail,
            ...(result.runtime ? { runtime: result.runtime } : {}),
          },
        };
    record.performed = outcome.performed;
    record.reason = outcome.performed
      ? "Bounded exercise completed; owner transcript review remains required before promotion."
      : `Bounded exercise did not pass: ${outcome.attempt.code}`;
    record.attempts = [...(record.attempts ?? []), outcome.attempt];
    exerciseRecord.recordedAt = observedAt.slice(0, 10);
    exerciseRecord.status = outcome.performed
      ? "partially-exercised-awaiting-owner-review"
      : "exercise-failure-recorded";
    await writeFile(exerciseRecordPath, `${JSON.stringify(exerciseRecord, null, 2)}\n`, "utf8");
    process.stdout.write(
      JSON.stringify({
        roleId: configuration.roleId,
        performed: outcome.performed,
        reason: record.reason,
      }) + "\n",
    );
  } finally {
    await sessionLog.close();
    await home.dispose();
    await rm(workspace, { recursive: true, force: true });
  }
}

type ExerciseRecord = {
  schema: string;
  status: string;
  recordedAt: string;
  exercises: Array<{
    roleId: string;
    contentSha256: string;
    performed: boolean;
    reason: string;
    attempts?: unknown[];
  }>;
};

async function writeSuccessfulAttempt(input: {
  roleId: string;
  contentSha256: string;
  observedAt: string;
  result: Extract<Awaited<ReturnType<typeof runRoleExercise>>, { performed: true }>;
}): Promise<
  | { performed: true; attempt: Record<string, unknown> }
  | {
      performed: false;
      attempt: Readonly<{
        observedAt: string;
        performed: false;
        code: "TRANSCRIPT_SECRET_REJECTED";
        detail: string;
      }>;
    }
> {
  if (secretShaped(input.result.responseText)) {
    return {
      performed: false,
      attempt: {
        observedAt: input.observedAt,
        performed: false,
        code: "TRANSCRIPT_SECRET_REJECTED",
        detail: "response text was not retained because it resembled credential material",
      },
    };
  }
  const filename = `${input.observedAt.replace(/[:.]/gu, "-")}-${input.roleId}.md`;
  const outputPath = resolve(EVIDENCE_ROOT, filename);
  await writeFile(
    outputPath,
    [
      `# Role exercise — ${input.roleId}`,
      "",
      `Observed at: ${input.observedAt}`,
      `Role artifact digest: \`${input.contentSha256}\``,
      `Runtime model: \`${input.result.binding.model}\``,
      `Reasoning effort: \`${input.result.binding.reasoningEffort}\``,
      `Protocol: \`${input.result.binding.protocolVersion}\``,
      `Binding fingerprint: \`${input.result.binding.materialFingerprint}\``,
      "",
      "## Transcript",
      "",
      input.result.responseText,
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    performed: true,
    attempt: {
      observedAt: input.observedAt,
      performed: true,
      evidencePath: relative(ROOT, outputPath).split("\\").join("/"),
      transcriptSha256: sha256(input.result.responseText),
      model: input.result.binding.model,
      reasoningEffort: input.result.binding.reasoningEffort,
      protocolVersion: input.result.binding.protocolVersion,
      runtime: input.result.runtime,
      bindingFingerprint: input.result.binding.materialFingerprint,
    },
  };
}

function secretShaped(value: string): boolean {
  return /authorization\s*:\s*bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|sk-[a-z0-9_-]{8,}/iu.test(
    value,
  );
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}
