import { describe, expect, it, vi } from "vitest";

import { createWorkflowRunnerControl } from "./workflow-runner.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Surface B runner lock handoff", () => {
  it("releases the server lock, runs one child, blocks duplicate starts, then reacquires", async () => {
    const completion = deferred<number | null>();
    const releaseLock = vi.fn(async () => undefined);
    const reacquireLock = vi.fn(async () => true);
    const launch = vi.fn(async () => ({ completion: completion.promise }));
    const runner = createWorkflowRunnerControl({
      available: true,
      releaseLock,
      reacquireLock,
      launch,
    });

    expect(await runner.start("work_slugify")).toEqual({ ok: true });
    expect(releaseLock).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledWith("work_slugify");
    expect(runner.status()).toMatchObject({ state: "running", workItemId: "work_slugify" });
    expect(await runner.start("work_other")).toEqual({ ok: false, code: "RUNNER_ALREADY_ACTIVE" });
    expect(launch).toHaveBeenCalledOnce();

    completion.resolve(0);
    await runner.waitUntilIdle();
    expect(reacquireLock).toHaveBeenCalledOnce();
    expect(runner.status()).toMatchObject({ state: "completed", workItemId: "work_slugify" });
  });

  it("refuses work without a configured server runner", async () => {
    const releaseLock = vi.fn(async () => undefined);
    const runner = createWorkflowRunnerControl({
      available: false,
      releaseLock,
      reacquireLock: async () => true,
      launch: async () => ({ completion: Promise.resolve(0) }),
    });
    expect(await runner.start("work_slugify")).toEqual({
      ok: false,
      code: "WORKFLOW_RUNNER_UNAVAILABLE",
    });
    expect(releaseLock).not.toHaveBeenCalled();
  });

  it("keeps the server fail-closed if the lock cannot be reacquired", async () => {
    const runner = createWorkflowRunnerControl({
      available: true,
      releaseLock: async () => undefined,
      reacquireLock: async () => false,
      launch: async () => ({ completion: Promise.resolve(0) }),
    });
    expect(await runner.start("work_slugify")).toEqual({ ok: true });
    await runner.waitUntilIdle();
    expect(runner.status()).toMatchObject({
      state: "recovery_required",
      workItemId: "work_slugify",
    });
  });
});
