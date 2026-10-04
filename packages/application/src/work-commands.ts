/**
 * Create, assign, evidence and review-request commands for work items (workflow-proof W3, P-1,
 * W5f, W5h).
 *
 * Both surfaces call these; neither holds workflow logic. The shape follows the attention commands:
 * a pure function over the current log, a stale-revision refusal, a manager-only authority check,
 * and a receipt. The reducer stays the only rules authority: a command builds candidate events,
 * dry-runs the canonical replay (`replayProject`) over `[...log, ...candidates]`, and refuses on
 * any new reducer issue, passing the reducer's code through. A candidate that does not parse is refused too, because the
 * reducer would silently drop it and the command would then report success for nothing.
 */
import { parseProjectEvent, workContractSchema, type WorkContract } from "@cuckcode/contracts";
import {
  judgeDoneClaim,
  nextEventTimes,
  replayProject,
  type WorkTruthState,
} from "@cuckcode/domain";

export type WorkCommand = Readonly<{
  commandId: string;
  projectId: string;
  expectedRevision: number;
  actor: Readonly<{ actorType: "manager" | "agent"; actorId: string }>;
  intent: "create" | "assign" | "record_evidence" | "request_review";
  workItemId: string;
  contract?: WorkContract;
  roleAssignmentId?: string;
  evidence?: WorkEvidenceInput;
}>;

/** An owner-run check result (workflow-proof W5f). `outputSha256` digests the saved output. */
export type WorkEvidenceInput = Readonly<{
  kind: string;
  result: "passed" | "failed";
  note?: string;
  outputSha256?: string;
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
    return refuse("NOT_AUTHORIZED", "only a manager may create, assign or review work");
  }

  // Judged in canonical replay order (time, then event id), the order every surface sees, not raw
  // file order: the two differ when events share or regress a timestamp.
  const before = replayProject(log).work;
  const item = before.workItems[command.workItemId];
  const candidates =
    command.intent === "create"
      ? planCreate(command, item !== undefined)
      : command.intent === "assign"
        ? planAssign(command, item)
        : command.intent === "record_evidence"
          ? planRecordEvidence(command, item)
          : planRequestReview(command, item, log);
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

const EVIDENCE_STATES = ["assigned", "active", "blocked", "waiting_input", "review_requested"];
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_NOTE = 280;

/**
 * An owner-run check result becomes verified evidence (W5f). The kind must be one the contract
 * obliges: a misspelt kind would otherwise be recorded and then never count toward "done". The
 * recorder never runs the check; `outputSha256` digests the output the owner saved from running it.
 */
function planRecordEvidence(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  const evidence: unknown = command.evidence;
  const issues: string[] = [];
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    return refuse("EVIDENCE_INVALID", "evidence is required");
  }
  const record = evidence as Record<string, unknown>;
  const extra = Object.keys(record).filter(
    (key) => !["kind", "result", "note", "outputSha256"].includes(key),
  );
  if (extra.length > 0) issues.push(`unexpected fields: ${extra.sort().join(", ")}`);
  if (typeof record.kind !== "string" || record.kind.length === 0) issues.push("kind is required");
  if (record.result !== "passed" && record.result !== "failed") {
    issues.push('result must be "passed" or "failed"');
  }
  if (
    record.note !== undefined &&
    (typeof record.note !== "string" || record.note.length > MAX_NOTE)
  ) {
    issues.push(`note must be a string of at most ${String(MAX_NOTE)} characters`);
  }
  if (
    record.outputSha256 !== undefined &&
    (typeof record.outputSha256 !== "string" || !SHA256.test(record.outputSha256))
  ) {
    issues.push("outputSha256 must be a 64-character lowercase hex digest");
  }
  if (issues.length > 0) return refuse("EVIDENCE_INVALID", ...issues);
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (!item.contract)
    return refuse("CONTRACT_MISSING", `${command.workItemId} has no work contract`);
  const kinds = item.contract.evidenceObligations.map((entry) => entry.kind);
  if (!kinds.includes(record.kind as string)) {
    return refuse(
      "EVIDENCE_KIND_UNKNOWN",
      `${String(record.kind)} is not an obligation of this contract; the obligations are: ${kinds.join(", ")}`,
    );
  }
  if (!EVIDENCE_STATES.includes(item.state)) {
    return refuse(
      "WORK_NOT_ACCEPTING_EVIDENCE",
      `${command.workItemId} is ${item.state}; evidence is taken once it is assigned and until review ends`,
    );
  }
  return [
    {
      kind: "evidence.recorded",
      payload: {
        evidenceId: `evidence_${command.commandId}`,
        workItemId: command.workItemId,
        kind: record.kind,
        version: 1,
        result: record.result,
        ...(record.note !== undefined ? { note: record.note } : {}),
        ...(record.outputSha256 !== undefined ? { outputSha256: record.outputSha256 } : {}),
        recordedBy: command.actor.actorId,
      },
    },
  ];
}

/** Evidence the runner recorded when the role claimed done (the bridge's `done-claim` kind). */
const hasRunnerDoneClaim = (log: readonly unknown[], workItemId: string): boolean =>
  log.some((raw) => {
    if (typeof raw !== "object" || raw === null) return false;
    const e = raw as { kind?: unknown; source?: unknown; payload?: unknown };
    const payload = e.payload as Record<string, unknown> | undefined;
    return (
      e.kind === "evidence.recorded" &&
      e.source === "adapter" &&
      payload?.workItemId === workItemId &&
      payload.kind === "done-claim"
    );
  });

/**
 * The owner moves an active item to review (W5h, rehearsal finding F-1). The role cannot run the
 * checks, so its done claim is always recorded before the owner's evidence exists; this is the
 * step that follows. It needs both halves: the role actually claimed done, and every contract
 * obligation now has verified passing evidence. The owner cannot skip the claim, and the claim
 * alone is never enough. It records no claim of its own, and it does not check that the evidence
 * was produced from the final worktree: that is the owner's responsibility.
 */
function planRequestReview(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
  log: readonly unknown[],
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (item.state !== "active") {
    return refuse(
      "WORK_NOT_REVIEWABLE",
      `${command.workItemId} is ${item.state}; a review is requested only for an active item`,
    );
  }
  if (!hasRunnerDoneClaim(log, command.workItemId)) {
    return refuse(
      "DONE_CLAIM_MISSING",
      `${command.workItemId} has no recorded done claim from the role; nothing is ready to review`,
    );
  }
  const judgement = judgeDoneClaim({ log, workItemId: command.workItemId });
  if (!judgement.ok) {
    return refuse(
      "DONE_NOT_SUPPORTED",
      `missing verified evidence: ${judgement.missingKinds.join(", ") || "none"}`,
      `failed evidence: ${judgement.failedKinds.join(", ") || "none"}`,
      `unverified evidence: ${judgement.unverifiedKinds.join(", ") || "none"}`,
    );
  }
  return [
    {
      kind: "work.transitioned",
      payload: {
        payloadVersion: 3,
        workItemId: command.workItemId,
        fromRevision: item.revision,
        toState: "review_requested",
        condition: {
          reasonCode: "review_requested",
          summary: "Every evidence obligation has verified passing evidence; acceptance is yours.",
          waitingOn: { kind: "manager" },
          requestedAction: { kind: "approve", summary: "Accept, redirect or decline this work." },
        },
      },
    },
  ];
}
