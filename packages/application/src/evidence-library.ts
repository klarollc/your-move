import type { KnowledgeLifecycleStatus } from "@cuckcode/contracts";

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
  evidence: ReadonlyArray<
    Readonly<{
      evidenceId: string;
      kind: EvidenceKind;
      status: EvidenceStatus;
      summary: string;
      version: number;
      revision: number;
      originatingEntityId: string;
      approved: boolean;
    }>
  >;
}>;

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
          evidenceOrder.indexOf(left.kind) - evidenceOrder.indexOf(right.kind) ||
          left.evidenceId.localeCompare(right.evidenceId),
      ),
  };
}

function containsSensitive(value: string): boolean {
  return /\b(?:authorization|bearer|credential|password|secret|token)\b|\bsk-[a-z0-9_-]+/iu.test(
    value,
  );
}
