import { describe, expect, it } from "vitest";

import type { OpenQuestion, QuestionDisposition } from "@cuckcode/contracts";
import { createQuestionRegister, raiseQuestion, type QuestionRegister } from "@cuckcode/domain";

import { executeQuestionCommand } from "./open-question-commands.js";

const question: OpenQuestion = {
  schemaVersion: 1,
  questionId: "question_1",
  projectId: "project_graybox",
  subject: { kind: "work_item", id: "work_42" },
  authorKind: "agent",
  authorId: "agent_test",
  roleId: "test",
  raisedByEventId: "event_108",
  question: "Is the layout evidence rewritten on every visual run?",
  whyItMatters: "It backs an approved measurement decision.",
  confidence: "likely",
  wouldBeResolvedBy: ["Comparing capture output paths against committed evidence"],
  evidenceRefs: ["evidence_defect_register"],
  blocksWork: false,
};

const seeded = (): QuestionRegister => {
  const raised = raiseQuestion(createQuestionRegister(), question);
  if (!raised.ok) throw new Error(raised.code);
  return raised.register;
};

const disposition: QuestionDisposition = {
  dispositionId: "d1",
  questionId: "question_1",
  authorKind: "manager",
  authorId: "manager_nate",
  disposition: "accepted_risk",
  reason: "Known and tolerated until the graybox gate.",
  evidenceRefs: [],
};

describe("open-question commands", () => {
  it("raises a question and returns an exact revisioned receipt", () => {
    const result = executeQuestionCommand({
      register: createQuestionRegister(),
      currentRevision: 7,
      command: {
        commandId: "cmd_1",
        expectedRevision: 7,
        actor: { actorType: "agent", actorId: "agent_test" },
        intent: "raise",
        payload: question,
      },
    });
    if (!result.ok) throw new Error(result.code);
    expect(result.receipt).toEqual({
      receiptId: "receipt_cmd_1",
      commandId: "cmd_1",
      acceptedRevision: 7,
      resultingRevision: 8,
      intent: "raise",
      actorId: "agent_test",
      questionId: "question_1",
      status: "open",
      blocksWork: false,
    });
  });

  it("refuses a stale command with a retry-safe, actionable error", () => {
    const result = executeQuestionCommand({
      register: seeded(),
      currentRevision: 9,
      command: {
        commandId: "cmd_2",
        expectedRevision: 7,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "dispose",
        payload: disposition,
      },
    });
    expect(result).toMatchObject({
      ok: false,
      code: "QUESTION_COMMAND_STALE",
      retrySafe: true,
    });
    if (result.ok) throw new Error("expected failure");
    expect(result.requiredAction).toBeTruthy();
  });

  it("rejects a command whose payload attribution does not match the actor", () => {
    expect(
      executeQuestionCommand({
        register: createQuestionRegister(),
        currentRevision: 1,
        command: {
          commandId: "cmd_3",
          expectedRevision: 1,
          actor: { actorType: "agent", actorId: "agent_someone_else" },
          intent: "raise",
          payload: question,
        },
      }),
    ).toEqual({ ok: false, code: "QUESTION_ATTRIBUTION_MISMATCH" });
  });

  it("rejects a command whose payload author kind does not match the actor type", () => {
    expect(
      executeQuestionCommand({
        register: seeded(),
        currentRevision: 1,
        command: {
          commandId: "cmd_4",
          expectedRevision: 1,
          actor: { actorType: "agent", actorId: "manager_nate" },
          intent: "dispose",
          payload: disposition,
        },
      }),
    ).toEqual({ ok: false, code: "QUESTION_ATTRIBUTION_MISMATCH" });
  });

  it("enforces manager-only dispositions at the command boundary, not only in the aggregate", () => {
    expect(
      executeQuestionCommand({
        register: seeded(),
        currentRevision: 1,
        command: {
          commandId: "cmd_5",
          expectedRevision: 1,
          actor: { actorType: "agent", actorId: "agent_test" },
          intent: "dispose",
          payload: { ...disposition, authorKind: "agent", authorId: "agent_test" },
        },
      }),
    ).toEqual({ ok: false, code: "QUESTION_MANAGER_AUTHORITY_REQUIRED" });
  });

  it("rejects a question that fails contract validation before it reaches the register", () => {
    expect(
      executeQuestionCommand({
        register: createQuestionRegister(),
        currentRevision: 1,
        command: {
          commandId: "cmd_6",
          expectedRevision: 1,
          actor: { actorType: "agent", actorId: "agent_test" },
          intent: "raise",
          payload: { ...question, wouldBeResolvedBy: [] },
        },
      }),
    ).toEqual({ ok: false, code: "QUESTION_UNRESOLVABLE" });
  });

  it("surfaces a domain refusal with its own code and reports the resulting status", () => {
    const closed = executeQuestionCommand({
      register: seeded(),
      currentRevision: 1,
      command: {
        commandId: "cmd_7",
        expectedRevision: 1,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "dispose",
        payload: disposition,
      },
    });
    if (!closed.ok) throw new Error(closed.code);
    expect(closed.receipt.status).toBe("closed");
    expect(
      executeQuestionCommand({
        register: closed.register,
        currentRevision: 2,
        command: {
          commandId: "cmd_8",
          expectedRevision: 2,
          actor: { actorType: "manager", actorId: "manager_nate" },
          intent: "dispose",
          payload: { ...disposition, dispositionId: "d2" },
        },
      }),
    ).toEqual({ ok: false, code: "QUESTION_CLOSED" });
  });
});
