export const stableIdPrefixes = [
  "project",
  "event",
  "work",
  "agent",
  "role",
  "role-assignment",
  "evidence",
  "artifact",
  "knowledge",
  "collaboration",
  "approval",
] as const;

export type StableIdPrefix = (typeof stableIdPrefixes)[number];
export type StableId<P extends StableIdPrefix = StableIdPrefix> = `${P}_${string}`;
export type UtcTimestamp = `${string}Z`;

export type ValidationError = {
  code: "INVALID_ID" | "INVALID_TIMESTAMP";
  field: "id" | "timestamp";
  reason: "empty" | "prefix_mismatch" | "invalid_rfc3339";
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: ValidationError };

export type Clock = {
  now(): UtcTimestamp;
};

export type IdFactory = {
  next<P extends StableIdPrefix>(prefix: P): StableId<P>;
};

export function parseStableId<P extends StableIdPrefix>(
  prefix: P,
  value: string,
): ParseResult<StableId<P>> {
  if (value.length === 0) {
    return { ok: false, error: { code: "INVALID_ID", field: "id", reason: "empty" } };
  }

  if (!value.startsWith(`${prefix}_`) || value.length === prefix.length + 1) {
    return {
      ok: false,
      error: { code: "INVALID_ID", field: "id", reason: "prefix_mismatch" },
    };
  }

  return { ok: true, value: value as StableId<P> };
}

const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseUtcTimestamp(value: string): ParseResult<UtcTimestamp> {
  const milliseconds = Date.parse(value);
  if (!rfc3339.test(value) || Number.isNaN(milliseconds)) {
    return {
      ok: false,
      error: {
        code: "INVALID_TIMESTAMP",
        field: "timestamp",
        reason: "invalid_rfc3339",
      },
    };
  }

  return { ok: true, value: new Date(milliseconds).toISOString() as UtcTimestamp };
}
