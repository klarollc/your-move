import type { CanonicalProjectSnapshot } from "./replay.js";

export type ManagerAttentionItem = {
  subjectId: string;
  reason: "blocked" | "waiting_input" | "failed" | "review_requested" | "approval_required";
  priority: number;
  causeEventId: string;
  updatedAt: string;
};
const priorities: Record<ManagerAttentionItem["reason"], number> = {
  blocked: 10,
  failed: 20,
  waiting_input: 30,
  review_requested: 40,
  approval_required: 50,
};

export function projectManagerAttention(
  snapshot: CanonicalProjectSnapshot,
): ManagerAttentionItem[] {
  const items: ManagerAttentionItem[] = [];
  for (const work of Object.values(snapshot.work.workItems)) {
    let reason: ManagerAttentionItem["reason"] | undefined;
    if (work.state === "blocked") reason = "blocked";
    if (work.state === "failed") reason = "failed";
    if (work.state === "waiting_input") reason = "waiting_input";
    if (work.state === "review_requested") reason = "review_requested";
    if (
      work.state === "completed" &&
      !Object.values(snapshot.work.approvals).some(
        (approval) => approval.workItemId === work.workItemId,
      )
    ) {
      reason = "approval_required";
    }
    if (reason) {
      items.push({
        subjectId: work.workItemId,
        reason,
        priority: priorities[reason],
        causeEventId: work.updatedByEventId,
        updatedAt: work.updatedAt,
      });
    }
  }
  return items.sort(
    (left, right) =>
      left.priority - right.priority || left.subjectId.localeCompare(right.subjectId),
  );
}
