import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sharedLampVerdictMessageSchema, sharedUtteranceVerdictSchema } from "@cuckcode/contracts";

import { openExecutionStore } from "./execution-store.js";
import { createLampLiveFeed } from "./lamp-live-feed.js";
import {
  LAMP_BUDGET_MS,
  createLampPipeline,
  lampUtteranceId,
  percentile,
  turnIndexFromUtteranceId,
  type Classify,
} from "./lamp-pipeline.js";

const directories: string[] = [];
const stores: ReturnType<typeof openExecutionStore>[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function storeWithExecution() {
  const directory = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r4-lamp-"));
  directories.push(directory);
  const store = openExecutionStore({ dataDir: directory });
  stores.push(store);
  const execution = store.enqueue({
    draftId: "draft_1",
    revision: 1,
    maxTurns: 10,
    transcript: [],
    now: new Date().toISOString(),
  });
  return { store, executionId: execution.id };
}

describe("hosted lamp pipeline (R4 Track A)", () => {
  it("classifies each utterance once, stores B's row, and publishes B's textless message", async () => {
    const { store, executionId } = storeWithExecution();
    const feed = createLampLiveFeed();
    const published: unknown[] = [];
    feed.subscribe((message) => published.push(message));
    const texts: string[] = [];
    const classify: Classify = async (text) => {
      texts.push(text);
      return { verdict: text.includes("review") ? "lamp" : "no-lamp", latencyMs: 5 };
    };
    const pipeline = createLampPipeline({ store, feed, classify });

    pipeline.observe({ executionId, turnIndex: 2, utteranceIndex: 1, text: "Reading first." });
    pipeline.observe({ executionId, turnIndex: 2, utteranceIndex: 1, text: "Reading first." });
    pipeline.observe({ executionId, turnIndex: 3, utteranceIndex: 2, text: "   " });
    pipeline.observe({
      executionId,
      turnIndex: 4,
      utteranceIndex: 2,
      text: "Ready for your review.",
    });
    await pipeline.flush();

    expect(texts).toEqual(["Reading first.", "Ready for your review."]);
    const rows = store.listVerdicts(executionId);
    expect(
      rows.map((row) => [row.row.id, row.row.index, row.row.turnIndex, row.row.verdict]),
    ).toEqual([
      [lampUtteranceId(executionId, 2), 1, 2, "no-lamp"],
      [lampUtteranceId(executionId, 4), 2, 4, "lamp"],
    ]);
    for (const row of rows) expect(sharedUtteranceVerdictSchema.parse(row.row)).toEqual(row.row);
    expect(published).toHaveLength(2);
    for (const message of published) {
      expect(Object.keys(message as object).sort()).toEqual(
        ["attemptId", "ts", "type", "utteranceId", "verdict"].sort(),
      );
      expect(sharedLampVerdictMessageSchema.parse(message)).toEqual(message);
      expect(message).not.toHaveProperty("text");
    }
    expect(turnIndexFromUtteranceId(executionId, lampUtteranceId(executionId, 4))).toBe(4);
    expect(turnIndexFromUtteranceId("other", lampUtteranceId(executionId, 4))).toBeUndefined();
  });

  it("keeps B's flag-only degrade rule: over budget or a failing classifier sets degraded, nothing throws", async () => {
    const { store, executionId } = storeWithExecution();
    let now = 0;
    const slow = createLampPipeline({
      store,
      feed: createLampLiveFeed(),
      clock: () => now,
      classify: async () => {
        now += LAMP_BUDGET_MS + 1;
        return { verdict: "lamp", latencyMs: LAMP_BUDGET_MS + 1 };
      },
    });
    slow.observe({ executionId, turnIndex: 1, utteranceIndex: 1, text: "Please review." });
    await slow.flush();
    expect(slow.snapshot()).toMatchObject({ degraded: true, failures: 0 });
    expect(slow.snapshot().latency.p95Ms).toBe(LAMP_BUDGET_MS + 1);

    const failing = createLampPipeline({
      store,
      feed: createLampLiveFeed(),
      classify: async () => {
        throw new Error("LAMP_INVALID_BINARY_RESPONSE");
      },
    });
    expect(() =>
      failing.observe({ executionId, turnIndex: 2, utteranceIndex: 2, text: "x" }),
    ).not.toThrow();
    await failing.flush();
    expect(failing.snapshot()).toMatchObject({
      degraded: true,
      failures: 1,
      lastFailure: "LAMP_INVALID_BINARY_RESPONSE",
    });
  });

  it("flags degraded when more than eight classifications are pending (B's MAX_PENDING_UTTERANCES)", async () => {
    const { store, executionId } = storeWithExecution();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const pipeline = createLampPipeline({
      store,
      feed: createLampLiveFeed(),
      classify: async () => {
        await gate;
        return { verdict: "no-lamp", latencyMs: 1 };
      },
    });
    for (let turn = 1; turn <= 8; turn += 1) {
      pipeline.observe({ executionId, turnIndex: turn, utteranceIndex: turn, text: `t${turn}` });
    }
    expect(pipeline.snapshot().degraded).toBe(false);
    pipeline.observe({ executionId, turnIndex: 9, utteranceIndex: 9, text: "t9" });
    expect(pipeline.snapshot().degraded).toBe(true);
    release();
    await pipeline.flush();
    expect(store.listVerdicts(executionId)).toHaveLength(9);
  });

  it("computes nearest-rank percentiles", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
  });
});
