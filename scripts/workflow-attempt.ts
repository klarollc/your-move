/**
 * One workflow attempt as a loop over injected dependencies (workflow-proof W5d).
 *
 * Preflight, then up to `maxTurns` turns. After each step the bridge plans the canonical events;
 * the loop appends them and obeys `proceed`. It never decides state itself. A refused append stops
 * the attempt at once: a run must not go on without a record. The session is always closed.
 *
 * Known limit, stated plainly: if the session never starts there is no active item to halt, so
 * nothing is appended and the failure is reported only in the result (the runner exits non-zero).
 */
import type { PostureRecord } from "@cuckcode/contracts";

import {
  planHalt,
  planPreflight,
  planTurn,
  type PlanResult,
  type TurnSummary,
} from "./workflow-bridge.js";

export type AppendOutcome =
  Readonly<{ ok: true; revision: number }> | Readonly<{ ok: false; code: string; detail: string }>;

export type AttemptDeps = Readonly<{
  readLog(): Promise<Readonly<{ events: readonly unknown[]; revision: number }>>;
  append(events: readonly unknown[], expectedRevision: number): Promise<AppendOutcome>;
  startSession(): Promise<Readonly<{ posture: PostureRecord; close(): Promise<void> }>>;
  runTurn(
    number: number,
  ): Promise<Readonly<{ summary: TurnSummary; claimDone: boolean; claimBlocked?: string }>>;
  now(): string;
}>;

export type AttemptOutcome =
  | "blocked_before_turn"
  | "hard_stop"
  | "review_requested"
  | "claim_unsupported"
  | "role_blocked"
  | "turn_cap"
  | "runtime_failure"
  | "log_refused"
  | "rejected";

export type AttemptResult = Readonly<{
  outcome: AttemptOutcome;
  turnsRun: number;
  notes: readonly string[];
}>;

export async function runWorkflowAttempt(
  input: Readonly<{
    deps: AttemptDeps;
    projectId: string;
    workItemId: string;
    runId: string;
    neededPaths: readonly string[];
    maxTurns: number;
  }>,
): Promise<AttemptResult> {
  const { deps } = input;
  const ids = { projectId: input.projectId, workItemId: input.workItemId };
  let session: Awaited<ReturnType<AttemptDeps["startSession"]>>;
  try {
    session = await deps.startSession();
  } catch (error) {
    return {
      outcome: "runtime_failure",
      turnsRun: 0,
      notes: [`the session did not start: ${messageOf(error)}`, "nothing was recorded"],
    };
  }
  let turnsRun = 0;
  const commit = async (
    plan: PlanResult,
  ): Promise<{ plan: Extract<PlanResult, { ok: true }> } | { stop: AttemptResult }> => {
    if (!plan.ok) {
      return { stop: { outcome: "rejected", turnsRun, notes: [...plan.issues] } };
    }
    const log = await deps.readLog();
    const appended = await deps.append(plan.events, log.revision);
    if (!appended.ok) {
      return {
        stop: {
          outcome: "log_refused",
          turnsRun,
          notes: [`the log refused the append: ${appended.code}: ${appended.detail}`],
        },
      };
    }
    return { plan };
  };
  const fresh = async () => ({ ...ids, now: deps.now(), log: (await deps.readLog()).events });
  try {
    const pre = await commit(
      planPreflight({
        ...(await fresh()),
        runId: input.runId,
        posture: session.posture,
        neededPaths: input.neededPaths,
      }),
    );
    if ("stop" in pre) return pre.stop;
    if (!pre.plan.proceed) {
      return { outcome: "blocked_before_turn", turnsRun: 0, notes: pre.plan.notes };
    }
    for (let number = 1; number <= input.maxTurns; number += 1) {
      let turn: Awaited<ReturnType<AttemptDeps["runTurn"]>>;
      try {
        turn = await deps.runTurn(number);
      } catch (error) {
        const halted = await commit(
          planHalt({
            ...(await fresh()),
            runId: `${input.runId}h`,
            reason: "runtime_failure",
            detail: messageOf(error),
          }),
        );
        if ("stop" in halted) return halted.stop;
        return { outcome: "runtime_failure", turnsRun, notes: halted.plan.notes };
      }
      turnsRun = number;
      const step = await commit(
        planTurn({
          ...(await fresh()),
          runId: `${input.runId}t${String(number)}`,
          turn: turn.summary,
          claimDone: turn.claimDone,
          ...(turn.claimBlocked !== undefined ? { claimBlocked: turn.claimBlocked } : {}),
        }),
      );
      if ("stop" in step) return step.stop;
      switch (step.plan.outcome) {
        case "hard_stop":
          return { outcome: "hard_stop", turnsRun, notes: step.plan.notes };
        case "review_requested":
          return { outcome: "review_requested", turnsRun, notes: step.plan.notes };
        case "role_blocked":
          return { outcome: "role_blocked", turnsRun, notes: step.plan.notes };
        case "done_unsupported":
          return { outcome: "claim_unsupported", turnsRun, notes: step.plan.notes };
        default:
          break;
      }
    }
    const capped = await commit(
      planHalt({
        ...(await fresh()),
        runId: `${input.runId}h`,
        reason: "turn_cap",
        detail: `${String(input.maxTurns)} turns used`,
      }),
    );
    if ("stop" in capped) return capped.stop;
    return { outcome: "turn_cap", turnsRun, notes: capped.plan.notes };
  } finally {
    await session.close();
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
