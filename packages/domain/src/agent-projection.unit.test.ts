import { describe, expect, it } from "vitest";

import type { CanonicalProjectSnapshot } from "./replay.js";
import { projectAccessibleOutline } from "./accessible-outline.js";
import { projectAgentActionableState } from "./agent-projection.js";

const snapshot: CanonicalProjectSnapshot = {
  schemaVersion: 1,
  project: { projectId: "project_alpha", name: "Alpha" },
  eventIds: [],
  work: {
    workItems: {
      work_notice: {
        workItemId: "work_notice",
        outcome: "Deliver notice",
        state: "completed",
        revision: 6,
        requiredEvidenceKinds: ["unit"],
        updatedByEventId: "event_completed",
        updatedAt: "2026-08-13T23:00:00.000Z",
      },
    },
    evidence: {
      evidence_unit: {
        evidenceId: "evidence_unit",
        workItemId: "work_notice",
        kind: "unit",
        version: 1,
        result: "passed",
        eventId: "event_evidence",
      },
    },
    approvals: {},
    issues: [],
  },
  staffing: { agents: {}, assignments: {}, qualifications: {}, issues: [] },
  knowledge: { records: {}, issues: [] },
  collaborations: {},
  replayIssues: [],
};

describe("reciprocal projections", () => {
  it("exposes byte-equivalent actionable records to humans and agents", () => {
    const human = projectAccessibleOutline(snapshot).items.map(
      ({ label: _label, ...record }) => record,
    );
    const agent = projectAgentActionableState(snapshot).items;

    expect(agent).toEqual(human);
    expect(agent[0]).toMatchObject({
      subjectId: "work_notice",
      status: "completed",
      evidenceLinks: [{ evidenceId: "evidence_unit", version: 1 }],
      decisions: { approvalIds: [] },
      nextActions: ["request_manager_approval"],
    });
  });
});
