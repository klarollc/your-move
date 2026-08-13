import { describe, expect, it } from "vitest";

import type { CanonicalProjectSnapshot } from "./replay.js";
import { projectAccessibleOutline } from "./accessible-outline.js";

const snapshot = (): CanonicalProjectSnapshot => ({
  schemaVersion: 1,
  project: { projectId: "project_alpha", name: "Alpha" },
  eventIds: [],
  work: {
    workItems: {
      work_zeta: {
        workItemId: "work_zeta",
        outcome: "Resolve blocker",
        state: "blocked",
        revision: 2,
        requiredEvidenceKinds: ["unit"],
        updatedByEventId: "event_blocked",
        updatedAt: "2026-08-13T23:00:00.000Z",
      },
      work_alpha: {
        workItemId: "work_alpha",
        outcome: "Review evidence",
        state: "completed",
        revision: 6,
        requiredEvidenceKinds: ["browser"],
        updatedByEventId: "event_completed",
        updatedAt: "2026-08-13T23:00:01.000Z",
      },
    },
    evidence: {
      evidence_browser: {
        evidenceId: "evidence_browser",
        workItemId: "work_alpha",
        kind: "browser",
        version: 3,
        result: "passed",
        eventId: "event_evidence",
      },
    },
    approvals: {},
    issues: [
      {
        code: "INVALID_WORK_TRANSITION",
        eventId: "event_conflict",
        workItemId: "work_zeta",
        message: "stale revision",
      },
    ],
  },
  staffing: { agents: {}, assignments: {}, qualifications: {}, issues: [] },
  knowledge: { records: {}, issues: [] },
  collaborations: {},
  replayIssues: [],
});

describe("projectAccessibleOutline", () => {
  it("provides stable non-spatial ordering and complete human-legible action state", () => {
    const outline = projectAccessibleOutline(snapshot());

    expect(outline.items.map(({ subjectId }) => subjectId)).toEqual(["work_alpha", "work_zeta"]);
    expect(outline.items[1]).toMatchObject({
      subjectId: "work_zeta",
      label: "Resolve blocker — blocked",
      status: "blocked",
      scope: { projectId: "project_alpha", workItemId: "work_zeta" },
      constraints: { requiredEvidenceKinds: ["unit"] },
      conflicts: [{ code: "INVALID_WORK_TRANSITION", eventId: "event_conflict" }],
      nextActions: ["resolve_blocker"],
    });
  });
});
