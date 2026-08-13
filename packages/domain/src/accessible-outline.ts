import { buildActionableRecords, type ActionableRecord } from "./reciprocal-records.js";
import type { CanonicalProjectSnapshot } from "./replay.js";

export type AccessibleOutlineItem = ActionableRecord & { label: string };
export type AccessibleOfficeOutline = { projectId: string | null; items: AccessibleOutlineItem[] };

export function projectAccessibleOutline(
  snapshot: CanonicalProjectSnapshot,
): AccessibleOfficeOutline {
  return {
    projectId: snapshot.project.projectId,
    items: buildActionableRecords(snapshot).map((record) => ({
      ...record,
      label: `${snapshot.work.workItems[record.subjectId]?.outcome ?? record.subjectId} — ${record.status}`,
    })),
  };
}
