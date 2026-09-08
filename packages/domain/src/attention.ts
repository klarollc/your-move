import type { CanonicalProjectSnapshot } from "./replay.js";
import { questionsRequiringDisposition, type QuestionRegister } from "./open-question.js";

export type ManagerAttentionItem = {
  subjectId: string;
  reason:
    | "blocked"
    | "waiting_input"
    | "failed"
    | "review_requested"
    | "approval_required"
    | "question_open";
  priority: number;
  causeEventId: string;
  updatedAt: string;
};
const priorities: Record<ManagerAttentionItem["reason"], number> = {
  blocked: 10,
  failed: 20,
  waiting_input: 30,
  question_open: 35,
  review_requested: 40,
  approval_required: 50,
};

/**
 * An open question is not work. It never renders as activity, progress, or collaboration
 * (spec §2.5); its truthful representation is an attention signal plus an inspectable record.
 */
export type QuestionAttentionView = Readonly<{
  register: QuestionRegister;
  nowIso: string;
}>;

export function projectManagerAttention(
  snapshot: CanonicalProjectSnapshot,
  questions?: QuestionAttentionView,
): ManagerAttentionItem[] {
  const items: ManagerAttentionItem[] = [];
  for (const work of Object.values(snapshot.work.workItems)) {
    let reason: ManagerAttentionItem["reason"] | undefined;
    if (work.state === "blocked") reason = "blocked";
    if (work.state === "failed") reason = "failed";
    if (work.state === "waiting_input") reason = "waiting_input";
    if (work.state === "review_requested") reason = "review_requested";
    if (
      work.state === "completed" &&
      !Object.values(snapshot.work.approvals).some(
        (approval) => approval.workItemId === work.workItemId,
      )
    ) {
      reason = "approval_required";
    }
    if (reason) {
      items.push({
        subjectId: work.workItemId,
        reason,
        priority: priorities[reason],
        causeEventId: work.updatedByEventId,
        updatedAt: work.updatedAt,
      });
    }
  }
  if (questions) {
    for (const record of questionsRequiringDisposition(questions.register, questions.nowIso)) {
      const { question } = record;
      const overdue = question.neededBy !== undefined && question.neededBy <= questions.nowIso;
      items.push({
        subjectId: question.questionId,
        // The reason stays question_open even when escalated. A question that halts work is
        // still a question; reporting it as blocked would assert a work state canonical state
        // does not hold, which is the substitution agents are forced into today.
        reason: "question_open",
        priority: question.blocksWork || overdue ? priorities.blocked : priorities.question_open,
        causeEventId: question.raisedByEventId,
        updatedAt: question.raisedAt,
      });
    }
  }

  return items.sort(
    (left, right) =>
      left.priority - right.priority || left.subjectId.localeCompare(right.subjectId),
  );
}
