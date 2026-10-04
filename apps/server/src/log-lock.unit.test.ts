import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acquireLogLock, lockPathFor, withLogLock, type LockEnv } from "./log-lock.js";

let dir: string;
let log: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ck-lock-"));
  log = join(dir, "events.jsonl");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const env = (over: Partial<LockEnv> = {}): LockEnv => ({
  pid: 100,
  host: "host-a",
  now: () => "2026-10-04T12:00:00.000Z",
  isAlive: () => true,
  ...over,
});

describe("the log's single-writer lock", () => {
  it("is taken once, names its holder, and is released", async () => {
    const first = await acquireLogLock(log, "server", env());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(JSON.parse(await readFile(first.lock.lockPath, "utf8"))).toEqual({
      pid: 100,
      host: "host-a",
      role: "server",
      since: "2026-10-04T12:00:00.000Z",
    });
    await first.lock.release();
    const again = await acquireLogLock(log, "runner", env({ pid: 101 }));
    expect(again.ok).toBe(true);
  });

  it("refuses a second writer while the holder is alive, naming the holder", async () => {
    const first = await acquireLogLock(log, "server", env());
    expect(first.ok).toBe(true);
    const second = await acquireLogLock(log, "runner", env({ pid: 101 }));
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("LOG_LOCKED");
    expect(second.detail).toContain("server");
    expect(second.detail).toContain("pid 100");
  });

  it("reclaims a lock from a dead process on this host, and says so", async () => {
    await acquireLogLock(log, "server", env());
    const next = await acquireLogLock(log, "runner", env({ pid: 101, isAlive: () => false }));
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.lock.reclaimed).toMatchObject({ pid: 100, role: "server" });
  });

  it("never reclaims a lock from another host, even if the pid looks dead", async () => {
    await acquireLogLock(log, "server", env({ host: "host-b" }));
    const next = await acquireLogLock(log, "runner", env({ pid: 101, isAlive: () => false }));
    expect(next.ok).toBe(false);
    if (next.ok) return;
    expect(next.code).toBe("LOG_LOCKED");
    expect(next.detail).toContain(lockPathFor(log));
  });

  it("refuses an unreadable lock instead of replacing it", async () => {
    await writeFile(lockPathFor(log), "garbage");
    const result = await acquireLogLock(log, "runner", env());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LOCK_UNREADABLE");
    expect(await readFile(lockPathFor(log), "utf8")).toBe("garbage");
  });

  it("releases only a lock that is still its own", async () => {
    const mine = await acquireLogLock(log, "server", env());
    if (!mine.ok) throw new Error("expected lock");
    await writeFile(
      lockPathFor(log),
      `${JSON.stringify({ pid: 999, host: "host-a", role: "runner", since: "x" })}\n`,
    );
    await mine.lock.release();
    expect(await readFile(lockPathFor(log), "utf8")).toContain('"pid":999');
  });

  it("releases synchronously for exit handlers", async () => {
    const mine = await acquireLogLock(log, "runner", env());
    if (!mine.ok) throw new Error("expected lock");
    mine.lock.releaseSync();
    await expect(readFile(lockPathFor(log), "utf8")).rejects.toThrow();
  });

  it("treats two spellings of one log as the same log", () => {
    expect(lockPathFor(join(dir, "x", "..", "events.jsonl"))).toBe(lockPathFor(log));
  });

  it("withLogLock releases when the step throws, and refuses when locked", async () => {
    await expect(
      withLogLock(log, "review", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const held = await acquireLogLock(log, "server");
    expect(held.ok).toBe(true);
    const refused = await withLogLock(log, "review", async () => 1);
    expect(refused.locked).toBe(false);
  });
});
