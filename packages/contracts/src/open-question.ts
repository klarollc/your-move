import { parseUtcTimestamp } from "./primitives.js";

export const questionSubjectKinds = [
  "work_item",
  "knowledge",
  "artifact",
  "role",
  "kickoff",
  "project",
] as const;
export type QuestionSubjectKind = (typeof questionSubjectKinds)[number];

export const questionConfidences = ["speculative", "likely", "confident"] as const;
export type QuestionConfidence = (typeof questionConfidences)[number];

export const questionAuthorKinds = ["manager", "agent"] as const;
export type QuestionAuthorKind = (typeof questionAuthorKinds)[number];

export const questionDispositions = [
  "answered",
  "accepted_risk",
  "superseded",
  "rejected",
  "deferred",
] as const;
export type QuestionDispositionKind = (typeof questionDispositions)[number];

export type QuestionIssueCode =
  | "QUESTION_INVALID"
  | "QUESTION_UNRESOLVABLE"
  | "QUESTION_SECRET_REJECTED"
  | "QUESTION_DISPOSITION_INCOMPLETE";

type Validation<T> = { ok: true; value: T } | { ok: false; code: QuestionIssueCode };

export type OpenQuestion = Readonly<{
  schemaVersion: 1;
  questionId: string;
  projectId: string;
  subject: Readonly<{ kind: QuestionSubjectKind; id: string }>;
  authorKind: QuestionAuthorKind;
  authorId: string;
  roleId?: string;
  raisedByEventId: string;
  raisedAt: string;
  question: string;
  whyItMatters: string;
  confidence: QuestionConfidence;
  wouldBeResolvedBy: string[];
  evidenceRefs: string[];
  blocksWork: boolean;
  addressedToRoleId?: string;
  neededBy?: string;
}>;

export type QuestionDisposition = Readonly<{
  dispositionId: string;
  questionId: string;
  authorKind: QuestionAuthorKind;
  authorId: string;
  disposition: QuestionDispositionKind;
  reason: string;
  evidenceRefs: string[];
  supersededByQuestionId?: string;
  reviewBy?: string;
}>;

export function validateOpenQuestion(input: unknown): Validation<OpenQuestion> {
  if (!isRecord(input)) return invalid("QUESTION_INVALID");
  if (containsSecret(input)) return invalid("QUESTION_SECRET_REJECTED");

  // A question that cannot say what would settle it is a complaint, not a question.
  if (Array.isArray(input.wouldBeResolvedBy) && !nonEmptyStringArray(input.wouldBeResolvedBy)) {
    return invalid("QUESTION_UNRESOLVABLE");
  }

  if (
    input.schemaVersion !== 1 ||
    !nonEmpty(input.questionId) ||
    !nonEmpty(input.projectId) ||
    !validSubject(input.subject) ||
    !isMember(input.authorKind, questionAuthorKinds) ||
    !nonEmpty(input.authorId) ||
    !optionalNonEmpty(input.roleId) ||
    !nonEmpty(input.raisedByEventId) ||
    // Every canonical record can say when it happened. A question that cannot is not
    // attributable in time, and anything projecting it has no truthful freshness to show.
    !utcTimestamp(input.raisedAt) ||
    !nonEmpty(input.question) ||
    !nonEmpty(input.whyItMatters) ||
    !isMember(input.confidence, questionConfidences) ||
    !nonEmptyStringArray(input.wouldBeResolvedBy) ||
    !stringArray(input.evidenceRefs) ||
    // blocksWork is always explicit. It is never inferred from the question's shape.
    typeof input.blocksWork !== "boolean" ||
    !optionalNonEmpty(input.addressedToRoleId) ||
    !optionalNonEmpty(input.neededBy)
  ) {
    return invalid("QUESTION_INVALID");
  }
  return { ok: true, value: input as unknown as OpenQuestion };
}

export function validateQuestionDisposition(input: unknown): Validation<QuestionDisposition> {
  if (!isRecord(input)) return invalid("QUESTION_INVALID");
  if (containsSecret(input)) return invalid("QUESTION_SECRET_REJECTED");
  if (
    !isMember(input.authorKind, questionAuthorKinds) ||
    !isMember(input.disposition, questionDispositions) ||
    typeof input.dispositionId !== "string" ||
    typeof input.questionId !== "string" ||
    typeof input.authorId !== "string" ||
    typeof input.reason !== "string" ||
    !stringArray(input.evidenceRefs) ||
    !optionalString(input.supersededByQuestionId) ||
    !optionalString(input.reviewBy)
  ) {
    return invalid("QUESTION_INVALID");
  }
  if (
    !nonEmpty(input.dispositionId) ||
    !nonEmpty(input.questionId) ||
    !nonEmpty(input.authorId) ||
    // Every disposition states why. Silence and shrugs do not close a question.
    !nonEmpty(input.reason) ||
    // Superseding without a successor loses the thread.
    (input.disposition === "superseded" && !nonEmpty(input.supersededByQuestionId)) ||
    // Deferral without a review date is a silent drop.
    (input.disposition === "deferred" && !nonEmpty(input.reviewBy))
  ) {
    return invalid("QUESTION_DISPOSITION_INCOMPLETE");
  }
  return { ok: true, value: input as unknown as QuestionDisposition };
}

const secretKey = /api[_-]?key|authorization|credential|password|secret|token/iu;
const secretValue = /\bsk-[a-z0-9_-]+\b|\bauthorization\s*:|\bbearer\s+[a-z0-9._-]+/iu;

function containsSecret(value: unknown): boolean {
  if (typeof value === "string") return secretValue.test(value);
  if (Array.isArray(value)) return value.some(containsSecret);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => secretKey.test(key) || containsSecret(child));
}

function validSubject(value: unknown): boolean {
  return (
    isRecord(value) &&
    isMember(value.kind, questionSubjectKinds) &&
    nonEmpty(value.id) &&
    Object.keys(value).every((key) => key === "kind" || key === "id")
  );
}

function isMember<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return stringArray(value) && value.length > 0;
}

function optionalNonEmpty(value: unknown): boolean {
  return value === undefined || nonEmpty(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function utcTimestamp(value: unknown): value is string {
  return typeof value === "string" && parseUtcTimestamp(value).ok;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(code: QuestionIssueCode): { ok: false; code: QuestionIssueCode } {
  return { ok: false, code };
}
