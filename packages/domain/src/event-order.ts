import { parseProjectEvent, type ProjectEvent } from "@cuckcode/contracts";

import { stableStringify } from "./canonical-json.js";

export type EventLogIssue =
  | {
      code: "MALFORMED_EVENT";
      fingerprint: string;
      reason: string;
      message: string;
    }
  | {
      code: "DUPLICATE_EVENT_CONFLICT";
      eventId: string;
      message: string;
    };

export type NormalizedEventLog = {
  events: ProjectEvent[];
  issues: EventLogIssue[];
};

export function normalizeEventLog(input: readonly unknown[]): NormalizedEventLog {
  const valid: ProjectEvent[] = [];
  const issues: EventLogIssue[] = [];

  for (const candidate of input) {
    const parsed = parseProjectEvent(candidate);
    if (parsed.ok) {
      valid.push(parsed.value);
    } else {
      issues.push({
        code: "MALFORMED_EVENT",
        fingerprint: safeFingerprint(candidate),
        reason: parsed.error.reason,
        message: parsed.error.details.join("; "),
      });
    }
  }

  const byId = new Map<string, ProjectEvent[]>();
  for (const event of valid) {
    const group = byId.get(event.eventId) ?? [];
    group.push(event);
    byId.set(event.eventId, group);
  }

  const events: ProjectEvent[] = [];
  for (const [eventId, variants] of byId) {
    const unique = new Map(variants.map((event) => [stableStringify(event), event]));
    if (unique.size === 1) {
      const event = unique.values().next().value as ProjectEvent | undefined;
      if (event) events.push(event);
    } else {
      issues.push({
        code: "DUPLICATE_EVENT_CONFLICT",
        eventId,
        message: "Conflicting content shares one eventId; all variants were quarantined.",
      });
    }
  }

  events.sort(compareEvents);
  issues.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  return { events, issues };
}

function compareEvents(left: ProjectEvent, right: ProjectEvent): number {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.receivedAt.localeCompare(right.receivedAt) ||
    left.eventId.localeCompare(right.eventId)
  );
}

function safeFingerprint(value: unknown): string {
  try {
    return stableStringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Timestamps for `count` events about to be appended to `log`, so that canonical replay (time,
 * then event id) applies them after everything already there.
 *
 * Canonical order breaks time ties by event id with a locale-aware comparison, so an event that
 * shares a timestamp with an earlier one can sort before it. New events therefore start one
 * millisecond after the newest `occurredAt` or `receivedAt` in the log (or at `now`, if later) and
 * are one millisecond apart. The stamp can run a few milliseconds ahead of the wall clock; that is
 * the cost of a log whose order never depends on id collation.
 */
export function nextEventTimes(log: readonly unknown[], now: string, count: number): string[] {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) throw new Error("NEXT_EVENT_TIMES_NOW_INVALID");
  let newest = Number.NEGATIVE_INFINITY;
  for (const event of normalizeEventLog(log).events) {
    newest = Math.max(newest, Date.parse(event.occurredAt), Date.parse(event.receivedAt));
  }
  const start = Math.max(nowMs, newest + 1);
  return Array.from({ length: count }, (_, index) => new Date(start + index).toISOString());
}
