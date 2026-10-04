/**
 * Moves an active work item to review (workflow-proof W5h). Owner-run.
 *
 * The role cannot run the checks, so its done claim comes first and the owner's verified evidence
 * after. This is the step that follows: it appends one `work.transitioned` event to
 * `review_requested` through the same work command the server uses, so the rules (an active item,
 * a recorded role claim, verified passing evidence for every obligation) are enforced there, not
 * here. It does not accept the work: acceptance stays with the manager, in the surface.
 *
 * It appends to the log directly. It is another writer beside the server and the runner: do not run
 * it while a runner is appending to the same log (single-writer assumption, W5 plan §4 item 3).
 */
import { createHash } from "node:crypto";

import { executeWorkCommand } from "@cuckcode/application";

import { appendEventLog, readEventLog } from "../apps/server/src/event-log.js";

export type RequestReviewInput = Readonly<{
  logPath: string;
  workItemId: string;
  projectId?: string;
  actorId: string;
  now: string;
}>;

export type RequestReviewResult =
  | Readonly<{ ok: true; eventId: string; revision: number }>
  | Readonly<{ ok: false; code: string; issues: readonly string[] }>;

const fail = (code: string, ...issues: string[]): RequestReviewResult => ({
  ok: false,
  code,
  issues,
});

export async function requestWorkReview(input: RequestReviewInput): Promise<RequestReviewResult> {
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
  const commandId = `review-${createHash("sha256")
    .update([input.now, input.workItemId, String(log.revision)].join("|"))
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
      intent: "request_review",
      workItemId: input.workItemId,
    },
  });
  if (!outcome.ok) return { ok: false, code: outcome.code, issues: outcome.issues };
  const appended = await appendEventLog(input.logPath, outcome.events, log.revision);
  if (!appended.ok) return fail(appended.code, appended.detail);
  return {
    ok: true,
    eventId: String(outcome.events[0]?.eventId),
    revision: appended.revision,
  };
}

const KEYS = ["log", "work", "actor", "project"] as const;

export type ParsedReviewArgs =
  | Readonly<{
      ok: true;
      value: Readonly<{ logPath: string; workItemId: string; actorId: string; projectId?: string }>;
    }>
  | Readonly<{ ok: false; issues: string[] }>;

export function parseReviewArgs(argv: readonly string[]): ParsedReviewArgs {
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
  for (const required of ["log", "work"]) {
    if (!given.get(required)) issues.push(`${required}=... is required`);
  }
  if (issues.length > 0) return { ok: false, issues };
  const project = given.get("project") || undefined;
  return {
    ok: true,
    value: {
      logPath: given.get("log") as string,
      workItemId: given.get("work") as string,
      actorId: given.get("actor") || "manager_owner",
      ...(project !== undefined ? { projectId: project } : {}),
    },
  };
}
