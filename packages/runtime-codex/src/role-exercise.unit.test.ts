import { describe, expect, it } from "vitest";

import type { BindingExpectation } from "./binding.js";
import { featureDisableConfig } from "./feature-policy.js";
import {
  STANDARD_ROLE_EXERCISE_PROMPT,
  exerciseThreadStartParams,
  hasExactInstructionSource,
  runRoleExercise,
  type ExerciseSupervisor,
} from "./role-exercise.js";
import type { SupervisorEvent } from "./supervisor.js";

const expected = {
  requestedModel: "gpt-5.6-luna",
  expectedReasoningEffort: "medium",
  expectedAuthMode: "chatgpt",
  protocolVersion: "0.146.0",
  promotedContentSha256: "authored-delivery-lead-v1",
} satisfies BindingExpectation;

const observedThread = {
  thread: { id: "thread_1" },
  model: "gpt-5.6-luna",
  reasoningEffort: "medium",
  sandbox: { type: "readOnly", networkAccess: false },
  approvalPolicy: "never",
  multiAgentMode: "explicitRequestOnly",
  instructionSources: ["C:/controlled/delivery-lead/AGENTS.md"],
};

function supervisor(
  overrides: Partial<{ threadStart: unknown; completed: unknown; mcpServers: unknown[] }> = {},
) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const listeners = new Set<(event: SupervisorEvent) => void>();
  const completion = (overrides.completed ?? {
    method: "turn/completed",
    params: {
      threadId: "thread_1",
      turn: {
        id: "turn_1",
        status: "completed",
        items: [{ id: "item_1", type: "agentMessage", text: "EXERCISE_OK" }],
      },
    },
  }) as { method: string; params: unknown };
  const instance: ExerciseSupervisor = {
    async start() {
      return {
        codexHome: "C:/controlled/delivery-lead",
        platformFamily: "windows",
        platformOs: "windows",
        userAgent: "CuckCode/0.146.0 (Windows)",
      };
    },
    async readAccountStatus() {
      return { ok: true, mode: "chatgpt" };
    },
    async request(method, params) {
      calls.push({ method, params });
      if (method === "thread/start") return overrides.threadStart ?? observedThread;
      if (method === "mcpServerStatus/list")
        return { data: overrides.mcpServers ?? [], nextCursor: null };
      if (method === "turn/start") {
        // The completion arrives as a notification after turn/start answers, as it does live.
        queueMicrotask(() => {
          for (const listener of [...listeners])
            listener({
              kind: "notification",
              method: completion.method,
              params: completion.params,
            });
        });
        return { turn: { id: "turn_1" } };
      }
      throw new Error(`unexpected method ${method}`);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    async stop() {},
  };
  return { instance, calls };
}

describe("role exercise runner", () => {
  it("runs exactly one text-only turn after observed binding and instruction-source checks", async () => {
    const fake = supervisor();

    const result = await runRoleExercise({
      supervisor: fake.instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });

    expect(result).toMatchObject({
      performed: true,
      threadId: "thread_1",
      turnId: "turn_1",
      responseText: "EXERCISE_OK",
    });
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[0]).toMatchObject({
      method: "thread/start",
      params: {
        cwd: "C:/synthetic/role-exercise",
        ephemeral: true,
        model: "gpt-5.6-luna",
        sandbox: "read-only",
        approvalPolicy: "never",
        baseInstructions: STANDARD_ROLE_EXERCISE_PROMPT,
        config: { model_reasoning_effort: "medium", features: featureDisableConfig() },
      },
    });
    // F1.3: the servers the session started are listed before anything else can happen.
    expect(fake.calls[1]).toEqual({
      method: "mcpServerStatus/list",
      params: { threadId: "thread_1", detail: "toolsAndAuthOnly" },
    });
    expect(fake.calls[2]).toEqual({
      method: "turn/start",
      params: {
        threadId: "thread_1",
        input: [{ type: "text", text: "Begin the bounded role exercise." }],
      },
    });
  });

  it("refuses before a turn when the session started an MCP server, naming it", async () => {
    const fake = supervisor({
      mcpServers: [
        {
          name: "codex_apps",
          authStatus: "oAuth",
          runtimeStatus: "connected",
          tools: { github_search: {} },
          resources: [],
          resourceTemplates: [],
        },
      ],
    });

    const result = await runRoleExercise({
      supervisor: fake.instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });

    expect(result).toMatchObject({ performed: false, code: "BINDING_REFUSED" });
    expect(result.performed ? "" : result.detail).toMatch(/^TOOL_SURFACE_PRESENT: .*codex_apps/u);
    expect(fake.calls.map(({ method }) => method)).toEqual([
      "thread/start",
      "mcpServerStatus/list",
    ]);
  });

  it("uses a shared prompt that exposes each role's responsibility and refusal for owner review", () => {
    expect(STANDARD_ROLE_EXERCISE_PROMPT).toMatch(/responsib/i);
    expect(STANDARD_ROLE_EXERCISE_PROMPT).toMatch(/refus/i);
  });

  it("refuses before a turn when another instruction source participates", async () => {
    const fake = supervisor({
      threadStart: {
        ...observedThread,
        instructionSources: ["C:/controlled/delivery-lead/AGENTS.md", "C:/uncontrolled/AGENTS.md"],
      },
    });

    const result = await runRoleExercise({
      supervisor: fake.instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });

    expect(result).toMatchObject({ performed: false, code: "INSTRUCTION_SOURCE_MISMATCH" });
    expect(fake.calls.map(({ method }) => method)).toEqual(["thread/start"]);
  });

  it("marks the exercise unperformed when the completed turn reports an external effect", async () => {
    const fake = supervisor({
      completed: {
        method: "turn/completed",
        params: {
          threadId: "thread_1",
          turn: {
            id: "turn_1",
            status: "completed",
            items: [{ id: "item_1", type: "commandExecution", command: "dir" }],
          },
        },
      },
    });

    const result = await runRoleExercise({
      supervisor: fake.instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });

    expect(result).toMatchObject({ performed: false, code: "EXTERNAL_EFFECT_OBSERVED" });
  });

  it("stops on an item type nobody has classified rather than treating it as text", async () => {
    const fake = supervisor({
      completed: {
        method: "turn/completed",
        params: {
          threadId: "thread_1",
          turn: {
            id: "turn_1",
            status: "completed",
            items: [
              { id: "item_1", type: "agentMessage", text: "EXERCISE_OK" },
              { id: "item_2", type: "teleport" },
            ],
          },
        },
      },
    });

    const result = await runRoleExercise({
      supervisor: fake.instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });

    expect(result).toMatchObject({ performed: false, code: "UNCLASSIFIED_ITEM_TYPE" });
  });

  it("records the runner's attempt on every result that reached a turn", async () => {
    const performed = await runRoleExercise({
      supervisor: supervisor().instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });
    expect(performed.runtime).toEqual([
      expect.objectContaining({
        attempt: 1,
        outcome: "completed",
        turnId: "turn_1",
        failure: null,
      }),
    ]);

    const refused = await runRoleExercise({
      supervisor: supervisor({ threadStart: { ...observedThread, instructionSources: [] } })
        .instance,
      cwd: "C:/synthetic/role-exercise",
      expectedInstructionSource: "C:/controlled/delivery-lead/AGENTS.md",
      agentId: "agent_delivery",
      bindingId: "binding_delivery",
      roleId: "delivery-lead",
      expected,
    });
    expect(refused.performed).toBe(false);
    expect(refused.runtime).toBeUndefined();
  });
});

describe("bounded turn task prompt", () => {
  it("carries an explicit task prompt into baseInstructions", () => {
    const params = exerciseThreadStartParams(
      "C:/synthetic/workspace",
      {
        requestedModel: "gpt-5.6-luna",
        expectedReasoningEffort: "medium",
        expectedAuthMode: "chatgpt",
        protocolVersion: "0.146.0",
        promotedContentSha256: "authored-delivery-lead-v1",
      },
      "Score the three candidates against the rubric.",
    );

    expect(params.baseInstructions).toBe("Score the three candidates against the rubric.");
  });

  it("carries the feature policy on every thread/start, beside the approved effort (F1.1)", () => {
    const params = exerciseThreadStartParams("C:/synthetic/workspace", expected, "Any task.");
    expect(params.config).toEqual({
      model_reasoning_effort: "medium",
      features: featureDisableConfig(),
    });
    expect(Object.keys(featureDisableConfig()).length).toBeGreaterThan(0);
  });

  it("falls back to the standard exercise prompt when no task is given", () => {
    // The exercise contract must not change shape because a second caller appeared.
    const params = exerciseThreadStartParams("C:/synthetic/workspace", {
      requestedModel: "gpt-5.6-luna",
      expectedReasoningEffort: "medium",
      expectedAuthMode: "chatgpt",
      protocolVersion: "0.146.0",
      promotedContentSha256: "authored-delivery-lead-v1",
    });

    expect(params.baseInstructions).toBe(STANDARD_ROLE_EXERCISE_PROMPT);
  });
});

describe("caller-chosen sandbox mode (tracer, P-1)", () => {
  const base = {
    requestedModel: "gpt-5.6-luna",
    expectedReasoningEffort: "medium",
    expectedAuthMode: "chatgpt" as const,
    protocolVersion: "0.146.0",
    promotedContentSha256: "authored-implementation-engineer-v1",
  };

  it("defaults to read-only, so no existing caller changes posture", () => {
    expect(exerciseThreadStartParams("C:/w", base, "Task.").sandbox).toBe("read-only");
    expect(exerciseThreadStartParams("C:/w", base, "Task.", {}).sandbox).toBe("read-only");
  });

  it("applies workspace-write when asked, and changes nothing else", () => {
    const standard = exerciseThreadStartParams("C:/w", base, "Task.");
    const widened = exerciseThreadStartParams("C:/w", base, "Task.", {
      sandbox: "workspace-write",
    });
    expect(widened.sandbox).toBe("workspace-write");
    expect({ ...widened, sandbox: "read-only" }).toEqual(standard);
    expect(widened.approvalPolicy).toBe("never");
    expect(widened.ephemeral).toBe(true);
  });
});

describe("hasExactInstructionSource (P-2, exported for the tracer)", () => {
  it("accepts exactly the one controlled instruction file and nothing else", () => {
    expect(
      hasExactInstructionSource({ instructionSources: ["/h/AGENTS.md"] }, "/h/AGENTS.md"),
    ).toBe(true);
    expect(
      hasExactInstructionSource(
        { instructionSources: ["/h/AGENTS.md", "/x/AGENTS.md"] },
        "/h/AGENTS.md",
      ),
    ).toBe(false);
    expect(
      hasExactInstructionSource({ instructionSources: ["/x/AGENTS.md"] }, "/h/AGENTS.md"),
    ).toBe(false);
    expect(hasExactInstructionSource({ instructionSources: [] }, "/h/AGENTS.md")).toBe(false);
    expect(hasExactInstructionSource({}, "/h/AGENTS.md")).toBe(false);
    expect(hasExactInstructionSource(null, "/h/AGENTS.md")).toBe(false);
  });
});
