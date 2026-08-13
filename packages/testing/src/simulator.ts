import type { EventKind, ProjectEvent } from "@cuckcode/contracts";

export const simulatorScenarioNames = [
  "normal-completion",
  "manager-question-response",
  "permission-denial",
  "dependency-wait",
  "test-failure-revision",
  "agent-disconnect",
  "agent-disconnect-recovery",
  "stale-out-of-order",
  "cancellation",
  "reviewer-disagreement",
] as const;
export type SimulatorScenarioName = (typeof simulatorScenarioNames)[number];
export type SimulatorSeed = {
  projectId: string;
  baseTime: string;
  eventIdPrefix: string;
};
export type SimulatorScenario = { name: SimulatorScenarioName; events: ProjectEvent[] };

const defaultSeed: SimulatorSeed = {
  projectId: "project_fixture",
  baseTime: "2026-08-14T00:00:00.000Z",
  eventIdPrefix: "event_sim",
};

export function createSimulatorScenario(
  name: SimulatorScenarioName,
  seed: SimulatorSeed = defaultSeed,
): SimulatorScenario {
  const emit = emitter(seed);
  const events = scenarioEvents(name, emit);
  return { name, events };
}

type Emit = (
  kind: EventKind,
  payload: Record<string, unknown>,
  source?: ProjectEvent["source"],
) => ProjectEvent;

function emitter(seed: SimulatorSeed): Emit {
  let sequence = 0;
  return (kind, payload, source = "system") => {
    sequence += 1;
    const occurredAt = new Date(Date.parse(seed.baseTime) + sequence * 1_000).toISOString();
    return {
      schemaVersion: 1,
      eventId: `${seed.eventIdPrefix}_${String(sequence).padStart(3, "0")}`,
      projectId: seed.projectId,
      ...(kind.startsWith("work.") || kind === "evidence.recorded"
        ? { workItemId: "work_fixture" }
        : {}),
      kind,
      occurredAt,
      receivedAt: occurredAt,
      source,
      trust: "verified",
      payload,
    };
  };
}

function scenarioEvents(name: SimulatorScenarioName, emit: Emit): ProjectEvent[] {
  if (name === "agent-disconnect" || name === "agent-disconnect-recovery") {
    const events = [
      emit("agent.registered", {
        agentId: "agent_fixture",
        capabilities: ["typescript", "testing"],
        health: "connected",
      }),
      emit("agent.presence_changed", {
        agentId: "agent_fixture",
        presence: "active",
        health: "disconnected",
      }),
    ];
    if (name === "agent-disconnect-recovery") {
      events.push(
        emit("agent.presence_changed", {
          agentId: "agent_fixture",
          presence: "idle",
          health: "connected",
        }),
      );
    }
    return events;
  }
  if (name === "reviewer-disagreement") {
    return [
      emit("collaboration.recorded", {
        collaborationId: "collaboration_review",
        participantIds: ["agent_visual", "agent_release"],
        topic: "conflicting reviewer conclusions",
      }),
      emit(
        "manager.feedback_recorded",
        {
          collaborationId: "collaboration_review",
          disposition: "unresolved",
          findings: ["visual_pass", "release_needs_work"],
        },
        "reviewer",
      ),
    ];
  }

  const events = baseWork(emit);
  if (name === "cancellation") {
    events.push(emit("work.transitioned", transition(0, "cancelled")));
    return events;
  }
  events.push(
    emit("work.transitioned", transition(0, "ready")),
    emit("work.transitioned", transition(1, "assigned")),
    emit("work.transitioned", transition(2, "active")),
  );
  if (name === "normal-completion") {
    events.push(
      emit("work.transitioned", transition(3, "review_requested")),
      emit("evidence.recorded", {
        evidenceId: "evidence_unit",
        workItemId: "work_fixture",
        kind: "unit",
        version: 1,
        result: "passed",
      }),
      emit("work.transitioned", transition(4, "verified")),
      emit("work.transitioned", transition(5, "completed")),
    );
  }
  if (name === "manager-question-response") {
    events.push(
      emit("work.transitioned", transition(3, "waiting_input")),
      emit(
        "manager.feedback_recorded",
        { workItemId: "work_fixture", response: "Browser evidence is required." },
        "manager",
      ),
      emit("work.transitioned", transition(4, "active")),
    );
  }
  if (name === "permission-denial") {
    events.push(
      emit("work.transitioned", transition(3, "blocked", { blocker: "permission denied" })),
    );
  }
  if (name === "dependency-wait") {
    events.push(
      emit("work.transitioned", transition(3, "waiting_input", { dependency: "manager input" })),
    );
  }
  if (name === "test-failure-revision") {
    events.push(
      emit("work.transitioned", transition(3, "review_requested")),
      emit("evidence.recorded", {
        evidenceId: "evidence_unit_failed",
        workItemId: "work_fixture",
        kind: "unit",
        version: 1,
        result: "failed",
      }),
      emit("work.transitioned", transition(4, "active")),
    );
  }
  if (name === "stale-out-of-order") {
    const stale = emit("work.transitioned", transition(0, "assigned"));
    return [stale, ...events];
  }
  return events;
}

function baseWork(emit: Emit): ProjectEvent[] {
  return [
    emit("project.created", { name: "Simulator Fixture" }, "manager"),
    emit("work.created", {
      workItemId: "work_fixture",
      outcome: "Produce verified fixture output",
      requiredEvidenceKinds: ["unit"],
    }),
  ];
}

function transition(
  fromRevision: number,
  toState: string,
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  return { workItemId: "work_fixture", fromRevision, toState, ...details };
}
