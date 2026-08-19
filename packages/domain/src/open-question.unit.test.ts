import { describe, expect, it } from "vitest";

import type { OpenQuestion, QuestionDisposition } from "@cuckcode/contracts";

import {
  createQuestionRegister,
  disposeQuestion,
  questionsRequiringDisposition,
  raiseQuestion,
} from "./open-question.js";

const question: OpenQuestion = {
  schemaVersion: 1,
  questionId: "question_1",
  projectId: "project_graybox",
  subject: { kind: "work_item", id: "work_42" },
  authorKind: "agent",
  authorId: "agent_test",
  roleId: "test",
  raisedByEventId: "event_108",
  question: "Is the Task 5 layout evidence rewritten on every visual run?",
  whyItMatters: "It backs an approved measurement decision.",
  confidence: "likely",
  wouldBeResolvedBy: ["Comparing capture output paths against committed evidence"],
  evidenceRefs: ["evidence_defect_register"],
  blocksWork: false,
};

function disposition(
  overrides: Partial<QuestionDisposition> & Pick<QuestionDisposition, "dispositionId">,
): QuestionDisposition {
  return {
    questionId: "question_1",
    authorKind: "manager",
    authorId: "manager_nate",
    disposition: "answered",
    reason: "Confirmed against the capture spec.",
    evidenceRefs: [],
    ...overrides,
  };
}

function withOneQuestion() {
  const raised = raiseQuestion(createQuestionRegister(), question);
  if (!raised.ok) throw new Error(`unexpected raise failure: ${raised.code}`);
  return raised.register;
}

describe("open-question register", () => {
  it("raises an attributable question as open and rejects a duplicate id", () => {
    const register = withOneQuestion();
    expect(register.questions.question_1?.status).toBe("open");
    expect(register.questions.question_1?.dispositions).toEqual([]);
    expect(raiseQuestion(register, question)).toEqual({ ok: false, code: "QUESTION_DUPLICATE" });
  });

  it("rejects a disposition for a question that was never raised", () => {
    expect(disposeQuestion(createQuestionRegister(), disposition({ dispositionId: "d1" }))).toEqual(
      { ok: false, code: "QUESTION_NOT_FOUND" },
    );
  });

  it("lets any participant answer, but an agent answer does not close the question", () => {
    const answered = disposeQuestion(
      withOneQuestion(),
      disposition({ dispositionId: "d1", authorKind: "agent", authorId: "agent_design" }),
    );
    if (!answered.ok) throw new Error(answered.code);
    expect(answered.register.questions.question_1?.dispositions).toHaveLength(1);
    expect(answered.register.questions.question_1?.status).toBe("open");
  });

  it("closes the question when the manager answers it", () => {
    const answered = disposeQuestion(withOneQuestion(), disposition({ dispositionId: "d1" }));
    if (!answered.ok) throw new Error(answered.code);
    expect(answered.register.questions.question_1?.status).toBe("closed");
  });

  it("reserves accepted_risk and rejected for the manager", () => {
    for (const kind of ["accepted_risk", "rejected"] as const) {
      expect(
        disposeQuestion(
          withOneQuestion(),
          disposition({ dispositionId: "d1", disposition: kind, authorKind: "agent" }),
        ),
      ).toEqual({ ok: false, code: "QUESTION_AUTHORITY" });
    }
  });

  it("retains every disposition in order and never overwrites an earlier one", () => {
    const first = disposeQuestion(
      withOneQuestion(),
      disposition({ dispositionId: "d1", authorKind: "agent", reason: "Agent reading." }),
    );
    if (!first.ok) throw new Error(first.code);
    const second = disposeQuestion(
      first.register,
      disposition({ dispositionId: "d2", reason: "Manager reading." }),
    );
    if (!second.ok) throw new Error(second.code);
    expect(second.register.questions.question_1?.dispositions.map((d) => d.reason)).toEqual([
      "Agent reading.",
      "Manager reading.",
    ]);
  });

  it("requires a new question to reopen and refuses to mutate a closed one", () => {
    const closed = disposeQuestion(
      withOneQuestion(),
      disposition({ dispositionId: "d1", disposition: "rejected", reason: "Out of scope." }),
    );
    if (!closed.ok) throw new Error(closed.code);
    expect(closed.register.questions.question_1?.status).toBe("closed");
    expect(disposeQuestion(closed.register, disposition({ dispositionId: "d2" }))).toEqual({
      ok: false,
      code: "QUESTION_CLOSED",
    });
  });

  it("treats deferral as parked, never resolved, and surfaces it again at its review date", () => {
    const deferred = disposeQuestion(
      withOneQuestion(),
      disposition({
        dispositionId: "d1",
        disposition: "deferred",
        reason: "Revisit after the graybox gate.",
        reviewBy: "2026-09-01T00:00:00.000Z",
      }),
    );
    if (!deferred.ok) throw new Error(deferred.code);
    expect(deferred.register.questions.question_1?.status).toBe("deferred");

    // Time passing never resolves a question; it only makes it due again.
    expect(questionsRequiringDisposition(deferred.register, "2026-08-20T00:00:00.000Z")).toEqual(
      [],
    );
    expect(
      questionsRequiringDisposition(deferred.register, "2026-09-02T00:00:00.000Z").map(
        (record) => record.question.questionId,
      ),
    ).toEqual(["question_1"]);
  });

  it("always lists an undispositioned question as requiring disposition", () => {
    expect(
      questionsRequiringDisposition(withOneQuestion(), "2099-01-01T00:00:00.000Z").map(
        (record) => record.question.questionId,
      ),
    ).toEqual(["question_1"]);
  });

  it("rejects a disposition whose questionId does not match its target", () => {
    expect(
      disposeQuestion(withOneQuestion(), disposition({ dispositionId: "d1", questionId: "other" })),
    ).toEqual({ ok: false, code: "QUESTION_NOT_FOUND" });
  });
});
