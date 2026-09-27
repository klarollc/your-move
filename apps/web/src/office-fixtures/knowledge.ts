import type { BrowserLibraryProjection } from "@cuckcode/application";

/**
 * The Project Library's knowledge records: Phase 4 graybox data, kept as it was. Phase 7-O Task 8b
 * moved the library's evidence to the canonical log; knowledge has no canonical expression in the
 * office logs yet and is out of 8b's scope.
 */
const knowledgeStatuses = [
  "authoritative",
  "approved",
  "provisional",
  "contested",
  "stale",
  "superseded",
  "rejected",
] as const;

export const PHASE_4_KNOWLEDGE: BrowserLibraryProjection["knowledge"] = knowledgeStatuses.map(
  (status, index) => ({
    knowledgeId: `knowledge_${status}`,
    status,
    title: `${status.slice(0, 1).toUpperCase()}${status.slice(1)} project record`,
    snippet: `Browser-safe ${status} context remains explicitly labeled.`,
    revision: index + 1,
    originatingEntityId: "zone_library",
  }),
);
