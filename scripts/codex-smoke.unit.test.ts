import { describe, expect, it } from "vitest";

import type { TurnAttempt } from "@cuckcode/runtime-codex";

import {
  SMOKE_PROMPT,
  runCodexSmoke,
  type SmokeDependencies,
  type SmokeLedger,
  type SmokeTurn,
} from "./codex-smoke.js";

const attempt = (overrides: Partial<TurnAttempt> = {}): TurnAttempt => ({
  attempt: 1,
  transportRetry: false,
  turnId: "turn_1",
  outcome: "completed",
  status: "completed",
  failure: null,
  retries: [],
  refusedServerRequest: null,
  lastMethod: "turn/completed",
  elapsedMs: 6_000,
  ...overrides,
});

function rehearsal(
  turn: SmokeTurn | "unopened",
  ledger: SmokeLedger = { budget: 3, spent: 0, entries: [] },
) {
  const written: {
    ledger: SmokeLedger | null;
    records: Array<Record<string, unknown>>;
    prompts: string[];
    closed: number;
  } = {
    ledger: null,
    records: [],
    prompts: [],
    closed: 0,
  };
  const deps: SmokeDependencies = {
    optIn: true,
    pin: "0.157.1",
    requestedModel: "gpt-5.6-sol",
    readLedger: async () => structuredClone(ledger),
    writeLedger: async (next) => {
      written.ledger = next;
    },
    openSession: async () =>
      turn === "unopened"
        ? { ok: false, code: "CODEX_DRIFT", detail: "CODEX_BINARY_VERSION_DRIFT" }
        : {
            ok: true,
            session: {
              report: {
                model: "gpt-5.6-sol",
                reasoningEffort: "medium",
                protocolVersion: "0.157.1",
              },
              turn: async (text) => {
                written.prompts.push(text);
                return turn;
              },
              close: async () => {
                written.closed += 1;
              },
            },
          },
    writeRecord: async (record) => {
      written.records.push(record);
      return "docs/evidence/runtime/smoke/x.json";
    },
    now: () => "2026-09-26T12:00:00.000Z",
  };
  return { deps, written };
}

describe("the Codex smoke turn", () => {
  it("refuses without the explicit opt-in, before touching the ledger", async () => {
    const { deps, written } = rehearsal({
      ok: true,
      text: '{"ok": true}',
      effects: [],
      attempts: [attempt()],
    });
    await expect(runCodexSmoke({ ...deps, optIn: false })).rejects.toThrow(
      "LIVE_SMOKE_EXPLICIT_OPT_IN_REQUIRED",
    );
    expect(written.ledger).toBeNull();
  });

  it("refuses once its allowance cannot cover a turn and both retries", async () => {
    const { deps, written } = rehearsal(
      { ok: true, text: '{"ok": true}', effects: [], attempts: [attempt()] },
      { budget: 3, spent: 1, entries: [] },
    );
    await expect(runCodexSmoke(deps)).rejects.toThrow("SMOKE_ALLOWANCE_EXHAUSTED: 1/3");
    expect(written.records).toEqual([]);
  });

  it("records one answered turn, what ran, and every attempt, and spends one", async () => {
    const { deps, written } = rehearsal({
      ok: true,
      text: '{"ok": true}',
      effects: [],
      attempts: [attempt()],
    });
    const outcome = await runCodexSmoke(deps);
    expect(outcome).toEqual({
      ok: true,
      code: "SMOKE_OK",
      recordPath: "docs/evidence/runtime/smoke/x.json",
    });
    expect(written.prompts).toEqual([SMOKE_PROMPT]);
    expect(written.closed).toBe(1);
    expect(written.records[0]).toMatchObject({
      schema: "cuckcode.codex-smoke.v1",
      roleId: "release-reviewer",
      codexPin: "0.157.1",
      requestedModel: "gpt-5.6-sol",
      observed: { model: "gpt-5.6-sol", reasoningEffort: "medium", protocolVersion: "0.157.1" },
      code: "SMOKE_OK",
      answerMatched: true,
      verdict: null,
    });
    expect(written.records[0]?.runtime).toEqual([
      expect.objectContaining({ attempt: 1, outcome: "completed", failure: null }),
    ]);
    expect(written.ledger).toMatchObject({ budget: 3, spent: 1 });
  });

  it("spends every attempt a transport retry used, so the ledger never under-reports", async () => {
    const failure = {
      message: "stream disconnected",
      variant: "responseStreamDisconnected",
      httpStatusCode: null,
      additionalDetails: null,
      transport: true,
    };
    const { deps, written } = rehearsal({
      ok: false,
      code: "TURN_FAILED",
      detail: "turn turn_2 reported status failed",
      effects: [],
      attempts: [
        attempt({ outcome: "failed", status: "failed", failure }),
        attempt({
          attempt: 2,
          turnId: "turn_2",
          transportRetry: true,
          outcome: "failed",
          status: "failed",
          failure,
        }),
      ],
    });
    const outcome = await runCodexSmoke(deps);
    expect(outcome).toMatchObject({ ok: false, code: "TURN_FAILED" });
    expect(written.ledger).toMatchObject({ spent: 2 });
    expect(written.records[0]?.runtime).toHaveLength(2);
  });

  it("records an answer that is not the requested one as a completed turn with a mismatch", async () => {
    const { deps, written } = rehearsal({
      ok: true,
      text: "Sure! Here you go.",
      effects: [],
      attempts: [attempt()],
    });
    const outcome = await runCodexSmoke(deps);
    expect(outcome.code).toBe("SMOKE_ANSWER_MISMATCH");
    expect(written.records[0]).toMatchObject({ answerMatched: false });
    expect(JSON.stringify(written.records[0])).not.toContain("Sure! Here you go.");
  });

  it("records a session that never opened and spends nothing", async () => {
    const { deps, written } = rehearsal("unopened");
    const outcome = await runCodexSmoke(deps);
    expect(outcome).toMatchObject({ ok: false, code: "CODEX_DRIFT" });
    expect(written.records[0]).toMatchObject({ code: "CODEX_DRIFT", runtime: [] });
    expect(written.ledger).toMatchObject({ spent: 0 });
  });
});
