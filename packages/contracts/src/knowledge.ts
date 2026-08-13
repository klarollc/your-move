import type { ProjectEvent } from "./events.js";

export const knowledgeLifecycleStatuses = [
  "provisional",
  "authoritative",
  "approved",
  "contested",
  "rejected",
  "stale",
  "superseded",
] as const;
export type KnowledgeLifecycleStatus = (typeof knowledgeLifecycleStatuses)[number];

export function determineInitialKnowledgeStatus(
  source: ProjectEvent["source"],
  requestedStatus: KnowledgeLifecycleStatus,
): { status: KnowledgeLifecycleStatus; issue?: "AGENT_FINDING_REQUIRES_PROMOTION" } {
  if (
    source === "adapter" &&
    (requestedStatus === "authoritative" || requestedStatus === "approved")
  ) {
    return { status: "provisional", issue: "AGENT_FINDING_REQUIRES_PROMOTION" };
  }
  return { status: requestedStatus };
}
