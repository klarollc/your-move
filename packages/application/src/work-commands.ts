/**
 * Create and assign commands for work items (workflow-proof W3, P-1).
 *
 * Both surfaces call these; neither holds workflow logic. The shape follows the attention commands:
 * a pure function over the current log, a stale-revision refusal, a manager-only authority check,
 * and a receipt. The reducer stays the only rules authority: a command builds candidate events,
 * dry-runs the canonical replay (`replayProject`) over `[...log, ...candidates]`, and refuses on
 * any new reducer issue, passing the reducer's code through. A candidate that does not parse is refused too, because the
 * reducer would silently drop it and the command would then report success for nothing.
 */
import { parseProjectEvent, workContractSchema, type WorkContract } from "@cuckcode/contracts";
import { nextEventTimes, replayProject, type WorkTruthState } from "@cuckcode/domain";

export type WorkCommand = Readonly<{
  commandId: string;
  projectId: string;
  expectedRevision: number;
  actor: Readonly<{ actorType: "manager" | "agent"; actorId: string }>;
  intent: "create" | "assign";
  workItemId: string;
  contract?: WorkContract;
  roleAssignmentId?: string;
}>;

export type WorkCommandReceipt = Readonly<{
  receiptId: string;
  commandId: string;
  acceptedRevision: number;
  resultingRevision: number;
  intent: WorkCommand["intent"];
  actorId: string;
  workItemId: string;
  eventIds: readonly string[];
}>;

export type WorkCommandResult =
  | Readonly<{
      ok: true;
      events: readonly Record<string, unknown>[];
      state: WorkTruthState;
      receipt: WorkCommandReceipt;
    }>
  | Readonly<{ ok: false; code: string; issues: readonly string[]; retrySafe?: true }>;

const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const WORK_ITEM_ID = /^work_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ROLE_ASSIGNMENT_ID = /^role-assignment_[A-Za-z0-9][A-Za-z0-9._-]*$/;

const refuse = (code: string, ...issues: string[]): WorkCommandResult => ({
  ok: false,
  code,
  issues,
});

export function executeWorkCommand(
  input: Readonly<{
    log: readonly unknown[];
    currentRevision: number;
    now: string;
    command: WorkCommand;
  }>,
): WorkCommandResult {
  const { log, currentRevision, now, command } = input;
  if (!COMMAND_ID.test(command.commandId)) {
    return refuse("COMMAND_INVALID", "commandId is missing or malformed");
  }
  if (!WORK_ITEM_ID.test(command.workItemId)) {
    return refuse("COMMAND_INVALID", "workItemId is missing or malformed");
  }
  if (command.expectedRevision !== currentRevision) {
    return {
      ok: false,
      code: "STALE_REVISION",
      issues: [
        `expected revision ${String(command.expectedRevision)}, current is ${String(currentRevision)}`,
      ],
      retrySafe: true,
    };
  }
  if (command.actor.actorType !== "manager") {
    return refuse("NOT_AUTHORIZED", "only a manager may create or assign work");
  }

  // Judged in canonical replay order (time, then event id), the order every surface sees, not raw
  // file order: the two differ when events share or regress a timestamp.
  const before = replayProject(log).work;
  const item = before.workItems[command.workItemId];
  const candidates =
    command.intent === "create"
      ? planCreate(command, item !== undefined)
      : planAssign(command, item);
  if (!Array.isArray(candidates)) return candidates;

  // Stamped after everything already in the log, so canonical replay applies them last.
  const times = nextEventTimes(log, now, candidates.length);
  let sequence = 0;
  const events = candidates.map((candidate) => {
    sequence += 1;
    return {
      schemaVersion: 1,
      eventId: `event_${command.commandId}_${String(sequence)}`,
      projectId: command.projectId,
      kind: candidate.kind,
      occurredAt: times[sequence - 1],
      receivedAt: times[sequence - 1],
      source: "manager",
      trust: "verified",
      workItemId: command.workItemId,
      ...(candidate.roleAssignmentId ? { roleAssignmentId: candidate.roleAssignmentId } : {}),
      payload: candidate.payload,
    };
  });

  for (const candidate of events) {
    const parsed = parseProjectEvent(candidate);
    if (!parsed.ok) {
      return refuse("EVENT_INVALID", `${candidate.eventId}: ${parsed.error.details.join("; ")}`);
    }
  }

  const after = replayProject([...log, ...events]).work;
  const fresh = after.issues.slice(before.issues.length);
  const first = fresh[0];
  if (first) return refuse(first.code, ...fresh.map((found) => found.message));

  return {
    ok: true,
    events,
    state: after,
    receipt: {
      receiptId: `receipt_${command.commandId}`,
      commandId: command.commandId,
      acceptedRevision: currentRevision,
      // Revisions count appended events: a log of N events is at revision N.
      resultingRevision: currentRevision + events.length,
      intent: command.intent,
      actorId: command.actor.actorId,
      workItemId: command.workItemId,
      eventIds: events.map((event) => event.eventId),
    },
  };
}

type Candidate = Readonly<{
  kind: string;
  payload: Record<string, unknown>;
  roleAssignmentId?: string;
}>;

function planCreate(command: WorkCommand, exists: boolean): Candidate[] | WorkCommandResult {
  if (command.contract === undefined) {
    return refuse("CONTRACT_INVALID", "contract is required");
  }
  const parsed = workContractSchema.safeParse(command.contract);
  if (!parsed.success) {
    return refuse(
      "CONTRACT_INVALID",
      ...parsed.error.issues.map(
        (found) => `${found.path.join(".") || "(root)"}: ${found.message}`,
      ),
    );
  }
  if (exists) return refuse("WORK_ITEM_EXISTS", `${command.workItemId} already exists`);
  return [
    {
      kind: "work.created",
      payload: {
        payloadVersion: 2,
        workItemId: command.workItemId,
        outcome: parsed.data.outcome,
        requiredEvidenceKinds: parsed.data.evidenceObligations.map((entry) => entry.kind),
        contract: parsed.data,
      },
    },
  ];
}

function planAssign(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!command.roleAssignmentId || !ROLE_ASSIGNMENT_ID.test(command.roleAssignmentId)) {
    return refuse("COMMAND_INVALID", "roleAssignmentId is missing or malformed");
  }
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  // D-26: an item is assigned against a bounded contract. A version 1 item has none.
  if (!item.contract)
    return refuse("CONTRACT_MISSING", `${command.workItemId} has no work contract`);
  if ((item.state !== "draft" && item.state !== "ready") || item.assignment !== null) {
    return refuse(
      "WORK_NOT_ASSIGNABLE",
      `${command.workItemId} is ${item.state} and cannot be assigned`,
    );
  }
  const transition = (fromRevision: number, toState: string): Candidate => ({
    kind: "work.transitioned",
    payload: { payloadVersion: 3, workItemId: command.workItemId, fromRevision, toState },
  });
  const steps: Candidate[] = [];
  let revision = item.revision;
  if (item.state === "draft") {
    steps.push(transition(revision, "ready"));
    revision += 1;
  }
  steps.push({
    kind: "work.assigned",
    payload: { workItemId: command.workItemId, roleAssignmentId: command.roleAssignmentId },
    roleAssignmentId: command.roleAssignmentId,
  });
  steps.push(transition(revision, "assigned"));
  return steps;
}
