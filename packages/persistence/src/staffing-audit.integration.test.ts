import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { evaluateRoleOffer } from "@cuckcode/domain";

import { appendEvents, readEvents } from "./event-store.js";
import { openProjectStore } from "./project-store.js";

it("persists offer, agent response, and manager decision as separate canonical events", () => {
  const root = mkdtempSync(join(tmpdir(), "cuckcode-staffing-audit-"));
  const store = openProjectStore(root);
  try {
    const result = evaluateRoleOffer({
      offer: {
        offerId: "offer_1",
        agentId: "agent_1",
        roleId: "implementation-engineer",
        roleContractVersion: "agency-overlay-1",
        overlayDiff: ["TDD required"],
        qualificationOutcome: "passed",
        qualificationEvidenceIds: ["evidence_1"],
        permissionCeiling: ["project.read"],
        prohibitedActions: ["deploy"],
        workload: { activeRoles: 0, capacity: "available" },
        conflicts: [],
      },
      response: { kind: "decline", category: "capacity", reason: "Current workload" },
      manager: { decision: "defer", managerId: "manager_1", reason: "Role remains vacant" },
      existingAssignments: [],
      independentReviewerId: "reviewer_1",
    });
    appendEvents(
      store,
      "project_alpha",
      result.auditEvents.map((event, index) => ({
        schemaVersion: 1,
        eventId: `event_staffing_${index}`,
        projectId: "project_alpha",
        kind: event.kind,
        occurredAt: `2026-08-13T19:00:0${index}.000Z`,
        receivedAt: `2026-08-13T19:00:0${index}.000Z`,
        source: event.source,
        trust: "verified",
        payload: event.payload,
      })),
    );

    expect(readEvents(store, "project_alpha").map(({ kind }) => kind)).toEqual([
      "role.offer_recorded",
      "role.response_recorded",
      "role.assignment_decided",
    ]);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
