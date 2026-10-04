/**
 * The append-only event log (workflow-proof W5a).
 *
 * One JSONL file of `ProjectEvent` records, one per line, is the source of truth for the proof. A
 * revision is the count of complete, valid events in it (the W3 convention).
 *
 * Nothing here repairs or skips silently. A final line with no newline is reported `truncated` and
 * is not counted; an unparseable or invalid line, or a repeated event id, is reported as a problem
 * with its line number. Appending to a log that has either refuses, because the next writer would
 * otherwise build on a record nobody has read in full.
 *
 * Writes inside this process are serialised per path. Two processes appending to the same file are
 * NOT made safe here: the proof assumes one manager and one runner (W5 plan §4, item 3), and the
 * revision check below narrows but does not close a cross-process race.
 */
import { appendFile, readFile } from "node:fs/promises";

import { parseProjectEvent } from "@cuckcode/contracts";

export type LogProblem = Readonly<{ line: number; reason: string }>;

export type ParsedLog = Readonly<{
  events: readonly unknown[];
  revision: number;
  truncated: boolean;
  problems: readonly LogProblem[];
}>;

export function parseEventLog(text: string): ParsedLog {
  const truncated = text.length > 0 && !text.endsWith("\n");
  const rawLines = text.split("\n");
  // The segment after the last newline is either empty (a clean end) or a truncated line.
  const complete = rawLines.slice(0, -1);
  const events: unknown[] = [];
  const problems: LogProblem[] = [];
  const seen = new Set<string>();
  complete.forEach((line, index) => {
    if (line.trim().length === 0) return;
    const number = index + 1;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      problems.push({ line: number, reason: "line is not valid JSON" });
      return;
    }
    const parsed = parseProjectEvent(value);
    if (!parsed.ok) {
      problems.push({
        line: number,
        reason: `line is not a valid project event: ${parsed.error.details.join("; ")}`,
      });
      return;
    }
    if (seen.has(parsed.value.eventId)) {
      problems.push({ line: number, reason: `duplicate event id ${parsed.value.eventId}` });
      return;
    }
    seen.add(parsed.value.eventId);
    events.push(value);
  });
  return { events, revision: events.length, truncated, problems };
}

export async function readEventLog(path: string): Promise<ParsedLog> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return parseEventLog("");
    throw error;
  }
  return parseEventLog(text);
}

export type AppendResult =
  | Readonly<{ ok: true; revision: number }>
  | Readonly<{
      ok: false;
      code: "STALE_REVISION" | "LOG_DAMAGED" | "EVENT_INVALID" | "EVENT_DUPLICATE";
      detail: string;
    }>;

const queues = new Map<string, Promise<unknown>>();

function serialised<T>(path: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(path) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    path,
    next.catch(() => undefined),
  );
  return next;
}

export function appendEventLog(
  path: string,
  events: readonly unknown[],
  expectedRevision: number,
): Promise<AppendResult> {
  return serialised(path, async () => {
    const log = await readEventLog(path);
    if (log.truncated || log.problems.length > 0) {
      return {
        ok: false,
        code: "LOG_DAMAGED",
        detail: log.truncated
          ? "the log ends in a truncated line"
          : `the log has ${String(log.problems.length)} unreadable line(s); first: line ${String(log.problems[0]?.line)}`,
      } as const;
    }
    if (log.revision !== expectedRevision) {
      return {
        ok: false,
        code: "STALE_REVISION",
        detail: `expected revision ${String(expectedRevision)}, log is at ${String(log.revision)}`,
      } as const;
    }
    const known = new Set(log.events.map((event) => (event as { eventId: string }).eventId));
    for (const event of events) {
      const parsed = parseProjectEvent(event);
      if (!parsed.ok) {
        return {
          ok: false,
          code: "EVENT_INVALID",
          detail: parsed.error.details.join("; "),
        } as const;
      }
      if (known.has(parsed.value.eventId)) {
        return {
          ok: false,
          code: "EVENT_DUPLICATE",
          detail: `event id ${parsed.value.eventId} is already in the log or the batch`,
        } as const;
      }
      known.add(parsed.value.eventId);
    }
    if (events.length > 0) {
      await appendFile(
        path,
        `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
        "utf8",
      );
    }
    return { ok: true, revision: log.revision + events.length } as const;
  });
}
