import {
  determineInitialKnowledgeStatus,
  knowledgeLifecycleStatuses,
  parseProjectEvent,
  type KnowledgeLifecycleStatus,
  type ProjectEvent,
} from "@cuckcode/contracts";

export type KnowledgeTruthRecord = {
  knowledgeId: string;
  statement: string;
  provenance: { sourceId: string; sourceVersion: number };
  status: KnowledgeLifecycleStatus;
  authorized: boolean;
  revision: number;
  updatedByEventId: string;
  supersededBy?: string;
  /** What this record is about. Two records sharing a subject can disagree; without one they cannot. */
  subject?: string;
  /** The records this one summarises. A synthesis cites its inputs and does not outrank them. */
  synthesisOf?: string[];
};
export type KnowledgeTruth = {
  records: Record<string, KnowledgeTruthRecord>;
  issues: { code: string; eventId: string; knowledgeId?: string; message: string }[];
};

export function reduceKnowledgeTruth(input: readonly unknown[]): KnowledgeTruth {
  const state: KnowledgeTruth = { records: {}, issues: [] };
  for (const candidate of input) {
    const parsed = parseProjectEvent(candidate);
    if (!parsed.ok) continue;
    if (parsed.value.kind === "knowledge.recorded") recordKnowledge(state, parsed.value);
    if (parsed.value.kind === "knowledge.status_changed")
      changeKnowledgeStatus(state, parsed.value);
  }
  return state;
}

export function selectCurrentKnowledge(state: KnowledgeTruth): KnowledgeTruthRecord[] {
  return Object.values(state.records)
    .filter((record) => record.authorized && record.status === "authoritative")
    .sort((left, right) => left.knowledgeId.localeCompare(right.knowledgeId));
}

function recordKnowledge(state: KnowledgeTruth, event: ProjectEvent): void {
  const knowledgeId = text(event.payload.knowledgeId);
  const statement = text(event.payload.statement);
  const requestedStatus = status(event.payload.requestedStatus);
  const authorized = event.payload.authorized;
  const provenance = provenanceValue(event.payload.provenance);
  if (
    !knowledgeId ||
    !statement ||
    !requestedStatus ||
    typeof authorized !== "boolean" ||
    !provenance
  ) {
    addIssue(
      state,
      "MALFORMED_KNOWLEDGE",
      event,
      "knowledge record requires statement and provenance",
      knowledgeId,
    );
    return;
  }
  const subject = text(event.payload.subject);
  const synthesisOf = citations(event.payload.synthesisOf);
  const initial = determineInitialKnowledgeStatus(event.source, requestedStatus);
  state.records[knowledgeId] = {
    knowledgeId,
    statement,
    provenance,
    status: initial.status,
    authorized,
    revision: 0,
    updatedByEventId: event.eventId,
    ...(subject === undefined ? {} : { subject }),
    ...(synthesisOf === undefined ? {} : { synthesisOf }),
  };
  if (initial.issue)
    addIssue(state, initial.issue, event, "agent finding remains provisional", knowledgeId);
}

function changeKnowledgeStatus(state: KnowledgeTruth, event: ProjectEvent): void {
  const knowledgeId = text(event.payload.knowledgeId);
  const toStatus = status(event.payload.toStatus);
  const fromRevision = integer(event.payload.fromRevision);
  const record = knowledgeId ? state.records[knowledgeId] : undefined;
  if (!knowledgeId || !record || !toStatus || fromRevision !== record.revision) {
    addIssue(
      state,
      "INVALID_KNOWLEDGE_TRANSITION",
      event,
      "record or revision is invalid",
      knowledgeId,
    );
    return;
  }
  const managerOnly =
    toStatus === "authoritative" || toStatus === "rejected" || toStatus === "superseded";
  if (managerOnly && event.source !== "manager") {
    addIssue(
      state,
      "UNAUTHORIZED_KNOWLEDGE_TRANSITION",
      event,
      `${toStatus} requires manager authority`,
      knowledgeId,
    );
    return;
  }
  if (toStatus === "stale" && event.source !== "system" && event.source !== "manager") {
    addIssue(
      state,
      "UNAUTHORIZED_KNOWLEDGE_TRANSITION",
      event,
      "staleness requires system or manager authority",
      knowledgeId,
    );
    return;
  }
  const supersededBy = toStatus === "superseded" ? text(event.payload.supersededBy) : undefined;
  if (toStatus === "superseded" && !supersededBy) {
    addIssue(
      state,
      "INVALID_KNOWLEDGE_TRANSITION",
      event,
      "supersession must identify its replacement",
      knowledgeId,
    );
    return;
  }
  state.records[knowledgeId] = {
    ...record,
    status: toStatus,
    revision: record.revision + 1,
    updatedByEventId: event.eventId,
    ...(supersededBy ? { supersededBy } : {}),
  };
}

function provenanceValue(value: unknown): { sourceId: string; sourceVersion: number } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const sourceId = text(record.sourceId);
  const sourceVersion = integer(record.sourceVersion);
  return sourceId && sourceVersion !== undefined ? { sourceId, sourceVersion } : undefined;
}
function status(value: unknown): KnowledgeLifecycleStatus | undefined {
  return typeof value === "string" &&
    knowledgeLifecycleStatuses.includes(value as KnowledgeLifecycleStatus)
    ? (value as KnowledgeLifecycleStatus)
    : undefined;
}
/** A citation list is a list of ids or it is nothing. A partly-readable one is not half-accepted. */
function citations(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const ids = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  return ids.length === value.length ? ids : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function integer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}
function addIssue(
  state: KnowledgeTruth,
  code: string,
  event: ProjectEvent,
  message: string,
  knowledgeId?: string,
): void {
  state.issues.push({
    code,
    eventId: event.eventId,
    ...(knowledgeId ? { knowledgeId } : {}),
    message,
  });
}
