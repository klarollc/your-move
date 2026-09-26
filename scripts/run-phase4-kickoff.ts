import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { RuntimeBindingReport } from "@cuckcode/contracts";
import { runPreflightedKickoff, type PreparedKickoffBinding } from "@cuckcode/application";
import { CODEX_PIN, attemptRecords, parseApprovedRoleExercisePlan } from "@cuckcode/runtime-codex";
import { readFile } from "node:fs/promises";

import {
  KICKOFF_BRIEFING,
  KICKOFF_ROLE_IDS,
  SYNTHESIS_ROLE_ID,
} from "./phase4-kickoff-briefing.js";
import {
  buildKickoffPreflightInput,
  MAX_QUALIFICATION_AGE_MS,
} from "./phase4-kickoff-preflight.js";
import {
  openKickoffSession,
  parseTurnJson,
  type KickoffSession,
} from "./phase4-kickoff-session.js";

/**
 * Task 17 — the one bounded live D-25 kickoff.
 *
 * Six persistent threads, at most thirteen turns, text-only, read-only sandbox, `approvalPolicy:
 * never`, no tools. Every role is isolated in its own controlled Codex home carrying only its
 * composed brief and the credential; the task contract attached at thread start is identical for all
 * six, which is the equal-briefing requirement.
 *
 * The run stops rather than repairs. A role that fails is that role's failure and the round
 * continues under-filled; an observed external effect stops everything, because containment that did
 * not hold once will not be trusted for the remaining turns.
 */
const ROOT = resolve(process.cwd());
const EVIDENCE_ROOT = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-17-run");
const PACKET_PATH = resolve(ROOT, "docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md");

if (process.env.CUCKCODE_LIVE_KICKOFF !== "1") {
  throw new Error("LIVE_KICKOFF_EXPLICIT_OPT_IN_REQUIRED");
}

const approved = parseApprovedRoleExercisePlan(await readFile(PACKET_PATH, "utf8"));
if (!approved.ok) throw new Error(approved.code);

const now = Date.now();
const preflightInput = await buildKickoffPreflightInput();
const workspace = await mkdtemp(join(tmpdir(), "cuckcode-kickoff-"));
await mkdir(EVIDENCE_ROOT, { recursive: true });

const sessions = new Map<string, KickoffSession>();
const prepared: PreparedKickoffBinding[] = [];
const openFailures: Array<{ roleId: string; code: string; detail: string }> = [];

/** Opened one at a time: a failure at role four must not leave three orphaned processes. */
for (const roleId of KICKOFF_ROLE_IDS) {
  const configuration = approved.plan.find((entry) => entry.roleId === roleId);
  const candidate = preflightInput.bindings.find((entry) => entry.roleId === roleId);
  if (!configuration || !candidate) {
    openFailures.push({ roleId, code: "ROLE_NOT_CONFIGURED", detail: "absent from the packet" });
    continue;
  }

  const opened = await openKickoffSession({
    roleId,
    agentId: candidate.agentId,
    bindingId: candidate.bindingId,
    cwd: workspace,
    expected: {
      requestedModel: configuration.model,
      expectedReasoningEffort: configuration.reasoningEffort,
      expectedAuthMode: "chatgpt",
      protocolVersion: CODEX_PIN,
      promotedContentSha256: candidate.roleContractVersion.replace(/^content:/u, ""),
    },
  });

  if (!opened.ok) {
    openFailures.push({ roleId, code: opened.code, detail: opened.detail });
    continue;
  }

  sessions.set(roleId, opened.session);
  prepared.push({
    displayName: roleId,
    createdAt: new Date().toISOString(),
    providerIds: { threadRole: roleId },
    report: opened.session.report,
    candidate,
  });
}

if (openFailures.length > 0) {
  for (const session of sessions.values()) await session.close();
  await rm(workspace, { recursive: true, force: true });
  await writeFile(
    resolve(EVIDENCE_ROOT, "run.json"),
    `${JSON.stringify({ ok: false, code: "SESSIONS_NOT_OPENED", openFailures }, null, 2)}\n`,
    "utf8",
  );
  process.stderr.write(`${JSON.stringify({ ok: false, openFailures }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  // The role is captured here, from the candidate, rather than read off the report. A report says
  // what runtime session exists and `runtimeBindingReportSchema` is strict with no `roleId`; the
  // candidate is what joins that session to a role contract. This line used to write
  // `roleId: report.roleId`, which was `undefined`, and `JSON.stringify` dropped the key — which is
  // why both shipped Task 17 run artifacts record bindings that do not say which role they were
  // for. Owner ruling 2026-09-14, `docs/evidence/decision-record-2026-09-14-scripts-typecheck.md`.
  const bindings: Array<{ report: RuntimeBindingReport; roleId: string; createdAt: string }> = [];
  const transcript: Array<Record<string, unknown>> = [];

  const promptFor = (kind: string, roleId: string): string => {
    if (kind === "contribution") {
      return `CONTRIBUTION. Here is the shared briefing, identical for all six roles:\n\n${JSON.stringify(KICKOFF_BRIEFING, null, 2)}\n\nGive your contribution as ${roleId}, in the CONTRIBUTION schema. One JSON object, nothing else.`;
    }
    if (kind === "synthesis") {
      const contributions = transcript
        .filter((entry) => entry.kind === "contribution" && entry.accepted === true)
        .map((entry) => ({ roleId: entry.roleId, payload: entry.payload }));
      return `SYNTHESIS. You are the Delivery Lead. Here are every role's contributions:\n\n${JSON.stringify(contributions, null, 2)}\n\nSynthesise them in the SYNTHESIS schema. Record disagreements rather than resolving them, attributing each to the ROLE that holds it — a roleId such as "test-engineer", never a contribution identifier. One JSON object, nothing else.`;
    }
    const synthesis = transcript.find(
      (entry) => entry.kind === "synthesis" && entry.accepted === true,
    );
    return `REVISION. The Delivery Lead synthesised the round as:\n\n${JSON.stringify(synthesis?.payload ?? null, null, 2)}\n\nRespond as ${roleId} in the REVISION schema: affirm, amend, or challenge, with your reason. One JSON object, nothing else.`;
  };

  const result = await runPreflightedKickoff({
    briefing: KICKOFF_BRIEFING,
    preparedBindings: prepared,
    promoted: preflightInput.promoted,
    now,
    maxQualificationAgeMs: MAX_QUALIFICATION_AGE_MS,
    synthesisRoleId: SYNTHESIS_ROLE_ID,
    trustStore: {
      registerAgent: () => undefined,
      appendBinding: ({ report, createdAt }) => {
        // `runPreflightedKickoff` refuses the round unless every candidate's agentId and bindingId
        // equal its report's, so this join is exact by construction rather than by convention. It
        // still refuses rather than recording an unattributed binding: a binding whose role cannot
        // be named is the defect this replaces.
        const preparedBinding = prepared.find(
          (entry) => entry.candidate.bindingId === report.bindingId,
        );
        if (!preparedBinding) throw new Error("BINDING_ROLE_UNRESOLVED");
        bindings.push({ report, roleId: preparedBinding.candidate.roleId, createdAt });
      },
    },
    runTurn: async (request) => {
      const session = sessions.get(request.roleId);
      if (!session) {
        return { ok: false, code: "SESSION_MISSING", detail: `no session for ${request.roleId}` };
      }

      const turn = await session.turn(promptFor(request.kind, request.roleId));
      const events = turn.effects.length > 0 ? turn.effects : undefined;

      if (!turn.ok) {
        transcript.push({
          ...request,
          accepted: false,
          code: turn.code,
          detail: turn.detail,
          runtime: attemptRecords(turn.attempts),
        });
        return { ok: false, code: turn.code, detail: turn.detail, ...(events ? { events } : {}) };
      }

      const parsed = parseTurnJson(turn.text);
      if (!parsed.ok) {
        transcript.push({
          ...request,
          runtime: attemptRecords(turn.attempts),
          accepted: false,
          code: "PAYLOAD_UNPARSEABLE",
          raw: turn.text,
        });
        return {
          ok: false,
          code: "PAYLOAD_UNPARSEABLE",
          detail: parsed.detail,
          ...(events ? { events } : {}),
        };
      }

      // The role supplies its position. Identifiers come from the round, so a role can neither
      // misattribute itself nor address a kickoff it is not part of.
      const payload =
        request.kind === "contribution"
          ? {
              schemaVersion: 1,
              contributionId: `contribution_${request.roleId}`,
              kickoffId: KICKOFF_BRIEFING.kickoffId,
              briefingVersion: KICKOFF_BRIEFING.briefingVersion,
              roleId: request.roleId,
              agentId: request.agentId,
              kind: parsed.value.kind,
              goal: parsed.value.goal,
              value: parsed.value.value,
              risk: parsed.value.risk,
              dependencies: parsed.value.dependencies ?? [],
              acceptanceCriteria: parsed.value.acceptanceCriteria ?? [],
              evidenceNeeds: parsed.value.evidenceNeeds ?? [],
              uncertainties: parsed.value.uncertainties ?? [],
              disagreements: parsed.value.disagreements ?? [],
            }
          : request.kind === "synthesis"
            ? {
                synthesisId: "synthesis_task17",
                authorRoleId: request.roleId,
                proposedGoal: parsed.value.proposedGoal,
                includedContributionIds: transcript
                  .filter((entry) => entry.kind === "contribution" && entry.accepted === true)
                  .map((entry) => `contribution_${String(entry.roleId)}`),
                disagreementRegister: parsed.value.disagreementRegister ?? [],
                unresolvedEvidenceGaps: parsed.value.unresolvedEvidenceGaps ?? [],
              }
            : {
                revisionId: `revision_${request.roleId}`,
                roleId: request.roleId,
                agentId: request.agentId,
                response: parsed.value.response,
                statement: parsed.value.statement,
              };

      transcript.push({
        ...request,
        accepted: true,
        payload,
        raw: turn.text,
        runtime: attemptRecords(turn.attempts),
      });
      return { ok: true, payload, ...(events ? { events } : {}) };
    },
  });

  for (const session of sessions.values()) await session.close();
  await rm(workspace, { recursive: true, force: true });

  await writeFile(
    resolve(EVIDENCE_ROOT, "run.json"),
    `${JSON.stringify(
      {
        schema: "cuckcode.phase4-task17-run.v1",
        status:
          result.status === "completed"
            ? "Run completed. The charter is not approved: only the manager approves a charter."
            : `Run did not complete: ${result.status}.`,
        ranAt: new Date().toISOString(),
        briefing: KICKOFF_BRIEFING,
        synthesisRoleId: SYNTHESIS_ROLE_ID,
        bindings: bindings.map(({ report, roleId, createdAt }) => ({
          agentId: report.agentId,
          roleId,
          model: report.model,
          reasoningEffort: report.reasoningEffort,
          protocolVersion: report.protocolVersion,
          materialFingerprint: report.materialFingerprint,
          createdAt,
        })),
        result,
        transcript,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify({
      ok: result.status === "completed",
      status: result.status,
      ...(result.status === "completed"
        ? {
            turnsUsed: result.result.turnsUsed,
            responded: result.result.respondedRoleIds.length,
            silent: result.result.silentRoleIds,
            failures: result.result.failures.length,
            stopped: result.result.stopped ?? null,
          }
        : {}),
    })}\n`,
  );
}
