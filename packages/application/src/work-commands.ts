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
import {
  boundedWorkContractSchema,
  parseProjectEvent,
  type WorkContract,
} from "@cuckcode/contracts";
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
  intent:
    | "create"
    | "assign"
    | "record_evidence"
    | "request_review"
    | "record_ruling"
    | "grant_turns"
    | "rescope"
    | "close_incomplete"
    | "nudge"
    | "suppress_nudge"
    | "withdraw_ruling"
    | "ask_question"
    | "propose_rescope"
    | "decline_rescope"
    | "dispute_send_back";
  workItemId: string;
  contract?: WorkContract;
  roleAssignmentId?: string;
  evidence?: WorkEvidenceInput;
  ruling?: WorkRulingInput;
  turnsGranted?: number;
  budgetRevision?: number;
  expectedContractRevision?: number;
  reason?: string;
  note?: string;
  disposition?: "snooze" | "dismiss";
  rulingId?: string;
  proposalId?: string;
  question?: string;
  statement?: string;
}>;

export type WorkRulingInput = Readonly<{
  decision: "accept" | "accept_with_exception" | "send_back" | "defer";
  reason?: string;
  note?: string;
  resurfaceAt?: string;
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
const AGENT_ID = /^agent_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RESCOPE_PROPOSAL_ID = /^rescope-proposal_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RULING_ID = /^ruling_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_SPEECH_TEXT = 2_000;

type WorkActor = Readonly<{ actorType: "manager" | "agent"; actorId: string }>;
type AgentSpeechIntent = "ask_question" | "propose_rescope" | "dispute_send_back";
const AGENT_SPEECH_INTENTS: readonly AgentSpeechIntent[] = [
  "ask_question",
  "propose_rescope",
  "dispute_send_back",
];

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
    trustedContext?: Readonly<{
      worktreeSha256?: string;
      authenticatedAgent?: Readonly<{ agentId: string; roleAssignmentId: string }>;
    }>;
  }>,
): WorkCommandResult {
  const { log, currentRevision, now, command, trustedContext } = input;
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
  if (trustedContext?.worktreeSha256 !== undefined && !SHA256.test(trustedContext.worktreeSha256)) {
    return refuse(
      "WORKTREE_DIGEST_INVALID",
      "trusted worktree digest must be 64-character lowercase hex",
    );
  }
  const agentSpeech = AGENT_SPEECH_INTENTS.includes(command.intent as AgentSpeechIntent);
  const authenticatedAgent = trustedContext?.authenticatedAgent;
  let effectiveActor: WorkActor;
  let authenticatedRoleAssignmentId: string | undefined;
  if (authenticatedAgent) {
    if (!agentSpeech) {
      return refuse("NOT_AUTHORIZED", "authenticated agents may only record speech acts");
    }
    if (
      !AGENT_ID.test(authenticatedAgent.agentId) ||
      !ROLE_ASSIGNMENT_ID.test(authenticatedAgent.roleAssignmentId)
    ) {
      return refuse("NOT_AUTHORIZED", "authenticated agent identity is malformed");
    }
    const current = replayProject(log);
    const item = current.work.workItems[command.workItemId];
    const assignedAgent =
      current.staffing.assignments[authenticatedAgent.roleAssignmentId]?.agentId;
    if (
      current.project.projectId !== command.projectId ||
      assignedAgent !== authenticatedAgent.agentId ||
      item?.assignment?.roleAssignmentId !== authenticatedAgent.roleAssignmentId
    ) {
      return refuse(
        "WORK_SPEECH_ACT_UNAUTHORIZED",
        "the authenticated agent must hold this work item's active role assignment in this project",
      );
    }
    effectiveActor = { actorType: "agent", actorId: authenticatedAgent.agentId };
    authenticatedRoleAssignmentId = authenticatedAgent.roleAssignmentId;
  } else {
    if (agentSpeech || command.actor.actorType !== "manager") {
      return refuse("NOT_AUTHORIZED", "an authenticated manager or assigned agent is required");
    }
    effectiveActor = command.actor;
  }
  const commandPrefix = `event_${command.commandId}_`;
  if (normalizeCommandEventIds(log).some((eventId) => eventId.startsWith(commandPrefix))) {
    return refuse(
      "COMMAND_ID_DUPLICATE",
      `command ${command.commandId} already appears in the event log`,
    );
  }
  const fields = validateCommandFields(command);
  if (fields.length > 0) return refuse("COMMAND_INVALID", ...fields);

  // Judged in canonical replay order (time, then event id), the order every surface sees, not raw
  // file order: the two differ when events share or regress a timestamp.
  const before = replayProject(log).work;
  const item = before.workItems[command.workItemId];
  const candidates =
    command.intent === "ask_question"
      ? planAskQuestion(command)
      : command.intent === "propose_rescope"
        ? planProposeRescope(command, item, authenticatedRoleAssignmentId)
        : command.intent === "dispute_send_back"
          ? planDisputeSendBack(command, item, authenticatedRoleAssignmentId)
          : command.intent === "decline_rescope"
            ? planDeclineRescope(command, item)
            : command.intent === "create"
              ? planCreate(command, item !== undefined)
              : command.intent === "assign"
                ? planAssign(command, item)
                : command.intent === "record_evidence"
                  ? planRecordEvidence(command, item, trustedContext?.worktreeSha256)
                  : command.intent === "request_review"
                    ? planRequestReview(command, item, log)
                    : command.intent === "record_ruling"
                      ? planRuling(command, item, before, log, now, trustedContext?.worktreeSha256)
                      : command.intent === "grant_turns"
                        ? planGrantTurns(command, item)
                        : command.intent === "rescope"
                          ? planRescope(command, item)
                          : command.intent === "close_incomplete"
                            ? planCloseIncomplete(command, item)
                            : command.intent === "nudge"
                              ? planNudge(command, item)
                              : command.intent === "suppress_nudge"
                                ? planSuppressNudge(command, item)
                                : planWithdrawRuling(command, item, before);
  if (!Array.isArray(candidates)) return candidates;

  // Stamped after everything already in the log, so canonical replay applies them last.
  const times = nextEventTimes(log, now, candidates.length);
  let sequence = 0;
  const events = candidates.map((candidate, index) => {
    sequence += 1;
    return {
      schemaVersion: 1,
      eventId: `event_${command.commandId}_${String(sequence)}`,
      projectId: command.projectId,
      kind: candidate.kind,
      occurredAt: times[sequence - 1],
      receivedAt: times[sequence - 1],
      source: candidate.source ?? "manager",
      trust: candidate.trust ?? "verified",
      ...(candidate.actor
        ? { actor: candidate.actor }
        : authenticatedAgent
          ? { actor: effectiveActor }
          : {}),
      workItemId: command.workItemId,
      ...(candidate.roleAssignmentId
        ? { roleAssignmentId: candidate.roleAssignmentId }
        : authenticatedRoleAssignmentId
          ? { roleAssignmentId: authenticatedRoleAssignmentId }
          : {}),
      payload: {
        ...candidate.payload,
        ...(candidate.suppressionDays === undefined
          ? {}
          : {
              until: new Date(
                Date.parse(times[index]!) + candidate.suppressionDays * 86_400_000,
              ).toISOString(),
            }),
      },
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
      actorId: effectiveActor.actorId,
      workItemId: command.workItemId,
      eventIds: events.map((event) => event.eventId),
    },
  };
}

type Candidate = Readonly<{
  kind: string;
  payload: Record<string, unknown>;
  roleAssignmentId?: string;
  actor?: WorkActor;
  source?: "manager" | "adapter";
  trust?: "verified" | "reported";
  suppressionDays?: 2 | 3;
}>;

function planCreate(command: WorkCommand, exists: boolean): Candidate[] | WorkCommandResult {
  if (command.contract === undefined) {
    return refuse("CONTRACT_INVALID", "contract is required");
  }
  const parsed = boundedWorkContractSchema.safeParse(command.contract);
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
        payloadVersion: 3,
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
  trustedWorktreeSha256?: string,
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
        ...(trustedWorktreeSha256 !== undefined ? { worktreeSha256: trustedWorktreeSha256 } : {}),
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

const COMMAND_FIELDS: Readonly<Record<WorkCommand["intent"], readonly string[]>> = {
  create: ["contract"],
  assign: ["roleAssignmentId"],
  record_evidence: ["evidence"],
  request_review: [],
  record_ruling: ["ruling"],
  grant_turns: ["turnsGranted", "budgetRevision"],
  rescope: ["contract", "expectedContractRevision", "proposalId"],
  close_incomplete: ["reason"],
  nudge: ["roleAssignmentId", "note"],
  suppress_nudge: ["disposition"],
  withdraw_ruling: ["rulingId"],
  ask_question: ["question"],
  propose_rescope: ["proposalId", "expectedContractRevision", "contract"],
  decline_rescope: ["proposalId", "reason"],
  dispute_send_back: ["rulingId", "statement"],
};

function validateCommandFields(command: WorkCommand): string[] {
  const common = ["commandId", "projectId", "expectedRevision", "actor", "intent", "workItemId"];
  const allowed = new Set([...common, ...(COMMAND_FIELDS[command.intent] ?? [])]);
  const extra = Object.keys(command).filter((key) => !allowed.has(key));
  if (extra.length > 0) return [`unexpected command fields: ${extra.sort().join(", ")}`];
  return [];
}

function planAskQuestion(command: WorkCommand): Candidate[] | WorkCommandResult {
  if (!speechText(command.question)) {
    return refuse("COMMAND_INVALID", "question must be non-empty and at most 2000 characters");
  }
  return [
    {
      kind: "work.question_asked",
      payload: { workItemId: command.workItemId, question: command.question },
      source: "adapter",
      trust: "reported",
    },
  ];
}

function planProposeRescope(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
  roleAssignmentId: string | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (!item.contract) return refuse("CONTRACT_MISSING", `${command.workItemId} has no contract`);
  if (
    typeof command.expectedContractRevision !== "number" ||
    command.expectedContractRevision !== item.contractRevision
  ) {
    return refuse(
      "STALE_CONTRACT_REVISION",
      `expected contract revision ${String(item.contractRevision)}`,
    );
  }
  if (!command.proposalId || !RESCOPE_PROPOSAL_ID.test(command.proposalId)) {
    return refuse("COMMAND_INVALID", "proposalId is missing or malformed");
  }
  if (!roleAssignmentId) {
    return refuse("NOT_AUTHORIZED", "an authenticated role assignment is required");
  }
  if (command.contract === undefined) {
    return refuse("CONTRACT_INVALID", "replacement contract is required");
  }
  const parsed = boundedWorkContractSchema.safeParse(command.contract);
  if (!parsed.success) {
    return refuse(
      "CONTRACT_INVALID",
      ...parsed.error.issues.map(
        (found) => `${found.path.join(".") || "(root)"}: ${found.message}`,
      ),
    );
  }
  return [
    {
      kind: "work.rescope_proposed",
      payload: {
        workItemId: command.workItemId,
        proposalId: command.proposalId,
        expectedContractRevision: command.expectedContractRevision,
        contract: parsed.data,
      },
      roleAssignmentId,
      source: "adapter",
      trust: "reported",
    },
  ];
}

function planDeclineRescope(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (!command.proposalId || !RESCOPE_PROPOSAL_ID.test(command.proposalId)) {
    return refuse("COMMAND_INVALID", "proposalId is missing or malformed");
  }
  if (!speechText(command.reason)) {
    return refuse(
      "COMMAND_INVALID",
      "decline requires a non-empty reason of at most 2000 characters",
    );
  }
  return [
    {
      kind: "work.rescope_declined",
      payload: {
        workItemId: command.workItemId,
        proposalId: command.proposalId,
        reason: command.reason,
      },
      actor: command.actor,
    },
  ];
}

function planDisputeSendBack(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
  roleAssignmentId: string | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (!command.rulingId || !RULING_ID.test(command.rulingId)) {
    return refuse("COMMAND_INVALID", "rulingId is missing or malformed");
  }
  if (!speechText(command.statement)) {
    return refuse(
      "COMMAND_INVALID",
      "dispute statement must be non-empty and at most 2000 characters",
    );
  }
  if (!roleAssignmentId) {
    return refuse("NOT_AUTHORIZED", "an authenticated role assignment is required");
  }
  return [
    {
      kind: "work.send_back_disputed",
      payload: {
        workItemId: command.workItemId,
        rulingId: command.rulingId,
        statement: command.statement,
      },
      roleAssignmentId,
      source: "adapter",
      trust: "reported",
    },
  ];
}

function speechText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_SPEECH_TEXT;
}

function normalizeCommandEventIds(log: readonly unknown[]): string[] {
  return log.flatMap((raw) => {
    if (typeof raw !== "object" || raw === null) return [];
    const eventId = (raw as Record<string, unknown>).eventId;
    return typeof eventId === "string" ? [eventId] : [];
  });
}

function planRuling(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
  before: WorkTruthState,
  log: readonly unknown[],
  now: string,
  trustedWorktreeSha256?: string,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  const ruling: unknown = command.ruling;
  if (typeof ruling !== "object" || ruling === null || Array.isArray(ruling)) {
    return refuse("COMMAND_INVALID", "ruling is required");
  }
  const data = ruling as Record<string, unknown>;
  const allowed = ["decision", "reason", "note", "resurfaceAt"];
  const extra = Object.keys(data).filter((key) => !allowed.includes(key));
  const issues: string[] = [];
  if (extra.length > 0) issues.push(`unexpected ruling fields: ${extra.sort().join(", ")}`);
  if (
    !(["accept", "accept_with_exception", "send_back", "defer"] as unknown[]).includes(
      data.decision,
    )
  ) {
    issues.push("ruling.decision is not supported");
  }
  for (const key of ["reason", "note"] as const) {
    if (data[key] !== undefined && (typeof data[key] !== "string" || data[key].length > MAX_NOTE)) {
      issues.push(`ruling.${key} must be a string of at most ${String(MAX_NOTE)} characters`);
    }
  }
  if (
    ["accept_with_exception", "send_back", "defer"].includes(String(data.decision)) &&
    (typeof data.reason !== "string" || data.reason.trim().length === 0)
  ) {
    issues.push(`ruling.${String(data.decision)} requires a non-empty reason`);
  }
  if (data.decision === "defer") {
    if (
      typeof data.resurfaceAt !== "string" ||
      !data.resurfaceAt.endsWith("Z") ||
      !Number.isFinite(Date.parse(data.resurfaceAt))
    ) {
      issues.push("ruling.defer requires a UTC resurfaceAt");
    } else if (Date.parse(data.resurfaceAt) <= Date.parse(now)) {
      issues.push("ruling.resurfaceAt must be in the future");
    }
  } else if (data.resurfaceAt !== undefined) {
    issues.push("ruling.resurfaceAt is only allowed for defer");
  }
  if (issues.length > 0) return refuse("COMMAND_INVALID", ...issues);

  const decision = data.decision as WorkRulingInput["decision"];
  if (decision === "accept") {
    if (trustedWorktreeSha256 === undefined) {
      return refuse("WORKTREE_DIGEST_MISSING", "final review requires a trusted worktree digest");
    }
    const judgement = judgeDoneClaim({ log, workItemId: command.workItemId });
    if (!judgement.ok) {
      return refuse(
        "DONE_NOT_SUPPORTED",
        "ordinary acceptance requires checked evidence for every obligation",
      );
    }
    const digestIssue = finalEvidenceDigestIssue(log, before, item, trustedWorktreeSha256);
    if (digestIssue) return refuse(digestIssue.code, digestIssue.message);
  }
  const evidenceVersions = Object.values(before.evidence)
    .filter((entry) => entry.workItemId === command.workItemId)
    .map(({ evidenceId, version }) => ({ evidenceId, version }))
    .sort((left, right) =>
      left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0,
    );
  return [
    {
      kind: "work.ruling_recorded",
      payload: {
        workItemId: command.workItemId,
        rulingId: `ruling_${command.commandId}`,
        decision,
        sourceWorkRevision: item.revision,
        evidenceVersions,
        ...(typeof data.reason === "string" ? { reason: data.reason } : {}),
        ...(typeof data.note === "string" ? { note: data.note } : {}),
        ...(typeof data.resurfaceAt === "string" ? { resurfaceAt: data.resurfaceAt } : {}),
      },
    },
  ];
}

function finalEvidenceDigestIssue(
  log: readonly unknown[],
  state: WorkTruthState,
  item: WorkTruthState["workItems"][string],
  worktreeSha256: string,
): { code: string; message: string } | undefined {
  const obligations =
    item.contract?.evidenceObligations ??
    item.requiredEvidenceKinds.map((kind) => ({ kind, description: kind }));
  const events = log
    .flatMap((raw) => {
      const parsed = parseProjectEvent(raw);
      return parsed.ok ? [parsed.value] : [];
    })
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.receivedAt.localeCompare(right.receivedAt) ||
        left.eventId.localeCompare(right.eventId),
    );
  for (const obligation of obligations) {
    const latest = events
      .filter(
        (event) =>
          event.kind === "evidence.recorded" &&
          event.payload.workItemId === item.workItemId &&
          event.payload.kind === obligation.kind,
      )
      .at(-1);
    if (!latest || latest.trust !== "verified" || latest.payload.result !== "passed") {
      return {
        code: "DONE_NOT_SUPPORTED",
        message: `${obligation.kind} has no latest checked passing evidence`,
      };
    }
    if (latest.payload.worktreeSha256 === undefined) {
      return {
        code: "WORKTREE_DIGEST_MISSING",
        message: `${obligation.kind} evidence has no recorded worktree digest`,
      };
    }
    if (latest.payload.worktreeSha256 !== worktreeSha256) {
      return {
        code: "WORKTREE_DIGEST_MISMATCH",
        message: `${obligation.kind} evidence was recorded against a different worktree`,
      };
    }
    const recorded = state.evidence[latest.payload.evidenceId as string];
    if (!recorded || recorded.version !== latest.payload.version || recorded.trust !== "verified") {
      return {
        code: "DONE_NOT_SUPPORTED",
        message: `${obligation.kind} does not resolve to the latest verified evidence record`,
      };
    }
  }
  return undefined;
}

function planGrantTurns(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (!Number.isInteger(command.turnsGranted) || (command.turnsGranted ?? 0) <= 0) {
    return refuse("COMMAND_INVALID", "turnsGranted must be a positive integer");
  }
  if (!Number.isInteger(command.budgetRevision) || (command.budgetRevision ?? 0) <= 0) {
    return refuse("COMMAND_INVALID", "budgetRevision must be a positive integer");
  }
  if (
    item.turnBudget?.budgetRecorded !== true ||
    command.budgetRevision !== item.turnBudget.budgetRevision
  ) {
    return refuse(
      "TURN_BUDGET_INVALID",
      `expected budget revision ${String(item.turnBudget?.budgetRevision)}`,
    );
  }
  return [
    {
      kind: "work.turns_granted",
      payload: {
        workItemId: command.workItemId,
        turnsGranted: command.turnsGranted,
        budgetRevision: command.budgetRevision,
      },
    },
  ];
}

function planRescope(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (command.contract === undefined)
    return refuse("CONTRACT_INVALID", "replacement contract is required");
  const contract = boundedWorkContractSchema.safeParse(command.contract);
  if (!contract.success) {
    return refuse(
      "CONTRACT_INVALID",
      ...contract.error.issues.map(
        (found) => `${found.path.join(".") || "(root)"}: ${found.message}`,
      ),
    );
  }
  if (item.state === "active")
    return refuse("WORK_RUN_ACTIVE", "work cannot be re-scoped while its runner is active");
  const expectedContractRevision = command.expectedContractRevision;
  if (
    typeof expectedContractRevision !== "number" ||
    !Number.isInteger(expectedContractRevision) ||
    expectedContractRevision !== item.contractRevision
  ) {
    return refuse(
      "STALE_CONTRACT_REVISION",
      `expected contract revision ${String(item.contractRevision)}`,
    );
  }
  if (!item.contract)
    return refuse("CONTRACT_MISSING", `${command.workItemId} has no contract to re-scope`);
  const proposal = command.proposalId
    ? item.speechActs?.find(
        (entry) =>
          entry.kind === "work.rescope_proposed" && entry.proposalId === command.proposalId,
      )
    : undefined;
  if (
    command.proposalId &&
    (!proposal || proposal.kind !== "work.rescope_proposed" || proposal.status !== "open")
  ) {
    return refuse(
      "WORK_SPEECH_ACT_DISPOSITION_CONFLICT",
      "linked approval requires one open rescope proposal for this work item",
    );
  }
  return [
    {
      kind: "work.rescoped",
      payload: {
        workItemId: command.workItemId,
        expectedContractRevision,
        contractRevision: expectedContractRevision + 1,
        contract: contract.data,
        ...(command.proposalId ? { proposalId: command.proposalId } : {}),
      },
      ...(command.proposalId ? { actor: command.actor } : {}),
    },
  ];
}

function planCloseIncomplete(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (
    typeof command.reason !== "string" ||
    command.reason.trim().length === 0 ||
    command.reason.length > MAX_NOTE
  ) {
    return refuse(
      "COMMAND_INVALID",
      "close-incomplete requires a non-empty reason of at most 280 characters",
    );
  }
  if (
    item.state === "completed" ||
    item.state === "cancelled" ||
    item.state === "closed_incomplete"
  ) {
    return refuse("WORK_ALREADY_TERMINAL", `${command.workItemId} is already terminal`);
  }
  return [
    {
      kind: "work.closed_incomplete",
      payload: {
        workItemId: command.workItemId,
        fromRevision: item.revision,
        reason: command.reason,
      },
    },
  ];
}

function planNudge(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (!command.roleAssignmentId || !ROLE_ASSIGNMENT_ID.test(command.roleAssignmentId)) {
    return refuse("COMMAND_INVALID", "roleAssignmentId is missing or malformed");
  }
  if (
    typeof command.note !== "string" ||
    command.note.trim().length === 0 ||
    command.note.length > MAX_NOTE
  ) {
    return refuse("COMMAND_INVALID", "nudge requires a non-empty note of at most 280 characters");
  }
  if (item.assignment?.roleAssignmentId !== command.roleAssignmentId) {
    return refuse("INVALID_NUDGE", "nudge target must be the work item's current assignment");
  }
  return [
    {
      kind: "work.nudged",
      payload: {
        workItemId: command.workItemId,
        roleAssignmentId: command.roleAssignmentId,
        note: command.note,
      },
      roleAssignmentId: command.roleAssignmentId,
    },
  ];
}

function planSuppressNudge(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (command.disposition !== "snooze" && command.disposition !== "dismiss") {
    return refuse("COMMAND_INVALID", "disposition must be snooze or dismiss");
  }
  return [
    {
      kind: "work.nudge_suppressed",
      payload: { workItemId: command.workItemId, disposition: command.disposition },
      suppressionDays: command.disposition === "snooze" ? 2 : 3,
    },
  ];
}

function planWithdrawRuling(
  command: WorkCommand,
  item: WorkTruthState["workItems"][string] | undefined,
  before: WorkTruthState,
): Candidate[] | WorkCommandResult {
  if (!item) return refuse("WORK_ITEM_NOT_FOUND", `${command.workItemId} does not exist`);
  if (typeof command.rulingId !== "string" || command.rulingId.length === 0) {
    return refuse("COMMAND_INVALID", "rulingId is required");
  }
  const ruling = before.rulings?.[command.rulingId];
  if (
    !ruling ||
    ruling.workItemId !== command.workItemId ||
    item.currentRulingId !== ruling.rulingId ||
    ruling.withdrawn
  ) {
    return refuse(
      "RULING_WITHDRAWAL_REFUSED",
      "only the current, unwithdrawn ruling may be withdrawn",
    );
  }
  return [
    {
      kind: "ruling.withdrawn",
      payload: {
        workItemId: command.workItemId,
        rulingId: command.rulingId,
        evidenceVersions: ruling.evidenceVersions,
      },
    },
  ];
}
