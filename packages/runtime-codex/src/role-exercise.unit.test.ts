import { describe, expect, it } from "vitest";

import type { BindingExpectation } from "./binding.js";
import {
  STANDARD_ROLE_EXERCISE_PROMPT,
  runRoleExercise,
  type ExerciseSupervisor,
} from "./role-exercise.js";

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

function supervisor(overrides: Partial<{ threadStart: unknown; completed: unknown }> = {}) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
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
      if (method === "turn/start") return { turn: { id: "turn_1" } };
      throw new Error(`unexpected method ${method}`);
    },
    async waitForNotification() {
      return (overrides.completed ?? {
        method: "turn/completed",
        params: {
          threadId: "thread_1",
          turn: {
            id: "turn_1",
            status: "completed",
            items: [{ id: "item_1", type: "agentMessage", text: "EXERCISE_OK" }],
          },
        },
      }) as Record<string, unknown>;
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
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]).toMatchObject({
      method: "thread/start",
      params: {
        cwd: "C:/synthetic/role-exercise",
        ephemeral: true,
        model: "gpt-5.6-luna",
        sandbox: "read-only",
        approvalPolicy: "never",
        baseInstructions: STANDARD_ROLE_EXERCISE_PROMPT,
        config: { model_reasoning_effort: "medium" },
      },
    });
    expect(fake.calls[1]).toEqual({
      method: "turn/start",
      params: {
        threadId: "thread_1",
        input: [{ type: "text", text: "Begin the bounded role exercise." }],
      },
    });
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
});
