import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { composeRole, type RoleBrief } from "@cuckcode/domain";
import {
  CodexStdioSupervisor,
  createControlledCodexHome,
  parseApprovedRoleExercisePlan,
  runRoleExercise,
  CODEX_PIN,
  resolveInstalledCodexExecutable,
} from "@cuckcode/runtime-codex";

import { assertNoCodexDrift } from "./codex-drift.js";

import { TASK7_CONTRACT, buildReviewPacket } from "./phase6-review-packet.js";

/**
 * Phase 6 Task 7 — the scored review, run by the two promoted roles the brief names.
 *
 * Bounded exactly as the Task 16 packet requires: one text-only turn per role, read-only sandbox,
 * `approvalPolicy: never`, no tools, no external effect, each role isolated in its own controlled
 * Codex home carrying only its composed brief. Two provider turns in total.
 *
 * The two reviews are independent: neither role is shown the other's output, and the runs do not
 * share a thread. Averaging or reconciling them here would destroy the disagreement the rubric
 * exists to surface.
 */
const ROOT = resolve(process.cwd());
const ROLES_ROOT = resolve(ROOT, "roles");
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/phase-6/scored-review");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");
// The pinned, installed Codex (R1.2). CUCKCODE_CODEX_EXE overrides the path, never the pin.
const EXECUTABLE = resolveInstalledCodexExecutable();
const CREDENTIAL_SOURCE = resolve(
  process.env.CUCKCODE_CODEX_AUTH ??
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
);

/** The two roles the brief names for Task 7. Nothing else may review. */
const REVIEWER_ROLE_IDS = ["product-designer", "visual-qa-reviewer"] as const;

if (process.env.CUCKCODE_LIVE_PHASE6_REVIEW !== "1") {
  throw new Error("LIVE_PHASE6_REVIEW_EXPLICIT_OPT_IN_REQUIRED");
}
// R3: refuse before any session opens if the installed Codex is not the pinned one.
await assertNoCodexDrift();

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);

/** Only a promoted role may act. A reviewer that was never promoted is not the reviewed artifact. */
const promotions = JSON.parse(await readFile(resolve(ROLES_ROOT, "promotions.json"), "utf8")) as {
  promotions: Array<{ roleId: string; contentSha256: string; revokedAt: string | null }>;
};

const packet = await buildReviewPacket();
await mkdir(EVIDENCE_ROOT, { recursive: true });

const results: Array<Record<string, unknown>> = [];

for (const roleId of REVIEWER_ROLE_IDS) {
  const configuration = approved.plan.find((entry) => entry.roleId === roleId);
  if (!configuration) throw new Error(`REVIEWER_NOT_IN_APPROVED_PLAN:${roleId}`);

  const promotion = promotions.promotions.find(
    (entry) => entry.roleId === roleId && entry.revokedAt === null,
  );
  if (!promotion) throw new Error(`REVIEWER_NOT_PROMOTED:${roleId}`);

  const artifact = await readFile(resolve(ROLES_ROOT, "authored", `${roleId}.json`));
  if (sha256(artifact) !== promotion.contentSha256) {
    throw new Error(`REVIEWER_ARTIFACT_DRIFT:${roleId}`);
  }
  const composed = composeRole(JSON.parse(artifact.toString("utf8")) as RoleBrief);
  if (!composed.ok) throw new Error(`REVIEWER_COMPOSITION_REFUSED:${composed.refusal.code}`);

  const workspace = await mkdtemp(join(tmpdir(), "cuckcode-phase6-review-"));
  const home = await createControlledCodexHome({
    parentDirectory: tmpdir(),
    instruction: composed.text,
    credentialSourcePath: CREDENTIAL_SOURCE,
  });
  const observedAt = new Date().toISOString();

  try {
    const result = await runRoleExercise({
      supervisor: new CodexStdioSupervisor({ executable: EXECUTABLE, codexHome: home.path }),
      cwd: workspace,
      expectedInstructionSource: home.instructionPath,
      agentId: `phase6-review-${roleId}`,
      bindingId: `phase6-review-${roleId}-${observedAt}`,
      roleId,
      expected: {
        requestedModel: configuration.model,
        expectedReasoningEffort: configuration.reasoningEffort,
        expectedAuthMode: "chatgpt",
        protocolVersion: CODEX_PIN,
        promotedContentSha256: promotion.contentSha256,
      },
      taskPrompt: TASK7_CONTRACT,
      turnInput: packet,
    });

    if (!result.performed) {
      results.push({ roleId, performed: false, code: result.code, detail: result.detail });
      process.stdout.write(`${JSON.stringify({ roleId, performed: false, code: result.code })}\n`);
      continue;
    }

    const filename = `${observedAt.replace(/[:.]/gu, "-")}-${roleId}.md`;
    await writeFile(
      resolve(EVIDENCE_ROOT, filename),
      [
        `# Phase 6 Task 7 scored review — ${roleId}`,
        "",
        `Observed at: ${observedAt}`,
        `Role artifact digest: \`${promotion.contentSha256}\``,
        `Runtime model: \`${result.binding.model}\``,
        `Reasoning effort: \`${result.binding.reasoningEffort}\``,
        `Protocol: \`${result.binding.protocolVersion}\``,
        `Binding fingerprint: \`${result.binding.materialFingerprint}\``,
        `Packet digest: \`${sha256(packet)}\``,
        "",
        "This reviewer was given measured data and declared intent. It was **not** shown the",
        "rendered compositions: the turn is text-only and no tool was available. Any criterion it",
        "marked NOT-ASSESSABLE was refused for that reason and must not be read as a low score.",
        "",
        "## Review",
        "",
        result.responseText,
        "",
      ].join("\n"),
      "utf8",
    );

    results.push({
      roleId,
      performed: true,
      evidencePath: `docs/evidence/phase-6/scored-review/${filename}`,
      transcriptSha256: sha256(result.responseText),
      model: result.binding.model,
      reasoningEffort: result.binding.reasoningEffort,
      bindingFingerprint: result.binding.materialFingerprint,
    });
    process.stdout.write(`${JSON.stringify({ roleId, performed: true, file: filename })}\n`);
  } finally {
    await home.dispose();
    await rm(workspace, { recursive: true, force: true });
  }
}

await writeFile(
  resolve(EVIDENCE_ROOT, "runs.json"),
  `${JSON.stringify(
    {
      schema: "cuckcode.phase6-scored-review.v1",
      status:
        "Task 7 runs recorded. Scores support discussion and select nothing; the owner selects at Task 8.",
      recordedAt: new Date().toISOString().slice(0, 10),
      packetSha256: sha256(packet),
      independent: true,
      reviewers: results,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
