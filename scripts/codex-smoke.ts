import { createHash } from "node:crypto";

import { attemptRecords, type TurnAttempt } from "@cuckcode/runtime-codex";

/**
 * CP-2, spec §4.4: one text-only turn at the pinned Codex, before any budgeted run.
 *
 * It asks the Release Reviewer on `gpt-5.6-sol` — the configuration behind passes 6–9 — for one
 * fixed JSON object, and records what ran, how the turn went, and every attempt with Codex's own
 * failure class. It is not a release review and produces no verdict.
 *
 * Its allowance is its own ledger, never the Phase 5 one. A run needs room for the turn and both
 * transport retries CX-4 permits, so one allowance of three covers exactly one smoke; every attempt
 * a retry used is spent, because the provider may have billed it.
 */
export type SmokeLedger = {
  budget: number;
  spent: number;
  entries: Array<Record<string, unknown>>;
};
export type SmokeTurn =
  | { ok: true; text: string; effects: unknown[]; attempts: TurnAttempt[] }
  | { ok: false; code: string; detail: string; effects: unknown[]; attempts: TurnAttempt[] };
export type SmokeSession = {
  report: { model: string; reasoningEffort: string | null; protocolVersion: string };
  turn: (text: string) => Promise<SmokeTurn>;
  close: () => Promise<void>;
};
export type SmokeDependencies = {
  optIn: boolean;
  pin: string;
  requestedModel: string;
  readLedger: () => Promise<SmokeLedger>;
  writeLedger: (ledger: SmokeLedger) => Promise<void>;
  openSession: () => Promise<
    { ok: true; session: SmokeSession } | { ok: false; code: string; detail: string }
  >;
  writeRecord: (record: Record<string, unknown>) => Promise<string>;
  now: () => string;
};

export const SMOKE_PROMPT = 'Reply with exactly this JSON object and nothing else: {"ok": true}';
/** One turn plus the two transport retries CX-4 allows a run. */
export const SMOKE_TURN_ALLOWANCE = 3;
const ROLE_ID = "release-reviewer";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

function answered(text: string): boolean {
  const body = (text.match(/```(?:json)?\s*([\s\S]*?)```/u)?.[1] ?? text).trim();
  try {
    const parsed = JSON.parse(body) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 1 &&
      (parsed as { ok?: unknown }).ok === true
    );
  } catch {
    return false;
  }
}

export async function runCodexSmoke(
  deps: SmokeDependencies,
): Promise<{ ok: boolean; code: string; recordPath: string | null }> {
  if (!deps.optIn) throw new Error("LIVE_SMOKE_EXPLICIT_OPT_IN_REQUIRED");
  const ledger = await deps.readLedger();
  if (ledger.budget - ledger.spent < SMOKE_TURN_ALLOWANCE) {
    throw new Error(`SMOKE_ALLOWANCE_EXHAUSTED: ${ledger.spent}/${ledger.budget}`);
  }

  const startedAt = deps.now();
  const base = {
    schema: "cuckcode.codex-smoke.v1",
    status: "A smoke turn, not a release review. It produces no verdict and approves nothing.",
    roleId: ROLE_ID,
    codexPin: deps.pin,
    requestedModel: deps.requestedModel,
    prompt: SMOKE_PROMPT,
    startedAt,
    verdict: null,
  };

  const opened = await deps.openSession();
  if (!opened.ok) {
    const recordPath = await deps.writeRecord({
      ...base,
      endedAt: deps.now(),
      observed: null,
      code: opened.code,
      detail: opened.detail,
      answerMatched: null,
      runtime: [],
    });
    ledger.entries.push({ at: startedAt, roleId: ROLE_ID, attempts: 0, code: opened.code });
    await deps.writeLedger(ledger);
    return { ok: false, code: opened.code, recordPath };
  }

  let turn: SmokeTurn;
  try {
    turn = await opened.session.turn(SMOKE_PROMPT);
  } finally {
    await opened.session.close();
  }

  const spent = Math.max(1, turn.attempts.length);
  const matched = turn.ok && turn.effects.length === 0 ? answered(turn.text) : null;
  const code = !turn.ok
    ? turn.code
    : turn.effects.length > 0
      ? "EXTERNAL_EFFECT_OBSERVED"
      : matched
        ? "SMOKE_OK"
        : "SMOKE_ANSWER_MISMATCH";

  const recordPath = await deps.writeRecord({
    ...base,
    endedAt: deps.now(),
    observed: {
      model: opened.session.report.model,
      reasoningEffort: opened.session.report.reasoningEffort,
      protocolVersion: opened.session.report.protocolVersion,
    },
    code,
    ...(turn.ok ? {} : { detail: turn.detail }),
    answerMatched: matched,
    // The answer's digest, never its text: a mismatch is recorded, not transcribed.
    ...(turn.ok ? { responseSha256: sha256(turn.text) } : {}),
    runtime: attemptRecords(turn.attempts),
  });
  ledger.spent += spent;
  ledger.entries.push({ at: startedAt, roleId: ROLE_ID, attempts: spent, code });
  await deps.writeLedger(ledger);
  return { ok: code === "SMOKE_OK", code, recordPath };
}
