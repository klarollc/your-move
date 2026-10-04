import {
  classifyTurnError,
  describeFailure,
  type FailureClassification,
} from "./failure-classification.js";
import type { SupervisorEvent } from "./supervisor.js";

/**
 * One turn, run the same way by every caller (R6.1–R6.4, R6.6; CP-3).
 *
 * Before this, the kickoff session waited 180 s and the role exercise 90 s on a wall clock that
 * ignored whether the turn was still streaming, neither ever interrupted a turn it gave up on, and
 * both discarded Codex's own retry reports and failure class. Pass 9 ended at that clock; pass 8's
 * "stream disconnected" arrived with its class thrown away. Here:
 *
 * - the wait ends on this turn's `turn/completed`, or after `idleMs` with no notification for the
 *   turn, or at `hardMs` however busy it is — and on either limit the turn is interrupted, not
 *   abandoned;
 * - every `error` notification for the turn is kept, with `willRetry` and its class;
 * - a server request the supervisor refused fails the turn by name;
 * - a transport-class failure that produced no output is re-submitted once after a backoff, if the
 *   run's budget allows (CX-4). Nothing else is retried.
 *
 * A re-submitted turn is a new turn on the same thread: the failed one stays in the thread's
 * history. Codex 0.157 has no rollback, and inventing one would be worse.
 */
export type Clock = {
  now: () => number;
  setTimer: (ms: number, fire: () => void) => () => void;
  sleep: (ms: number) => Promise<void>;
};

export const systemClock: Clock = {
  now: () => performance.now(),
  setTimer: (ms, fire) => {
    const timer = setTimeout(fire, ms);
    return () => clearTimeout(timer);
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type RetryBudget = { remaining: number };
export function createRetryBudget(total: number): RetryBudget {
  return { remaining: total };
}

/** CX-4: two transport retries per run. A run is one process, so the default budget is too. */
export const RUN_RETRY_BUDGET: RetryBudget = createRetryBudget(2);

const MAX_TIMER_MS = 2 ** 31 - 1;

/** CX-3 and CX-4. One value set for every live script. */
export const TURN_LIMITS = {
  idleMs: 180_000,
  hardMs: 900_000,
  interruptGraceMs: 15_000,
  retryBackoffMs: 30_000,
  startTimeoutMs: 60_000,
  maxRetriesPerTurn: 1,
};

export type TurnSupervisor = {
  request: (
    method: string,
    params: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<unknown>;
  subscribe: (listener: (event: SupervisorEvent) => void) => () => void;
};

export type ObservedRetry = FailureClassification & { willRetry: boolean; atMs: number };

export type TurnAttempt = {
  attempt: number;
  transportRetry: boolean;
  turnId: string | null;
  outcome:
    | "completed"
    | "failed"
    | "interrupted"
    | "idleTimeout"
    | "hardTimeout"
    | "serverRequestRefused"
    | "runtimeFailure";
  status: string | null;
  failure: FailureClassification | null;
  retries: ObservedRetry[];
  refusedServerRequest: string | null;
  lastMethod: string | null;
  elapsedMs: number;
};

export type CompletedTurn = { id: string; status: string; items: unknown[] };

export type TurnRunResult =
  | { ok: true; turn: CompletedTurn; streamedItems: unknown[]; attempts: TurnAttempt[] }
  | {
      ok: false;
      code: string;
      detail: string;
      turn: CompletedTurn | null;
      /**
       * Items this turn's final attempt announced through `item/completed`. `turn/completed.items`
       * can omit them (DF-044), so a judge of what the turn did must read both.
       */
      streamedItems: unknown[];
      attempts: TurnAttempt[];
    };

type Options = {
  threadId: string;
  input: readonly unknown[];
  clock?: Clock;
  retryBudget?: RetryBudget;
  limits?: Partial<typeof TURN_LIMITS>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function turnIdOf(params: Record<string, unknown>): string | undefined {
  if (typeof params.turnId === "string") return params.turnId;
  const turn = params.turn;
  return isRecord(turn) && typeof turn.id === "string" ? turn.id : undefined;
}

function asCompletedTurn(value: unknown): CompletedTurn | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    status: typeof value.status === "string" ? value.status : "unknown",
    items: Array.isArray(value.items) ? value.items : [],
  };
}

/** Anything the model produced. A user message echo is not output. */
const producedOutput = (turn: CompletedTurn | null): boolean =>
  (turn?.items ?? []).some((item) => !(isRecord(item) && item.type === "userMessage"));

type AttemptEnd = {
  attempt: TurnAttempt;
  turn: CompletedTurn | null;
  streamedItems: unknown[];
  code?: string;
  detail?: string;
};

function runAttempt(
  supervisor: TurnSupervisor,
  options: Options & { limits: typeof TURN_LIMITS; clock: Clock },
  attemptNumber: number,
  transportRetry: boolean,
): Promise<AttemptEnd> {
  const { clock, limits, threadId } = options;
  const startedAt = clock.now();
  const attempt: TurnAttempt = {
    attempt: attemptNumber,
    transportRetry,
    turnId: null,
    outcome: "runtimeFailure",
    status: null,
    failure: null,
    retries: [],
    refusedServerRequest: null,
    lastMethod: null,
    elapsedMs: 0,
  };

  return new Promise<AttemptEnd>((resolve) => {
    let settled = false;
    let expiring: TurnAttempt["outcome"] | null = null;
    const buffered: SupervisorEvent[] = [];
    let cancelIdle: () => void = () => undefined;
    let cancelGrace: () => void = () => undefined;
    let cancelHard: () => void = () => undefined;
    let unsubscribe: () => void = () => undefined;

    const streamed: unknown[] = [];
    const finish = (
      end: Omit<AttemptEnd, "attempt" | "streamedItems">,
      outcome: TurnAttempt["outcome"],
    ) => {
      if (settled) return;
      settled = true;
      cancelIdle();
      cancelGrace();
      cancelHard();
      unsubscribe();
      attempt.outcome = outcome;
      attempt.elapsedMs = clock.now() - startedAt;
      resolve({ attempt, streamedItems: streamed, ...end });
    };

    const interrupt = (outcome: TurnAttempt["outcome"], code: string, detail: string) => {
      if (settled || expiring !== null) return;
      expiring = outcome;
      cancelIdle();
      cancelHard();
      const giveUp = () =>
        finish({ turn: null, code, detail: `${detail}; no completion after interrupt` }, outcome);
      if (attempt.turnId === null) {
        giveUp();
        return;
      }
      pendingExpiry = { code, detail };
      supervisor
        .request("turn/interrupt", { threadId, turnId: attempt.turnId }, limits.interruptGraceMs)
        .catch(() => undefined);
      cancelGrace = clock.setTimer(limits.interruptGraceMs, giveUp);
    };
    let pendingExpiry: { code: string; detail: string } | null = null;

    const armIdle = () => {
      cancelIdle();
      cancelIdle = clock.setTimer(limits.idleMs, () =>
        interrupt(
          "idleTimeout",
          "TURN_IDLE_TIMEOUT",
          `no notification for ${limits.idleMs} ms; last was ${attempt.lastMethod ?? "none"}`,
        ),
      );
    };

    const handle = (event: SupervisorEvent) => {
      if (settled) return;
      const params = isRecord(event.params) ? event.params : {};
      if (params.threadId !== undefined && params.threadId !== threadId) return;
      const eventTurn = turnIdOf(params);
      if (eventTurn !== undefined && eventTurn !== attempt.turnId) return;

      if (event.kind === "serverRequestRefused") {
        attempt.refusedServerRequest = event.method;
        interrupt(
          "serverRequestRefused",
          "SERVER_REQUEST_REFUSED",
          `Codex asked the client ${event.method}, which CuckCode does not answer`,
        );
        return;
      }

      // Frozen once a limit fires, so the record names what the turn last did, not the reply to
      // our own interrupt.
      if (expiring === null) {
        attempt.lastMethod = event.method;
        armIdle();
      }

      if (event.method === "item/completed" && isRecord(params.item)) streamed.push(params.item);

      if (event.method === "error") {
        attempt.retries.push({
          ...classifyTurnError(params.error),
          willRetry: params.willRetry === true,
          atMs: clock.now() - startedAt,
        });
        return;
      }
      if (event.method !== "turn/completed") return;

      const turn = asCompletedTurn(params.turn);
      attempt.status = turn?.status ?? null;
      if (expiring !== null && pendingExpiry) {
        finish({ turn, ...pendingExpiry }, expiring);
        return;
      }
      if (turn?.status === "completed") {
        finish({ turn }, "completed");
        return;
      }
      const error = isRecord(params.turn) ? params.turn.error : undefined;
      attempt.failure = classifyTurnError(error);
      const status = turn?.status ?? "unknown";
      finish(
        {
          turn,
          code: status === "interrupted" ? "TURN_INTERRUPTED" : "TURN_FAILED",
          detail: describeFailure(attempt.turnId ?? "unknown", status, attempt.failure),
        },
        status === "interrupted" ? "interrupted" : "failed",
      );
    };

    unsubscribe = supervisor.subscribe((event) => {
      // Until turn/start answers, the turn's id is unknown; hold this thread's events until it is.
      if (attempt.turnId === null) buffered.push(event);
      else handle(event);
    });
    armIdle();
    cancelHard = clock.setTimer(limits.hardMs, () =>
      interrupt("hardTimeout", "TURN_HARD_TIMEOUT", `turn exceeded ${limits.hardMs} ms`),
    );

    supervisor
      .request("turn/start", { threadId, input: [...options.input] }, limits.startTimeoutMs)
      .then((started) => {
        const turnId = isRecord(started) ? asCompletedTurn(started.turn)?.id : undefined;
        if (turnId === undefined) {
          finish(
            { turn: null, code: "TURN_ID_MISSING", detail: "turn/start returned no turn id" },
            "runtimeFailure",
          );
          return;
        }
        attempt.turnId = turnId;
        for (const event of buffered.splice(0)) handle(event);
      })
      .catch((cause: unknown) => {
        finish(
          {
            turn: null,
            code: "RUNTIME_FAILURE",
            detail: cause instanceof Error ? cause.message : "turn/start failed",
          },
          "runtimeFailure",
        );
      });
  });
}

export async function runTurn(
  supervisor: TurnSupervisor,
  options: Options,
): Promise<TurnRunResult> {
  const clock = options.clock ?? systemClock;
  const limits = { ...TURN_LIMITS, ...options.limits };
  // setTimeout clamps any delay above 2^31 - 1 ms to 1 ms, so an over-large limit would expire at
  // once rather than never. Refuse it before anything is started.
  for (const [name, value] of Object.entries(limits)) {
    if (
      name !== "maxRetriesPerTurn" &&
      !(Number.isFinite(value) && value >= 0 && value <= MAX_TIMER_MS)
    )
      throw new Error(`TURN_LIMIT_OUT_OF_RANGE: ${name}=${value}`);
  }
  const budget = options.retryBudget ?? RUN_RETRY_BUDGET;
  const attempts: TurnAttempt[] = [];
  let retriesThisTurn = 0;

  for (;;) {
    const end = await runAttempt(
      supervisor,
      { ...options, clock, limits },
      attempts.length + 1,
      retriesThisTurn > 0,
    );
    attempts.push(end.attempt);
    if (end.attempt.outcome === "completed" && end.turn) {
      return { ok: true, turn: end.turn, streamedItems: end.streamedItems, attempts };
    }
    const retryable =
      end.attempt.outcome === "failed" &&
      end.attempt.failure?.transport === true &&
      !producedOutput(end.turn) &&
      retriesThisTurn < limits.maxRetriesPerTurn &&
      budget.remaining > 0;
    if (!retryable) {
      return {
        ok: false,
        code: end.code ?? "RUNTIME_FAILURE",
        detail: end.detail ?? "turn did not complete",
        turn: end.turn,
        streamedItems: end.streamedItems,
        attempts,
      };
    }
    budget.remaining -= 1;
    retriesThisTurn += 1;
    await clock.sleep(limits.retryBackoffMs);
  }
}
