/**
 * The office read model (Phase 7-O spec v0.2 §4, plan Task 4).
 *
 * One pure projection from a canonical snapshot to everything the office shows about a person or a
 * zone. The rail, the outline, the scene cue and the inspector all read this one model, so they
 * cannot disagree, and no surface can manufacture a more reassuring state from a literal.
 *
 * Two inputs are not canonical and are deliberately narrow:
 *
 * - The registry names entities and their layout: id, label, relationship, and for a person the
 *   agent id. A registry entry that also carries state is reported and the extra fields ignored.
 * - Auxiliary records may supply runtime binding and permissions only. A record that tries to supply
 *   state, a condition, a blocker, an approval, evidence, attention or a requested action is refused
 *   whole (fail closed), and the refusal is reported.
 */
import type { WorkCondition } from "@cuckcode/contracts";
import {
  projectManagerAttention,
  projectOfficeScene,
  type CanonicalProjectSnapshot,
  type ManagerAttentionItem,
  type SceneFreshness,
  type WorkAssignmentTruth,
  type WorkConditionTruth,
} from "@cuckcode/domain";

export type OfficeRegistryEntry =
  | Readonly<{
      entityId: string;
      kind: "person";
      label: string;
      agentId: string;
      relationship?: string;
    }>
  | Readonly<{ entityId: string; kind: "zone"; label: string }>;

export type OfficeAuxiliaryRecord = Readonly<Record<string, unknown>>;

export type OfficeReadModelInput = Readonly<{
  snapshot: CanonicalProjectSnapshot;
  now: string;
  registry: readonly OfficeRegistryEntry[];
  auxiliary?: readonly OfficeAuxiliaryRecord[];
  staleAfterMs?: number;
}>;

export type OfficeReadModelIssue = Readonly<{
  code:
    | "CAUSE_EVENT_MISSING"
    | "ATTENTION_UNJOINED"
    | "APPROVAL_EVIDENCE_UNRESOLVED"
    | "AUXILIARY_FACT_REFUSED"
    | "REGISTRY_FACT_REFUSED"
    | "REPLAY_ISSUE"
    | string;
  message: string;
  entityId?: string;
  workItemId?: string;
  eventId?: string;
}>;

export type OfficeAttentionView = Readonly<{
  workItemId: string;
  reason: ManagerAttentionItem["reason"];
  priority: number;
  causeEventId: string;
  updatedAt: string;
  condition: WorkConditionTruth | null;
  relatedEntityId: string | null;
}>;

export type OfficeEvidenceView = Readonly<{
  evidenceId: string;
  kind: string;
  version: number;
  result: "passed" | "failed";
  eventId: string;
}>;

export type OfficeApprovalView = Readonly<{
  status: "approved" | "not_approved" | "unresolved";
  approvalId: string | null;
  requiredEvidenceKinds: readonly string[];
  missingEvidenceKinds: readonly string[];
}>;

export type OfficeWorkView = Readonly<{
  workItemId: string;
  outcome: string;
  state: string;
  causeEventId: string | null;
  updatedAt: string;
  freshness: SceneFreshness;
  supported: boolean;
  motion: boolean;
  condition: WorkConditionTruth | null;
  assignment: WorkAssignmentTruth | null;
  evidence: readonly OfficeEvidenceView[];
  approval: OfficeApprovalView;
}>;

export type OfficeAgentView =
  | Readonly<{
      status: "recorded";
      agentId: string;
      presence: string;
      health: string;
      causeEventId: string | null;
      updatedAt: string | null;
      freshness: SceneFreshness;
      supported: boolean;
      motion: boolean;
      zone: string | null;
    }>
  | Readonly<{ status: "unresolved"; reason: "agent_not_recorded"; agentId: string }>;

export type OfficeRuntimeView =
  | Readonly<{
      status: "recorded";
      source: string;
      version: number;
      fixture: boolean;
      binding: unknown;
      permissions: readonly string[];
    }>
  | Readonly<{ status: "unavailable"; reason: "not_recorded" }>;

export type OfficePersonView = Readonly<{
  entityId: string;
  kind: "person";
  label: string;
  relationship: string | null;
  agent: OfficeAgentView;
  workRelation: "resolved" | "none_assigned";
  work: readonly OfficeWorkView[];
  attention: readonly OfficeAttentionView[];
  runtime: OfficeRuntimeView;
}>;

export type OfficeZoneView = Readonly<{
  entityId: string;
  kind: "zone";
  label: string;
  status: "layout_only";
}>;

/**
 * A handoff the log records, joined to office people (Phase 7-O Task 9). `revision` is the position
 * of the recording event in the log: the workspace revision at which the handoff became true.
 */
export type OfficeHandoffView = Readonly<{
  handoffId: string;
  fromEntityId: string;
  toEntityId: string;
  workItemId: string;
  causeEventId: string;
  revision: number;
}>;

export type OfficeReadModel = Readonly<{
  schemaVersion: 1;
  projectId: string | null;
  source: Readonly<{ eventCount: number; lastEventId: string | null }>;
  observedAt: string;
  current: boolean;
  issues: readonly OfficeReadModelIssue[];
  entities: ReadonlyArray<OfficePersonView | OfficeZoneView>;
  attention: readonly OfficeAttentionView[];
  handoffs: readonly OfficeHandoffView[];
  /** Work no office person holds (Phase 7-O Task 9d, F-9-1), so the office can show it. */
  unassignedWork: readonly OfficeWorkView[];
}>;

const REGISTRY_KEYS = {
  person: ["entityId", "kind", "label", "agentId", "relationship"],
  zone: ["entityId", "kind", "label"],
} as const;
const AUXILIARY_KEYS = [
  "entityId",
  "source",
  "version",
  "fixture",
  "runtimeBinding",
  "permissions",
];

export function projectOfficeReadModel(input: OfficeReadModelInput): OfficeReadModel {
  const { snapshot, now, registry } = input;
  const issues: OfficeReadModelIssue[] = [];
  const known = new Set(snapshot.eventIds);
  const scene = projectOfficeScene(snapshot, now, input.staleAfterMs);

  for (const replay of snapshot.replayIssues) {
    issues.push({
      code: "REPLAY_ISSUE",
      message: `${replay.code}: ${"message" in replay ? String(replay.message) : ""}`,
    });
  }
  for (const workIssue of snapshot.work.issues) {
    issues.push({
      code: workIssue.code,
      message: workIssue.message,
      eventId: workIssue.eventId,
      ...(workIssue.workItemId ? { workItemId: workIssue.workItemId } : {}),
    });
  }
  for (const staffingIssue of snapshot.staffing.issues) {
    issues.push({
      code: staffingIssue.code,
      message: staffingIssue.message,
      eventId: staffingIssue.eventId,
    });
  }

  // Registry: layout only.
  for (const entry of registry) {
    const allowed: readonly string[] = REGISTRY_KEYS[entry.kind] ?? [];
    const extra = Object.keys(entry).filter((key) => !allowed.includes(key));
    if (extra.length > 0) {
      issues.push({
        code: "REGISTRY_FACT_REFUSED",
        entityId: entry.entityId,
        message: `registry entries carry layout only; ignored ${extra.sort().join(", ")}`,
      });
    }
  }

  // Auxiliary: runtime binding and permissions only, or nothing.
  const runtimeByEntity = new Map<string, OfficeRuntimeView>();
  for (const record of input.auxiliary ?? []) {
    const entityId = typeof record.entityId === "string" ? record.entityId : "";
    const extra = Object.keys(record).filter((key) => !AUXILIARY_KEYS.includes(key));
    const permissions = record.permissions ?? [];
    if (
      extra.length > 0 ||
      !entityId ||
      typeof record.source !== "string" ||
      typeof record.version !== "number" ||
      !Array.isArray(permissions) ||
      !permissions.every((permission) => typeof permission === "string")
    ) {
      issues.push({
        code: "AUXILIARY_FACT_REFUSED",
        ...(entityId ? { entityId } : {}),
        message:
          extra.length > 0
            ? `auxiliary records may not supply ${extra.sort().join(", ")}; the record was refused`
            : "auxiliary record is malformed; the record was refused",
      });
      continue;
    }
    runtimeByEntity.set(entityId, {
      status: "recorded",
      source: record.source,
      version: record.version,
      fixture: record.fixture === true,
      binding: record.runtimeBinding ?? null,
      permissions: [...(permissions as string[])],
    });
  }

  // Joins: role assignment → agent → registry person.
  const personByAgent = new Map<string, string>();
  for (const entry of registry)
    if (entry.kind === "person") personByAgent.set(entry.agentId, entry.entityId);
  const agentByRoleAssignment = new Map(
    Object.values(snapshot.staffing.assignments).map((assignment) => [
      assignment.roleAssignmentId,
      assignment.agentId,
    ]),
  );
  const personForWork = (workItemId: string): string | null => {
    const held = snapshot.work.workItems[workItemId]?.assignment?.roleAssignmentId;
    const agentId = held ? agentByRoleAssignment.get(held) : undefined;
    return agentId ? (personByAgent.get(agentId) ?? null) : null;
  };

  const attention: OfficeAttentionView[] = projectManagerAttention(snapshot).map((item) => ({
    workItemId: item.subjectId,
    reason: item.reason,
    priority: item.priority,
    causeEventId: item.causeEventId,
    updatedAt: item.updatedAt,
    condition: item.condition,
    relatedEntityId: personForWork(item.subjectId),
  }));
  for (const item of attention) {
    if (item.relatedEntityId === null) {
      issues.push({
        code: "ATTENTION_UNJOINED",
        workItemId: item.workItemId,
        message: "no recorded role assignment joins this attention item to a person",
      });
    }
  }

  const workViews = new Map<string, OfficeWorkView>();
  for (const item of Object.values(snapshot.work.workItems)) {
    const descriptor = scene.find(
      (entry) => entry.subjectType === "work" && entry.subjectId === item.workItemId,
    );
    const supported = known.has(item.updatedByEventId);
    if (!supported) {
      issues.push({
        code: "CAUSE_EVENT_MISSING",
        workItemId: item.workItemId,
        eventId: item.updatedByEventId,
        message: "the event said to cause this state is not in the log",
      });
    }
    const evidence = Object.values(snapshot.work.evidence)
      .filter((record) => record.workItemId === item.workItemId)
      .map(({ evidenceId, kind, version, result, eventId }) => ({
        evidenceId,
        kind,
        version,
        result,
        eventId,
      }))
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    workViews.set(item.workItemId, {
      workItemId: item.workItemId,
      outcome: item.outcome,
      state: item.state,
      causeEventId: supported ? item.updatedByEventId : null,
      updatedAt: item.updatedAt,
      freshness: descriptor?.freshness ?? "unavailable",
      supported,
      motion: supported && (descriptor?.semanticMotion ?? false),
      condition: item.condition,
      assignment: item.assignment,
      evidence,
      approval: approvalFor(snapshot, item.workItemId, item.requiredEvidenceKinds, issues),
    });
  }

  const entities = registry.map((entry): OfficePersonView | OfficeZoneView => {
    if (entry.kind === "zone") {
      return { entityId: entry.entityId, kind: "zone", label: entry.label, status: "layout_only" };
    }
    const agent = snapshot.staffing.agents[entry.agentId];
    let agentView: OfficeAgentView;
    if (!agent) {
      agentView = { status: "unresolved", reason: "agent_not_recorded", agentId: entry.agentId };
    } else {
      const descriptor = scene.find(
        (candidate) => candidate.subjectType === "agent" && candidate.subjectId === entry.agentId,
      );
      const supported = known.has(agent.updatedByEventId);
      if (!supported) {
        issues.push({
          code: "CAUSE_EVENT_MISSING",
          entityId: entry.entityId,
          eventId: agent.updatedByEventId,
          message: "the event said to set this presence is not in the log",
        });
      }
      agentView = {
        status: "recorded",
        agentId: agent.agentId,
        presence: agent.presence,
        health: agent.health,
        causeEventId: supported ? agent.updatedByEventId : null,
        updatedAt: agent.updatedAt,
        freshness: descriptor?.freshness ?? "unavailable",
        supported,
        motion: supported && (descriptor?.semanticMotion ?? false),
        zone: supported ? (descriptor?.zone ?? null) : null,
      };
    }
    const work = [...workViews.values()]
      .filter((view) => personForWork(view.workItemId) === entry.entityId)
      .sort((left, right) => left.workItemId.localeCompare(right.workItemId));
    return {
      entityId: entry.entityId,
      kind: "person",
      label: entry.label,
      relationship: entry.relationship ?? null,
      agent: agentView,
      workRelation: work.length > 0 ? "resolved" : "none_assigned",
      work,
      attention: attention.filter((item) => item.relatedEntityId === entry.entityId),
      runtime: runtimeByEntity.get(entry.entityId) ?? {
        status: "unavailable",
        reason: "not_recorded",
      },
    };
  });

  // Before `current` is decided: an unjoined handoff is an unresolved record.
  const handoffs = handoffsFrom(snapshot, entities, issues);
  return {
    schemaVersion: 1,
    projectId: snapshot.project.projectId,
    source: {
      eventCount: snapshot.eventIds.length,
      lastEventId: snapshot.eventIds.at(-1) ?? null,
    },
    observedAt: now,
    handoffs,
    unassignedWork: [...workViews.values()]
      .filter((view) => personForWork(view.workItemId) === null)
      .sort((left, right) => left.workItemId.localeCompare(right.workItemId)),
    // Any unresolved record, not only a replay issue, means the office cannot claim to be current
    // (owner ruling on Task 6, 2026-09-26). REPLAY_ISSUE is among these issues.
    current: snapshot.replayIssues.length === 0 && issues.length === 0,
    issues,
    entities,
    attention,
  };
}

function approvalFor(
  snapshot: CanonicalProjectSnapshot,
  workItemId: string,
  requiredEvidenceKinds: readonly string[],
  issues: OfficeReadModelIssue[],
): OfficeApprovalView {
  const passedKinds = new Set(
    Object.values(snapshot.work.evidence)
      .filter((record) => record.workItemId === workItemId && record.result === "passed")
      .map((record) => record.kind),
  );
  const missingEvidenceKinds = requiredEvidenceKinds.filter((kind) => !passedKinds.has(kind));
  const approval = Object.values(snapshot.work.approvals).find(
    (candidate) => candidate.workItemId === workItemId,
  );
  if (!approval) {
    return {
      status: "not_approved",
      approvalId: null,
      requiredEvidenceKinds,
      missingEvidenceKinds,
    };
  }
  const unresolved = approval.evidenceVersions.filter(
    ({ evidenceId, version }) => snapshot.work.evidence[evidenceId]?.version !== version,
  );
  if (unresolved.length > 0) {
    issues.push({
      code: "APPROVAL_EVIDENCE_UNRESOLVED",
      workItemId,
      eventId: approval.eventId,
      message: `approval cites evidence not recorded at that version: ${unresolved
        .map(({ evidenceId, version }) => `${evidenceId}@${version}`)
        .join(", ")}`,
    });
    return {
      status: "unresolved",
      approvalId: approval.approvalId,
      requiredEvidenceKinds,
      missingEvidenceKinds,
    };
  }
  return {
    status: "approved",
    approvalId: approval.approvalId,
    requiredEvidenceKinds,
    missingEvidenceKinds,
  };
}

/** The condition as the contract defines it, re-exported for surfaces that render it. */
export type { WorkCondition };

/**
 * Recorded handoffs whose two agents are office people. A handoff naming anyone else is reported
 * as `HANDOFF_UNJOINED` and gets no view, so the office shows no cue it cannot attribute.
 */
function handoffsFrom(
  snapshot: CanonicalProjectSnapshot,
  entities: ReadonlyArray<OfficePersonView | OfficeZoneView>,
  issues: OfficeReadModelIssue[],
): OfficeHandoffView[] {
  const entityOfAgent = new Map<string, string>();
  for (const entity of entities) {
    if (entity.kind === "person") entityOfAgent.set(entity.agent.agentId, entity.entityId);
  }
  const views: OfficeHandoffView[] = [];
  for (const collaboration of Object.values(snapshot.collaborations)) {
    const handoff = collaboration.kind === "handoff" ? collaboration.handoff : undefined;
    if (!handoff) continue;
    const fromEntityId = entityOfAgent.get(handoff.fromAgentId);
    const toEntityId = entityOfAgent.get(handoff.toAgentId);
    if (!fromEntityId || !toEntityId) {
      issues.push({
        code: "HANDOFF_UNJOINED",
        eventId: collaboration.updatedByEventId,
        workItemId: handoff.workItemId,
        message: `handoff ${collaboration.collaborationId} names an agent the office does not show`,
      });
      continue;
    }
    views.push({
      handoffId: collaboration.collaborationId,
      fromEntityId,
      toEntityId,
      workItemId: handoff.workItemId,
      causeEventId: collaboration.updatedByEventId,
      revision: snapshot.eventIds.indexOf(collaboration.updatedByEventId) + 1,
    });
  }
  return views.sort((left, right) => left.revision - right.revision);
}
