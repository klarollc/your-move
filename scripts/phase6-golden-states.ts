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
} from "@cuckcode/domain";
import {
  PHASE6_FIXTURE_SEED,
  createPhase6ComparisonEvents,
  stripPhase7OAdditions,
  type Phase7OAdditionParts,
} from "@cuckcode/testing";

import type { SceneState } from "./phase6-candidate-render.js";

/**
 * The six golden states the brief names, built the way the comparison frame was: from canonical
 * events, through the same projectors the graybox uses. A golden state assembled by drawing what it
 * ought to look like would be a picture of a state rather than a state.
 *
 * Five distinct fixtures plus reduced-motion equivalents. The default office is the frozen Task 1
 * frame unchanged — the state Phase 7 implements against must be the state the candidates were
 * compared on, or the selection carries no information.
 */

const BASE = createPhase6ComparisonEvents();
const NOW = PHASE6_FIXTURE_SEED.now;
const PROJECT_ID = PHASE6_FIXTURE_SEED.projectId;

let extra = 0;
function emit(
  kind: ProjectEvent["kind"],
  payload: Record<string, unknown>,
  source: ProjectEvent["source"] = "system",
): ProjectEvent {
  extra += 1;
  const occurredAt = new Date(
    Date.parse(PHASE6_FIXTURE_SEED.baseTime) + (100 + extra) * 1_000,
  ).toISOString();
  return {
    schemaVersion: 1,
    eventId: `${PHASE6_FIXTURE_SEED.eventIdPrefix}_gs_${String(extra).padStart(3, "0")}`,
    projectId: PROJECT_ID,
    ...(kind.startsWith("work.") || kind === "evidence.recorded"
      ? { workItemId: "work_phase6_priority" }
      : {}),
    kind,
    occurredAt,
    receivedAt: occurredAt,
    source,
    trust: "verified",
    payload,
  };
}

export type GoldenState = {
  id: string;
  name: string;
  /** What this state exists to prove, in the brief's terms. */
  purpose: string;
  events: ProjectEvent[];
  visibleChecklist: string[];
};

/** Transition the one priority from `active` (revision 3 after the base sequence) onward. */
const transition = (fromRevision: number, toState: string, details: Record<string, unknown> = {}) =>
  emit("work.transitioned", {
    workItemId: "work_phase6_priority",
    fromRevision,
    toState,
    ...details,
  });

/**
 * Moves the working agent's presence with its work.
 *
 * Building these states exposed that nothing in the domain propagates a work transition to the
 * agent holding it. A fixture that transitioned only the work left the agent in `active` presence,
 * and `projectOfficeScene` duly emitted a moving agent beside a blocked work item — an office
 * animating work on work that had stopped. That is the fake activity the brief forbids by name, and
 * it arrives from a stale presence rather than from any decision to fake anything.
 */
const presence = (state: string) =>
  emit("agent.presence_changed", {
    agentId: "agent_implementation_engineer",
    presence: state,
    health: "connected",
  });

export const GOLDEN_STATES: GoldenState[] = [
  {
    id: "01-default-office",
    name: "Default office",
    purpose:
      "The frozen Task 1 comparison frame, unchanged. Phase 7 implements against the same state the candidates were compared on.",
    events: BASE,
    visibleChecklist: [
      "six distinct agents, all connected, at their declared work areas",
      "one current priority in the active state",
      "no escalation: no waiting_input, blocked or failed subject",
      "attention rail collapsed, inspector closed, camera at reset",
      "exactly two semantic-motion subjects: the active work item and the agent working it",
    ],
  },
  {
    id: "02-active-collaboration",
    name: "Active collaboration",
    purpose:
      "A collaboration bound to a canonical collaboration event, so the visible gathering is backed by a record rather than by proximity.",
    events: [
      ...BASE,
      emit("collaboration.recorded", {
        collaborationId: "collaboration_charter_review",
        participantIds: ["agent_delivery_lead", "agent_product_designer"],
        topic: "charter scope for the current priority",
      }),
    ],
    visibleChecklist: [
      "one active collaboration descriptor, at the shared zone",
      "both named participants present and identifiable",
      "the collaboration carries the id of the event that created it",
      "no agent is drawn as collaborating who is not a recorded participant",
      "proximity alone never implies collaboration",
    ],
  },
  {
    id: "03-manager-escalation",
    name: "Manager escalation",
    purpose:
      "A single clear attention path: one subject needs the manager, and the route to it is unambiguous.",
    events: [
      ...BASE,
      transition(3, "waiting_input", {
        question: "Which acceptance bound applies to the charter?",
      }),
      presence("waiting"),
    ],
    visibleChecklist: [
      "exactly one subject in waiting_input",
      "an entry in the manager attention rail for that subject and no other",
      "a question glyph at the owning desk, not colour alone",
      "the agent that raised it remains identifiable",
      "no other zone competes for attention",
    ],
  },
  {
    id: "04-blocked-work",
    name: "Blocked work",
    purpose:
      "Blocked with the reason available and no fake activity: a blocked office must not animate as though work continues.",
    events: [
      ...BASE,
      transition(3, "blocked", { reason: "upstream contract unresolved" }),
      presence("blocked"),
    ],
    visibleChecklist: [
      "the priority is blocked and reads as blocked without colour",
      "the reason is reachable from the subject",
      "zero semantic-motion subjects: nothing moves while nothing progresses",
      "the assigned agent is not drawn as active",
      "lighting is unchanged; severity is carried by the subject, not the room",
    ],
  },
  {
    id: "05-visual-review",
    name: "Visual review with named artifact",
    purpose:
      "A review state that names the artifact and evidence under review, so completion stays distinct from approval.",
    events: [
      ...BASE,
      transition(3, "review_requested"),
      presence("reviewing"),
      emit("evidence.recorded", {
        evidenceId: "evidence_capture_matrix",
        kind: "visual",
        artifact: "docs/evidence/phase-6/golden-states/01-default-office-1440x900.svg",
      }),
    ],
    visibleChecklist: [
      "the priority sits at the review station, not at its owning desk",
      "the named artifact and evidence kind are both present in the outline",
      "review_requested is visibly distinct from verified and from completed",
      "no approval is implied by the presence of evidence",
      "the reviewing agent is identifiable",
    ],
  },
];

export type ProjectedGoldenState = {
  state: GoldenState;
  snapshot: CanonicalProjectSnapshot;
  scene: OfficeSceneDescriptor[];
  outline: AccessibleOfficeOutline;
  digest: string;
};

export function projectGoldenState(state: GoldenState): ProjectedGoldenState {
  const snapshot = replayProject(state.events);
  const scene = projectOfficeScene(snapshot, NOW);
  const outline = projectAccessibleOutline(snapshot);
  return {
    state,
    snapshot,
    scene,
    outline,
    digest: goldenDigest(
      snapshot,
      { work: snapshot.work, staffing: snapshot.staffing, scene },
      outline,
    ),
  };
}

function goldenDigest(
  snapshot: CanonicalProjectSnapshot,
  parts: Phase7OAdditionParts,
  outline: AccessibleOfficeOutline,
): string {
  return createHash("sha256")
    .update(
      stableStringify({
        eventIds: snapshot.eventIds,
        work: parts.work,
        staffing: parts.staffing,
        collaborations: snapshot.collaborations,
        scene: parts.scene,
        outline,
      }),
    )
    .digest("hex");
}

export const projectAllGoldenStates = (): ProjectedGoldenState[] =>
  GOLDEN_STATES.map(projectGoldenState);

/** The two approved viewports every golden state is captured at. */
export const GOLDEN_VIEWPORTS: Array<[string, number, number]> = [
  ["1440x900", 1440, 900],
  ["1280x800", 1280, 800],
];

/** Turns canonical descriptors into the declared render state. Nothing is invented here. */
export function sceneStateFrom(projected: ProjectedGoldenState): SceneState {
  const agentStates: Record<string, string> = {};
  let work: { state: string } | undefined;
  const collaborationParticipants: string[] = [];

  for (const descriptor of projected.scene) {
    if (descriptor.subjectType === "agent") agentStates[descriptor.subjectId] = descriptor.state;
    if (descriptor.subjectType === "work") work = { state: descriptor.state };
  }
  for (const collaboration of Object.values(projected.snapshot.collaborations)) {
    if (collaboration.active) collaborationParticipants.push(...collaboration.participantIds);
  }
  // `work` is omitted rather than set to `undefined`. `SceneState.work` is optional and the
  // renderer tests it with `if (scene.work)`, so the two are identical at runtime — but under
  // `exactOptionalPropertyTypes` an explicit `undefined` is not assignable to an optional property.
  // Type-only; proven no-op against the five golden states at both viewports, digests unchanged.
  // Owner ruling 2026-09-14, `docs/evidence/decision-record-2026-09-14-scripts-typecheck.md`.
  return { agentStates, collaborationParticipants, ...(work ? { work } : {}) };
}

/**
 * A golden state's fingerprint as Phase 6 computed it: the same input with the Phase 7-O additions
 * removed by the one definition of them in `@cuckcode/testing` (plan P-1).
 */
export function goldenStateDigestV1(projected: ProjectedGoldenState): string {
  return goldenDigest(
    projected.snapshot,
    stripPhase7OAdditions({
      work: projected.snapshot.work,
      staffing: projected.snapshot.staffing,
      scene: projected.scene,
    }),
    projected.outline,
  );
}
