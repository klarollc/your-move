import type { OpenQuestion, QuestionDisposition } from "@cuckcode/contracts";

export type QuestionStatus = "open" | "deferred" | "closed";

export type OpenQuestionRecord = Readonly<{
  question: OpenQuestion;
  dispositions: readonly QuestionDisposition[];
  status: QuestionStatus;
}>;

export type QuestionRegister = Readonly<{
  questions: Readonly<Record<string, OpenQuestionRecord>>;
}>;

type Result = { ok: true; register: QuestionRegister } | { ok: false; code: string };

// Only the manager may record that a known unknown will not be resolved.
const managerOnly = new Set(["accepted_risk", "rejected", "deferred"]);

export function createQuestionRegister(): QuestionRegister {
  return { questions: {} };
}

export function raiseQuestion(register: QuestionRegister, question: OpenQuestion): Result {
  if (register.questions[question.questionId]) return failure("QUESTION_DUPLICATE");
  return success({
    ...register,
    questions: {
      ...register.questions,
      [question.questionId]: { question, dispositions: [], status: "open" },
    },
  });
}

export function disposeQuestion(
  register: QuestionRegister,
  disposition: QuestionDisposition,
): Result {
  const record = register.questions[disposition.questionId];
  if (!record) return failure("QUESTION_NOT_FOUND");
  // Reopening requires a new question that supersedes this one. A closed record is never mutated.
  if (record.status === "closed") return failure("QUESTION_CLOSED");
  if (managerOnly.has(disposition.disposition) && disposition.authorKind !== "manager") {
    return failure("QUESTION_AUTHORITY");
  }
  if (record.dispositions.some((prior) => prior.dispositionId === disposition.dispositionId)) {
    return failure("QUESTION_DISPOSITION_DUPLICATE");
  }
  return success({
    ...register,
    questions: {
      ...register.questions,
      [disposition.questionId]: {
        ...record,
        // Every disposition is retained. None replaces another participant's contribution.
        dispositions: [...record.dispositions, disposition],
        status: nextStatus(record.status, disposition),
      },
    },
  });
}

/**
 * Questions the manager still owes a decision on. Time never resolves a question; passing a
 * deferral's review date only makes it due again.
 */
export function questionsRequiringDisposition(
  register: QuestionRegister,
  nowIso: string,
): readonly OpenQuestionRecord[] {
  return Object.values(register.questions)
    .filter((record) => {
      if (record.status === "open") return true;
      if (record.status !== "deferred") return false;
      const reviewBy = lastDeferral(record)?.reviewBy;
      return reviewBy !== undefined && reviewBy <= nowIso;
    })
    .toSorted((left, right) => left.question.questionId.localeCompare(right.question.questionId));
}

function nextStatus(current: QuestionStatus, disposition: QuestionDisposition): QuestionStatus {
  if (disposition.disposition === "deferred") return "deferred";
  if (disposition.disposition === "answered") {
    // An agent's answer is a contribution, not an acceptance. Only the manager closes on it,
    // matching the knowledge rule that agent findings stay provisional until promotion.
    return disposition.authorKind === "manager" ? "closed" : current;
  }
  return "closed";
}

function lastDeferral(record: OpenQuestionRecord): QuestionDisposition | undefined {
  return record.dispositions.findLast(({ disposition }) => disposition === "deferred");
}

function success(register: QuestionRegister): Result {
  return { ok: true, register };
}

function failure(code: string): Result {
  return { ok: false, code };
}
