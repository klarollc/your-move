import type { CanonicalProjectSnapshot } from "./replay.js";

export type ActionableRecord = {
  subjectId: string;
  identity: { kind: "work_item"; id: string };
  status: string;
  scope: { projectId: string | null; workItemId: string };
  constraints: { requiredEvidenceKinds: string[] };
  decisions: { approvalIds: string[] };
  conflicts: { code: string; eventId: string }[];
  evidenceLinks: { evidenceId: string; version: number }[];
  nextActions: string[];
};

export function buildActionableRecords(snapshot: CanonicalProjectSnapshot): ActionableRecord[] {
  return Object.values(snapshot.work.workItems)
    .map((work): ActionableRecord => {
      const approvalIds = Object.values(snapshot.work.approvals)
        .filter((approval) => approval.workItemId === work.workItemId)
        .map((approval) => approval.approvalId)
        .sort();
      const evidenceLinks = Object.values(snapshot.work.evidence)
        .filter((evidence) => evidence.workItemId === work.workItemId)
        .map(({ evidenceId, version }) => ({ evidenceId, version }))
        .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
      const conflicts = snapshot.work.issues
        .filter((issue) => issue.workItemId === work.workItemId)
        .map(({ code, eventId }) => ({ code, eventId }))
        .sort((left, right) => left.eventId.localeCompare(right.eventId));
      return {
        subjectId: work.workItemId,
        identity: { kind: "work_item", id: work.workItemId },
        status: work.state,
        scope: { projectId: snapshot.project.projectId, workItemId: work.workItemId },
        constraints: { requiredEvidenceKinds: [...work.requiredEvidenceKinds].sort() },
        decisions: { approvalIds },
        conflicts,
        evidenceLinks,
        nextActions: nextActions(work.state, approvalIds.length > 0),
      };
    })
    .sort((left, right) => left.subjectId.localeCompare(right.subjectId));
}

function nextActions(state: string, approved: boolean): string[] {
  if (state === "blocked") return ["resolve_blocker"];
  if (state === "waiting_input") return ["answer_request"];
  if (state === "review_requested") return ["review_evidence"];
  if (state === "completed" && !approved) return ["request_manager_approval"];
  return [];
}
