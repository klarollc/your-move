import { describe, expect, it } from "vitest";

import { reduceWorkTruth } from "./work-truth.js";

const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  source = "system",
) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_alpha",
  workItemId: "work_notice",
  kind,
  occurredAt: `2026-08-13T20:00:${eventId.slice(-2)}.000Z`,
  receivedAt: `2026-08-13T20:01:${eventId.slice(-2)}.000Z`,
  source,
  trust: "verified",
  payload,
});

const created = event("event_01", "work.created", {
  workItemId: "work_notice",
  outcome: "Ship a verified Decision Notice",
  requiredEvidenceKinds: ["unit", "browser"],
});

describe("reduceWorkTruth", () => {
  it("retains an invalid transition as an issue without mutating accepted state", () => {
    const invalid = event("event_02", "work.transitioned", {
      workItemId: "work_notice",
      fromRevision: 0,
      toState: "active",
    });

    const result = reduceWorkTruth([created, invalid]);

    expect(result.workItems.work_notice?.state).toBe("draft");
    expect(result.issues).toContainEqual({
      code: "INVALID_WORK_TRANSITION",
      eventId: "event_02",
      workItemId: "work_notice",
      message: "draft cannot transition to active",
    });
  });

  it("rejects completion until every named evidence kind has a passed version", () => {
    const events = [
      created,
      event("event_02", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 0,
        toState: "ready",
      }),
      event("event_03", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 1,
        toState: "assigned",
      }),
      event("event_04", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 2,
        toState: "active",
      }),
      event("event_05", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 3,
        toState: "review_requested",
      }),
      event("event_06", "evidence.recorded", {
        evidenceId: "evidence_unit",
        workItemId: "work_notice",
        kind: "unit",
        version: 1,
        result: "passed",
      }),
      event("event_07", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 4,
        toState: "verified",
      }),
      event("event_08", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 5,
        toState: "completed",
      }),
    ];

    const result = reduceWorkTruth(events);

    expect(result.workItems.work_notice?.state).toBe("review_requested");
    expect(result.issues.map(({ code }) => code)).toEqual([
      "VERIFICATION_EVIDENCE_MISSING",
      "INVALID_WORK_TRANSITION",
    ]);
  });

  it("records completion separately from explicit version-bound manager approval", () => {
    const sequence = [
      created,
      ...(["ready", "assigned", "active", "review_requested"] as const).map((toState, index) =>
        event(`event_0${index + 2}`, "work.transitioned", {
          workItemId: "work_notice",
          fromRevision: index,
          toState,
        }),
      ),
      event("event_06", "evidence.recorded", {
        evidenceId: "evidence_unit",
        workItemId: "work_notice",
        kind: "unit",
        version: 1,
        result: "passed",
      }),
      event("event_07", "evidence.recorded", {
        evidenceId: "evidence_browser",
        workItemId: "work_notice",
        kind: "browser",
        version: 3,
        result: "passed",
      }),
      event("event_08", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 4,
        toState: "verified",
      }),
      event("event_09", "work.transitioned", {
        workItemId: "work_notice",
        fromRevision: 5,
        toState: "completed",
      }),
    ];

    const completed = reduceWorkTruth(sequence);
    expect(completed.workItems.work_notice?.state).toBe("completed");
    expect(completed.approvals).toEqual({});

    const approved = reduceWorkTruth([
      ...sequence,
      event(
        "event_10",
        "approval.recorded",
        {
          approvalId: "approval_notice",
          workItemId: "work_notice",
          artifactId: "artifact_notice",
          artifactVersion: 2,
          evidenceVersions: [
            { evidenceId: "evidence_browser", version: 3 },
            { evidenceId: "evidence_unit", version: 1 },
          ],
        },
        "manager",
      ),
    ]);

    expect(approved.approvals.approval_notice).toMatchObject({
      actor: "manager",
      artifactId: "artifact_notice",
      artifactVersion: 2,
      evidenceVersions: [
        { evidenceId: "evidence_browser", version: 3 },
        { evidenceId: "evidence_unit", version: 1 },
      ],
    });
  });

  it("rejects non-manager approval events", () => {
    const result = reduceWorkTruth([
      created,
      event("event_02", "approval.recorded", { approvalId: "approval_notice" }, "system"),
    ]);

    expect(result.approvals).toEqual({});
    expect(result.issues[0]?.code).toBe("UNAUTHORIZED_APPROVAL");
  });
});
