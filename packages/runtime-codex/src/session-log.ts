import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SupervisorEvent } from "./supervisor.js";

/**
 * R6.8, CX-5: what a live session actually saw, kept after the controlled home is deleted.
 *
 * Passes 6–9 left nothing behind: the controlled `CODEX_HOME` held Codex's own logs and was
 * disposed, and the supervisor's stderr lived only in memory. This subscribes to the supervisor
 * for the life of a session and writes one JSONL file under `docs/evidence/runtime/sessions/`.
 *
 * It is diagnostic evidence, not a transcript. Streaming deltas are counted, not stored, and every
 * `text`, `delta` or long string inside an event is replaced by its length, so the log says what
 * happened and when without committing what the model wrote. The credential never passes through
 * here: the log sees only protocol events and the supervisor's already-redacted stderr.
 */
export type SessionLogSource = {
  subscribe: (listener: (event: SupervisorEvent) => void) => () => void;
  readonly stderr: readonly string[];
};

type LogClock = { now: () => number; iso: () => string };
const systemLogClock: LogClock = {
  now: () => performance.now(),
  iso: () => new Date().toISOString(),
};

const TEXT_KEYS = new Set(["text", "delta", "content", "summary", "aggregatedOutput", "output"]);
const LONG_STRING = 160;

const isDelta = (method: string): boolean => method.endsWith("/delta") || method.endsWith("Delta");

function redact(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return (key !== undefined && TEXT_KEYS.has(key)) || value.length > LONG_STRING
      ? { redactedLength: value.length }
      : value;
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [name, redact(entry, name)]),
    );
  }
  return value;
}

export function sessionLogPath(
  root: string,
  script: string,
  startedAt: string,
  roleId: string,
): string {
  return join(root, script, `${startedAt.replace(/[:.]/gu, "-")}-${roleId}.jsonl`);
}

export function openSessionLog(
  source: SessionLogSource,
  meta: { root: string; script: string; roleId: string; pin: string; clock?: LogClock },
): { close: () => Promise<string> } {
  const clock = meta.clock ?? systemLogClock;
  const startedAt = clock.iso();
  const origin = clock.now();
  const events: Record<string, unknown>[] = [];
  const deltaCounts: Record<string, number> = {};
  const refused: string[] = [];
  let sequence = 0;

  const unsubscribe = source.subscribe((event) => {
    const atMs = Math.round(clock.now() - origin);
    if (event.kind === "serverRequestRefused") {
      refused.push(event.method);
      events.push({ kind: "serverRequestRefused", seq: ++sequence, atMs, method: event.method });
      return;
    }
    if (isDelta(event.method)) {
      deltaCounts[event.method] = (deltaCounts[event.method] ?? 0) + 1;
      return;
    }
    events.push({
      kind: "notification",
      seq: ++sequence,
      atMs,
      method: event.method,
      params: redact(event.params),
    });
  });

  return {
    close: async () => {
      unsubscribe();
      const path = sessionLogPath(meta.root, meta.script, startedAt, meta.roleId);
      const header = {
        kind: "session",
        script: meta.script,
        roleId: meta.roleId,
        codexPin: meta.pin,
        startedAt,
        endedAt: clock.iso(),
        deltaCounts,
        refusedServerRequests: refused,
      };
      const stderr = source.stderr.map((line) => ({ kind: "stderr", line }));
      await mkdir(join(meta.root, meta.script), { recursive: true });
      await writeFile(
        path,
        `${[header, ...events, ...stderr].map((line) => JSON.stringify(line)).join("\n")}\n`,
        "utf8",
      );
      return path;
    },
  };
}
