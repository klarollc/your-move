import {
  evaluateQualification,
  parseProjectEvent,
  type ProjectEvent,
  type QualificationCheck,
} from "@cuckcode/contracts";

export type AgentPresence =
  "unavailable" | "idle" | "reserved" | "active" | "waiting" | "blocked" | "reviewing" | "failed";

export type StaffingTruth = {
  agents: Record<
    string,
    {
      agentId: string;
      capabilities: string[];
      health: "connected" | "disconnected" | "stale";
      presence: AgentPresence;
      /** The event that last set presence or health, and when it occurred (Phase 7-O spec §3.3). */
      updatedByEventId: string;
      updatedAt: string;
    }
  >;
  assignments: Record<
    string,
    { roleAssignmentId: string; roleId: string; agentId: string; active: true }
  >;
  qualifications: Record<
    string,
    {
      qualificationId: string;
      agentId: string;
      roleId: string;
      qualified: boolean;
      blockingCheckIds: string[];
      exceptedCheckIds: string[];
    }
  >;
  issues: { code: string; eventId: string; agentId?: string; message: string }[];
};

export function reduceStaffingTruth(input: readonly unknown[]): StaffingTruth {
  const state = createStaffingTruth();
  for (const candidate of input) {
    const parsed = parseProjectEvent(candidate);
    if (parsed.ok) applyStaffingEvent(state, parsed.value);
  }
  return state;
}

export function createStaffingTruth(): StaffingTruth {
  return { agents: {}, assignments: {}, qualifications: {}, issues: [] };
}

/**
 * Applies one parsed event to staffing truth in place. Exported so a reducer that depends on
 * staffing at a point in the log (work assignment, Phase 7-O) reads this definition rather than a
 * copy of it.
 */
export function applyStaffingEvent(state: StaffingTruth, event: ProjectEvent): void {
  if (event.kind === "agent.registered") registerAgent(state, event);
  if (event.kind === "role.assigned") assignRole(state, event);
  if (event.kind === "role.released") releaseRole(state, event);
  if (event.kind === "qualification.recorded") recordQualification(state, event);
  if (event.kind === "agent.presence_changed") changePresence(state, event);
}

function registerAgent(state: StaffingTruth, event: ProjectEvent): void {
  const agentId = text(event.payload.agentId);
  const capabilities = textArray(event.payload.capabilities);
  const health = event.payload.health;
  if (!agentId || !capabilities || health !== "connected") return;
  state.agents[agentId] = {
    agentId,
    capabilities: [...capabilities].sort(),
    health,
    presence: "idle",
    updatedByEventId: event.eventId,
    updatedAt: event.occurredAt,
  };
}

function assignRole(state: StaffingTruth, event: ProjectEvent): void {
  const roleAssignmentId = text(event.payload.roleAssignmentId);
  const roleId = text(event.payload.roleId);
  const agentId = text(event.payload.agentId);
  const required = textArray(event.payload.requiredCapabilities);
  const agent = agentId ? state.agents[agentId] : undefined;
  if (!roleAssignmentId || !roleId || !agentId || !required || !agent) return;
  if (Object.values(state.assignments).some((assignment) => assignment.agentId === agentId)) {
    addIssue(state, "AGENT_ALREADY_ASSIGNED", event, "agent already holds an active role", agentId);
    return;
  }
  const missing = required.filter((capability) => !agent.capabilities.includes(capability));
  if (missing.length > 0) {
    addIssue(
      state,
      "CAPABILITY_REQUIRED",
      event,
      `missing capabilities: ${missing.sort().join(", ")}`,
      agentId,
    );
    return;
  }
  if (agent.health !== "connected") {
    addIssue(state, "AGENT_UNAVAILABLE", event, "agent health does not permit assignment", agentId);
    return;
  }
  state.assignments[roleAssignmentId] = { roleAssignmentId, roleId, agentId, active: true };
  agent.presence = "reserved";
  touch(agent, event);
}

function releaseRole(state: StaffingTruth, event: ProjectEvent): void {
  const roleAssignmentId = text(event.payload.roleAssignmentId);
  if (!roleAssignmentId) return;
  const assignment = state.assignments[roleAssignmentId];
  if (!assignment) return;
  delete state.assignments[roleAssignmentId];
  const agent = state.agents[assignment.agentId];
  if (agent && agent.health === "connected") {
    agent.presence = "idle";
    touch(agent, event);
  }
}

function recordQualification(state: StaffingTruth, event: ProjectEvent): void {
  const qualificationId = text(event.payload.qualificationId);
  const agentId = text(event.payload.agentId);
  const roleId = text(event.payload.roleId);
  const checks = qualificationChecks(event.payload.checks);
  const exceptions = textArray(event.payload.exceptions);
  const agent = agentId ? state.agents[agentId] : undefined;
  if (!qualificationId || !agentId || !roleId || !checks || !exceptions || !agent) return;
  const result = evaluateQualification({ checks, exceptions });
  state.qualifications[qualificationId] = {
    qualificationId,
    agentId,
    roleId,
    qualified: result.qualified && agent.health === "connected",
    blockingCheckIds: result.blockingCheckIds,
    exceptedCheckIds: result.exceptedCheckIds,
  };
}

function changePresence(state: StaffingTruth, event: ProjectEvent): void {
  const agentId = text(event.payload.agentId);
  const requested = text(event.payload.presence) as AgentPresence | undefined;
  const health = event.payload.health;
  const agent = agentId ? state.agents[agentId] : undefined;
  if (
    !agentId ||
    !requested ||
    !agent ||
    (health !== "connected" && health !== "disconnected" && health !== "stale")
  )
    return;
  agent.health = health;
  touch(agent, event);
  if (health !== "connected" && requested === "active") {
    agent.presence = "unavailable";
    for (const qualification of Object.values(state.qualifications)) {
      if (qualification.agentId === agentId) qualification.qualified = false;
    }
    addIssue(
      state,
      "UNTRUTHFUL_AGENT_PRESENCE",
      event,
      `${health} agent cannot be active`,
      agentId,
    );
    return;
  }
  agent.presence = health === "connected" ? requested : "unavailable";
}

function qualificationChecks(value: unknown): QualificationCheck[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const checks: QualificationCheck[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const record = item as Record<string, unknown>;
    const checkId = text(record.checkId);
    const category = text(record.category);
    if (
      !checkId ||
      !category ||
      typeof record.mandatory !== "boolean" ||
      typeof record.passed !== "boolean"
    )
      return undefined;
    checks.push({ checkId, category, mandatory: record.mandatory, passed: record.passed });
  }
  return checks;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function textArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}
function addIssue(
  state: StaffingTruth,
  code: string,
  event: ProjectEvent,
  message: string,
  agentId?: string,
): void {
  state.issues.push({ code, eventId: event.eventId, ...(agentId ? { agentId } : {}), message });
}

function touch(agent: { updatedByEventId: string; updatedAt: string }, event: ProjectEvent): void {
  agent.updatedByEventId = event.eventId;
  agent.updatedAt = event.occurredAt;
}
