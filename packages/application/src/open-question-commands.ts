import {
  validateOpenQuestion,
  validateQuestionDisposition,
  type OpenQuestion,
  type QuestionDisposition,
} from "@cuckcode/contracts";
import { disposeQuestion, raiseQuestion, type QuestionRegister } from "@cuckcode/domain";

type QuestionIntent = "raise" | "dispose";

type QuestionCommand = Readonly<{
  commandId: string;
  expectedRevision: number;
  actor: Readonly<{ actorType: "manager" | "agent"; actorId: string }>;
  intent: QuestionIntent;
  payload: unknown;
}>;

type QuestionCommandResult =
  | Readonly<{
      ok: true;
      register: QuestionRegister;
      receipt: Readonly<{
        receiptId: string;
        commandId: string;
        acceptedRevision: number;
        resultingRevision: number;
        intent: QuestionIntent;
        actorId: string;
        questionId: string;
        status: string;
        blocksWork: boolean;
      }>;
    }>
  | Readonly<{ ok: false; code: string; retrySafe?: true; requiredAction?: string }>;

// Duplicated from the aggregate on purpose. Authority is enforced at the boundary as well as in
// the domain, so a caller that bypasses one still cannot bypass the other.
const managerOnlyDispositions = new Set(["accepted_risk", "rejected", "deferred"]);

export function executeQuestionCommand(
  input: Readonly<{
    register: QuestionRegister;
    currentRevision: number;
    command: QuestionCommand;
  }>,
): QuestionCommandResult {
  const { command, currentRevision } = input;
  if (command.expectedRevision !== currentRevision) {
    return {
      ok: false,
      code: "QUESTION_COMMAND_STALE",
      retrySafe: true,
      requiredAction:
        "Refresh the question register and reissue the command at its current revision.",
    };
  }

  const applied =
    command.intent === "raise"
      ? applyRaise(input.register, command)
      : applyDispose(input.register, command);
  if (!applied.ok) return applied;

  const record = applied.register.questions[applied.questionId];
  return {
    ok: true,
    register: applied.register,
    receipt: {
      receiptId: `receipt_${command.commandId}`,
      commandId: command.commandId,
      acceptedRevision: currentRevision,
      resultingRevision: currentRevision + 1,
      intent: command.intent,
      actorId: command.actor.actorId,
      questionId: applied.questionId,
      status: record?.status ?? "unknown",
      blocksWork: record?.question.blocksWork ?? false,
    },
  };
}

type Applied =
  { ok: true; register: QuestionRegister; questionId: string } | { ok: false; code: string };

function applyRaise(register: QuestionRegister, command: QuestionCommand): Applied {
  const validation = validateOpenQuestion(command.payload);
  if (!validation.ok) return { ok: false, code: validation.code };
  const question: OpenQuestion = validation.value;
  if (!attributionMatches(question.authorKind, question.authorId, command)) {
    return { ok: false, code: "QUESTION_ATTRIBUTION_MISMATCH" };
  }
  const raised = raiseQuestion(register, question);
  if (!raised.ok) return { ok: false, code: raised.code };
  return { ok: true, register: raised.register, questionId: question.questionId };
}

function applyDispose(register: QuestionRegister, command: QuestionCommand): Applied {
  const validation = validateQuestionDisposition(command.payload);
  if (!validation.ok) return { ok: false, code: validation.code };
  const disposition: QuestionDisposition = validation.value;
  if (!attributionMatches(disposition.authorKind, disposition.authorId, command)) {
    return { ok: false, code: "QUESTION_ATTRIBUTION_MISMATCH" };
  }
  if (
    managerOnlyDispositions.has(disposition.disposition) &&
    command.actor.actorType !== "manager"
  ) {
    return { ok: false, code: "QUESTION_MANAGER_AUTHORITY_REQUIRED" };
  }
  const disposed = disposeQuestion(register, disposition);
  if (!disposed.ok) return { ok: false, code: disposed.code };
  return { ok: true, register: disposed.register, questionId: disposition.questionId };
}

function attributionMatches(
  authorKind: "manager" | "agent",
  authorId: string,
  command: QuestionCommand,
): boolean {
  return authorKind === command.actor.actorType && authorId === command.actor.actorId;
}
