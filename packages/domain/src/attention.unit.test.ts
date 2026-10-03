import { describe, expect, it } from "vitest";

import type { OpenQuestion } from "@cuckcode/contracts";

import type { CanonicalProjectSnapshot } from "./replay.js";
import { projectManagerAttention } from "./attention.js";
import { createQuestionRegister, raiseQuestion, type QuestionRegister } from "./open-question.js";

const snapshot: CanonicalProjectSnapshot = {
  schemaVersion: 1,
  project: { projectId: "project_alpha", name: "Alpha" },
  eventIds: [],
  work: {
    workItems: {
      work_done: {
        workItemId: "work_done",
        outcome: "Done",
        state: "completed",
        revision: 1,
        requiredEvidenceKinds: [],
        updatedByEventId: "event_03",
        updatedAt: "2026-08-13T23:00:03.000Z",
        assignment: null,
        condition: null,
      },
      work_waiting: {
        workItemId: "work_waiting",
        outcome: "Waiting",
        state: "waiting_input",
        revision: 1,
        requiredEvidenceKinds: [],
        updatedByEventId: "event_02",
        updatedAt: "2026-08-13T23:00:02.000Z",
        assignment: null,
        condition: null,
      },
      work_blocked: {
        workItemId: "work_blocked",
        outcome: "Blocked",
        state: "blocked",
        revision: 1,
        requiredEvidenceKinds: [],
        updatedByEventId: "event_01",
        updatedAt: "2026-08-13T23:00:01.000Z",
        assignment: null,
        condition: null,
      },
    },
    evidence: {},
    approvals: {},
    issues: [],
  },
  staffing: { agents: {}, assignments: {}, qualifications: {}, issues: [] },
  knowledge: { records: {}, issues: [] },
  collaborations: {},
  replayIssues: [],
};

describe("projectManagerAttention", () => {
  it("orders blocked, waiting input, then completed-unapproved work deterministically", () => {
    expect(
      projectManagerAttention(snapshot).map(({ subjectId, reason }) => [subjectId, reason]),
    ).toEqual([
      ["work_blocked", "blocked"],
      ["work_waiting", "waiting_input"],
      ["work_done", "approval_required"],
    ]);
  });
});

const NOW = "2026-08-19T12:00:00.000Z";

function question(overrides: Partial<OpenQuestion> & { questionId: string }): OpenQuestion {
  return {
    schemaVersion: 1,
    projectId: "project_alpha",
    subject: { kind: "work_item", id: "work_blocked" },
    authorKind: "agent",
    authorId: "agent_test",
    raisedByEventId: "event_q1",
    raisedAt: "2026-08-19T09:30:00.000Z",
    question: "Which fixture is authoritative?",
    whyItMatters: "Two fixtures disagree and only one can be cited.",
    confidence: "medium",
    wouldBeResolvedBy: ["An owner statement naming the authoritative fixture."],
    evidenceRefs: [],
    blocksWork: false,
    ...overrides,
  } as OpenQuestion;
}

function registerWith(...questions: OpenQuestion[]): QuestionRegister {
  let register = createQuestionRegister();
  for (const item of questions) {
    const result = raiseQuestion(register, item);
    if (!result.ok) throw new Error(`fixture question rejected: ${result.code}`);
    register = result.register;
  }
  return register;
}

describe("projectManagerAttention with open questions", () => {
  it("places a non-blocking open question between waiting input and review requested", () => {
    const items = projectManagerAttention(snapshot, {
      register: registerWith(question({ questionId: "question_1" })),
      nowIso: NOW,
    });

    expect(items.map(({ subjectId, reason, priority }) => [subjectId, reason, priority])).toEqual([
      ["work_blocked", "blocked", 10],
      ["work_waiting", "waiting_input", 30],
      ["question_1", "question_open", 35],
      ["work_done", "approval_required", 50],
    ]);
  });

  it("escalates a blocking question to blocked priority without calling it blocked", () => {
    const items = projectManagerAttention(snapshot, {
      register: registerWith(question({ questionId: "question_blocking", blocksWork: true })),
      nowIso: NOW,
    });
    const raised = items.find((item) => item.subjectId === "question_blocking");

    expect(raised?.priority).toBe(10);
    // The reason stays question_open. A question that halts work is still a question, and
    // reporting it as blocked would assert a work state that canonical state does not hold.
    expect(raised?.reason).toBe("question_open");
  });

  it("escalates once neededBy has passed and not before", () => {
    const pending = projectManagerAttention(snapshot, {
      register: registerWith(
        question({ questionId: "question_due", neededBy: "2026-08-19T18:00:00.000Z" }),
      ),
      nowIso: NOW,
    });
    expect(pending.find((item) => item.subjectId === "question_due")?.priority).toBe(35);

    const overdue = projectManagerAttention(snapshot, {
      register: registerWith(
        question({ questionId: "question_due", neededBy: "2026-08-19T06:00:00.000Z" }),
      ),
      nowIso: NOW,
    });
    expect(overdue.find((item) => item.subjectId === "question_due")?.priority).toBe(10);
  });

  it("projects nothing for questions when no register is supplied", () => {
    expect(projectManagerAttention(snapshot).every((item) => item.reason !== "question_open")).toBe(
      true,
    );
  });
});

describe("projectManagerAttention, attention follows the request (DF-029, spec §10.1)", () => {
  const truth = { eventId: "event_09", source: "adapter" as const, trust: "reported" as const };
  const request = { kind: "redirect" as const, summary: "Redirect the request or decline it." };
  const onAgent = {
    reasonCode: "dependency_blocked" as const,
    summary: "Needs the Implementation Engineer's build.",
    waitingOn: { kind: "agent" as const, id: "agent_implementation" },
    ...truth,
  };
  const withItems = (
    conditions: Record<string, CanonicalProjectSnapshot["work"]["workItems"][string]["condition"]>,
    state: CanonicalProjectSnapshot["work"]["workItems"][string]["state"],
  ): CanonicalProjectSnapshot => ({
    ...snapshot,
    work: {
      ...snapshot.work,
      workItems: Object.fromEntries(
        Object.entries(conditions).map(([workItemId, condition]) => [
          workItemId,
          {
            workItemId,
            outcome: workItemId,
            state,
            revision: 1,
            requiredEvidenceKinds: [],
            updatedByEventId: "event_09",
            updatedAt: "2026-08-13T23:00:09.000Z",
            assignment: null,
            condition,
          },
        ]),
      ),
    },
  });
  const subjects = (value: CanonicalProjectSnapshot) =>
    projectManagerAttention(value).map((item) => item.subjectId);

  it("raises no attention for a blocker or a wait that nobody asked the manager about", () => {
    for (const state of ["blocked", "waiting_input"] as const) {
      expect(subjects(withItems({ work_elsewhere: onAgent }, state)), state).toEqual([]);
    }
  });

  it("raises attention when the condition carries a request, whoever resolves it", () => {
    for (const state of ["blocked", "waiting_input"] as const) {
      expect(
        subjects(withItems({ work_asked: { ...onAgent, requestedAction: request } }, state)),
        state,
      ).toEqual(["work_asked"]);
    }
  });

  it("keeps today's attention when no condition is recorded", () => {
    for (const state of ["blocked", "waiting_input", "failed"] as const) {
      expect(subjects(withItems({ work_unknown: null }, state)), state).toEqual(["work_unknown"]);
    }
  });
});
