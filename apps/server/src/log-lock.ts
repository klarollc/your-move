/**
 * The single-writer lock for the event log (workflow-proof W5 plan §4, item 3, made mechanical).
 *
 * The server, the runner, the evidence recorder and the review CLI all append to one JSONL log, and
 * `appendEventLog` only narrows a cross-process race. This lock closes it for the proof: a lock file
 * beside the log, created exclusively, naming the holder. A second writer refuses instead of waiting.
 *
 * A lock is reclaimed only when it was taken on this host by a process that is no longer running.
 * Anything else (another host, an unreadable lock, a live pid) is refused with the lock file named,
 * because guessing wrong would put two writers on one log.
 */
import { hostname } from "node:os";
import { resolve } from "node:path";
import { readFileSync, rmSync } from "node:fs";
import { open, readFile, rm } from "node:fs/promises";

export type LockHolder = Readonly<{ pid: number; host: string; role: string; since: string }>;

export type LogLock = Readonly<{
  lockPath: string;
  /** Set when a lock left by a dead process on this host was reclaimed. */
  reclaimed?: LockHolder;
  release: () => Promise<void>;
  /** For process exit handlers, where only synchronous work runs. */
  releaseSync: () => void;
}>;

export type LockResult =
  | Readonly<{ ok: true; lock: LogLock }>
  | Readonly<{ ok: false; code: "LOG_LOCKED" | "LOCK_UNREADABLE"; detail: string }>;

/** Resolved, so two spellings of one log (relative, absolute) take the same lock. */
export const lockPathFor = (logPath: string) => `${resolve(logPath)}.lock`;

export type LockEnv = Readonly<{
  pid: number;
  host: string;
  now: () => string;
  isAlive: (pid: number) => boolean;
}>;

const defaultEnv: LockEnv = {
  pid: process.pid,
  host: hostname(),
  now: () => new Date().toISOString(),
  isAlive: (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // EPERM means the process exists but is not ours.
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  },
};

function parseHolder(text: string): LockHolder | undefined {
  try {
    const value = JSON.parse(text) as Partial<LockHolder>;
    if (
      typeof value.pid === "number" &&
      Number.isInteger(value.pid) &&
      typeof value.host === "string" &&
      typeof value.role === "string" &&
      typeof value.since === "string"
    ) {
      return value as LockHolder;
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

async function tryCreate(lockPath: string, holder: LockHolder): Promise<boolean> {
  try {
    const handle = await open(lockPath, "wx");
    try {
      await handle.writeFile(`${JSON.stringify(holder)}\n`, "utf8");
    } finally {
      await handle.close();
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

export async function acquireLogLock(
  logPath: string,
  role: string,
  env: LockEnv = defaultEnv,
): Promise<LockResult> {
  const lockPath = lockPathFor(logPath);
  const mine: LockHolder = { pid: env.pid, host: env.host, role, since: env.now() };
  let reclaimed: LockHolder | undefined;

  if (!(await tryCreate(lockPath, mine))) {
    let text: string;
    try {
      text = await readFile(lockPath, "utf8");
    } catch {
      return { ok: false, code: "LOCK_UNREADABLE", detail: `cannot read ${lockPath}` };
    }
    const holder = parseHolder(text);
    if (!holder) {
      return {
        ok: false,
        code: "LOCK_UNREADABLE",
        detail: `${lockPath} is not a valid lock; if no writer is running, delete it yourself`,
      };
    }
    const sameHost = holder.host === env.host;
    if (sameHost && !env.isAlive(holder.pid)) {
      await rm(lockPath, { force: true });
      if (!(await tryCreate(lockPath, mine))) {
        return { ok: false, code: "LOG_LOCKED", detail: `${lockPath} was taken while reclaiming` };
      }
      reclaimed = holder;
    } else {
      return {
        ok: false,
        code: "LOG_LOCKED",
        detail: `the log is held by ${holder.role} (pid ${String(holder.pid)} on ${holder.host}, since ${holder.since}); ${
          sameHost
            ? "stop it first"
            : "it was taken on another host, so it cannot be checked; if it is gone, delete " +
              lockPath +
              " yourself"
        }`,
      };
    }
  }

  let released = false;
  const ours = (text: string) => {
    const current = parseHolder(text);
    return current !== undefined && current.pid === mine.pid && current.host === mine.host;
  };
  return {
    ok: true,
    lock: {
      lockPath,
      ...(reclaimed ? { reclaimed } : {}),
      release: async () => {
        if (released) return;
        released = true;
        // Only remove a lock that is still ours.
        if (ours(await readFile(lockPath, "utf8").catch(() => ""))) {
          await rm(lockPath, { force: true });
        }
      },
      releaseSync: () => {
        if (released) return;
        released = true;
        let text = "";
        try {
          text = readFileSync(lockPath, "utf8");
        } catch {
          /* already gone */
        }
        if (ours(text)) rmSync(lockPath, { force: true });
      },
    },
  };
}

/** Run one owner or runner step under the lock, releasing it however the step ends. */
export async function withLogLock<T>(
  logPath: string,
  role: string,
  step: (lock: LogLock) => Promise<T>,
): Promise<
  | Readonly<{ locked: true; value: T }>
  | Readonly<{ locked: false; code: "LOG_LOCKED" | "LOCK_UNREADABLE"; detail: string }>
> {
  const acquired = await acquireLogLock(logPath, role);
  if (!acquired.ok) return { locked: false, code: acquired.code, detail: acquired.detail };
  try {
    return { locked: true, value: await step(acquired.lock) };
  } finally {
    await acquired.lock.release();
  }
}
