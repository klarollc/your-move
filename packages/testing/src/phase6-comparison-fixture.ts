import { createHash } from "node:crypto";

import type { ProjectEvent } from "@cuckcode/contracts";
import {
  projectAccessibleOutline,
  projectOfficeScene,
  replayProject,
  stableStringify,
  type AccessibleOfficeOutline,
  type CanonicalProjectSnapshot,
  type OfficeSceneDescriptor,
  type WorkItemTruth,
  type WorkTruthState,
} from "@cuckcode/domain";

/**
 * The single canonical default-office frame every Phase 6 candidate renders.
 *
 * The brief's controlled comparison frame exists so that three candidates differ in art direction
 * and in nothing else. That only holds if the state underneath them is identical, which is a claim
 * a reviewer cannot make by looking at three pictures. So the frame is built from canonical events,
 * projected through the same projectors the graybox uses, and reduced to one digest that every
 * candidate manifest must name.
 *
 * `now` is pinned because `projectOfficeScene` derives freshness from it. An unpinned clock would
 * make the digest drift on its own and turn a drift failure into noise nobody trusts.
 */
export const PHASE6_FIXTURE_SEED = {
  projectId: "project_phase6_comparison",
  baseTime: "2026-09-14T00:00:00.000Z",
  eventIdPrefix: "event_phase6",
  now: "2026-09-14T00:00:30.000Z",
} as const;

/**
 * Role to work area. The scene projector derives a behavioral zone from work state; it does not
 * know about the brief's named functional zones, and Phase 4 behavior is accepted and not being
 * reopened. So the frame declares the spatial assignment alongside the canonical projection, and
 * candidates must place the six agents exactly here.
 */
export const PHASE6_ROLE_WORK_AREAS = {
  "delivery-lead": "team_area",
  "product-designer": "team_area",
  "implementation-engineer": "team_area",
  "test-engineer": "team_area",
  "visual-qa-reviewer": "review_station",
  "release-reviewer": "review_station",
} as const;

/** View state the brief fixes for every candidate. Not canonical truth — a declared frame. */
export const PHASE6_VIEW_STATE = {
  primaryViewport: "1440x900",
  accommodationViewport: "1280x800",
  camera: "reset",
  inspector: "closed",
  attentionRail: "collapsed",
  escalations: 0,
  currentPriorities: 1,
  runtimeHealth: "connected",
  reducedMotion: false,
} as const;

export const PHASE6_ROLE_IDS = Object.keys(PHASE6_ROLE_WORK_AREAS) as Array<
  keyof typeof PHASE6_ROLE_WORK_AREAS
>;

const agentIdFor = (roleId: string): string => `agent_${roleId.replace(/-/gu, "_")}`;

/**
 * The active role is fixed rather than incidental. Exactly one work item is in flight, so exactly
 * one agent carries semantic motion — enough for candidates to show the office inhabited and to be
 * scored on motion character, without a second moving subject that would let two candidates differ
 * in what is moving rather than in how it looks.
 */
const ACTIVE_ROLE_ID = "implementation-engineer";

export function createPhase6ComparisonEvents(): ProjectEvent[] {
  let sequence = 0;
  const emit = (
    kind: ProjectEvent["kind"],
    payload: Record<string, unknown>,
    source: ProjectEvent["source"] = "system",
  ): ProjectEvent => {
    sequence += 1;
    const occurredAt = new Date(
      Date.parse(PHASE6_FIXTURE_SEED.baseTime) + sequence * 1_000,
    ).toISOString();
    return {
      schemaVersion: 1,
      eventId: `${PHASE6_FIXTURE_SEED.eventIdPrefix}_${String(sequence).padStart(3, "0")}`,
      projectId: PHASE6_FIXTURE_SEED.projectId,
      ...(kind.startsWith("work.") ? { workItemId: "work_phase6_priority" } : {}),
      kind,
      occurredAt,
      receivedAt: occurredAt,
      source,
      trust: "verified",
      payload,
    };
  };

  const events: ProjectEvent[] = [
    emit("project.created", { name: "Phase 6 comparison frame" }, "manager"),
  ];

  for (const roleId of PHASE6_ROLE_IDS) {
    events.push(
      emit("agent.registered", {
        agentId: agentIdFor(roleId),
        capabilities: [roleId],
        health: "connected",
      }),
    );
  }
  for (const roleId of PHASE6_ROLE_IDS) {
    events.push(
      emit("role.assigned", {
        roleAssignmentId: `role-assignment_${roleId.replace(/-/gu, "_")}`,
        roleId,
        agentId: agentIdFor(roleId),
        requiredCapabilities: [roleId],
      }),
    );
  }

  events.push(
    emit("work.created", {
      workItemId: "work_phase6_priority",
      outcome: "Deliver the current priority",
      requiredEvidenceKinds: ["unit"],
    }),
    emit("work.transitioned", {
      workItemId: "work_phase6_priority",
      fromRevision: 0,
      toState: "ready",
    }),
    emit("work.transitioned", {
      workItemId: "work_phase6_priority",
      fromRevision: 1,
      toState: "assigned",
    }),
    emit("work.transitioned", {
      workItemId: "work_phase6_priority",
      fromRevision: 2,
      toState: "active",
    }),
    emit("agent.presence_changed", {
      agentId: agentIdFor(ACTIVE_ROLE_ID),
      presence: "active",
      health: "connected",
    }),
  );

  return events;
}

export type Phase6ComparisonFrame = {
  events: ProjectEvent[];
  snapshot: CanonicalProjectSnapshot;
  scene: OfficeSceneDescriptor[];
  outline: AccessibleOfficeOutline;
  viewState: typeof PHASE6_VIEW_STATE;
  roleWorkAreas: typeof PHASE6_ROLE_WORK_AREAS;
};

export function projectPhase6ComparisonFrame(): Phase6ComparisonFrame {
  const events = createPhase6ComparisonEvents();
  const snapshot = replayProject(events);
  return {
    events,
    snapshot,
    scene: projectOfficeScene(snapshot, PHASE6_FIXTURE_SEED.now),
    outline: projectAccessibleOutline(snapshot),
    viewState: PHASE6_VIEW_STATE,
    roleWorkAreas: PHASE6_ROLE_WORK_AREAS,
  };
}

/**
 * The digest covers what a candidate must render, not how the frame was built. Events are included
 * by id only: a candidate is bound to the resulting state, and re-deriving the same state through a
 * different but equivalent event sequence should not read as drift.
 */
export function phase6ComparisonFixtureDigest(): string {
  const frame = projectPhase6ComparisonFrame();
  return comparisonDigest(frame, frame.snapshot.work);
}

function comparisonDigest(frame: Phase6ComparisonFrame, work: WorkTruthState): string {
  return createHash("sha256")
    .update(
      stableStringify({
        eventIds: frame.snapshot.eventIds,
        work,
        staffing: frame.snapshot.staffing,
        scene: frame.scene,
        outline: frame.outline,
        viewState: frame.viewState,
        roleWorkAreas: frame.roleWorkAreas,
      }),
    )
    .digest("hex");
}

/**
 * The canonical fields Phase 7-O adds (spec §3, plan P-1), as paths into the digest input. Removing
 * exactly these from a projection must reproduce the frozen Phase 6 fingerprints; anything else that
 * differs is drift the owner has not approved.
 */
export const PHASE_7O_ADDITIONS = [
  "work.workItems[*].assignment",
  "work.workItems[*].condition",
] as const;

/** A copy of the work truth with the Phase 7-O additions removed. The input is not changed. */
export function stripPhase7OAdditions(work: WorkTruthState): WorkTruthState {
  return {
    ...work,
    workItems: Object.fromEntries(
      Object.entries(work.workItems).map(([id, item]) => {
        const phase6: Partial<WorkItemTruth> = { ...item };
        delete phase6.assignment;
        delete phase6.condition;
        return [id, phase6 as WorkItemTruth];
      }),
    ),
  };
}

/** The comparison digest as Phase 6 computed it: the same input with the additions removed. */
export function phase6ComparisonFixtureDigestV1(): string {
  const frame = projectPhase6ComparisonFrame();
  return comparisonDigest(frame, stripPhase7OAdditions(frame.snapshot.work));
}
