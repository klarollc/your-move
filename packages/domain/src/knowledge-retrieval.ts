import type { KnowledgeTruth, KnowledgeTruthRecord } from "./knowledge-truth.js";

/**
 * Retrieval and conflict surfacing for shared project knowledge — MDD section 15.
 *
 * Two rules from that section drive everything here, and both are about what a reader is *not* told.
 *
 * "Deleted, inaccessible, rejected, or superseded material is not silently substituted." A retrieval
 * that drops a rejected record and hands back the survivor is, to its reader, indistinguishable from
 * a project in which the rejected record never existed. So withheld records are reported as
 * omissions, with the reason, and a superseded one names its replacement.
 *
 * "Conflicts are stored and surfaced; they are never silently merged." A conflict therefore does not
 * disappear once it is settled — it is retained with the resolution that settled it. A subsystem
 * where resolved conflicts vanish cannot answer the question that matters later, which is what the
 * project used to believe and who decided otherwise.
 */

export type RetrievalQuery = Readonly<{
  subject?: string;
  /** Case-insensitive substring of the statement. */
  text?: string;
}>;

export type RetrievedRecord = KnowledgeTruthRecord;

export type RetrievalOmission = Readonly<{
  knowledgeId: string;
  status: KnowledgeTruthRecord["status"];
  reason: string;
  supersededBy?: string;
}>;

export type KnowledgeConflict = Readonly<{
  subject: string;
  knowledgeIds: string[];
  statements: string[];
  /** Null while more than one claim is still live. Never removed once recorded. */
  resolution: null | {
    survivingKnowledgeId: string;
    disposedOf: Array<{ knowledgeId: string; status: string; supersededBy?: string }>;
  };
  /** Syntheses proposed over this subject. They cite their inputs and do not outrank them. */
  proposedResolutions: string[];
}>;

export type RetrievalIssue = Readonly<{ code: string; knowledgeId: string; message: string }>;

export type RetrievalResult = Readonly<{
  results: RetrievedRecord[];
  omissions: RetrievalOmission[];
  conflicts: KnowledgeConflict[];
  issues: RetrievalIssue[];
}>;

const WITHHELD: Partial<Record<KnowledgeTruthRecord["status"], string>> = {
  rejected: "a rejected record is retained as an auditable proposal and must not guide work",
  superseded: "superseded by a named newer record; retained for history",
};

/** A claim still capable of guiding work. Stale counts: its source moved, its content is not void. */
const isLive = (record: KnowledgeTruthRecord): boolean =>
  record.status !== "rejected" && record.status !== "superseded";

const isSynthesis = (record: KnowledgeTruthRecord): boolean =>
  (record.synthesisOf?.length ?? 0) > 0;

const byId = (left: { knowledgeId: string }, right: { knowledgeId: string }): number =>
  left.knowledgeId.localeCompare(right.knowledgeId);

const matches = (record: KnowledgeTruthRecord, query: RetrievalQuery): boolean => {
  if (query.subject !== undefined && record.subject !== query.subject) return false;
  if (
    query.text !== undefined &&
    !record.statement.toLowerCase().includes(query.text.toLowerCase())
  ) {
    return false;
  }
  return true;
};

export function retrieveKnowledge(state: KnowledgeTruth, query: RetrievalQuery): RetrievalResult {
  const matched = Object.values(state.records).filter((record) => matches(record, query));

  const results = matched.filter(isLive).sort(byId);
  const omissions = matched
    .filter((record) => !isLive(record))
    .sort(byId)
    .map((record) => ({
      knowledgeId: record.knowledgeId,
      status: record.status,
      reason: WITHHELD[record.status] ?? "withheld",
      ...(record.supersededBy ? { supersededBy: record.supersededBy } : {}),
    }));

  // A synthesis that cites a record nobody contributed is not a synthesis of anything. It is
  // reported rather than dropped, because the citation is the only thing keeping it from outranking
  // the inputs it claims to summarise.
  const issues: RetrievalIssue[] = [];
  for (const record of matched.sort(byId)) {
    for (const cited of record.synthesisOf ?? []) {
      if (state.records[cited]) continue;
      issues.push({
        code: "SYNTHESIS_CITES_MISSING_RECORD",
        knowledgeId: record.knowledgeId,
        message: `synthesis cites ${cited}, which is not in the project record`,
      });
    }
  }

  const subjects = new Set(matched.map((record) => record.subject).filter(Boolean));
  const conflicts = detectKnowledgeConflicts(state).filter((conflict) =>
    query.subject === undefined ? true : subjects.has(conflict.subject),
  );

  return { results, omissions, conflicts, issues };
}

/**
 * Every subject over which two records ever asserted different things.
 *
 * Resolved conflicts stay in the answer, carrying how they were resolved. Promotion is not a
 * resolution: marking one record authoritative while a contradicting record is still live leaves the
 * loser in the project, still retrievable, and now outranked by something that never addressed it.
 * That is the silent merge section 15 forbids, and it is the case this function is most careful about.
 */
export function detectKnowledgeConflicts(state: KnowledgeTruth): KnowledgeConflict[] {
  const bySubject = new Map<string, KnowledgeTruthRecord[]>();
  for (const record of Object.values(state.records)) {
    if (!record.subject) continue;
    bySubject.set(record.subject, [...(bySubject.get(record.subject) ?? []), record]);
  }

  const conflicts: KnowledgeConflict[] = [];
  for (const [subject, records] of [...bySubject.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const claims = records.filter((record) => !isSynthesis(record)).sort(byId);
    const distinct = new Set(claims.map((record) => record.statement));
    if (distinct.size < 2) continue;

    const live = claims.filter(isLive);
    const disposed = claims.filter((record) => !isLive(record));
    const liveStatements = new Set(live.map((record) => record.statement));

    conflicts.push({
      subject,
      knowledgeIds: claims.map((record) => record.knowledgeId),
      statements: [...distinct],
      resolution:
        liveStatements.size <= 1 && live.length > 0
          ? {
              survivingKnowledgeId: live[0]?.knowledgeId ?? "",
              disposedOf: disposed.map((record) => ({
                knowledgeId: record.knowledgeId,
                status: record.status,
                ...(record.supersededBy ? { supersededBy: record.supersededBy } : {}),
              })),
            }
          : null,
      proposedResolutions: records
        .filter(isSynthesis)
        .sort(byId)
        .map((record) => record.knowledgeId),
    });
  }
  return conflicts;
}

/** The conflicts that still need a decision. */
export function openKnowledgeConflicts(state: KnowledgeTruth): KnowledgeConflict[] {
  return detectKnowledgeConflicts(state).filter((conflict) => conflict.resolution === null);
}
