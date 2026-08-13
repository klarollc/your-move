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
