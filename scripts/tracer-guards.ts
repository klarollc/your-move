/**
 * tracer-guards.draft-v0.2.ts — DRAFT v0.2 (2026-10-03)
 *
 * Status: DRAFT. Not for execution. Does not belong in the CuckCode tree until the owner
 * approves it through the project's own conventions.
 *
 * Pure, dependency-free guards for the tracer runner. They are separate from the runner so they
 * can be tested without a Codex process, an install, or a worktree. Nothing here imports
 * @cuckcode/* packages: the item classifier is injected, so the runner passes the real
 * `classifyItem` and a test passes a fake.
 *
 * Owner ruling 2026-10-03 (write posture): "scoped file edits". The role may change files, but
 * only inside the worktree. Every other effect type still stops the run.
 */

import { posix, win32 } from "node:path";

export type PathApi = Pick<typeof posix, "resolve" | "relative" | "isAbsolute" | "sep">;
export type ItemClassifier = (type: string) => "text" | "effect" | "unclassified";

export type TurnVerdict =
  | { ok: true; fileChanges: FileChangeRecord[]; resultLine: ResultLine | null }
  | { ok: false; code: TurnRefusalCode; detail: string };

export type TurnRefusalCode =
  | "TURN_COMPLETION_INVALID"
  | "UNCLASSIFIED_ITEM_TYPE"
  | "EXTERNAL_EFFECT_OBSERVED"
  | "FILE_CHANGE_OUTSIDE_WORKTREE"
  | "FILE_CHANGE_UNREADABLE"
  | "FILE_CHANGE_NOT_COMPLETED";

export type FileChangeRecord = { path: string; kind: string; movePath: string | null };
export type ResultLine = { verdict: "done" | "blocked"; summary: string };

export const RESULT_MARKER = "TRACER_RESULT:";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Is `candidate` strictly inside `root`? Resolves relative candidates against the worktree, as
 * the runtime reports them relative to `cwd`. `.git` is refused even inside the root: a linked
 * worktree's `.git` file points back at the owner's repository, so writing it is an escape.
 */
export function isInsideWorktree(
  root: string,
  candidate: string,
  pathApi: PathApi = posix,
): boolean {
  if (candidate.length === 0 || candidate.includes("\0")) return false;
  const resolvedRoot = pathApi.resolve(root);
  const resolved = pathApi.resolve(resolvedRoot, candidate);
  const rel = pathApi.relative(resolvedRoot, resolved);
  if (rel.length === 0) return false; // the root itself is not a file the role may write
  if (rel === ".." || rel.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(rel)) return false;
  const first = rel.split(pathApi.sep)[0];
  return first !== ".git";
}

/** The path API matching the host the runner is on, so Windows drive letters compare correctly. */
export function hostPathApi(platform: string): PathApi {
  return platform === "win32" ? win32 : posix;
}

function readChanges(item: Record<string, unknown>): FileChangeRecord[] | null {
  if (!Array.isArray(item.changes) || item.changes.length === 0) return null;
  const out: FileChangeRecord[] = [];
  for (const change of item.changes) {
    if (!isRecord(change) || typeof change.path !== "string" || change.path.length === 0) {
      return null;
    }
    const kind =
      isRecord(change.kind) && typeof change.kind.type === "string" ? change.kind.type : "";
    if (kind.length === 0) return null;
    const move =
      isRecord(change.kind) && typeof change.kind.move_path === "string"
        ? change.kind.move_path
        : null;
    out.push({ path: change.path, kind, movePath: move });
  }
  return out;
}

/**
 * The text of the LAST agent message in a turn, or null. The result line is read from the
 * message the role actually wrote, not from a serialization of the whole turn.
 */
export function lastAgentMessageText(items: readonly unknown[]): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (isRecord(item) && item.type === "agentMessage" && typeof item.text === "string") {
      return item.text;
    }
  }
  return null;
}

/**
 * `TRACER_RESULT: done|blocked — summary` must START a line. A mention of the marker inside
 * prose, a quoted instruction, or a code span does not count. The last matching line wins.
 */
export function parseResultLine(text: string): ResultLine | null {
  const pattern = /^TRACER_RESULT:[ \t]*(done|blocked)\b[ \t]*[—:\-–]*[ \t]*(.*)$/gmu;
  let last: ResultLine | null = null;
  for (const match of text.matchAll(pattern)) {
    const verdict = match[1] as "done" | "blocked";
    last = { verdict, summary: (match[2] ?? "").trim().slice(0, 300) };
  }
  return last;
}

/**
 * Judges one completed turn against the scoped-edit posture.
 *
 * - Unclassified item types stop the run (conservative, as everywhere else in runtime-codex).
 * - `fileChange` is the only effect that is allowed, and only when it completed and every path
 *   (and move target) is inside the worktree.
 * - Every other effect type — commandExecution, mcpToolCall, webSearch, subagents — stops the run.
 *
 * Limitation, stated rather than hidden: this is a check after the turn, not an interception.
 * The sandbox is the preventive control; this is the detective one.
 */
export function judgeTracerTurn(input: {
  turn: unknown;
  threadId: string;
  expectedTurnId: string;
  worktree: string;
  classify: ItemClassifier;
  pathApi?: PathApi;
}): TurnVerdict {
  const pathApi = input.pathApi ?? posix;
  const turn = isRecord(input.turn) ? input.turn : null;
  if (
    !turn ||
    turn.id !== input.expectedTurnId ||
    turn.status !== "completed" ||
    !Array.isArray(turn.items)
  ) {
    return {
      ok: false,
      code: "TURN_COMPLETION_INVALID",
      detail: "the runtime did not report a completed turn for the requested turn id",
    };
  }

  const fileChanges: FileChangeRecord[] = [];
  const effects: string[] = [];
  const unclassified: string[] = [];

  for (const item of turn.items) {
    const type =
      isRecord(item) && typeof item.type === "string" && item.type.length > 0
        ? item.type
        : "unknown";
    const kind = input.classify(type);
    if (kind === "unclassified") {
      unclassified.push(type);
      continue;
    }
    if (kind === "text") continue;
    if (type !== "fileChange" || !isRecord(item)) {
      effects.push(type);
      continue;
    }
    if (item.status !== "completed") {
      return {
        ok: false,
        code: "FILE_CHANGE_NOT_COMPLETED",
        detail: `a fileChange item reported status ${String(item.status)}`,
      };
    }
    const changes = readChanges(item);
    if (changes === null) {
      return {
        ok: false,
        code: "FILE_CHANGE_UNREADABLE",
        detail: "a fileChange item did not carry readable path and kind for every change",
      };
    }
    for (const change of changes) {
      const targets = change.movePath === null ? [change.path] : [change.path, change.movePath];
      for (const target of targets) {
        if (!isInsideWorktree(input.worktree, target, pathApi)) {
          return {
            ok: false,
            code: "FILE_CHANGE_OUTSIDE_WORKTREE",
            detail: `change to "${target}" resolves outside the worktree`,
          };
        }
      }
      fileChanges.push(change);
    }
  }

  if (unclassified.length > 0) {
    return {
      ok: false,
      code: "UNCLASSIFIED_ITEM_TYPE",
      detail: `the turn reported item types with no classification: ${unclassified.join(", ")}`,
    };
  }
  if (effects.length > 0) {
    return {
      ok: false,
      code: "EXTERNAL_EFFECT_OBSERVED",
      detail: `the turn reported effect item types the tracer does not allow: ${[...new Set(effects)].join(", ")}`,
    };
  }

  const text = lastAgentMessageText(turn.items);
  return { ok: true, fileChanges, resultLine: text === null ? null : parseResultLine(text) };
}

/**
 * The posture thread/start must report back. The runner compares what the runtime OBSERVED, not
 * what was requested, so a runtime that silently downgraded or widened the sandbox is refused.
 */
export function checkObservedPosture(
  threadStart: unknown,
): { ok: true } | { ok: false; detail: string } {
  const start = isRecord(threadStart) ? threadStart : null;
  const sandbox = start && isRecord(start.sandbox) ? start.sandbox : null;
  if (!sandbox) return { ok: false, detail: "thread/start reported no sandbox" };
  if (sandbox.type !== "workspaceWrite") {
    return {
      ok: false,
      detail: `sandbox reported as ${String(sandbox.type)}, expected workspaceWrite`,
    };
  }
  if (sandbox.networkAccess !== false) {
    return { ok: false, detail: "sandbox reported network access, which the tracer forbids" };
  }
  if (start?.approvalPolicy !== "never") {
    return {
      ok: false,
      detail: `approvalPolicy reported as ${String(start?.approvalPolicy)}, expected never`,
    };
  }
  return { ok: true };
}
