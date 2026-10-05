import { projectOfficeReadModel, type OfficeWorkView } from "@cuckcode/application";
import { replayProject } from "@cuckcode/domain";

import type { WorkListAssignment, WorkListItem } from "./work-list.js";

export type WorkListProjection = Readonly<{
  projectName: string;
  revision: number;
  items: readonly WorkListItem[];
  assignments: readonly WorkListAssignment[];
}>;

const EVIDENCE_STATES = new Set([
  "assigned",
  "active",
  "blocked",
  "waiting_input",
  "review_requested",
]);

/** Surface B is a projection of the canonical log, never a separate source of work truth. */
export function projectWorkList(events: readonly unknown[], now: string): WorkListProjection {
  const snapshot = replayProject(events);
  const registry = Object.values(snapshot.staffing.agents).map((agent) => ({
    entityId: agent.agentId,
    kind: "person" as const,
    label: agent.agentId,
    agentId: agent.agentId,
  }));
  const officeProjection = projectOfficeReadModel({ snapshot, now, registry });
  const officeWork = new Map<string, OfficeWorkView>([
    ...officeProjection.unassignedWork.map((work) => [work.workItemId, work] as const),
    ...officeProjection.entities.flatMap((entity) =>
      entity.kind === "person" ? entity.work.map((work) => [work.workItemId, work] as const) : [],
    ),
  ]);
  const partialWork = new Set<string>();
  for (const raw of events) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const event = raw as { kind?: unknown; payload?: unknown };
    if (
      event.kind !== "evidence.recorded" ||
      typeof event.payload !== "object" ||
      event.payload === null
    ) {
      continue;
    }
    const payload = event.payload as Record<string, unknown>;
    if (
      payload.kind === "turn-record" &&
      payload.partial === true &&
      typeof payload.workItemId === "string"
    ) {
      partialWork.add(payload.workItemId);
    }
  }
  const outputDigests = new Map<string, string>();
  for (const raw of events) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const event = raw as { eventId?: unknown; kind?: unknown; payload?: unknown };
    if (event.kind !== "evidence.recorded" || typeof event.eventId !== "string") continue;
    if (typeof event.payload !== "object" || event.payload === null || Array.isArray(event.payload))
      continue;
    const digest = (event.payload as Record<string, unknown>).outputSha256;
    if (typeof digest === "string") outputDigests.set(event.eventId, digest);
  }

  const assignments = Object.values(snapshot.staffing.assignments)
    .map((assignment) => ({
      roleAssignmentId: assignment.roleAssignmentId,
      label: `${humanLabel(assignment.roleId)} · ${assignment.agentId}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const items = Object.values(snapshot.work.workItems)
    .map((item): WorkListItem => {
      const assignment = item.assignment
        ? snapshot.staffing.assignments[item.assignment.roleAssignmentId]
        : undefined;
      const view = officeWork.get(item.workItemId);
      return {
        workItemId: item.workItemId,
        outcome: item.outcome,
        state: item.state,
        assignee: assignment ? `${humanLabel(assignment.roleId)} · ${assignment.agentId}` : null,
        partial: partialWork.has(item.workItemId),
        contractAcceptsEvidence: Boolean(item.contract && EVIDENCE_STATES.has(item.state)),
        evidenceObligations:
          item.contract?.evidenceObligations ??
          item.requiredEvidenceKinds.map((kind) => ({ kind, description: "Required evidence" })),
        evidence: (view?.evidence ?? []).map(({ kind, result, eventId }) => {
          const outputSha256 = outputDigests.get(eventId);
          return {
            kind,
            result,
            eventId,
            ...(outputSha256 ? { outputSha256 } : {}),
          };
        }),
        postures: (view?.postures ?? []).map(({ runId, posture, eventId }) => ({
          runId,
          requested: `${posture.requested.sandboxMode}; approvals ${posture.requested.approvalPolicy}; network off`,
          granted: `${posture.granted.type}; approvals ${posture.granted.approvalPolicy}; network ${posture.granted.networkAccess ? "on" : "off"}`,
          declared: `read ${posture.declared.read}; write ${posture.declared.write}; run ${posture.declared.run}`,
          match: posture.match,
          eventId,
        })),
        lastEvent: item.updatedAt,
      };
    })
    .sort((left, right) => left.outcome.localeCompare(right.outcome));

  return {
    projectName: snapshot.project.name ?? "Project work",
    revision: events.length,
    items,
    assignments,
  };
}

function humanLabel(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
