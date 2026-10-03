import { projectOfficeReadModel, type OfficePersonView } from "@cuckcode/application";
import { replayProject } from "@cuckcode/domain";
import { describe, expect, it } from "vitest";

import { OFFICE_FIXTURES, OFFICE_SHELL_STATES, officeFixtureFor } from "./index.js";
import { OFFICE_REGISTRY } from "./registry.js";

/** Phase 7-O Task 5: the office's states are canonical logs, and they carry decision detail. */
const modelFor = (id: string) => {
  const fixture = OFFICE_FIXTURES[id];
  expect(fixture, id).toBeDefined();
  return projectOfficeReadModel({
    snapshot: replayProject(fixture!.events),
    now: fixture!.now,
    registry: OFFICE_REGISTRY,
  });
};
const person = (model: ReturnType<typeof modelFor>, entityId: string) =>
  model.entities.find((entity) => entity.entityId === entityId) as OfficePersonView | undefined;

/**
 * Decision sufficiency (spec §8, criterion 4): for every open attention item, the inspector of the
 * related person resolves the cause, the condition, the requested action and at least one piece of
 * evidence. An inspector that is truthful but empty fails here.
 */
function expectDecisionSufficient(id: string) {
  const model = modelFor(id);
  expect(model.attention.length, `${id} has no attention item to decide`).toBeGreaterThan(0);
  for (const item of model.attention) {
    const label = `${id}/${item.workItemId}`;
    expect(item.relatedEntityId, `${label}: nobody holds it`).not.toBeNull();
    const holder = person(model, item.relatedEntityId!);
    const work = holder?.work.find((view) => view.workItemId === item.workItemId);
    expect(work, `${label}: not in the holder's inspector`).toBeDefined();
    expect(work!.supported, `${label}: unsupported`).toBe(true);
    expect(work!.causeEventId, `${label}: no cause`).not.toBeNull();
    expect(work!.condition, `${label}: no recorded condition`).not.toBeNull();
    expect(work!.condition!.summary.length, `${label}: empty reason`).toBeGreaterThan(0);
    expect(work!.condition!.waitingOn.kind, `${label}: no waiting-on`).toBeTruthy();
    expect(
      work!.condition!.requestedAction?.summary.length ?? 0,
      `${label}: no action`,
    ).toBeGreaterThan(0);
    expect(work!.evidence.length, `${label}: no evidence link`).toBeGreaterThan(0);
  }
}

describe("office fixture logs", () => {
  it("maps every shell state to a canonical log, and marks non-canonical states as overlays", () => {
    const canonical = new Set([
      "ready",
      "empty",
      "partial",
      "stale",
      "permission-denied",
      "missing-artifact",
      "test-failure",
      "reviewer-disagreement",
      "conflict",
      "cancelled",
    ]);
    for (const state of OFFICE_SHELL_STATES) {
      const { fixture, overlay } = officeFixtureFor(state);
      expect(fixture.events, state).toBeDefined();
      if (canonical.has(state)) {
        expect(overlay, state).toBeNull();
        expect(fixture.id, state).toBe(state === "ready" ? "default" : state);
      } else {
        expect(overlay, state).toBe(state);
        expect(fixture.id, state).toBe("default");
      }
    }
  });

  it("replays every log with no replay issue and only the issues it declares", () => {
    for (const fixture of Object.values(OFFICE_FIXTURES)) {
      const snapshot = replayProject(fixture.events);
      expect(snapshot.replayIssues, fixture.id).toEqual([]);
      const codes = [...snapshot.work.issues, ...snapshot.staffing.issues].map(({ code }) => code);
      expect(codes, fixture.id).toEqual([...fixture.expectedIssueCodes]);
      expect(fixture.purpose.length, fixture.id).toBeGreaterThan(0);
    }
  });

  it("gives the default office the detail each decision needs (criterion 4)", () => {
    expectDecisionSufficient("default");
  });

  it("gives the permission-denied state (T3) the detail its decision needs", () => {
    expectDecisionSufficient("permission-denied");
    const blocked = modelFor("permission-denied").attention.find(
      (item) => item.reason === "blocked",
    );
    expect(blocked?.condition?.reasonCode).toBe("awaiting_permission");
  });

  it("resolves what approving the graybox review would take (T4)", () => {
    const model = modelFor("default");
    const work = person(model, "agent_implementation_engineer")?.work.find(
      (view) => view.workItemId === "work_graybox_slice",
    );
    expect(work?.state).toBe("review_requested");
    expect(work?.approval.status).toBe("not_approved");
    expect(work?.approval.requiredEvidenceKinds.length).toBeGreaterThan(0);
    expect(work?.approval.missingEvidenceKinds).toEqual([]);
  });

  it("reads stale when the clock has moved past the log", () => {
    const model = modelFor("stale");
    const test = person(model, "agent_test_engineer");
    expect(test?.agent.status === "recorded" && test.agent.freshness).toBe("delayed");
  });
});

/**
 * Phase 7-O Task 9 (spec §8.6), owner ruling 2026-09-26: two logs for the capture states no log
 * reached, selected with `?fixture=<id>` over the ready shell.
 */
describe("capture-only office logs", () => {
  it("records completed work that no approval covers", () => {
    const model = modelFor("completed-unapproved");
    const work = person(model, "agent_implementation_engineer")?.work.find(
      (view) => view.workItemId === "work_graybox_slice",
    );
    expect(work?.state).toBe("completed");
    expect(work?.approval.status).toBe("not_approved");
    expect(work?.approval.missingEvidenceKinds).toEqual([]);
    expect(model.issues).toEqual([]);
  });

  it("records work nobody holds, which no person's inspector lists", () => {
    const fixture = OFFICE_FIXTURES.unassigned;
    expect(fixture).toBeDefined();
    const snapshot = replayProject(fixture!.events);
    const unheld = Object.values(snapshot.work.workItems).filter((item) => !item.assignment);
    expect(unheld.map((item) => item.workItemId)).toEqual(["work_release_notes"]);
    const model = modelFor("unassigned");
    const held = model.entities.flatMap((entity) =>
      entity.kind === "person" ? entity.work.map((view) => view.workItemId) : [],
    );
    expect(held).not.toContain("work_release_notes");
    expect(model.issues).toEqual([]);
  });

  it("selects a named log over the ready shell, and ignores an unknown one", () => {
    expect(officeFixtureFor("ready", "unassigned")).toEqual({
      fixture: OFFICE_FIXTURES.unassigned,
      overlay: null,
    });
    expect(officeFixtureFor("ready", "no_such_log").fixture).toBe(OFFICE_FIXTURES.default);
  });
});
