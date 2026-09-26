import type { ProjectEvent } from "@cuckcode/contracts";

import { stableStringify } from "./canonical-json.js";
import { normalizeEventLog, type EventLogIssue } from "./event-order.js";
import { reduceKnowledgeTruth, type KnowledgeTruth } from "./knowledge-truth.js";
import { reduceStaffingTruth, type StaffingTruth } from "./staffing-truth.js";
import { reduceWorkTruth, type WorkTruthState } from "./work-truth.js";

export type CollaborationTruth = {
  collaborationId: string;
  kind: "collaboration" | "handoff";
  participantIds: string[];
  active: boolean;
  /** A handoff's direction and work item, when its event records all three (Phase 7-O Task 9). */
  handoff?: { fromAgentId: string; toAgentId: string; workItemId: string };
  updatedByEventId: string;
  updatedAt: string;
};
export type ReplayIssue =
  EventLogIssue | { code: "MULTIPLE_PROJECTS"; projectIds: string[]; message: string };
export type CanonicalProjectSnapshot = {
  schemaVersion: 1;
  project: { projectId: string | null; name: string | null };
  eventIds: string[];
  work: WorkTruthState;
  staffing: StaffingTruth;
  knowledge: KnowledgeTruth;
  collaborations: Record<string, CollaborationTruth>;
  replayIssues: ReplayIssue[];
};

export function replayProject(input: readonly unknown[]): CanonicalProjectSnapshot {
  const normalized = normalizeEventLog(input);
  const projectIds = [...new Set(normalized.events.map(({ projectId }) => projectId))].sort();
  const selectedProjectId = projectIds[0] ?? null;
  const events = selectedProjectId
    ? normalized.events.filter(({ projectId }) => projectId === selectedProjectId)
    : [];
  const replayIssues: ReplayIssue[] = [...normalized.issues];
  if (projectIds.length > 1) {
    replayIssues.push({
      code: "MULTIPLE_PROJECTS",
      projectIds,
      message:
        "One replay input contained events for multiple projects; only the first project was reduced.",
    });
  }
  replayIssues.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  return {
    schemaVersion: 1,
    project: { projectId: selectedProjectId, name: projectName(events) },
    eventIds: events.map(({ eventId }) => eventId),
    work: reduceWorkTruth(events),
    staffing: reduceStaffingTruth(events),
    knowledge: reduceKnowledgeTruth(events),
    collaborations: reduceCollaborations(events),
    replayIssues,
  };
}

function projectName(events: readonly ProjectEvent[]): string | null {
  const created = events.find(({ kind }) => kind === "project.created");
  return created && typeof created.payload.name === "string" ? created.payload.name : null;
}

function reduceCollaborations(events: readonly ProjectEvent[]): Record<string, CollaborationTruth> {
  const collaborations: Record<string, CollaborationTruth> = {};
  for (const event of events) {
    if (event.kind === "collaboration.recorded" || event.kind === "handoff.recorded") {
      const collaborationId = text(event.payload.collaborationId) ?? text(event.payload.handoffId);
      const participantIds = textArray(event.payload.participantIds);
      if (!collaborationId || !participantIds) continue;
      const fromAgentId = text(event.payload.fromAgentId);
      const toAgentId = text(event.payload.toAgentId);
      const workItemId = text(event.payload.workItemId);
      collaborations[collaborationId] = {
        collaborationId,
        kind: event.kind === "handoff.recorded" ? "handoff" : "collaboration",
        participantIds: [...participantIds].sort(),
        active: true,
        ...(event.kind === "handoff.recorded" && fromAgentId && toAgentId && workItemId
          ? { handoff: { fromAgentId, toAgentId, workItemId } }
          : {}),
        updatedByEventId: event.eventId,
        updatedAt: event.occurredAt,
      };
    }
    if (event.kind === "collaboration.closed") {
      const collaborationId = text(event.payload.collaborationId);
      const collaboration = collaborationId ? collaborations[collaborationId] : undefined;
      if (collaborationId && collaboration) {
        collaborations[collaborationId] = {
          ...collaboration,
          active: false,
          updatedByEventId: event.eventId,
          updatedAt: event.occurredAt,
        };
      }
    }
  }
  return collaborations;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function textArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}
