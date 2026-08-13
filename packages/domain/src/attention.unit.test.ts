import { describe, expect, it } from "vitest";

import type { CanonicalProjectSnapshot } from "./replay.js";
import { projectManagerAttention } from "./attention.js";

const snapshot: CanonicalProjectSnapshot = {
  schemaVersion: 1,
  project: { projectId: "project_alpha", name: "Alpha" },
  eventIds: [],
  work: {
    workItems: {
      work_done: {
        workItemId: "work_done",
        outcome: "Done",
        state: "completed",
        revision: 1,
        requiredEvidenceKinds: [],
        updatedByEventId: "event_03",
        updatedAt: "2026-08-13T23:00:03.000Z",
      },
      work_waiting: {
        workItemId: "work_waiting",
        outcome: "Waiting",
        state: "waiting_input",
        revision: 1,
        requiredEvidenceKinds: [],
        updatedByEventId: "event_02",
        updatedAt: "2026-08-13T23:00:02.000Z",
      },
      work_blocked: {
        workItemId: "work_blocked",
        outcome: "Blocked",
        state: "blocked",
        revision: 1,
        requiredEvidenceKinds: [],
        updatedByEventId: "event_01",
        updatedAt: "2026-08-13T23:00:01.000Z",
      },
    },
    evidence: {},
    approvals: {},
    issues: [],
  },
  staffing: { agents: {}, assignments: {}, qualifications: {}, issues: [] },
  knowledge: { records: {}, issues: [] },
  collaborations: {},
  replayIssues: [],
};

describe("projectManagerAttention", () => {
  it("orders blocked, waiting input, then completed-unapproved work deterministically", () => {
    expect(
      projectManagerAttention(snapshot).map(({ subjectId, reason }) => [subjectId, reason]),
    ).toEqual([
      ["work_blocked", "blocked"],
      ["work_waiting", "waiting_input"],
      ["work_done", "approval_required"],
    ]);
  });
});
