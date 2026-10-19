import { performance } from "node:perf_hooks";

import { sharedUtteranceVerdictSchema, type VerdictRow } from "@cuckcode/contracts";

import type { ExecutionStore } from "./execution-store.js";
import type { LampLiveFeed } from "./lamp-live-feed.js";
import { LAMP_V2_PROMPT_VERSION, type LampLabel } from "./lamp-v2.js";

// The hosted lamp pipeline (R4, Track A). A port of B's attemptUtteranceCapture
// (feature/lamp-body-phase-b:apps/server/src/workflow-observer.ts) onto the hosted loop:
// observe -> dedupe -> classify -> B's verdict row -> lamp_verdicts -> lamp.verdict on the feed.
//
// What changed, and why:
// - The source is the hosted loop's committed assistant turn (execution-loop.ts observer), not a
//   Codex item/completed notification. One reply per turn, complete, never streamed.
// - Rows go to lamp_verdicts in executions.sqlite, not <artifactRoot>/<attemptId>/lamp-verdicts.jsonl:
//   Railway's filesystem is ephemeral.
// - B also wrote an utterance/recorded ProjectEvent. The hosted server has no canonical log, and
//   verdicts never enter one (projection-only), so that event is not written here.
// - Latency: B's flag-only degrade rule is kept as-is (no enforcement). In addition, each
//   utterance's end-to-end wall-clock (observe() called -> verdict published) is recorded.

/** B's constants, unchanged. Flag only; nothing is enforced. */
export const LAMP_BUDGET_MS = 10_000;
export const MAX_PENDING_UTTERANCES = 8;

export type ObservedUtterance = Readonly<{
  /** The attempt: one work_executions row. */
  executionId: string;
  /** 1-based ordinal of this assistant entry in the execution's transcript (the turn index). */
  turnIndex: number;
  /** 1-based ordinal among the transcript's non-empty assistant entries (B's verdict index). */
  utteranceIndex: number;
  text: string;
}>;

export type Classify = (
  text: string,
) => Promise<Readonly<{ verdict: LampLabel; latencyMs: number }>>;

export type LampLatencySample = Readonly<{
  executionId: string;
  turnIndex: number;
  /** End-to-end: observe() -> verdict persisted and published. */
  endToEndMs: number;
  /** Classifier-reported (Ollama call) time, B's measure. */
  classifyMs: number;
}>;

/** B's id formula, with B's per-turn utterance index fixed at 1 (one reply per hosted turn). */
export function lampUtteranceId(executionId: string, turnIndex: number): string {
  return `utterance_${executionId}_${turnIndex}_1`;
}

/** Inverse of lampUtteranceId for the triage join; undefined for an id of another shape. */
export function turnIndexFromUtteranceId(
  executionId: string,
  utteranceId: string,
): number | undefined {
  const prefix = `utterance_${executionId}_`;
  if (!utteranceId.startsWith(prefix) || !utteranceId.endsWith("_1")) return undefined;
  const turn = Number(utteranceId.slice(prefix.length, -2));
  return Number.isInteger(turn) && turn >= 1 ? turn : undefined;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]!;
}

export function createLampPipeline(options: {
  store: ExecutionStore;
  feed: LampLiveFeed;
  classify: Classify;
  now?: () => string;
  /** Monotonic milliseconds (tests). Defaults to performance.now. */
  clock?: () => number;
}) {
  const now = options.now ?? (() => new Date().toISOString());
  const clock = options.clock ?? (() => performance.now());
  const seen = new Set<string>();
  const pending = new Set<Promise<void>>();
  const samples: LampLatencySample[] = [];
  let degraded = false;
  let failures = 0;
  let lastFailure: string | null = null;

  async function classifyAndPublish(utterance: ObservedUtterance, observedAt: number, ts: string) {
    const started = clock();
    const classification = await options.classify(utterance.text);
    const classifyMs = Math.max(classification.latencyMs, clock() - started);
    const verdictTs = now();
    const candidate = {
      id: lampUtteranceId(utterance.executionId, utterance.turnIndex),
      session_id: `main-chat assistant utterances; ${utterance.executionId}`,
      index: utterance.utteranceIndex,
      sourceItemId: `${utterance.executionId}:assistant:${utterance.turnIndex}`,
      turnIndex: utterance.turnIndex,
      speaker: "assistant" as const,
      text: utterance.text,
      timestamp: ts,
      gold_lamp: null,
      gold_speech_act: null,
      ambiguous: null,
      source: "runtime" as const,
      notes: "Runtime capture; gold intentionally unset.",
      verdict: classification.verdict,
      verdictTs,
      promptVersion: LAMP_V2_PROMPT_VERSION,
    };
    const parsed = sharedUtteranceVerdictSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(
        `VERDICT_ROW_INVALID:${parsed.error.issues.map((issue) => issue.path.join(".")).join(",")}`,
      );
    }
    const row: VerdictRow = parsed.data;
    const endToEndMs = clock() - observedAt;
    options.store.insertVerdict(utterance.executionId, row, endToEndMs);
    options.feed.publish({
      type: "lamp.verdict",
      attemptId: utterance.executionId,
      utteranceId: row.id,
      ts: verdictTs,
      verdict: row.verdict,
    });
    samples.push({
      executionId: utterance.executionId,
      turnIndex: utterance.turnIndex,
      endToEndMs,
      classifyMs,
    });
    if (endToEndMs > LAMP_BUDGET_MS) degraded = true;
  }

  return {
    /**
     * The execution loop's observer. Synchronous and non-throwing: classification runs in the
     * background, and its failures are counted here, never surfaced to the loop.
     */
    observe(utterance: ObservedUtterance): void {
      const observedAt = clock();
      try {
        if (!utterance.text.trim()) return;
        const key = `${utterance.executionId}:${utterance.turnIndex}`;
        if (seen.has(key)) return;
        seen.add(key);
        const task = classifyAndPublish(utterance, observedAt, now()).catch((error: unknown) => {
          failures += 1;
          lastFailure = error instanceof Error ? error.message.slice(0, 120) : "LAMP_FAILED";
          degraded = true;
        });
        pending.add(task);
        void task.finally(() => pending.delete(task));
        if (pending.size > MAX_PENDING_UTTERANCES) degraded = true;
      } catch {
        degraded = true;
      }
    },
    snapshot() {
      const endToEnd = samples.map((sample) => sample.endToEndMs);
      return {
        degraded,
        pending: pending.size,
        failures,
        lastFailure,
        latency: {
          count: endToEnd.length,
          p50Ms: percentile(endToEnd, 50),
          p95Ms: percentile(endToEnd, 95),
        },
      };
    },
    latencySamples(): readonly LampLatencySample[] {
      return [...samples];
    },
    /** Resolves once every classification started so far has settled. */
    async flush(): Promise<void> {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}

export type LampPipeline = ReturnType<typeof createLampPipeline>;
