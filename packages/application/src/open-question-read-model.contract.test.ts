import { describe, expect, it } from "vitest";

import type { OpenQuestion } from "@cuckcode/contracts";
import {
  createQuestionRegister,
  disposeQuestion,
  raiseQuestion,
  type QuestionRegister,
} from "@cuckcode/domain";

import { projectOpenQuestionReadModel } from "./open-question-read-model.js";

function question(
  overrides: Partial<OpenQuestion> & Pick<OpenQuestion, "questionId">,
): OpenQuestion {
  return {
    schemaVersion: 1,
    projectId: "project_graybox",
    subject: { kind: "work_item", id: "work_42" },
    authorKind: "agent",
    authorId: "agent_test",
    roleId: "test",
    raisedByEventId: "event_108",
    raisedAt: "2026-08-18T09:00:00.000Z",
    question: "Is the layout evidence rewritten on every visual run?",
    whyItMatters: "It backs an approved measurement decision.",
    confidence: "likely",
    wouldBeResolvedBy: ["Comparing capture output paths against committed evidence"],
    evidenceRefs: ["evidence_defect_register"],
    blocksWork: false,
    ...overrides,
  };
}

function register(...questions: OpenQuestion[]): QuestionRegister {
  return questions.reduce<QuestionRegister>((acc, item) => {
    const raised = raiseQuestion(acc, item);
    if (!raised.ok) throw new Error(raised.code);
    return raised.register;
  }, createQuestionRegister());
}

const roster = [
  { roleId: "test", agentId: "agent_test", subjects: [{ kind: "work_item", id: "work_42" }] },
  {
    roleId: "design",
    agentId: "agent_design",
    subjects: [{ kind: "work_item", id: "work_42" }],
  },
  { roleId: "release", agentId: "agent_release", subjects: [] },
] as const;

const view = { nowIso: "2026-08-19T00:00:00.000Z", roster };

describe("reciprocal open-question read model", () => {
  it("gives the manager and every agent who can see a question the identical shared record", () => {
    const model = projectOpenQuestionReadModel(
      register(question({ questionId: "question_1" })),
      view,
    );
    const managerRecord = model.manager.all.find((r) => r.questionId === "question_1");
    expect(managerRecord).toBeDefined();
    // Visibility is scoped; parity is not. Where an agent can see the record at all, it must be
    // byte-for-byte what the manager sees.
    const seen = model.agents
      .map((agent) => agent.visible.find((r) => r.questionId === "question_1"))
      .filter((record) => record !== undefined);
    expect(seen.length).toBeGreaterThan(0);
    for (const agentRecord of seen) {
      expect(agentRecord).toEqual(managerRecord);
    }
  });

  it("answers the three agent discovery questions without inference from failure", () => {
    const model = projectOpenQuestionReadModel(
      register(
        question({ questionId: "question_mine", authorId: "agent_test", roleId: "test" }),
        question({
          questionId: "question_for_design",
          authorId: "agent_test",
          roleId: "test",
          addressedToRoleId: "design",
        }),
        question({
          questionId: "question_by_other",
          authorId: "agent_design",
          roleId: "design",
          subject: { kind: "work_item", id: "work_42" },
        }),
      ),
      view,
    );
    const test = model.agents.find((a) => a.roleId === "test");
    expect(test?.raisedByMe.map((r) => r.questionId).toSorted()).toEqual([
      "question_for_design",
      "question_mine",
    ]);
    const design = model.agents.find((a) => a.roleId === "design");
    expect(design?.addressedToMe.map((r) => r.questionId)).toEqual(["question_for_design"]);
    // Raised by someone else, on ground this role is acting under. It must not be invisible.
    expect(design?.onMySubjects.map((r) => r.questionId)).toContain("question_mine");
  });

  it("shows an agent with no matching subject nothing it does not own", () => {
    const model = projectOpenQuestionReadModel(
      register(question({ questionId: "question_1" })),
      view,
    );
    const release = model.agents.find((a) => a.roleId === "release");
    expect(release?.raisedByMe).toEqual([]);
    expect(release?.addressedToMe).toEqual([]);
    expect(release?.onMySubjects).toEqual([]);
  });

  it("carries the disposition trail identically on both sides", () => {
    const seeded = register(question({ questionId: "question_1" }));
    const disposed = disposeQuestion(seeded, {
      dispositionId: "d1",
      questionId: "question_1",
      authorKind: "manager",
      authorId: "manager_nate",
      disposition: "accepted_risk",
      reason: "Known and tolerated until the graybox gate.",
      evidenceRefs: ["evidence_defect_register"],
    });
    if (!disposed.ok) throw new Error(disposed.code);
    const model = projectOpenQuestionReadModel(disposed.register, view);
    const managerRecord = model.manager.all[0];
    expect(managerRecord?.status).toBe("closed");
    expect(managerRecord?.dispositions).toHaveLength(1);
    const agentRecord = model.agents
      .find((a) => a.roleId === "test")
      ?.visible.find((r) => r.questionId === "question_1");
    expect(agentRecord).toEqual(managerRecord);
  });

  it("lists what the manager still owes a decision on, without closing anything by time", () => {
    const model = projectOpenQuestionReadModel(
      register(
        question({ questionId: "question_open" }),
        question({ questionId: "question_blocking", blocksWork: true }),
      ),
      view,
    );
    expect(model.manager.requiringDisposition.map((r) => r.questionId).toSorted()).toEqual([
      "question_blocking",
      "question_open",
    ]);
    // Blocking questions sort ahead of non-blocking ones.
    expect(model.manager.requiringDisposition[0]?.questionId).toBe("question_blocking");
  });

  it("never lets an absolute filesystem path cross the projection boundary", () => {
    const model = projectOpenQuestionReadModel(
      register(
        question({
          questionId: "question_1",
          evidenceRefs: [
            "evidence_ok",
            "C:\\Users\\nater\\secret.txt",
            "/etc/passwd",
            "\\\\server\\share\\thing",
          ],
        }),
      ),
      view,
    );
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("secret.txt");
    expect(serialized).not.toContain("/etc/passwd");
    expect(serialized).not.toContain("server\\\\share");
    expect(model.manager.all[0]?.evidenceRefs).toContain("evidence_ok");
    expect(model.manager.all[0]?.evidenceRefs).toContain("[redacted_path]");
  });
});
