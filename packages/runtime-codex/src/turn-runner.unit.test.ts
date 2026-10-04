import { describe, expect, it } from "vitest";

import { createManualClock } from "./fixtures/manual-clock.js";
import type { SupervisorEvent } from "./supervisor.js";
import { createRetryBudget, runTurn, type TurnSupervisor } from "./turn-runner.js";

const THREAD = "thread_1";
const DISCONNECTED = { responseStreamDisconnected: { httpStatusCode: null } };

type Emit = (method: string, params: Record<string, unknown>) => void;
type TurnScript = (turnId: string, emit: Emit, refuse: (method: string) => void) => void;

/** An in-memory supervisor. Each turn/start runs the next script once the id has been returned. */
function fake(scripts: TurnScript[], onInterrupt?: (turnId: string, emit: Emit) => void) {
  const listeners = new Set<(event: SupervisorEvent) => void>();
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const emit: Emit = (method, params) => {
    for (const listener of [...listeners]) listener({ kind: "notification", method, params });
  };
  const refuse = (method: string) => {
    for (const listener of [...listeners])
      listener({ kind: "serverRequestRefused", method, id: 99, params: { threadId: THREAD } });
  };
  let started = 0;
  const supervisor: TurnSupervisor = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    request: async (method, params) => {
      calls.push({ method, params });
      if (method === "turn/start") {
        const turnId = `turn_${++started}`;
        const script = scripts[started - 1];
        if (!script) throw new Error("no script for this turn");
        queueMicrotask(() => script(turnId, emit, refuse));
        return { turn: { id: turnId } };
      }
      if (method === "turn/interrupt") {
        queueMicrotask(() => onInterrupt?.(String(params.turnId), emit));
        return {};
      }
      throw new Error(`unexpected ${method}`);
    },
  };
  return { supervisor, calls, turnStarts: () => started };
}

const flush = async () => {
  for (let index = 0; index < 5; index += 1) await new Promise((resolve) => setImmediate(resolve));
};
const completed = (turnId: string, items: unknown[] = [{ type: "agentMessage", text: "OK" }]) => ({
  threadId: THREAD,
  turn: { id: turnId, status: "completed", items },
});
const failed = (turnId: string, codexErrorInfo: unknown, items: unknown[] = []) => ({
  threadId: THREAD,
  turn: {
    id: turnId,
    status: "failed",
    items,
    error: { message: "failed", codexErrorInfo, additionalDetails: "error sending request" },
  },
});
const input = [{ type: "text", text: "go" }];

describe("the shared turn runner", () => {
  it("returns a completed turn with one attempt", async () => {
    const { supervisor } = fake([(id, emit) => emit("turn/completed", completed(id))]);
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({ outcome: "completed", turnId: "turn_1" });
  });

  it("records every retry Codex reports, in order, with its class", async () => {
    const { supervisor } = fake([
      (id, emit) => {
        for (const willRetry of [true, true]) {
          emit("error", {
            threadId: THREAD,
            turnId: id,
            willRetry,
            error: { message: "stream disconnected", codexErrorInfo: DISCONNECTED },
          });
        }
        emit("turn/completed", completed(id));
      },
    ]);
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
    });
    expect(result.ok).toBe(true);
    expect(
      result.attempts[0]?.retries.map((retry) => [retry.willRetry, retry.variant, retry.transport]),
    ).toEqual([
      [true, "responseStreamDisconnected", true],
      [true, "responseStreamDisconnected", true],
    ]);
  });

  it("lets a slow turn run as long as it keeps streaming", async () => {
    const clock = createManualClock();
    const { supervisor, calls } = fake([
      (id, emit) => {
        for (let step = 1; step <= 4; step += 1)
          clock.setTimer(step * 100_000, () =>
            emit("item/agentMessage/delta", { threadId: THREAD, turnId: id, delta: "…" }),
          );
        clock.setTimer(450_000, () => emit("turn/completed", completed(id)));
      },
    ]);
    const run = runTurn(supervisor, { threadId: THREAD, input, clock });
    await flush();
    clock.advance(450_000);
    const result = await run;
    expect(result.ok).toBe(true);
    expect(calls.some((call) => call.method === "turn/interrupt")).toBe(false);
  });

  it("interrupts a silent turn at the idle limit and says what it last saw", async () => {
    const clock = createManualClock();
    const { supervisor, calls } = fake(
      [(id, emit) => emit("turn/started", { threadId: THREAD, turnId: id })],
      (id, emit) =>
        emit("turn/completed", {
          threadId: THREAD,
          turn: { id, status: "interrupted", items: [] },
        }),
    );
    const run = runTurn(supervisor, { threadId: THREAD, input, clock });
    await flush();
    clock.advance(179_999);
    await flush();
    expect(calls.filter((call) => call.method === "turn/interrupt")).toEqual([]);
    clock.advance(1);
    await flush();
    const result = await run;
    expect(result).toMatchObject({ ok: false, code: "TURN_IDLE_TIMEOUT" });
    expect(calls.filter((call) => call.method === "turn/interrupt")).toEqual([
      { method: "turn/interrupt", params: { threadId: THREAD, turnId: "turn_1" } },
    ]);
    expect(result.attempts[0]).toMatchObject({
      outcome: "idleTimeout",
      status: "interrupted",
      lastMethod: "turn/started",
      elapsedMs: 180_000,
    });
  });

  it("interrupts a turn that streams past the hard cap", async () => {
    const clock = createManualClock();
    const { supervisor, calls } = fake(
      [
        (id, emit) => {
          for (let step = 1; step <= 20; step += 1)
            clock.setTimer(step * 60_000, () =>
              emit("item/agentMessage/delta", { threadId: THREAD, turnId: id }),
            );
        },
      ],
      (id, emit) =>
        emit("turn/completed", {
          threadId: THREAD,
          turn: { id, status: "interrupted", items: [] },
        }),
    );
    const run = runTurn(supervisor, { threadId: THREAD, input, clock });
    await flush();
    clock.advance(900_000);
    await flush();
    const result = await run;
    expect(result).toMatchObject({ ok: false, code: "TURN_HARD_TIMEOUT" });
    expect(calls.filter((call) => call.method === "turn/interrupt")).toHaveLength(1);
    expect(result.attempts[0]?.elapsedMs).toBe(900_000);
  });

  it("retries one transport failure that produced nothing, after the backoff", async () => {
    const clock = createManualClock();
    const budget = createRetryBudget(2);
    const { supervisor, turnStarts } = fake([
      (id, emit) => emit("turn/completed", failed(id, DISCONNECTED)),
      (id, emit) => emit("turn/completed", completed(id)),
    ]);
    const run = runTurn(supervisor, { threadId: THREAD, input, clock, retryBudget: budget });
    await flush();
    clock.advance(29_999);
    await flush();
    expect(turnStarts()).toBe(1);
    clock.advance(1);
    await flush();
    const result = await run;
    expect(result.ok).toBe(true);
    expect(result.attempts.map((attempt) => [attempt.outcome, attempt.transportRetry])).toEqual([
      ["failed", false],
      ["completed", true],
    ]);
    expect(result.attempts[0]?.failure).toMatchObject({
      variant: "responseStreamDisconnected",
      transport: true,
      additionalDetails: "error sending request",
    });
    expect(budget.remaining).toBe(1);
  });

  it("stops after a second transport failure on the same turn", async () => {
    const clock = createManualClock();
    const { supervisor } = fake([
      (id, emit) => emit("turn/completed", failed(id, DISCONNECTED)),
      (id, emit) => emit("turn/completed", failed(id, DISCONNECTED)),
    ]);
    const run = runTurn(supervisor, { threadId: THREAD, input, clock });
    await flush();
    clock.advance(30_000);
    await flush();
    const result = await run;
    expect(result).toMatchObject({ ok: false, code: "TURN_FAILED" });
    expect(result.attempts).toHaveLength(2);
  });

  it("never retries a failure that is not transport", async () => {
    const { supervisor, turnStarts } = fake([
      (id, emit) => emit("turn/completed", failed(id, "usageLimitExceeded")),
    ]);
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
    });
    expect(result).toMatchObject({ ok: false, code: "TURN_FAILED" });
    if (result.ok) return;
    expect(result.detail).toContain("usageLimitExceeded");
    expect(turnStarts()).toBe(1);
  });

  it("never retries a transport failure that already produced output", async () => {
    const { supervisor, turnStarts } = fake([
      (id, emit) =>
        emit(
          "turn/completed",
          failed(id, DISCONNECTED, [{ type: "agentMessage", text: "partial" }]),
        ),
    ]);
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
    });
    expect(result).toMatchObject({ ok: false, code: "TURN_FAILED" });
    expect(turnStarts()).toBe(1);
  });

  it("never retries once the run's budget is spent", async () => {
    const { supervisor, turnStarts } = fake([
      (id, emit) => emit("turn/completed", failed(id, DISCONNECTED)),
    ]);
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
      retryBudget: createRetryBudget(0),
    });
    expect(result).toMatchObject({ ok: false, code: "TURN_FAILED" });
    expect(turnStarts()).toBe(1);
  });

  it("fails the turn by name when the server asks something CuckCode will not answer", async () => {
    const { supervisor, calls } = fake(
      [(_id, _emit, refuse) => refuse("item/tool/requestUserInput")],
      (id, emit) =>
        emit("turn/completed", {
          threadId: THREAD,
          turn: { id, status: "interrupted", items: [] },
        }),
    );
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
    });
    expect(result).toMatchObject({ ok: false, code: "SERVER_REQUEST_REFUSED" });
    if (result.ok) return;
    expect(result.detail).toContain("item/tool/requestUserInput");
    expect(calls.some((call) => call.method === "turn/interrupt")).toBe(true);
  });

  it("reports a turn that could not be started", async () => {
    const supervisor: TurnSupervisor = {
      subscribe: () => () => undefined,
      request: async () => {
        throw new Error("PROCESS_EXITED");
      },
    };
    const result = await runTurn(supervisor, {
      threadId: THREAD,
      input,
      clock: createManualClock(),
    });
    expect(result).toMatchObject({ ok: false, code: "RUNTIME_FAILURE" });
    if (result.ok) return;
    expect(result.detail).toContain("PROCESS_EXITED");
  });

  it("refuses a limit a real timer cannot hold, instead of firing it at once", async () => {
    const { supervisor, turnStarts } = fake([(id, emit) => emit("turn/completed", completed(id))]);
    await expect(
      runTurn(supervisor, { threadId: THREAD, input, limits: { hardMs: 2 ** 31 } }),
    ).rejects.toThrow("TURN_LIMIT_OUT_OF_RANGE: hardMs");
    expect(turnStarts()).toBe(0);
  });

  describe("streamed items (DF-044)", () => {
    const fileChange = { type: "fileChange", id: "f1", status: "completed", changes: [] };
    const itemDone = (turnId: string, item: unknown, threadId = THREAD) => ({
      threadId,
      turnId,
      item,
    });

    it("returns items announced through item/completed that turn/completed omits", async () => {
      const { supervisor } = fake([
        (id, emit) => {
          emit("item/completed", itemDone(id, fileChange));
          emit("turn/completed", completed(id));
        },
      ]);
      const result = await runTurn(supervisor, {
        threadId: THREAD,
        input,
        clock: createManualClock(),
      });
      expect(result.ok).toBe(true);
      expect(result.streamedItems).toEqual([fileChange]);
      if (result.ok) expect(result.turn.items).toEqual([{ type: "agentMessage", text: "OK" }]);
    });

    it("does not collect items from another turn or another thread", async () => {
      const { supervisor } = fake([
        (id, emit) => {
          emit("item/completed", itemDone("turn_other", fileChange));
          emit("item/completed", itemDone(id, fileChange, "thread_other"));
          emit("turn/completed", completed(id));
        },
      ]);
      const result = await runTurn(supervisor, {
        threadId: THREAD,
        input,
        clock: createManualClock(),
      });
      expect(result.streamedItems).toEqual([]);
    });

    it("returns streamed items on a failed turn too", async () => {
      const { supervisor } = fake([
        (id, emit) => {
          emit("item/completed", itemDone(id, fileChange));
          emit("turn/completed", failed(id, "other"));
        },
      ]);
      const result = await runTurn(supervisor, {
        threadId: THREAD,
        input,
        clock: createManualClock(),
      });
      expect(result.ok).toBe(false);
      expect(result.streamedItems).toEqual([fileChange]);
    });
  });

  describe("started items (W2)", () => {
    const itemStarted = (turnId: string, id: string, threadId = THREAD) => ({
      threadId,
      turnId,
      item: { type: "reasoning", id },
    });

    it("returns the ids of items announced through item/started", async () => {
      const { supervisor } = fake([
        (id, emit) => {
          emit("item/started", itemStarted(id, "s1"));
          emit("item/started", itemStarted(id, "s2"));
          emit("turn/completed", completed(id));
        },
      ]);
      const result = await runTurn(supervisor, {
        threadId: THREAD,
        input,
        clock: createManualClock(),
      });
      expect(result.startedItemIds).toEqual(["s1", "s2"]);
    });

    it("does not collect ids from another turn or another thread", async () => {
      const { supervisor } = fake([
        (id, emit) => {
          emit("item/started", itemStarted("turn_other", "s1"));
          emit("item/started", itemStarted(id, "s2", "thread_other"));
          emit("turn/completed", completed(id));
        },
      ]);
      const result = await runTurn(supervisor, {
        threadId: THREAD,
        input,
        clock: createManualClock(),
      });
      expect(result.startedItemIds).toEqual([]);
    });

    it("returns started ids on a failed turn too", async () => {
      const { supervisor } = fake([
        (id, emit) => {
          emit("item/started", itemStarted(id, "s1"));
          emit("turn/completed", failed(id, "other"));
        },
      ]);
      const result = await runTurn(supervisor, {
        threadId: THREAD,
        input,
        clock: createManualClock(),
      });
      expect(result.ok).toBe(false);
      expect(result.startedItemIds).toEqual(["s1"]);
    });
  });
});
