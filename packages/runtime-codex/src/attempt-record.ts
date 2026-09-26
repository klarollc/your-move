import type { TurnAttempt } from "./turn-runner.js";

/**
 * The runner's attempts as they are written into committed run records (R6.1, R7.1).
 *
 * A projection rather than the runner's own type, so a change to the runner does not silently
 * change the shape of evidence already written. Field names follow the protocol where one exists:
 * `codexErrorInfo` is Codex's own name for the failure class.
 */
export type FailureRecord = {
  message: string;
  codexErrorInfo: string | null;
  httpStatusCode: number | null;
  additionalDetails: string | null;
  transport: boolean;
};

export type CodexRetryRecord = {
  atMs: number;
  willRetry: boolean;
  message: string;
  codexErrorInfo: string | null;
  httpStatusCode: number | null;
  additionalDetails: string | null;
};

export type AttemptRecord = {
  attempt: number;
  transportRetry: boolean;
  turnId: string | null;
  outcome: TurnAttempt["outcome"];
  status: string | null;
  elapsedMs: number;
  lastMethod: string | null;
  refusedServerRequest: string | null;
  failure: FailureRecord | null;
  codexRetries: CodexRetryRecord[];
};

export function attemptRecords(attempts: readonly TurnAttempt[]): AttemptRecord[] {
  return attempts.map((attempt) => ({
    attempt: attempt.attempt,
    transportRetry: attempt.transportRetry,
    turnId: attempt.turnId,
    outcome: attempt.outcome,
    status: attempt.status,
    elapsedMs: attempt.elapsedMs,
    lastMethod: attempt.lastMethod,
    refusedServerRequest: attempt.refusedServerRequest,
    failure:
      attempt.failure === null
        ? null
        : {
            message: attempt.failure.message,
            codexErrorInfo: attempt.failure.variant,
            httpStatusCode: attempt.failure.httpStatusCode,
            additionalDetails: attempt.failure.additionalDetails,
            transport: attempt.failure.transport,
          },
    codexRetries: attempt.retries.map((retry) => ({
      atMs: retry.atMs,
      willRetry: retry.willRetry,
      message: retry.message,
      codexErrorInfo: retry.variant,
      httpStatusCode: retry.httpStatusCode,
      additionalDetails: retry.additionalDetails,
    })),
  }));
}
