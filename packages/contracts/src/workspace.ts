export type WorkspaceIssueCode =
  | "WORKSPACE_READ_MODEL_INVALID"
  | "WORKSPACE_COMMAND_INVALID"
  | "WORKSPACE_COMMAND_STALE"
  | "WORKSPACE_PROJECT_MISMATCH"
  | "WORKSPACE_COMMAND_SECRET"
  | "WORKSPACE_AUTHORITY_INVALID";

type Validation<T> = { ok: true; value: T } | { ok: false; code: WorkspaceIssueCode };

type WorkspaceEntity = {
  entityId: string;
  entityType: "agent" | "work" | "collaboration" | "zone" | "artifact";
  label: string;
  state: string;
  zone: string;
  behavior: string;
  causeEventId: string;
  updatedAt: string;
  freshness: "current" | "delayed" | "unavailable";
  domTwinId: string;
  canvasTwinId: string;
  actionable: {
    summary: string;
    requiredAction: string;
    requiredAuthority: string;
    evidenceIds: string[];
  };
};

export type WorkspaceReadModel = {
  schemaVersion: 1;
  revision: number;
  projectId: string;
  generatedAt: string;
  projectBar: { projectName: string; outcome: string; runtimeHealth: string };
  entities: WorkspaceEntity[];
  attention: Array<{
    attentionId: string;
    entityId: string;
    reason: string;
    priority: number;
    causeEventId: string;
  }>;
};

export type WorkspaceCommand = {
  schemaVersion: 1;
  commandId: string;
  projectId: string;
  expectedRevision: number;
  actor: { actorType: "manager" | "agent"; actorId: string };
  intent: string;
  targetEntityId: string;
  payload: Record<string, unknown>;
};

export function validateWorkspaceReadModel(input: unknown): Validation<WorkspaceReadModel> {
  if (!isRecord(input) || input.schemaVersion !== 1) return invalid("WORKSPACE_READ_MODEL_INVALID");
  if (
    !nonEmpty(input.projectId) ||
    !nonEmpty(input.generatedAt) ||
    !Number.isInteger(input.revision) ||
    Number(input.revision) < 0 ||
    !isRecord(input.projectBar) ||
    !nonEmpty(input.projectBar.projectName) ||
    !nonEmpty(input.projectBar.outcome) ||
    !nonEmpty(input.projectBar.runtimeHealth) ||
    !Array.isArray(input.entities) ||
    !Array.isArray(input.attention)
  ) {
    return invalid("WORKSPACE_READ_MODEL_INVALID");
  }
  const entities = input.entities;
  if (!entities.every(validEntity)) return invalid("WORKSPACE_READ_MODEL_INVALID");
  const entityIds = new Set(entities.map((entity) => entity.entityId));
  if (entityIds.size !== entities.length) return invalid("WORKSPACE_READ_MODEL_INVALID");
  if (!input.attention.every((item) => validAttention(item, entityIds))) {
    return invalid("WORKSPACE_READ_MODEL_INVALID");
  }
  return { ok: true, value: input as WorkspaceReadModel };
}

export function validateWorkspaceCommand(
  input: unknown,
  current: { projectId: string; revision: number },
): Validation<WorkspaceCommand> {
  if (!isRecord(input)) return invalid("WORKSPACE_COMMAND_INVALID");
  if (containsSecret(input)) return invalid("WORKSPACE_COMMAND_SECRET");
  if (input.projectId !== current.projectId) return invalid("WORKSPACE_PROJECT_MISMATCH");
  if (input.expectedRevision !== current.revision) return invalid("WORKSPACE_COMMAND_STALE");
  if (
    isRecord(input.actor) &&
    input.actor.actorType !== "manager" &&
    input.actor.actorType !== "agent"
  ) {
    return invalid("WORKSPACE_AUTHORITY_INVALID");
  }
  if (
    input.schemaVersion !== 1 ||
    !nonEmpty(input.commandId) ||
    !nonEmpty(input.projectId) ||
    !isRecord(input.actor) ||
    !["manager", "agent"].includes(String(input.actor.actorType)) ||
    !nonEmpty(input.actor.actorId) ||
    !nonEmpty(input.intent) ||
    !nonEmpty(input.targetEntityId) ||
    !isRecord(input.payload)
  ) {
    return invalid("WORKSPACE_COMMAND_INVALID");
  }
  if (
    (input.actor.actorType === "agent" && !agentSpeechIntents.has(String(input.intent))) ||
    (input.actor.actorType === "manager" && agentSpeechIntents.has(String(input.intent))) ||
    (input.actor.actorType !== "manager" && managerOnlyIntents.has(String(input.intent)))
  ) {
    return invalid("WORKSPACE_AUTHORITY_INVALID");
  }
  return { ok: true, value: input as WorkspaceCommand };
}

const managerOnlyIntents = new Set([
  "approve",
  "decline",
  "defer",
  "cancel",
  "redirect",
  "work.create",
  "work.assign",
  "work.record_evidence",
  "work.request_review",
  "work.record_ruling",
  "work.grant_turns",
  "work.rescope",
  "work.decline_rescope",
  "work.close_incomplete",
  "work.nudge",
  "work.suppress_nudge",
  "work.withdraw_ruling",
]);
const agentSpeechIntents = new Set([
  "work.ask_question",
  "work.propose_rescope",
  "work.dispute_send_back",
]);
const secretKey = /api[_-]?key|authorization|credential|password|secret|token/iu;
const secretValue = /\bsk-[a-z0-9_-]+\b/iu;

function validEntity(value: unknown): value is WorkspaceEntity {
  if (!isRecord(value) || !isRecord(value.actionable)) return false;
  return (
    nonEmpty(value.entityId) &&
    ["agent", "work", "collaboration", "zone", "artifact"].includes(String(value.entityType)) &&
    nonEmpty(value.label) &&
    nonEmpty(value.state) &&
    nonEmpty(value.zone) &&
    nonEmpty(value.behavior) &&
    nonEmpty(value.causeEventId) &&
    nonEmpty(value.updatedAt) &&
    ["current", "delayed", "unavailable"].includes(String(value.freshness)) &&
    nonEmpty(value.domTwinId) &&
    nonEmpty(value.canvasTwinId) &&
    nonEmpty(value.actionable.summary) &&
    nonEmpty(value.actionable.requiredAction) &&
    nonEmpty(value.actionable.requiredAuthority) &&
    Array.isArray(value.actionable.evidenceIds) &&
    value.actionable.evidenceIds.every(nonEmpty)
  );
}

function validAttention(value: unknown, entityIds: Set<string>): boolean {
  return (
    isRecord(value) &&
    nonEmpty(value.attentionId) &&
    nonEmpty(value.entityId) &&
    entityIds.has(value.entityId) &&
    nonEmpty(value.reason) &&
    Number.isInteger(value.priority) &&
    nonEmpty(value.causeEventId)
  );
}

function containsSecret(value: unknown): boolean {
  if (typeof value === "string") return secretValue.test(value);
  if (Array.isArray(value)) return value.some(containsSecret);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => secretKey.test(key) || containsSecret(child));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(code: WorkspaceIssueCode): { ok: false; code: WorkspaceIssueCode } {
  return { ok: false, code };
}
