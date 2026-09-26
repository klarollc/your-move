import type { RuntimeBindingReport } from "@cuckcode/contracts";

import { runTurn, type Clock, type TurnSupervisor } from "./turn-runner.js";
import { attemptRecords, type AttemptRecord } from "./attempt-record.js";
import { classifyTurnItems } from "./item-classification.js";
import { buildBindingReport, collectHandshakeFacts, type BindingExpectation } from "./binding.js";
import { featureDisableConfig } from "./feature-policy.js";
import { enumerateMcpServers } from "./tool-surface.js";

/**
 * The task is deliberately identical for every role. Role-specific instruction belongs only in
 * the controlled Codex home, so this text cannot become a second role template that drifts from
 * the reviewed artifact.
 */
export const STANDARD_ROLE_EXERCISE_PROMPT =
  "State briefly, in your own words, the responsibility this role holds in CuckCode and what it refuses to do. Do not call tools, access files, use network tools, connectors, subagents, or perform any external effect.";

export type ExerciseSupervisor = Readonly<{
  start: () => Promise<{
    codexHome: string;
    platformFamily: string;
    platformOs: string;
    userAgent: string;
  }>;
  readAccountStatus: () => Promise<
    { ok: true; mode: "chatgpt" | "api_key_managed" } | { ok: false; code: "AUTH_REQUIRED" }
  >;
  request: (
    method: string,
    params: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<unknown>;
  subscribe: TurnSupervisor["subscribe"];
  stop: () => Promise<void>;
}>;

export type RoleExerciseResult =
  | Readonly<{
      performed: true;
      binding: RuntimeBindingReport;
      threadId: string;
      turnId: string;
      responseText: string;
      /** The runner's attempts, for the exercise record (R6.1). */
      runtime: AttemptRecord[];
    }>
  | Readonly<{
      performed: false;
      code:
        | "AUTH_REQUIRED"
        | "EFFORT_CONFIGURATION_REQUIRED"
        | "INSTRUCTION_SOURCE_MISMATCH"
        | "HANDSHAKE_FACTS_INCOMPLETE"
        | "BINDING_REFUSED"
        | "TURN_COMPLETION_INVALID"
        | "EXTERNAL_EFFECT_OBSERVED"
        | "TEXT_ONLY_VIOLATION"
        | "UNCLASSIFIED_ITEM_TYPE"
        | "RUNTIME_FAILURE";
      detail: string;
      /** Present once a turn was attempted; absent for refusals before any turn. */
      runtime?: AttemptRecord[];
    }>;

/**
 * Exercises one role through precisely one provider turn. It never writes the exercise record:
 * record promotion is a separate, reviewable action, and a failed or mismatched run must remain
 * visibly unperformed instead of becoming a partial approval artifact.
 */
export async function runRoleExercise(input: {
  supervisor: ExerciseSupervisor;
  cwd: string;
  expectedInstructionSource: string;
  agentId: string;
  bindingId: string;
  roleId: string;
  expected: BindingExpectation;
  /** Defaults to the standard one-turn exercise. A different bounded task may be posed here. */
  taskPrompt?: string;
  /** Text sent as the turn input. Defaults to the exercise's own opening line. */
  turnInput?: string;
  /** Injected in tests; live runs use the system clock. */
  clock?: Clock;
}): Promise<RoleExerciseResult> {
  if (input.expected.expectedReasoningEffort === null) {
    return {
      performed: false,
      code: "EFFORT_CONFIGURATION_REQUIRED",
      detail: "a role exercise requires an explicit approved reasoning effort",
    };
  }

  try {
    const initialized = await input.supervisor.start();
    const auth = await input.supervisor.readAccountStatus();
    if (!auth.ok) {
      return {
        performed: false,
        code: "AUTH_REQUIRED",
        detail: "managed runtime authentication absent",
      };
    }

    const threadStart = await input.supervisor.request(
      "thread/start",
      exerciseThreadStartParams(input.cwd, input.expected, input.taskPrompt),
      30_000,
    );
    if (!hasExactInstructionSource(threadStart, input.expectedInstructionSource)) {
      return {
        performed: false,
        code: "INSTRUCTION_SOURCE_MISMATCH",
        detail: "the session did not load exactly the controlled role instruction file",
      };
    }
    // F1.3: what the session started, listed before any turn so the binding can refuse it.
    const mcpServers = await enumerateMcpServers(
      input.supervisor,
      nestedId(threadStart, "thread") ?? null,
    );

    let facts;
    try {
      facts = collectHandshakeFacts({
        agentId: input.agentId,
        bindingId: input.bindingId,
        roleId: input.roleId,
        userAgent: initialized.userAgent,
        auth,
        threadStart,
        mcpServers,
      });
    } catch {
      return {
        performed: false,
        code: "HANDSHAKE_FACTS_INCOMPLETE",
        detail: "the runtime did not report every required binding fact",
      };
    }

    const binding = buildBindingReport(facts, input.expected);
    if (!binding.ok) {
      return {
        performed: false,
        code: "BINDING_REFUSED",
        detail: `${binding.failure.code}: ${binding.failure.detail}`,
      };
    }

    const threadId = nestedId(threadStart, "thread");
    if (!threadId) {
      return {
        performed: false,
        code: "TURN_COMPLETION_INVALID",
        detail: "thread/start omitted the provider thread identifier",
      };
    }
    // The shared runner (CP-3) replaces a 90 s wait for the first cached turn/completed, which
    // could have returned another turn's completion.
    const run = await runTurn(input.supervisor, {
      threadId,
      input: [{ type: "text", text: input.turnInput ?? "Begin the bounded role exercise." }],
      ...(input.clock ? { clock: input.clock } : {}),
    });
    const runtime = attemptRecords(run.attempts);
    if (!run.ok) {
      const incomplete = run.code === "TURN_FAILED" || run.code === "TURN_INTERRUPTED";
      return {
        performed: false,
        code: incomplete ? "TURN_COMPLETION_INVALID" : "RUNTIME_FAILURE",
        detail: incomplete ? run.detail : `${run.code}: ${run.detail}`,
        runtime,
      };
    }
    const turnId = run.turn.id;
    const completed = { method: "turn/completed", params: { threadId, turn: run.turn } };
    const checked = checkCompletedTurn(completed, threadId, turnId);
    if (!checked.ok) return { ...checked.result, runtime };
    return {
      performed: true,
      binding: binding.report,
      threadId,
      turnId,
      responseText: checked.responseText,
      runtime,
    };
  } catch {
    return {
      performed: false,
      code: "RUNTIME_FAILURE",
      detail: "the exercise runtime did not complete its bounded request",
    };
  } finally {
    await input.supervisor.stop();
  }
}

export function exerciseThreadStartParams(
  cwd: string,
  expected: BindingExpectation,
  taskPrompt: string = STANDARD_ROLE_EXERCISE_PROMPT,
): Record<string, unknown> {
  return {
    cwd,
    ephemeral: true,
    model: expected.requestedModel,
    // This is the bounded posture observed back from thread/start, not a client-side assertion.
    sandbox: "read-only",
    approvalPolicy: "never",
    approvalsReviewer: "user",
    // The role's identity comes only from its controlled home; the task is attached at
    // thread/start, as the approved channel split requires. Parameterised so a second bounded
    // caller can pose a different task without a second copy of the posture above — the sandbox,
    // approval policy and effort are the parts that must never vary by caller.
    baseInstructions: taskPrompt,
    // The feature policy (F1.1) rides on the one place every caller builds thread/start from.
    config: {
      model_reasoning_effort: expected.expectedReasoningEffort,
      features: featureDisableConfig(),
    },
  };
}

function hasExactInstructionSource(threadStart: unknown, expected: string): boolean {
  const sources = record(threadStart)?.instructionSources;
  return Array.isArray(sources) && sources.length === 1 && sources[0] === expected;
}

function nestedId(value: unknown, key: string): string | undefined {
  return text(record(record(value)?.[key])?.id);
}

function checkCompletedTurn(
  completed: Record<string, unknown>,
  expectedThreadId: string,
  expectedTurnId: string,
):
  | { ok: true; responseText: string }
  | { ok: false; result: Extract<RoleExerciseResult, { performed: false }> } {
  const params = record(completed.params);
  const turn = record(params?.turn);
  if (
    completed.method !== "turn/completed" ||
    params?.threadId !== expectedThreadId ||
    turn?.id !== expectedTurnId ||
    turn?.status !== "completed" ||
    !Array.isArray(turn?.items)
  ) {
    return {
      ok: false,
      result: {
        performed: false,
        code: "TURN_COMPLETION_INVALID",
        detail: "the runtime did not report completion for the requested text turn",
      },
    };
  }

  const itemTypes = turn.items.map((item) => text(record(item)?.type) ?? "unknown");
  const { effects: external, unclassified } = classifyTurnItems(turn.items);
  if (unclassified.length > 0) {
    return {
      ok: false,
      result: {
        performed: false,
        code: "UNCLASSIFIED_ITEM_TYPE",
        detail: `the turn reported item types with no classification: ${unclassified.join(", ")}`,
      },
    };
  }
  if (external.length > 0) {
    return {
      ok: false,
      result: {
        performed: false,
        code: "EXTERNAL_EFFECT_OBSERVED",
        detail: `the turn reported external effect item types: ${external.join(", ")}`,
      },
    };
  }
  if (itemTypes.some((type) => type !== "agentMessage")) {
    return {
      ok: false,
      result: {
        performed: false,
        code: "TEXT_ONLY_VIOLATION",
        detail: `the text-only turn reported item types: ${itemTypes.join(", ")}`,
      },
    };
  }
  const responseTexts = turn.items
    .map((item) => record(item))
    .map((item) => (item?.type === "agentMessage" ? text(item.text) : undefined))
    .filter((item): item is string => item !== undefined);
  if (responseTexts.length !== 1) {
    return {
      ok: false,
      result: {
        performed: false,
        code: "TURN_COMPLETION_INVALID",
        detail: "the text-only turn did not carry exactly one non-empty agent message",
      },
    };
  }
  const responseText = responseTexts[0];
  if (responseText === undefined) throw new Error("RESPONSE_TEXT_MISSING");
  return { ok: true, responseText };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
