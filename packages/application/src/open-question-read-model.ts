import type { OpenQuestion, QuestionDisposition } from "@cuckcode/contracts";
import {
  questionsRequiringDisposition,
  type OpenQuestionRecord,
  type QuestionRegister,
  type QuestionStatus,
} from "@cuckcode/domain";

export type SharedQuestionRecord = Readonly<{
  questionId: string;
  projectId: string;
  subject: OpenQuestion["subject"];
  authorKind: OpenQuestion["authorKind"];
  authorId: string;
  roleId?: string;
  question: string;
  whyItMatters: string;
  confidence: OpenQuestion["confidence"];
  wouldBeResolvedBy: readonly string[];
  evidenceRefs: readonly string[];
  blocksWork: boolean;
  addressedToRoleId?: string;
  neededBy?: string;
  status: QuestionStatus;
  dispositions: ReadonlyArray<
    Readonly<{
      dispositionId: string;
      authorKind: QuestionDisposition["authorKind"];
      authorId: string;
      disposition: QuestionDisposition["disposition"];
      reason: string;
      evidenceRefs: readonly string[];
      supersededByQuestionId?: string;
      reviewBy?: string;
    }>
  >;
}>;

type RosterEntry = Readonly<{
  roleId: string;
  agentId: string;
  subjects: ReadonlyArray<Readonly<{ kind: string; id: string }>>;
}>;

export function projectOpenQuestionReadModel(
  register: QuestionRegister,
  view: Readonly<{ nowIso: string; roster: ReadonlyArray<RosterEntry> }>,
) {
  // One shared record per question, referenced by both projections. Parity is structural rather
  // than asserted: there is no second construction path that could drift from the first.
  const shared = new Map<string, SharedQuestionRecord>();
  for (const record of Object.values(register.questions)) {
    shared.set(record.question.questionId, toShared(record));
  }
  const all = [...shared.values()].toSorted((left, right) =>
    left.questionId.localeCompare(right.questionId),
  );

  const requiringDisposition = questionsRequiringDisposition(register, view.nowIso)
    .map((record) => shared.get(record.question.questionId))
    .filter((record): record is SharedQuestionRecord => record !== undefined)
    // Blocking questions first; a question that halts an agent outranks one that does not.
    .toSorted(
      (left, right) =>
        Number(right.blocksWork) - Number(left.blocksWork) ||
        left.questionId.localeCompare(right.questionId),
    );

  return {
    schemaVersion: 1 as const,
    manager: { all, requiringDisposition },
    agents: view.roster.map((entry) => {
      const raisedByMe = all.filter((record) => record.authorId === entry.agentId);
      const addressedToMe = all.filter((record) => record.addressedToRoleId === entry.roleId);
      const onMySubjects = all.filter((record) =>
        entry.subjects.some(
          (subject) =>
            subject.kind === record.subject.kind &&
            subject.id === record.subject.id &&
            record.authorId !== entry.agentId,
        ),
      );
      const visible = all.filter(
        (record) =>
          raisedByMe.includes(record) ||
          addressedToMe.includes(record) ||
          onMySubjects.includes(record),
      );
      return {
        schemaVersion: 1 as const,
        roleId: entry.roleId,
        agentId: entry.agentId,
        raisedByMe,
        addressedToMe,
        onMySubjects,
        visible,
      };
    }),
  };
}

function toShared(record: OpenQuestionRecord): SharedQuestionRecord {
  const { question } = record;
  return {
    questionId: question.questionId,
    projectId: question.projectId,
    subject: question.subject,
    authorKind: question.authorKind,
    authorId: question.authorId,
    ...(question.roleId === undefined ? {} : { roleId: question.roleId }),
    question: question.question,
    whyItMatters: question.whyItMatters,
    confidence: question.confidence,
    wouldBeResolvedBy: question.wouldBeResolvedBy.map(safeRef),
    evidenceRefs: question.evidenceRefs.map(safeRef),
    blocksWork: question.blocksWork,
    ...(question.addressedToRoleId === undefined
      ? {}
      : { addressedToRoleId: question.addressedToRoleId }),
    ...(question.neededBy === undefined ? {} : { neededBy: question.neededBy }),
    status: record.status,
    dispositions: record.dispositions.map((disposition) => ({
      dispositionId: disposition.dispositionId,
      authorKind: disposition.authorKind,
      authorId: disposition.authorId,
      disposition: disposition.disposition,
      reason: disposition.reason,
      evidenceRefs: disposition.evidenceRefs.map(safeRef),
      ...(disposition.supersededByQuestionId === undefined
        ? {}
        : { supersededByQuestionId: disposition.supersededByQuestionId }),
      ...(disposition.reviewBy === undefined ? {} : { reviewBy: disposition.reviewBy }),
    })),
  };
}

// Absolute filesystem paths never cross the projection boundary. Evidence is addressed by
// reference, not by location on the machine that happened to produce it.
const absolutePath = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/u;

function safeRef(value: string): string {
  return absolutePath.test(value) ? "[redacted_path]" : value;
}
