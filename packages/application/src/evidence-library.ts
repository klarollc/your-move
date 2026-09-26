import type { KnowledgeLifecycleStatus } from "@cuckcode/contracts";
import type { CanonicalProjectSnapshot } from "@cuckcode/domain";

import type { OfficeReadModel } from "./office-read-model.js";

const knowledgeOrder: readonly KnowledgeLifecycleStatus[] = [
  "authoritative",
  "approved",
  "provisional",
  "contested",
  "stale",
  "superseded",
  "rejected",
];
const evidenceOrder = ["test", "visual", "release"] as const;
type EvidenceKind = (typeof evidenceOrder)[number];
type EvidenceStatus = "pending" | "failed" | "complete" | "approved";

type KnowledgeInput = Readonly<{
  knowledgeId: string;
  status: KnowledgeLifecycleStatus;
  title: string;
  snippet: string;
  hiddenReasoning?: string;
  revision: number;
  originatingEntityId: string;
  authorized: boolean;
}>;

type EvidenceInput = Readonly<{
  evidenceId: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  summary: string;
  hiddenReasoning?: string;
  /** The evidence record's own version: an Evidence link resolves by ID and version (spec §6). */
  version: number;
  revision: number;
  originatingEntityId: string;
  authorized: boolean;
}>;

export type BrowserLibraryProjection = Readonly<{
  knowledge: ReadonlyArray<
    Readonly<{
      knowledgeId: string;
      status: KnowledgeLifecycleStatus;
      title: string;
      snippet: string;
      revision: number;
      originatingEntityId: string;
    }>
  >;
  evidence: readonly LibraryEvidenceRecord[];
}>;

/**
 * One evidence record as the Project Library shows it. `kind` is the kind as recorded; a record
 * projected from the log has no summary text (`null`), because `evidence.recorded` carries none
 * (Task 8b-2), and no origin when no office entity holds its work.
 */
export type LibraryEvidenceRecord = Readonly<{
  evidenceId: string;
  kind: string;
  status: EvidenceStatus;
  summary: string | null;
  version: number;
  revision: number;
  originatingEntityId: string | null;
  approved: boolean;
  workItemId?: string;
  causeEventId?: string;
}>;

/**
 * The Project Library's evidence, projected from the canonical log (Phase 7-O Task 8b).
 *
 * One record per recorded evidence item, at the version the log holds. The origin is the office
 * person whose held work the evidence belongs to, from the office read model, or null. `approved`
 * requires a manager approval that cites this evidence ID at this version; completed and approved
 * stay distinct. `revision` is the workspace revision the projection read.
 */
export function projectOfficeLibraryEvidence(
  input: Readonly<{ snapshot: CanonicalProjectSnapshot; model: OfficeReadModel }>,
): readonly LibraryEvidenceRecord[] {
  const { snapshot, model } = input;
  const holderOf = new Map<string, string>();
  for (const entity of model.entities) {
    if (entity.kind !== "person") continue;
    for (const work of entity.work) holderOf.set(work.workItemId, entity.entityId);
  }
  const approvals = Object.values(snapshot.work.approvals);
  return Object.values(snapshot.work.evidence)
    .map((record): LibraryEvidenceRecord => {
      const approved =
        record.result === "passed" &&
        approvals.some(
          (approval) =>
            approval.workItemId === record.workItemId &&
            approval.evidenceVersions.some(
              ({ evidenceId, version }) =>
                evidenceId === record.evidenceId && version === record.version,
            ),
        );
      return {
        evidenceId: record.evidenceId,
        kind: record.kind,
        status: record.result === "failed" ? "failed" : approved ? "approved" : "complete",
        summary: null,
        version: record.version,
        revision: model.source.eventCount,
        originatingEntityId: holderOf.get(record.workItemId) ?? null,
        approved,
        workItemId: record.workItemId,
        causeEventId: record.eventId,
      };
    })
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) || left.evidenceId.localeCompare(right.evidenceId),
    );
}

export function projectBrowserLibrary(
  input: Readonly<{
    knowledge: readonly KnowledgeInput[];
    evidence: readonly EvidenceInput[];
  }>,
): BrowserLibraryProjection {
  return {
    knowledge: input.knowledge
      .filter(({ authorized }) => authorized)
      .map((record) => ({
        knowledgeId: record.knowledgeId,
        status: record.status,
        ...(containsSensitive(record.title) || containsSensitive(record.snippet)
          ? {
              title: "Restricted record",
              snippet: "Sensitive content withheld from this browser session.",
            }
          : { title: record.title, snippet: record.snippet }),
        revision: record.revision,
        originatingEntityId: record.originatingEntityId,
      }))
      .sort(
        (left, right) =>
          knowledgeOrder.indexOf(left.status) - knowledgeOrder.indexOf(right.status) ||
          left.knowledgeId.localeCompare(right.knowledgeId),
      ),
    evidence: input.evidence
      .filter(({ authorized }) => authorized)
      .map((record) => ({
        evidenceId: record.evidenceId,
        kind: record.kind,
        status: record.status,
        summary: containsSensitive(record.summary)
          ? "Sensitive evidence summary withheld from this browser session."
          : record.summary,
        version: record.version,
        revision: record.revision,
        originatingEntityId: record.originatingEntityId,
        approved: record.status === "approved",
      }))
      .sort(
        (left, right) =>
          (evidenceOrder as readonly string[]).indexOf(left.kind) -
            (evidenceOrder as readonly string[]).indexOf(right.kind) ||
          left.evidenceId.localeCompare(right.evidenceId),
      ),
  };
}

function containsSensitive(value: string): boolean {
  return /\b(?:authorization|bearer|credential|password|secret|token)\b|\bsk-[a-z0-9_-]+/iu.test(
    value,
  );
}
