/**
 * Codex's own account of why a turn failed (R6.1).
 *
 * Passes 6–9 recorded "status failed" and one error message, and threw away `codexErrorInfo` —
 * the field that says whether the connection, the stream, a limit or a policy stopped the turn,
 * with the HTTP status when there was one. This keeps all of it.
 *
 * The four transport classes are the ones CX-4 allows the harness to retry. A limit, a policy
 * block and an overloaded server are deliberately not among them: retrying those spends a turn to
 * be told the same thing.
 */
export const TRANSPORT_CLASSES = [
  "httpConnectionFailed",
  "responseStreamConnectionFailed",
  "responseStreamDisconnected",
  "responseTooManyFailedAttempts",
] as const;

export type FailureClassification = {
  message: string;
  variant: string | null;
  httpStatusCode: number | null;
  additionalDetails: string | null;
  transport: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function classifyTurnError(error: unknown): FailureClassification {
  const source = isRecord(error) ? error : {};
  const info = source.codexErrorInfo;
  let variant: string | null = null;
  let httpStatusCode: number | null = null;
  if (typeof info === "string") {
    variant = info;
  } else if (isRecord(info)) {
    const [key] = Object.keys(info);
    if (key !== undefined) {
      variant = key;
      const detail = info[key];
      if (isRecord(detail) && typeof detail.httpStatusCode === "number")
        httpStatusCode = detail.httpStatusCode;
    }
  }
  return {
    message: typeof source.message === "string" ? source.message : "",
    variant,
    httpStatusCode,
    additionalDetails:
      typeof source.additionalDetails === "string" ? source.additionalDetails : null,
    transport: variant !== null && (TRANSPORT_CLASSES as readonly string[]).includes(variant),
  };
}

/** One line for a record's `detail`: message, class and status, in that order. */
export function describeFailure(turnId: string, status: string, failure: FailureClassification) {
  const parts = [
    failure.variant,
    failure.httpStatusCode === null ? null : `http ${failure.httpStatusCode}`,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
  const message = failure.message.trim();
  return `turn ${turnId} reported status ${status}${message ? `: ${message}` : ""}${parts ? ` [${parts}]` : ""}`;
}
