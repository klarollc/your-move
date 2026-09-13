import type { RuntimeBindingReport } from "@cuckcode/contracts";

import { buildBindingReport, collectHandshakeFacts, type BindingExpectation } from "./binding.js";

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
  waitForNotification: (method: string, timeoutMs?: number) => Promise<Record<string, unknown>>;
  stop: () => Promise<void>;
}>;

export type RoleExerciseResult =
  | Readonly<{
      performed: true;
      binding: RuntimeBindingReport;
      threadId: string;
      turnId: string;
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
        | "RUNTIME_FAILURE";
      detail: string;
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
      exerciseThreadStartParams(input.cwd, input.expected),
      30_000,
    );
    if (!hasExactInstructionSource(threadStart, input.expectedInstructionSource)) {
      return {
        performed: false,
        code: "INSTRUCTION_SOURCE_MISMATCH",
        detail: "the session did not load exactly the controlled role instruction file",
      };
    }

    let facts;
    try {
      facts = collectHandshakeFacts({
        agentId: input.agentId,
        bindingId: input.bindingId,
        roleId: input.roleId,
        userAgent: initialized.userAgent,
        auth,
        threadStart,
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
      return { performed: false, code: "BINDING_REFUSED", detail: binding.failure.code };
    }

    const threadId = nestedId(threadStart, "thread");
    if (!threadId) {
      return {
        performed: false,
        code: "TURN_COMPLETION_INVALID",
        detail: "thread/start omitted the provider thread identifier",
      };
    }
    const turnStart = await input.supervisor.request(
      "turn/start",
      {
        threadId,
        input: [{ type: "text", text: "Begin the bounded role exercise." }],
      },
      30_000,
    );
    const turnId = nestedId(turnStart, "turn");
    if (!turnId) {
      return {
        performed: false,
        code: "TURN_COMPLETION_INVALID",
        detail: "turn/start omitted the provider turn identifier",
      };
    }

    const completed = await input.supervisor.waitForNotification("turn/completed", 90_000);
    const checked = checkCompletedTurn(completed, threadId, turnId);
    if (!checked.ok) return checked.result;
    return { performed: true, binding: binding.report, threadId, turnId };
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
): Record<string, unknown> {
  return {
    cwd,
    ephemeral: true,
    model: expected.requestedModel,
    // This is the bounded posture observed back from thread/start, not a client-side assertion.
    sandbox: "read-only",
    approvalPolicy: "never",
    approvalsReviewer: "user",
    // The role's identity comes only from its controlled home; this common task contract is
    // deliberately attached at thread/start, as the approved channel split requires.
    baseInstructions: STANDARD_ROLE_EXERCISE_PROMPT,
    config: { model_reasoning_effort: expected.expectedReasoningEffort },
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
): { ok: true } | { ok: false; result: Extract<RoleExerciseResult, { performed: false }> } {
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
  const external = itemTypes.filter((type) => EXTERNAL_EFFECT_ITEM_TYPES.has(type));
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
  return { ok: true };
}

const EXTERNAL_EFFECT_ITEM_TYPES = new Set([
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "webSearch",
  "imageGeneration",
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
