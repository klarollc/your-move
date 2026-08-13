import type { CanonicalProjectSnapshot } from "./replay.js";
import type { AgentPresence } from "./staffing-truth.js";
import type { WorkState } from "./work-truth.js";

export type SceneFreshness = "current" | "delayed" | "unavailable";
export type OfficeSceneDescriptor = {
  subjectType: "work" | "agent" | "collaboration";
  subjectId: string;
  state: string;
  behavior: string;
  zone: string;
  semanticMotion: boolean;
  causeEventId: string | null;
  updatedAt: string | null;
  freshness: SceneFreshness;
  approved: boolean;
};

const workPresentation: Record<WorkState, { behavior: string; zone: string }> = {
  draft: { behavior: "neutral", zone: "desk" },
  ready: { behavior: "neutral", zone: "desk" },
  assigned: { behavior: "reserved", zone: "desk" },
  active: { behavior: "work_loop", zone: "desk" },
  review_requested: { behavior: "review_station", zone: "review" },
  verified: { behavior: "verified_waiting", zone: "review" },
  completed: { behavior: "delivery_area", zone: "delivery" },
  waiting_input: { behavior: "attention_request", zone: "desk" },
  blocked: { behavior: "blocked_stationary", zone: "desk" },
  failed: { behavior: "failure_stationary", zone: "desk" },
  paused: { behavior: "paused_stationary", zone: "desk" },
  cancelled: { behavior: "cancelled", zone: "archive" },
};
const agentBehavior: Record<AgentPresence, string> = {
  unavailable: "offline",
  idle: "neutral",
  reserved: "reserved",
  active: "work_loop",
  waiting: "waiting",
  blocked: "blocked_stationary",
  reviewing: "review_station",
  failed: "failure_stationary",
};

export function projectOfficeScene(
  snapshot: CanonicalProjectSnapshot,
  now: string,
  staleAfterMs = 60_000,
): OfficeSceneDescriptor[] {
  const descriptors: OfficeSceneDescriptor[] = [];
  for (const item of Object.values(snapshot.work.workItems)) {
    const presentation = workPresentation[item.state];
    const approved = Object.values(snapshot.work.approvals).some(
      (approval) => approval.workItemId === item.workItemId,
    );
    descriptors.push({
      subjectType: "work",
      subjectId: item.workItemId,
      state: item.state,
      behavior: presentation.behavior,
      zone: presentation.zone,
      semanticMotion: item.state === "active",
      causeEventId: item.updatedByEventId,
      updatedAt: item.updatedAt,
      freshness: freshness(item.updatedAt, now, staleAfterMs),
      approved,
    });
  }
  for (const agent of Object.values(snapshot.staffing.agents)) {
    descriptors.push({
      subjectType: "agent",
      subjectId: agent.agentId,
      state: agent.health === "connected" ? agent.presence : "unavailable",
      behavior: agent.health === "connected" ? agentBehavior[agent.presence] : "offline",
      zone: agent.presence === "reviewing" ? "review" : "desk",
      semanticMotion: agent.health === "connected" && agent.presence === "active",
      causeEventId: null,
      updatedAt: null,
      freshness: "unavailable",
      approved: false,
    });
  }
  for (const collaboration of Object.values(snapshot.collaborations)) {
    if (!collaboration.active) continue;
    descriptors.push({
      subjectType: "collaboration",
      subjectId: collaboration.collaborationId,
      state: collaboration.kind,
      behavior: collaboration.kind === "handoff" ? "handoff_transition" : "active_collaboration",
      zone: "shared",
      semanticMotion: true,
      causeEventId: collaboration.updatedByEventId,
      updatedAt: collaboration.updatedAt,
      freshness: freshness(collaboration.updatedAt, now, staleAfterMs),
      approved: false,
    });
  }
  return descriptors.sort(
    (left, right) =>
      left.subjectType.localeCompare(right.subjectType) ||
      left.subjectId.localeCompare(right.subjectId),
  );
}

function freshness(updatedAt: string, now: string, staleAfterMs: number): SceneFreshness {
  const age = Date.parse(now) - Date.parse(updatedAt);
  return Number.isFinite(age) && age >= 0 && age <= staleAfterMs ? "current" : "delayed";
}
