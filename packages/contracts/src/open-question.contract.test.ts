import { describe, expect, it } from "vitest";

import { validateOpenQuestion, validateQuestionDisposition } from "./open-question.js";

const question = {
  schemaVersion: 1,
  questionId: "question_1",
  projectId: "project_graybox",
  subject: { kind: "work_item", id: "work_42" },
  authorKind: "agent",
  authorId: "agent_test",
  roleId: "test",
  raisedByEventId: "event_108",
  raisedAt: "2026-08-18T09:00:00.000Z",
  question: "Were the Phase 0 rendered files re-captured under a later build?",
  whyItMatters: "Their recorded hashes no longer match the accepted evidence manifest.",
  confidence: "likely",
  wouldBeResolvedBy: ["Comparing working-tree hashes to the phase-0 report"],
  evidenceRefs: ["evidence_phase0_report"],
  blocksWork: false,
};

const disposition = {
  dispositionId: "disposition_1",
  questionId: "question_1",
  authorKind: "manager",
  authorId: "manager_nate",
  disposition: "answered",
  reason: "Re-captured during the Task 5 evidence pass; originals restored.",
  evidenceRefs: ["evidence_defect_register"],
};

describe("open-question contracts", () => {
  it("accepts an attributable agent question that states what would resolve it", () => {
    expect(validateOpenQuestion(question)).toMatchObject({ ok: true });
  });

  it("rejects a question that cannot state what would settle it", () => {
    expect(validateOpenQuestion({ ...question, wouldBeResolvedBy: [] })).toEqual({
      ok: false,
      code: "QUESTION_UNRESOLVABLE",
    });
    expect(validateOpenQuestion({ ...question, wouldBeResolvedBy: [""] })).toEqual({
      ok: false,
      code: "QUESTION_UNRESOLVABLE",
    });
  });

  it("requires blocksWork to be explicit and never infers it", () => {
    const withoutBlocksWork: Record<string, unknown> = { ...question };
    delete withoutBlocksWork.blocksWork;
    expect(validateOpenQuestion(withoutBlocksWork)).toEqual({
      ok: false,
      code: "QUESTION_INVALID",
    });
    expect(validateOpenQuestion({ ...question, blocksWork: "true" })).toEqual({
      ok: false,
      code: "QUESTION_INVALID",
    });
  });

  it("pins the schema version and closes every enum", () => {
    expect(validateOpenQuestion({ ...question, schemaVersion: 2 })).toEqual({
      ok: false,
      code: "QUESTION_INVALID",
    });
    expect(validateOpenQuestion({ ...question, confidence: "certain" })).toEqual({
      ok: false,
      code: "QUESTION_INVALID",
    });
    expect(
      validateOpenQuestion({ ...question, subject: { kind: "sprint", id: "sprint_1" } }),
    ).toEqual({ ok: false, code: "QUESTION_INVALID" });
    expect(validateOpenQuestion({ ...question, authorKind: "system" })).toEqual({
      ok: false,
      code: "QUESTION_INVALID",
    });
  });

  it("rejects secrets in any free-text field of a question or disposition", () => {
    expect(
      validateOpenQuestion({ ...question, whyItMatters: "authorization: bearer abc.def" }),
    ).toEqual({ ok: false, code: "QUESTION_SECRET_REJECTED" });
    expect(
      validateQuestionDisposition({ ...disposition, reason: "rotate sk-live-abc123 first" }),
    ).toEqual({ ok: false, code: "QUESTION_SECRET_REJECTED" });
  });

  it("accepts a complete disposition", () => {
    expect(validateQuestionDisposition(disposition)).toMatchObject({ ok: true });
  });

  it("requires a successor when a question is superseded", () => {
    expect(validateQuestionDisposition({ ...disposition, disposition: "superseded" })).toEqual({
      ok: false,
      code: "QUESTION_DISPOSITION_INCOMPLETE",
    });
    expect(
      validateQuestionDisposition({
        ...disposition,
        disposition: "superseded",
        supersededByQuestionId: "question_2",
      }),
    ).toMatchObject({ ok: true });
  });

  it("requires a review date when a question is deferred, so deferral is not a silent drop", () => {
    expect(validateQuestionDisposition({ ...disposition, disposition: "deferred" })).toEqual({
      ok: false,
      code: "QUESTION_DISPOSITION_INCOMPLETE",
    });
    expect(
      validateQuestionDisposition({
        ...disposition,
        disposition: "deferred",
        reviewBy: "2026-09-01T00:00:00.000Z",
      }),
    ).toMatchObject({ ok: true });
  });

  it("requires an explicit reason for every disposition", () => {
    expect(validateQuestionDisposition({ ...disposition, reason: "" })).toEqual({
      ok: false,
      code: "QUESTION_DISPOSITION_INCOMPLETE",
    });
  });
});

describe("open question provenance timestamp", () => {
  it("rejects a question that cannot say when it was raised", () => {
    const withoutRaisedAt: Record<string, unknown> = { ...question };
    delete withoutRaisedAt.raisedAt;

    expect(validateOpenQuestion(withoutRaisedAt)).toEqual({
      ok: false,
      code: "QUESTION_INVALID",
    });
  });

  it("rejects a raisedAt that is not a UTC timestamp", () => {
    expect(validateOpenQuestion({ ...question, raisedAt: "yesterday" }).ok).toBe(false);
    expect(validateOpenQuestion({ ...question, raisedAt: "2026-08-18" }).ok).toBe(false);
    expect(validateOpenQuestion({ ...question, raisedAt: "" }).ok).toBe(false);
  });

  it("accepts a UTC timestamp", () => {
    expect(validateOpenQuestion({ ...question, raisedAt: "2026-08-18T09:00:00.000Z" }).ok).toBe(
      true,
    );
  });
});
