/**
 * Runner-to-canonical bridge (workflow-proof W5d, spec §7).
 *
 * Pure planning: given the current log and what a run step observed, return the canonical events
 * the runner must append, and whether the run may proceed. Nothing here talks to a runtime, a
 * filesystem or a clock. The runner appends the events (directly to the log, never over HTTP: it
 * must not hold the server's session credentials) and acts on `proceed`.
 *
 * The role's own `done` claim never moves state. It is checked by the W4 rule against verified
 * evidence; an unsupported claim is recorded and the item stays active.
 *
 * Every plan is dry-run through the reducer. A plan that would add a reducer issue is rejected
 * whole (`BRIDGE_REJECTED`), never partly applied, because the reducer would otherwise drop or
 * mis-apply it silently.
 *
 * Trust: facts the runner measured itself (posture read-back, turn records) are source `adapter`,
 * trust `verified`. The role's claim is source `adapter`, trust `reported`.
 */
import { parseProjectEvent, type PostureRecord } from "@cuckcode/contracts";
import {
  checkReadiness,
  nextEventTimes,
  judgeDoneClaim,
  reconcileRecords,
  replayProject,
  type WorkItemTruth,
} from "@cuckcode/domain";

export type BridgeContext = Readonly<{
  projectId: string;
  workItemId: string;
  runId: string;
  now: string;
  log: readonly unknown[];
}>;

export type TurnSummary = Readonly<{
  number: number;
  itemTypes: readonly string[];
  streamedPaths: readonly string[];
  worktreePaths: readonly string[];
  partial: boolean;
  partialReasons: readonly string[];
}>;

export type PlanResult =
  | Readonly<{
      ok: true;
      events: readonly Record<string, unknown>[];
      proceed: boolean;
      outcome:
        | "started"
        | "blocked"
        | "continue"
        | "review_requested"
        | "done_unsupported"
        | "role_blocked"
        | "hard_stop";
      notes: readonly string[];
    }>
  | Readonly<{ ok: false; code: "BRIDGE_REJECTED"; issues: readonly string[] }>;

type Condition = Readonly<{
  reasonCode: string;
  summary: string;
  waitingOn: Readonly<{ kind: string }>;
  requestedAction: Readonly<{ kind: string; summary: string }>;
}>;

const clamp = (text: string): string => (text.length <= 280 ? text : `${text.slice(0, 277)}...`);
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const rejected = (...issues: string[]): PlanResult => ({
  ok: false,
  code: "BRIDGE_REJECTED",
  issues,
});

class Builder {
  readonly events: Record<string, unknown>[] = [];
  constructor(
    private readonly ctx: BridgeContext,
    private readonly stage: string,
    private readonly revision: number,
  ) {}

  private envelope(
    kind: string,
    source: string,
    trust: string,
    payload: Record<string, unknown>,
  ): void {
    const seq = this.events.length + 1;
    this.events.push({
      schemaVersion: 1,
      eventId: `event_${this.ctx.runId}_${this.stage}_${String(seq)}`,
      projectId: this.ctx.projectId,
      workItemId: this.ctx.workItemId,
      providerRunId: this.ctx.runId,
      kind,
      occurredAt: this.ctx.now,
      receivedAt: this.ctx.now,
      source,
      trust,
      payload,
    });
  }

  evidence(
    kind: string,
    result: "passed" | "failed",
    extra: Record<string, unknown>,
    trust: "verified" | "reported" = "verified",
  ): void {
    const seq = this.events.length + 1;
    this.envelope("evidence.recorded", "adapter", trust, {
      evidenceId: `evidence_${this.ctx.runId}_${this.stage}_${String(seq)}`,
      workItemId: this.ctx.workItemId,
      kind,
      version: 1,
      result,
      ...extra,
    });
  }

  transition(toState: string, condition?: Condition): void {
    this.envelope("work.transitioned", "adapter", "verified", {
      payloadVersion: 3,
      workItemId: this.ctx.workItemId,
      fromRevision: this.revision,
      toState,
      ...(condition ? { condition } : {}),
    });
  }
}

function finish(
  ctx: BridgeContext,
  unstamped: readonly Record<string, unknown>[],
  result: Extract<PlanResult, { ok: true }> extends infer R
    ? Omit<R & object, "events" | "ok">
    : never,
): PlanResult {
  // Stamped after everything already in the log, so canonical replay applies them last.
  const times = nextEventTimes(ctx.log, ctx.now, unstamped.length);
  const events: Record<string, unknown>[] = unstamped.map((event, index) => ({
    ...event,
    occurredAt: times[index] as string,
    receivedAt: times[index] as string,
  }));
  for (const event of events) {
    const parsed = parseProjectEvent(event);
    if (!parsed.ok) {
      return rejected(`${String(event.eventId)}: ${parsed.error.details.join("; ")}`);
    }
  }
  const before = replayProject(ctx.log).work.issues.length;
  const after = replayProject([...ctx.log, ...events]).work;
  const fresh = after.issues.slice(before);
  if (fresh.length > 0) return rejected(...fresh.map((issue) => `${issue.code}: ${issue.message}`));
  return { ok: true, events, ...result };
}

function itemOf(ctx: BridgeContext, wanted: string): WorkItemTruth | PlanResult {
  const item = replayProject(ctx.log).work.workItems[ctx.workItemId];
  if (!item) return rejected(`${ctx.workItemId} is not in the log`);
  if (item.state !== wanted) {
    return rejected(`${ctx.workItemId} is ${item.state}; this step needs it ${wanted}`);
  }
  return item;
}

const isPlan = (value: WorkItemTruth | PlanResult): value is PlanResult => "ok" in value;

export function planPreflight(
  input: BridgeContext & Readonly<{ posture: PostureRecord; neededPaths: readonly string[] }>,
): PlanResult {
  const item = itemOf(input, "assigned");
  if (isPlan(item)) return item;
  if (!item.contract) return rejected(`${input.workItemId} has no work contract`);
  const builder = new Builder(input, "pre", item.revision);
  const readiness = checkReadiness({
    contract: item.contract,
    posture: input.posture,
    neededPaths: input.neededPaths,
  });
  builder.evidence("posture-record", input.posture.match ? "passed" : "failed", {
    posture: input.posture,
  });
  if (readiness.ok) {
    // `active` raises no attention, so the transition takes no condition.
    builder.transition("active");
    return finish(input, builder.events, {
      proceed: true,
      outcome: "started",
      notes: readiness.uninlined.length > 0 ? [readiness.readBasis] : [],
    });
  }
  const condition: Condition =
    readiness.code === "BLOCKED_CANNOT_READ" && readiness.condition
      ? readiness.condition
      : {
          reasonCode: "awaiting_permission",
          summary:
            readiness.code === "POSTURE_MISMATCH"
              ? "The granted posture differs from the requested posture."
              : "The requested posture is broader than the contract's permission ceiling.",
          waitingOn: { kind: "manager" },
          requestedAction: {
            kind: "redirect",
            summary: "Rule on the difference, or relaunch with a matching posture.",
          },
        };
  builder.transition("blocked", { ...condition, summary: clamp(condition.summary) });
  const notes =
    readiness.code === "BLOCKED_CANNOT_READ"
      ? [`blocked before turn 1: ${(readiness.missingPaths ?? []).join(", ")} not inlined`]
      : [`blocked before turn 1: ${readiness.code}`];
  return finish(input, builder.events, { proceed: false, outcome: "blocked", notes });
}

export function planTurn(
  input: BridgeContext & Readonly<{ turn: TurnSummary; claimDone: boolean; claimBlocked?: string }>,
): PlanResult {
  const item = itemOf(input, "active");
  if (isPlan(item)) return item;
  const builder = new Builder(input, `t${String(input.turn.number)}`, item.revision);
  const reconciliation = reconcileRecords({
    log: input.log,
    workItemId: input.workItemId,
    displayedState: "active",
    streamedPaths: input.turn.streamedPaths,
    worktreePaths: input.turn.worktreePaths,
  });
  const stopped = !reconciliation.ok;
  builder.evidence("turn-record", input.turn.partial || stopped ? "failed" : "passed", {
    turn: input.turn.number,
    itemTypes: [...input.turn.itemTypes],
    paths: sortedUnique(input.turn.streamedPaths),
    worktreePaths: sortedUnique(input.turn.worktreePaths),
    partial: input.turn.partial,
    partialReasons: [...input.turn.partialReasons],
    ...(reconciliation.ok
      ? {}
      : { mismatches: reconciliation.mismatches.map((entry) => entry.detail) }),
  });
  if (!reconciliation.ok) {
    const details = reconciliation.mismatches.map((entry) => entry.detail).join("; ");
    builder.transition("blocked", {
      reasonCode: "awaiting_decision",
      summary: clamp(`Hard stop: ${details}`),
      waitingOn: { kind: "manager" },
      requestedAction: {
        kind: "redirect",
        summary: "Decide whether to continue, redirect or stop this run.",
      },
    });
    return finish(input, builder.events, {
      proceed: false,
      outcome: "hard_stop",
      notes: reconciliation.mismatches.map((entry) => entry.detail),
    });
  }
  if (input.claimBlocked !== undefined) {
    // The role's own structured end state (spec §4): it cannot proceed and says why. That is a
    // question for the manager, not a failure.
    builder.transition("blocked", {
      reasonCode: "awaiting_clarification",
      summary: clamp(`The role reports it is blocked: ${input.claimBlocked}`),
      waitingOn: { kind: "manager" },
      requestedAction: {
        kind: "answer_question",
        summary: "Answer the role's question, or redirect the work.",
      },
    });
    return finish(input, builder.events, {
      proceed: false,
      outcome: "role_blocked",
      notes: [`the role reports blocked: ${input.claimBlocked}`],
    });
  }
  if (!input.claimDone) {
    return finish(input, builder.events, { proceed: true, outcome: "continue", notes: [] });
  }
  const judgement = judgeDoneClaim({ log: input.log, workItemId: input.workItemId });
  if (judgement.ok) {
    builder.transition("review_requested", {
      reasonCode: "review_requested",
      summary: "Every evidence obligation has verified passing evidence; acceptance is yours.",
      waitingOn: { kind: "manager" },
      requestedAction: { kind: "approve", summary: "Accept, redirect or decline this work." },
    });
    return finish(input, builder.events, {
      proceed: false,
      outcome: "review_requested",
      notes: [],
    });
  }
  builder.evidence(
    "done-claim",
    "failed",
    {
      code: judgement.code,
      missingKinds: [...judgement.missingKinds],
      failedKinds: [...judgement.failedKinds],
      unverifiedKinds: [...judgement.unverifiedKinds],
    },
    "reported",
  );
  return finish(input, builder.events, {
    proceed: true,
    outcome: "done_unsupported",
    notes: [
      `done claim not supported: missing ${judgement.missingKinds.join(", ") || "none"}; failed ${
        judgement.failedKinds.join(", ") || "none"
      }; unverified ${judgement.unverifiedKinds.join(", ") || "none"}`,
    ],
  });
}

/** Halt an active run (turn cap, runtime failure): record why, then block and escalate. */
export function planHalt(
  input: BridgeContext & Readonly<{ reason: "turn_cap" | "runtime_failure"; detail: string }>,
): PlanResult {
  const item = itemOf(input, "active");
  if (isPlan(item)) return item;
  const builder = new Builder(input, "halt", item.revision);
  builder.evidence("run-halt", "failed", { reason: input.reason, detail: input.detail });
  builder.transition("blocked", {
    reasonCode: "awaiting_decision",
    summary: clamp(
      `Run halted (${input.reason === "turn_cap" ? "turn cap reached" : "runtime failure"}): ${input.detail}`,
    ),
    waitingOn: { kind: "manager" },
    requestedAction: {
      kind: "redirect",
      summary: "Decide whether to continue, redirect or stop this work.",
    },
  });
  return finish(input, builder.events, {
    proceed: false,
    outcome: "hard_stop",
    notes: [`halted: ${input.reason}: ${input.detail}`],
  });
}
