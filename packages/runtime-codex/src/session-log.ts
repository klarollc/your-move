import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
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

/**
 * Notifications that describe the account or the machine rather than the session: plan type, rate
 * limits, the PC's name, Codex's installation id. Their method and timing stay; their parameters do
 * not (owner ruling 2026-09-26).
 */
const IDENTITY_METHOD = /^(?:account|remoteControl)\//u;
const REDACTION_VERSION = "v1";

/**
 * A pattern for the user's home directory however a path spells it: `/` or `\`, single or doubled
 * (Codex's stderr prints Windows paths escaped), and case-insensitively, as Windows paths are.
 */
function homePattern(home: string): RegExp | null {
  const segments = home.split(/[\\/]+/u).filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  const escaped = segments.map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  const leading = /^[\\/]/u.test(home) ? "[\\\\/]+" : "";
  // Only where the home directory ends: a sibling such as `nate-old` is someone else's path.
  return new RegExp(`${leading}${escaped.join("[\\\\/]+")}(?![A-Za-z0-9._-])`, "giu");
}

function foldHome(text: string, home: RegExp | null): string {
  return home === null ? text : text.replace(home, "~");
}

function redact(value: unknown, home: RegExp | null, key?: string): unknown {
  if (typeof value === "string") {
    if ((key !== undefined && TEXT_KEYS.has(key)) || value.length > LONG_STRING)
      return { redactedLength: value.length };
    return foldHome(value, home);
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry, home));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [name, redact(entry, home, name)]),
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
  meta: {
    root: string;
    script: string;
    roleId: string;
    pin: string;
    clock?: LogClock;
    /** The user's home directory; injected in tests, `os.homedir()` otherwise. */
    home?: string;
  },
): { close: () => Promise<string> } {
  const clock = meta.clock ?? systemLogClock;
  const home = homePattern(meta.home ?? homedir());
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
      params: IDENTITY_METHOD.test(event.method)
        ? { redacted: "identity" }
        : redact(event.params, home),
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
        redaction: REDACTION_VERSION,
      };
      const stderr = source.stderr.map((line) => ({ kind: "stderr", line: foldHome(line, home) }));
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

/**
 * Brings a log written before redaction v1 to the same standard with the same functions, for the
 * smoke session held back on 2026-09-26 (F3.4). Sequence, timing and structure are kept; the header
 * records that the redaction came after capture.
 */
export function rewriteSessionLog(text: string, homeDirectory: string): string {
  const home = homePattern(homeDirectory);
  const rewritten = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (entry.kind === "session")
        return { ...entry, redaction: REDACTION_VERSION, redactedAfterCapture: true };
      if (entry.kind === "stderr" && typeof entry.line === "string")
        return { ...entry, line: foldHome(entry.line, home) };
      if (entry.kind === "notification" && typeof entry.method === "string") {
        return {
          ...entry,
          params: IDENTITY_METHOD.test(entry.method)
            ? { redacted: "identity" }
            : redact(entry.params, home),
        };
      }
      return entry;
    });
  return `${rewritten.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}
