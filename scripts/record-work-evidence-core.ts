/**
 * Records an owner-run check result as verified evidence (workflow-proof W5f).
 *
 * The owner runs the check (the test, the diff review) and saves its output. This appends one
 * `evidence.recorded` event, source manager and trust verified, through the same work command the
 * server uses, so the contract's evidence kinds and the item's state are enforced here too. It never
 * runs a check itself. The output file's digest is stored, so the record points at an artifact.
 *
 * It appends to the log directly. It is a second writer beside the server and the runner: do not
 * run it while a runner is appending to the same log (W5 plan §4, item 3, single-writer assumption).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { executeWorkCommand } from "@cuckcode/application";
import { judgeDoneClaim } from "@cuckcode/domain";

import { appendEventLog, readEventLog } from "../apps/server/src/event-log.js";

export type RecordEvidenceInput = Readonly<{
  logPath: string;
  workItemId: string;
  kind: string;
  result: "passed" | "failed";
  note?: string;
  outputPath?: string;
  projectId?: string;
  actorId: string;
  now: string;
}>;

export type RecordEvidenceResult =
  | Readonly<{
      ok: true;
      eventId: string;
      revision: number;
      outputSha256?: string;
      doneSupported: boolean;
      unsatisfied: readonly string[];
    }>
  | Readonly<{ ok: false; code: string; issues: readonly string[] }>;

const fail = (code: string, ...issues: string[]): RecordEvidenceResult => ({
  ok: false,
  code,
  issues,
});

export async function recordWorkEvidence(
  input: RecordEvidenceInput,
): Promise<RecordEvidenceResult> {
  const log = await readEventLog(input.logPath);
  if (log.truncated || log.problems.length > 0) {
    return fail(
      "LOG_DAMAGED",
      "the event log has a truncated or unreadable record; nothing was written",
    );
  }
  let projectId = input.projectId;
  if (projectId === undefined) {
    const ids = new Set(log.events.map((event) => (event as { projectId: string }).projectId));
    if (ids.size !== 1) {
      return fail(
        "PROJECT_AMBIGUOUS",
        `the log holds ${String(ids.size)} projects; pass project=<id>`,
      );
    }
    projectId = [...ids][0] as string;
  }
  let outputSha256: string | undefined;
  if (input.outputPath !== undefined) {
    let bytes: Buffer;
    try {
      bytes = await readFile(input.outputPath);
    } catch (error) {
      return fail("OUTPUT_UNREADABLE", `cannot read ${input.outputPath}: ${String(error)}`);
    }
    if (bytes.length === 0) return fail("OUTPUT_UNREADABLE", `${input.outputPath} is empty`);
    outputSha256 = createHash("sha256").update(bytes).digest("hex");
  }
  const commandId = `evidence-${createHash("sha256")
    .update([input.now, input.workItemId, input.kind, input.result, outputSha256 ?? ""].join("|"))
    .digest("hex")
    .slice(0, 12)}`;
  const outcome = executeWorkCommand({
    log: log.events,
    currentRevision: log.revision,
    now: input.now,
    command: {
      commandId,
      projectId,
      expectedRevision: log.revision,
      actor: { actorType: "manager", actorId: input.actorId },
      intent: "record_evidence",
      workItemId: input.workItemId,
      evidence: {
        kind: input.kind,
        result: input.result,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(outputSha256 !== undefined ? { outputSha256 } : {}),
      },
    },
  });
  if (!outcome.ok) return { ok: false, code: outcome.code, issues: outcome.issues };
  const appended = await appendEventLog(input.logPath, outcome.events, log.revision);
  if (!appended.ok) return fail(appended.code, appended.detail);
  const judgement = judgeDoneClaim({
    log: [...log.events, ...outcome.events],
    workItemId: input.workItemId,
  });
  return {
    ok: true,
    eventId: String(outcome.events[0]?.eventId),
    revision: appended.revision,
    ...(outputSha256 !== undefined ? { outputSha256 } : {}),
    doneSupported: judgement.ok,
    unsatisfied: judgement.ok
      ? []
      : [...judgement.missingKinds, ...judgement.failedKinds, ...judgement.unverifiedKinds],
  };
}

const KEYS = ["log", "work", "kind", "result", "output", "note", "actor", "project"] as const;

export type ParsedEvidenceArgs =
  | Readonly<{
      ok: true;
      value: Readonly<{
        logPath: string;
        workItemId: string;
        kind: string;
        result: "passed" | "failed";
        outputPath?: string;
        note?: string;
        actorId: string;
        projectId?: string;
      }>;
    }>
  | Readonly<{ ok: false; issues: string[] }>;

export function parseEvidenceArgs(argv: readonly string[]): ParsedEvidenceArgs {
  const given = new Map<string, string>();
  const issues: string[] = [];
  for (const arg of argv) {
    const at = arg.indexOf("=");
    const key = at < 0 ? arg : arg.slice(0, at);
    if (!(KEYS as readonly string[]).includes(key) || at < 0) {
      issues.push(
        `unknown or malformed argument: ${key} (use key=value; keys: ${KEYS.join(", ")})`,
      );
      continue;
    }
    given.set(key, arg.slice(at + 1));
  }
  for (const required of ["log", "work", "kind", "result"]) {
    if (!given.get(required)) issues.push(`${required}=... is required`);
  }
  const result = given.get("result");
  if (result !== undefined && result !== "passed" && result !== "failed") {
    issues.push('result must be "passed" or "failed"');
  }
  if (issues.length > 0) return { ok: false, issues };
  const optional = (key: string): string | undefined => given.get(key) || undefined;
  const output = optional("output");
  const note = optional("note");
  const project = optional("project");
  return {
    ok: true,
    value: {
      logPath: given.get("log") as string,
      workItemId: given.get("work") as string,
      kind: given.get("kind") as string,
      result: result as "passed" | "failed",
      ...(output !== undefined ? { outputPath: output } : {}),
      ...(note !== undefined ? { note } : {}),
      actorId: optional("actor") ?? "manager_owner",
      ...(project !== undefined ? { projectId: project } : {}),
    },
  };
}
