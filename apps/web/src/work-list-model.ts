import { normalizeEventLog, projectManagerAttention, replayProject } from "@cuckcode/domain";
import type { ProjectEvent } from "@cuckcode/contracts";

import type {
  WorkListAssignment,
  WorkListEvidence,
  WorkListItem,
  WorkListLogEntry,
} from "./work-list.js";

export type WorkListHealth = Readonly<{
  status: "current" | "stale" | "incomplete" | "damaged" | "disagreement";
  revision: number;
  projectedRevision: number;
  fetchedAt: string | null;
  ageMs: number | null;
  issueCount: number;
  issues: readonly string[];
}>;

export type WorkListProjectionOptions = Readonly<{
  revision?: number;
  truncated?: boolean;
  problems?: readonly unknown[];
  connected?: boolean;
  fetchedAt?: string;
  now?: string;
}>;

export type WorkListProjection = Readonly<{
  projectName: string;
  revision: number;
  items: readonly WorkListItem[];
  assignments: readonly WorkListAssignment[];
  log: readonly WorkListLogEntry[];
  health: WorkListHealth;
}>;

const EVIDENCE_STATES = new Set([
  "assigned",
  "active",
  "blocked",
  "waiting_input",
  "review_requested",
]);

/**
 * Surface B is a read-model projection of the canonical event log. Work state comes only from
 * replayProject; event envelopes are joined by event id to retain provenance that the domain
 * reducer intentionally does not duplicate into its truth records.
 */
export function projectWorkList(
  events: readonly unknown[],
  optionsOrNow: WorkListProjectionOptions | string = {},
): WorkListProjection {
  const options = typeof optionsOrNow === "string" ? { now: optionsOrNow } : optionsOrNow;
  const snapshot = replayProject(events, options.now ? { asOf: options.now } : {});
  const normalized = normalizeEventLog(events);
  const eventById = new Map<string, ProjectEvent>(
    normalized.events.map((event) => [event.eventId, event]),
  );
  const revisionById = new Map(snapshot.eventIds.map((eventId, index) => [eventId, index + 1]));
  const currentTimeMs = Date.parse(options.now ?? new Date().toISOString());
  const attentionById = new Map(
    projectManagerAttention(snapshot).map((attention) => [attention.subjectId, attention]),
  );
  const roleAssignmentEvent = new Map<string, ProjectEvent>();
  for (const event of normalized.events) {
    const roleAssignmentId = text(event.payload.roleAssignmentId);
    if (event.kind === "role.assigned" && roleAssignmentId) {
      roleAssignmentEvent.set(roleAssignmentId, event);
    }
  }
  const eventsByWork = new Map<string, ProjectEvent[]>();
  for (const event of normalized.events) {
    const payloadWorkItemId = text(event.payload.workItemId);
    const workItemId = event.workItemId ?? payloadWorkItemId;
    if (!workItemId || !snapshot.work.workItems[workItemId]) continue;
    const history = eventsByWork.get(workItemId) ?? [];
    history.push(event);
    eventsByWork.set(workItemId, history);
  }

  const revision = options.revision ?? events.length;
  const projectedRevision = snapshot.eventIds.length;
  const issues = [
    ...normalized.issues,
    ...snapshot.work.issues,
    ...snapshot.replayIssues,
    ...(options.problems ?? []),
  ];
  const fetchedAt = options.fetchedAt ?? null;
  const nowMs = Date.parse(options.now ?? new Date().toISOString());
  const fetchedAtMs = fetchedAt === null ? Number.NaN : Date.parse(fetchedAt);
  const ageMs =
    Number.isFinite(nowMs) && Number.isFinite(fetchedAtMs)
      ? Math.max(0, nowMs - fetchedAtMs)
      : null;
  const status: WorkListHealth["status"] =
    options.connected === false
      ? "stale"
      : options.truncated === true
        ? "incomplete"
        : issues.length > 0
          ? "damaged"
          : revision !== projectedRevision
            ? "disagreement"
            : "current";
  const health: WorkListHealth = {
    status,
    revision,
    projectedRevision,
    fetchedAt,
    ageMs,
    issueCount: issues.length,
    issues: issues.map(describeIssue),
  };

  const assignments = Object.values(snapshot.staffing.assignments)
    .map((assignment): WorkListAssignment => {
      const event = roleAssignmentEvent.get(assignment.roleAssignmentId);
      return {
        roleAssignmentId: assignment.roleAssignmentId,
        label: `${humanLabel(assignment.roleId)} · ${assignment.agentId}`,
        sourceRevision: event ? (revisionById.get(event.eventId) ?? null) : null,
        source: event?.source ?? null,
        trust: event?.trust ?? null,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  const items = Object.values(snapshot.work.workItems)
    .map((item): WorkListItem => {
      const assignment = item.assignment
        ? snapshot.staffing.assignments[item.assignment.roleAssignmentId]
        : undefined;
      const assignmentEvent = item.assignment ? eventById.get(item.assignment.eventId) : undefined;
      const history = eventsByWork.get(item.workItemId) ?? [];
      const latestSignal = history.at(-1);
      const attention = attentionById.get(item.workItemId);
      const evidence: WorkListEvidence[] = Object.values(snapshot.work.evidence)
        .filter((record) => record.workItemId === item.workItemId)
        .map((record) => {
          const event = eventById.get(record.eventId);
          const payload = event?.payload ?? {};
          return {
            kind: record.kind,
            result: record.result,
            eventId: record.eventId,
            status: evidenceStatus(event),
            source: event?.source ?? null,
            trust: event?.trust ?? null,
            sourceRevision: revisionById.get(record.eventId) ?? null,
            occurredAt: event?.occurredAt ?? null,
            providerRunId: event?.providerRunId ?? null,
            worktreeSha256: sha256(payload.worktreeSha256),
            outputSha256: sha256(payload.outputSha256),
          };
        })
        .sort((left, right) => (left.sourceRevision ?? 0) - (right.sourceRevision ?? 0));
      const partial = evidence.some((record) => {
        const event = eventById.get(record.eventId);
        return record.kind === "turn-record" && event?.payload.partial === true;
      });
      const postures = (snapshot.work.postures?.[item.workItemId] ?? []).map((record) => {
        const event = eventById.get(record.eventId);
        const posture = record.posture;
        return {
          runId: record.runId,
          requested: `${posture.requested.sandboxMode}; approvals ${posture.requested.approvalPolicy}; network off`,
          granted: `${posture.granted.type}; approvals ${posture.granted.approvalPolicy}; network ${posture.granted.networkAccess ? "on" : "off"}`,
          declared: `read ${posture.declared.read}; write ${posture.declared.write}; run ${posture.declared.run}`,
          match: posture.match,
          eventId: record.eventId,
          source: event?.source ?? null,
          trust: event?.trust ?? null,
          sourceRevision: revisionById.get(record.eventId) ?? null,
          providerRunId: event?.providerRunId ?? null,
          worktreeSha256: sha256(event?.payload.worktreeSha256),
        };
      });
      const latestEvidenceByKind = new Map<string, WorkListEvidence>();
      for (const record of evidence) latestEvidenceByKind.set(record.kind, record);
      const doneVerified =
        item.requiredEvidenceKinds.length > 0 &&
        item.requiredEvidenceKinds.every((kind) => {
          const record = latestEvidenceByKind.get(kind);
          return record?.status === "checked" && record.result === "passed";
        });
      const failedEvidence = evidence.filter((record) => record.result === "failed").at(-1);
      const hasEvidenceFailure = failedEvidence !== undefined;
      const resurfaceDue = item.resurface?.due === true;
      const needsManager = Boolean(attention) || hasEvidenceFailure || resurfaceDue;
      const waitingAt = resurfaceDue
        ? (item.resurface?.at ?? null)
        : (attention?.updatedAt ?? failedEvidence?.occurredAt ?? null);

      return {
        workItemId: item.workItemId,
        outcome: item.outcome,
        state: item.state,
        group: groupFor(item.state, needsManager, doneVerified),
        attentionReason:
          attention?.reason ??
          (hasEvidenceFailure ? "verification_failed" : resurfaceDue ? "resurface_due" : null),
        doneVerified,
        hasEvidenceFailure,
        condition: item.condition
          ? {
              reasonCode: item.condition.reasonCode,
              summary: item.condition.summary,
              waitingOn: item.condition.waitingOn,
              requestedAction: item.condition.requestedAction ?? null,
              source: item.condition.source,
              trust: item.condition.trust,
              sourceRevision: revisionById.get(item.condition.eventId) ?? null,
            }
          : null,
        contract: item.contract ?? null,
        contractRevision: item.contractRevision ?? null,
        contractHistory: item.contractHistory ?? [],
        turnBudget: item.turnBudget ?? null,
        resurface: item.resurface
          ? {
              ...item.resurface,
              sourceRevision: revisionById.get(item.resurface.eventId) ?? null,
            }
          : null,
        nudgeSuppression: item.nudgeSuppression
          ? {
              ...item.nudgeSuppression,
              sourceRevision: revisionById.get(item.nudgeSuppression.eventId) ?? null,
            }
          : null,
        nudgeSuppressed:
          item.nudgeSuppression !== undefined &&
          Number.isFinite(currentTimeMs) &&
          currentTimeMs < Date.parse(item.nudgeSuppression.until),
        nudges: (item.nudges ?? []).map((nudge) => ({
          ...nudge,
          sourceRevision: revisionById.get(nudge.eventId) ?? null,
        })),
        currentRulingId: item.currentRulingId ?? null,
        rulings: Object.values(snapshot.work.rulings ?? {})
          .filter((ruling) => ruling.workItemId === item.workItemId)
          .map((ruling) => ({
            rulingId: ruling.rulingId,
            decision: ruling.decision,
            recordedAt: ruling.recordedAt,
            withdrawn: ruling.withdrawn,
            eventId: ruling.eventId,
            sourceRevision: revisionById.get(ruling.eventId) ?? null,
            ...(ruling.reason === undefined ? {} : { reason: ruling.reason }),
            ...(ruling.note === undefined ? {} : { note: ruling.note }),
            ...(ruling.resurfaceAt === undefined ? {} : { resurfaceAt: ruling.resurfaceAt }),
          })),
        waitingMs:
          waitingAt && Number.isFinite(currentTimeMs)
            ? Math.max(0, currentTimeMs - Date.parse(waitingAt))
            : null,
        assignee: assignment ? `${humanLabel(assignment.roleId)} · ${assignment.agentId}` : null,
        roleAssignmentId: item.assignment?.roleAssignmentId ?? null,
        assignmentSourceRevision: item.assignment
          ? (revisionById.get(item.assignment.eventId) ?? null)
          : null,
        assignmentSource: assignmentEvent?.source ?? null,
        assignmentTrust: assignmentEvent?.trust ?? null,
        partial,
        contractAcceptsEvidence: Boolean(item.contract && EVIDENCE_STATES.has(item.state)),
        evidenceObligations:
          item.contract?.evidenceObligations ??
          item.requiredEvidenceKinds.map((kind) => ({ kind, description: "Required evidence" })),
        evidence,
        speechActs: item.speechActs ?? [],
        postures,
        sourceRevision: revisionById.get(item.updatedByEventId) ?? null,
        lastSignalRevision: latestSignal ? (revisionById.get(latestSignal.eventId) ?? null) : null,
        lastEvent: latestSignal?.occurredAt ?? item.updatedAt ?? null,
      };
    })
    .sort(compareWorkItems);

  const log = snapshot.eventIds.flatMap((eventId, index): WorkListLogEntry[] => {
    const event = eventById.get(eventId);
    if (!event) return [];
    return [
      {
        eventId,
        kind: event.kind,
        summary: eventSummary(event),
        source: event.source,
        trust: event.trust,
        occurredAt: event.occurredAt,
        workItemId: event.workItemId ?? text(event.payload.workItemId) ?? null,
        revision: index + 1,
        actor: event.actor ?? null,
      },
    ];
  });

  return {
    projectName: snapshot.project.name ?? "Project work",
    revision,
    items,
    assignments,
    log,
    health,
  };
}

function eventSummary(event: ProjectEvent): string {
  const payload = event.payload;
  if (event.kind === "work.created")
    return text(payload.outcome) ?? "Work created; outcome missing";
  if (event.kind === "work.transitioned") {
    const state = text(payload.toState) ?? "state missing";
    const condition = payload.condition;
    const reason =
      typeof condition === "object" && condition !== null && !Array.isArray(condition)
        ? text((condition as Record<string, unknown>).summary)
        : undefined;
    return reason ? `${state} · ${reason}` : state;
  }
  if (event.kind === "evidence.recorded") {
    return `${text(payload.kind) ?? "Evidence type missing"}: ${text(payload.result) ?? "result missing"}`;
  }
  if (event.kind === "approval.recorded") {
    return `Approval recorded · artifact ${text(payload.artifactId) ?? "missing"} · version ${typeof payload.artifactVersion === "number" ? payload.artifactVersion : "missing"}`;
  }
  if (event.kind === "work.assigned") {
    return `Assigned · ${text(payload.roleAssignmentId) ?? "role assignment missing"}`;
  }
  if (event.kind === "work.ruling_recorded") {
    const decision = text(payload.decision)?.replaceAll("_", " ") ?? "ruling missing";
    const reason = text(payload.reason);
    const resurfaceAt = text(payload.resurfaceAt);
    return [decision, reason, resurfaceAt ? `resurface at ${resurfaceAt}` : undefined]
      .filter(Boolean)
      .join(" · ");
  }
  if (event.kind === "ruling.withdrawn") return "Ruling withdrawn · prior work state restored";
  if (event.kind === "work.turns_granted") {
    const count = typeof payload.turnsGranted === "number" ? payload.turnsGranted : "unknown";
    return `${count} more turns granted`;
  }
  if (event.kind === "work.rescoped") {
    const from =
      typeof payload.expectedContractRevision === "number"
        ? payload.expectedContractRevision
        : "missing";
    const to = typeof payload.contractRevision === "number" ? payload.contractRevision : "missing";
    return `Agreement revision ${String(from)} → ${String(to)} recorded`;
  }
  if (event.kind === "work.question_asked") {
    return `Question asked · ${text(payload.question) ?? "question missing"}`;
  }
  if (event.kind === "work.rescope_proposed") {
    const contract = payload.contract;
    const outcome =
      typeof contract === "object" && contract !== null && !Array.isArray(contract)
        ? text((contract as Record<string, unknown>).outcome)
        : undefined;
    return `Agreement change proposed · ${outcome ?? "proposed outcome missing"}`;
  }
  if (event.kind === "work.rescope_declined") {
    return `Agreement change declined · ${text(payload.reason) ?? "reason missing"}`;
  }
  if (event.kind === "work.send_back_disputed") {
    return `Send-back disputed · ${text(payload.statement) ?? "statement missing"}`;
  }
  if (event.kind === "work.closed_incomplete") {
    return `Closed incomplete · ${text(payload.reason) ?? "reason missing"}`;
  }
  if (event.kind === "work.nudged") return "Nudge recorded · visible on next check-in";
  if (event.kind === "work.nudge_suppressed") {
    return text(payload.disposition) === "snooze"
      ? "Nudge suggestion snoozed · visible again after its recorded rest period"
      : "Nudge suggestion dismissed · visible again after its recorded rest period";
  }
  return event.kind.replaceAll(".", " ");
}

function evidenceStatus(event: ProjectEvent | undefined): WorkListEvidence["status"] {
  if (!event) return "claimed";
  if (event.trust === "verified") return "checked";
  if (event.trust === "inferred" || event.payload.kind === "done-claim") return "claimed";
  return "recorded";
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function groupFor(
  state: string,
  needsManager: boolean,
  doneVerified: boolean,
): WorkListItem["group"] {
  if (needsManager) return "your-move";
  if (state === "active") return "in-progress";
  if (state === "draft" || state === "ready" || state === "assigned" || state === "paused")
    return "queued";
  if (state === "verified" || state === "completed") return doneVerified ? "done" : "other";
  if (state === "blocked" || state === "waiting_input") return "in-progress";
  return "other";
}

const groupOrder: WorkListItem["group"][] = ["your-move", "in-progress", "queued", "done", "other"];

function compareWorkItems(left: WorkListItem, right: WorkListItem): number {
  const groupDifference = groupOrder.indexOf(left.group) - groupOrder.indexOf(right.group);
  if (groupDifference !== 0) return groupDifference;
  if (left.group === "your-move") {
    const waitDifference = (right.waitingMs ?? -1) - (left.waitingMs ?? -1);
    if (waitDifference !== 0) return waitDifference;
  } else if (left.group === "in-progress") {
    const signalDifference = (right.lastSignalRevision ?? -1) - (left.lastSignalRevision ?? -1);
    if (signalDifference !== 0) return signalDifference;
  } else if (left.group === "queued") {
    const queueDifference =
      (left.sourceRevision ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceRevision ?? Number.MAX_SAFE_INTEGER);
    if (queueDifference !== 0) return queueDifference;
  } else if (left.group === "done") {
    const verifiedDifference = (right.sourceRevision ?? -1) - (left.sourceRevision ?? -1);
    if (verifiedDifference !== 0) return verifiedDifference;
  }
  return left.workItemId.localeCompare(right.workItemId);
}

function sha256(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function describeIssue(issue: unknown): string {
  if (typeof issue === "object" && issue !== null && !Array.isArray(issue)) {
    const record = issue as Record<string, unknown>;
    const line = typeof record.line === "number" ? `line ${record.line}: ` : "";
    const message = text(record.message) ?? text(record.reason) ?? text(record.code);
    if (message) return `${line}${message}`;
  }
  if (typeof issue === "string") return issue;
  try {
    return JSON.stringify(issue);
  } catch {
    return "Unspecified log issue";
  }
}

function humanLabel(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
