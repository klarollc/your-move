import { replayProject } from "@cuckcode/domain";
import { projectOfficeLibraryEvidence } from "./evidence-library.js";
import { describe, expect, it } from "vitest";

import { projectOfficeReadModel, type OfficeRegistryEntry } from "./office-read-model.js";

/**
 * Phase 7-O Task 4: the office read model (spec v0.2 §4, §7, §8.1–8.3).
 *
 * Every expectation is written against the event log the test builds, never against a value read
 * back from the projector.
 */
const BASE = Date.parse("2026-09-25T20:00:00.000Z");
// Close enough to the last event that a freshly recorded presence reads current (60 s window).
const NOW = "2026-09-25T20:01:00.000Z";

type Options = {
  projectId?: string;
  blockedState?: "blocked" | "waiting_input";
  reasonCode?: string;
  summary?: string;
  waitingOn?: Record<string, unknown>;
  requestedAction?: Record<string, unknown>;
  evidenceVersion?: number;
  approveRelease?: boolean;
  approvalEvidenceVersion?: number;
  presenceSecond?: number;
  holder?: "test" | "implementation";
};

function office(options: Options = {}) {
  let tick = 0;
  const event = (
    eventId: string,
    kind: string,
    payload: Record<string, unknown>,
    source = "system",
    second?: number,
  ) => {
    tick += 1;
    const at = new Date(BASE + (second ?? tick) * 1000).toISOString();
    return {
      schemaVersion: 1,
      eventId,
      projectId: options.projectId ?? "project_office",
      kind,
      occurredAt: at,
      receivedAt: at,
      source,
      trust: "verified",
      payload,
    };
  };
  const roles = [
    ["delivery", "delivery-lead"],
    ["implementation", "implementation-engineer"],
    ["test", "test-engineer"],
  ] as const;
  const events = [
    event("event_project", "project.created", { name: "Office" }),
    ...roles.map(([short, roleId]) =>
      event(`event_agent_${short}`, "agent.registered", {
        agentId: `agent_${short}`,
        capabilities: [roleId],
        health: "connected",
      }),
    ),
    ...roles.map(([short, roleId]) =>
      event(`event_role_${short}`, "role.assigned", {
        roleAssignmentId: `role-assignment_${short}`,
        roleId,
        agentId: `agent_${short}`,
        requiredCapabilities: [roleId],
      }),
    ),
    event("event_work_evidence", "work.created", {
      workItemId: "work_evidence",
      outcome: "Provide current browser evidence",
      requiredEvidenceKinds: ["browser"],
    }),
    event("event_bind_evidence", "work.assigned", {
      workItemId: "work_evidence",
      roleAssignmentId: `role-assignment_${options.holder ?? "test"}`,
    }),
    ...(["ready", "assigned", "active"] as const).map((toState, index) =>
      event(`event_evidence_${toState}`, "work.transitioned", {
        workItemId: "work_evidence",
        fromRevision: index,
        toState,
      }),
    ),
    event("event_evidence_blocked", "work.transitioned", {
      workItemId: "work_evidence",
      fromRevision: 3,
      toState: options.blockedState ?? "blocked",
      payloadVersion: 2,
      condition: {
        reasonCode: options.reasonCode ?? "awaiting_evidence",
        summary: options.summary ?? "The Test Engineer needs the current browser evidence.",
        waitingOn: options.waitingOn ?? { kind: "manager" },
        requestedAction: options.requestedAction ?? {
          kind: "redirect",
          summary: "Redirect the evidence request or decline it.",
        },
      },
    }),
    event("event_work_release", "work.created", {
      workItemId: "work_release",
      outcome: "Ship the graybox slice",
      requiredEvidenceKinds: ["unit"],
    }),
    event("event_bind_release", "work.assigned", {
      workItemId: "work_release",
      roleAssignmentId: "role-assignment_implementation",
    }),
    ...(["ready", "assigned", "active", "review_requested"] as const).map((toState, index) =>
      event(
        `event_release_${toState}`,
        "work.transitioned",
        toState === "review_requested"
          ? {
              workItemId: "work_release",
              fromRevision: index,
              toState,
              payloadVersion: 2,
              condition: {
                reasonCode: "review_requested",
                summary: "The slice is ready for review.",
                waitingOn: { kind: "manager" },
                requestedAction: { kind: "approve", summary: "Approve or decline the slice." },
              },
            }
          : { workItemId: "work_release", fromRevision: index, toState },
      ),
    ),
    event("event_evidence_unit", "evidence.recorded", {
      evidenceId: "evidence_unit",
      workItemId: "work_release",
      kind: "unit",
      version: options.evidenceVersion ?? 1,
      result: "passed",
    }),
    event("event_release_verified", "work.transitioned", {
      workItemId: "work_release",
      fromRevision: 4,
      toState: "verified",
    }),
    event("event_release_completed", "work.transitioned", {
      workItemId: "work_release",
      fromRevision: 5,
      toState: "completed",
    }),
    ...(options.approveRelease
      ? [
          event(
            "event_approval",
            "approval.recorded",
            {
              approvalId: "approval_release",
              workItemId: "work_release",
              artifactId: "artifact_slice",
              artifactVersion: 1,
              evidenceVersions: [
                {
                  evidenceId: "evidence_unit",
                  version: options.approvalEvidenceVersion ?? options.evidenceVersion ?? 1,
                },
              ],
            },
            "manager",
          ),
        ]
      : []),
    event(
      "event_presence_test",
      "agent.presence_changed",
      { agentId: "agent_test", presence: "waiting", health: "connected" },
      "adapter",
      options.presenceSecond,
    ),
  ];
  return events;
}

const REGISTRY: OfficeRegistryEntry[] = [
  { entityId: "zone_review", kind: "zone", label: "Review station" },
  {
    entityId: "agent_delivery_lead",
    kind: "person",
    label: "Delivery Lead",
    agentId: "agent_delivery",
    relationship: "Coordinates the office team",
  },
  {
    entityId: "agent_implementation_engineer",
    kind: "person",
    label: "Implementation Engineer",
    agentId: "agent_implementation",
  },
  {
    entityId: "agent_test_engineer",
    kind: "person",
    label: "Test Engineer",
    agentId: "agent_test",
  },
];

const model = (events: readonly unknown[], extra: Record<string, unknown> = {}) =>
  projectOfficeReadModel({
    snapshot: replayProject(events),
    now: NOW,
    registry: REGISTRY,
    ...extra,
  });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entity = (m: any, id: string) =>
  m.entities.find((e: { entityId: string }) => e.entityId === id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const work = (m: any, entityId: string, workItemId: string) =>
  entity(m, entityId)?.work?.find((w: { workItemId: string }) => w.workItemId === workItemId);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mustWork = (m: any, entityId: string, workItemId: string) => {
  const found = work(m, entityId, workItemId);
  expect(found, `${entityId} / ${workItemId}`).toBeDefined();
  return found;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const codes = (m: any) => m.issues.map((issue: { code: string }) => issue.code);

describe("office read model: what the manager is shown", () => {
  it("joins work to a person through role assignment and carries its recorded condition", () => {
    const m = model(office());
    expect(m.current).toBe(true);
    const evidence = mustWork(m, "agent_test_engineer", "work_evidence");
    expect(evidence).toMatchObject({
      state: "blocked",
      causeEventId: "event_evidence_blocked",
      supported: true,
      condition: {
        reasonCode: "awaiting_evidence",
        summary: "The Test Engineer needs the current browser evidence.",
        waitingOn: { kind: "manager" },
        requestedAction: { kind: "redirect" },
        eventId: "event_evidence_blocked",
        source: "system",
        trust: "verified",
      },
      assignment: { roleAssignmentId: "role-assignment_test", eventId: "event_bind_evidence" },
    });
    expect(entity(m, "agent_test_engineer").agent).toMatchObject({
      status: "recorded",
      agentId: "agent_test",
      presence: "waiting",
      causeEventId: "event_presence_test",
      freshness: "current",
    });
  });

  it("says plainly what is absent rather than supplying a plausible default", () => {
    const m = model(office());
    const lead = entity(m, "agent_delivery_lead");
    expect(lead.workRelation).toBe("none_assigned");
    expect(lead.work).toEqual([]);
    expect(lead.attention).toEqual([]);
    expect(lead.runtime).toEqual({ status: "unavailable", reason: "not_recorded" });
    expect(entity(m, "zone_review")).toEqual({
      entityId: "zone_review",
      kind: "zone",
      label: "Review station",
      status: "layout_only",
    });
  });

  it("reports a registered person whose agent has no record as unresolved", () => {
    const registry = [
      ...REGISTRY,
      { entityId: "agent_ghost", kind: "person", label: "Ghost", agentId: "agent_ghost" },
    ];
    const m = model(office(), { registry });
    expect(entity(m, "agent_ghost").agent).toEqual({
      status: "unresolved",
      reason: "agent_not_recorded",
      agentId: "agent_ghost",
    });
  });
});

describe("two-snapshot sensitivity (§8.1)", () => {
  const a = model(office());

  it("changes the state when the recorded state changes", () => {
    const b = model(office({ blockedState: "waiting_input" }));
    expect(mustWork(a, "agent_test_engineer", "work_evidence").state).toBe("blocked");
    expect(mustWork(b, "agent_test_engineer", "work_evidence").state).toBe("waiting_input");
  });

  it("changes each part of the condition when it changes", () => {
    const b = model(
      office({
        reasonCode: "awaiting_decision",
        summary: "A different reason.",
        waitingOn: { kind: "agent", id: "agent_delivery" },
        requestedAction: { kind: "defer", summary: "Defer it." },
      }),
    );
    const before = mustWork(a, "agent_test_engineer", "work_evidence").condition;
    const after = mustWork(b, "agent_test_engineer", "work_evidence").condition;
    expect(after.reasonCode).toBe("awaiting_decision");
    expect(after.summary).toBe("A different reason.");
    expect(after.waitingOn).toEqual({ kind: "agent", id: "agent_delivery" });
    expect(after.requestedAction).toEqual({ kind: "defer", summary: "Defer it." });
    for (const key of ["reasonCode", "summary", "waitingOn", "requestedAction"]) {
      expect(after[key], key).not.toEqual(before[key]);
    }
  });

  it("moves the work to whichever person the assignment names", () => {
    const b = model(office({ holder: "implementation" }));
    expect(work(a, "agent_test_engineer", "work_evidence")).toBeDefined();
    expect(work(b, "agent_test_engineer", "work_evidence")).toBeUndefined();
    expect(work(b, "agent_implementation_engineer", "work_evidence")).toBeDefined();
    expect(entity(b, "agent_test_engineer").workRelation).toBe("none_assigned");
  });

  it("changes evidence and approval when they change", () => {
    const b = model(office({ evidenceVersion: 2, approveRelease: true }));
    const before = mustWork(a, "agent_implementation_engineer", "work_release");
    const after = mustWork(b, "agent_implementation_engineer", "work_release");
    expect(before.evidence.map((e: { version: number }) => e.version)).toEqual([1]);
    expect(after.evidence.map((e: { version: number }) => e.version)).toEqual([2]);
    expect(before.approval.status).toBe("not_approved");
    expect(after.approval).toMatchObject({ status: "approved", approvalId: "approval_release" });
  });

  it("changes the presence time, and freshness, when either input changes", () => {
    // The log is replayed in time order, so a presence event moved before registration would simply
    // be ignored. The record's time is varied within the log, and freshness through the clock.
    const later = model(office({ presenceSecond: 50 }));
    expect(entity(a, "agent_test_engineer").agent.updatedAt).not.toBe(
      entity(later, "agent_test_engineer").agent.updatedAt,
    );
    expect(entity(later, "agent_test_engineer").agent.updatedAt).toBe("2026-09-25T20:00:50.000Z");
    const events = office();
    const snapshot = replayProject(events);
    const soon = projectOfficeReadModel({ snapshot, now: NOW, registry: REGISTRY });
    const afterAnHour = projectOfficeReadModel({
      snapshot,
      now: "2026-09-25T21:00:00.000Z",
      registry: REGISTRY,
    });
    expect(entity(soon, "agent_test_engineer").agent.freshness).toBe("current");
    expect(entity(afterAnHour, "agent_test_engineer").agent.freshness).toBe("delayed");
    expect(mustWork(afterAnHour, "agent_test_engineer", "work_evidence").freshness).toBe("delayed");
  });
});

describe("cross-surface agreement (§8.2)", () => {
  it("gives every joined attention item to its person unchanged", () => {
    const m = model(office());
    expect(m.attention.length).toBeGreaterThanOrEqual(2);
    for (const item of m.attention) {
      expect(item.relatedEntityId, item.workItemId).not.toBeNull();
      expect(entity(m, item.relatedEntityId as string).attention).toContainEqual(item);
    }
  });

  it("keeps an attention item whose work nobody holds, and reports it as unjoined", () => {
    const events = office().filter((e) => e.eventId !== "event_bind_evidence");
    const m = model(events);
    const item = m.attention.find((i: { workItemId: string }) => i.workItemId === "work_evidence");
    expect(item).toBeDefined();
    expect(item?.relatedEntityId).toBeNull();
    expect(m.issues).toContainEqual(
      expect.objectContaining({ code: "ATTENTION_UNJOINED", workItemId: "work_evidence" }),
    );
  });
});

describe("adversarial inputs (§7)", () => {
  it("1. never shows activity whose cause event is not in the log", () => {
    const snapshot = replayProject(office());
    snapshot.work.workItems.work_evidence = {
      ...snapshot.work.workItems.work_evidence!,
      state: "active",
      updatedByEventId: "event_forged",
    };
    snapshot.staffing.agents.agent_test = {
      ...snapshot.staffing.agents.agent_test!,
      presence: "active",
      updatedByEventId: "event_forged_presence",
    };
    const m = projectOfficeReadModel({ snapshot, now: NOW, registry: REGISTRY });
    const evidence = mustWork(m, "agent_test_engineer", "work_evidence");
    expect(evidence.supported).toBe(false);
    expect(evidence.motion).toBe(false);
    expect(entity(m, "agent_test_engineer").agent.motion).toBe(false);
    expect(codes(m)).toContain("CAUSE_EVENT_MISSING");
  });

  it("2. never places a person in a zone no supported event put them in", () => {
    const snapshot = replayProject(office());
    snapshot.staffing.agents.agent_test = {
      ...snapshot.staffing.agents.agent_test!,
      presence: "reviewing",
      updatedByEventId: "event_forged_presence",
    };
    const m = projectOfficeReadModel({ snapshot, now: NOW, registry: REGISTRY });
    expect(entity(m, "agent_test_engineer").agent.zone).toBeNull();
    const honest = model(office());
    expect(entity(honest, "agent_test_engineer").agent.zone).toBe("desk");
  });

  it("3. presents completed work without an approval as completed, never approved", () => {
    const m = model(office());
    const release = mustWork(m, "agent_implementation_engineer", "work_release");
    expect(release.state).toBe("completed");
    expect(release.approval.status).toBe("not_approved");
    expect(m.attention).toContainEqual(
      expect.objectContaining({ workItemId: "work_release", reason: "approval_required" }),
    );
  });

  it("4. refuses an auxiliary record that tries to supply state, blocker or attention", () => {
    for (const forged of [
      { state: "active" },
      { blocker: "none" },
      { condition: { summary: "all clear" } },
      { attention: [] },
      { approval: "approved" },
      { evidence: [] },
      { requestedAction: "approve" },
    ]) {
      const m = model(office(), {
        auxiliary: [
          {
            entityId: "agent_test_engineer",
            source: "fixture",
            version: 1,
            fixture: true,
            ...forged,
          },
        ],
      });
      expect(codes(m), JSON.stringify(forged)).toContain("AUXILIARY_FACT_REFUSED");
      expect(entity(m, "agent_test_engineer").runtime.status).toBe("unavailable");
      expect(mustWork(m, "agent_test_engineer", "work_evidence").state).toBe("blocked");
    }
  });

  it("5a. never presents a revision as current while any read-model issue stands (owner ruling, Task 6)", () => {
    // A transition from a stale revision is refused by the work reducer (INVALID_WORK_TRANSITION):
    // the log replays without a replay issue, but the office still holds an unresolved record.
    const events = [...office()];
    const last = events.at(-1)!;
    const refused = {
      ...last,
      eventId: "event_refused_transition",
      kind: "work.transitioned",
      occurredAt: "2026-09-25T20:00:58.000Z",
      receivedAt: "2026-09-25T20:00:58.000Z",
      payload: { workItemId: "work_evidence", fromRevision: 0, toState: "active" },
    };
    const m = model([...events, refused]);
    expect(codes(m)).toContain("INVALID_WORK_TRANSITION");
    expect(m.current).toBe(false);
    expect(model(office()).current).toBe(true);
  });

  it("5. never presents a revision with replay issues as current, or a disconnected agent as fresh", () => {
    const mixed = [...office(), ...office({ projectId: "project_other" })];
    expect(model(mixed).current).toBe(false);
    const events = [
      ...office(),
      {
        ...office()[1]!,
        eventId: "event_drop",
        kind: "agent.presence_changed",
        occurredAt: "2026-09-25T20:00:59.000Z",
        receivedAt: "2026-09-25T20:00:59.000Z",
        payload: { agentId: "agent_test", presence: "idle", health: "disconnected" },
      },
    ];
    const m = model(events, {
      auxiliary: [
        {
          entityId: "agent_test_engineer",
          source: "fixture",
          version: 1,
          fixture: true,
          runtimeBinding: { session: "loopback", health: "connected" },
        },
      ],
    });
    expect(entity(m, "agent_test_engineer").agent.freshness).toBe("unavailable");
  });

  it("6. treats an approval citing an unrecorded evidence version as unresolved", () => {
    const m = model(office({ approveRelease: true, approvalEvidenceVersion: 7 }));
    expect(mustWork(m, "agent_implementation_engineer", "work_release").approval.status).toBe(
      "unresolved",
    );
    expect(codes(m)).toContain("APPROVAL_EVIDENCE_UNRESOLVED");
  });

  it("7. surfaces work bound to a role assignment that is not active", () => {
    const events = office().map((e) =>
      e.eventId === "event_bind_evidence"
        ? {
            ...e,
            payload: { workItemId: "work_evidence", roleAssignmentId: "role-assignment_gone" },
          }
        : e,
    );
    const m = model(events);
    expect(codes(m)).toContain("WORK_ASSIGNMENT_INVALID");
    expect(work(m, "agent_test_engineer", "work_evidence")).toBeUndefined();
  });

  it("8. never renders a malformed version-2 blocker as a condition-free blocker", () => {
    const events = office().map((e) =>
      e.eventId === "event_evidence_blocked"
        ? {
            ...e,
            payload: Object.fromEntries(
              Object.entries(e.payload).filter(([key]) => key !== "condition"),
            ),
          }
        : e,
    );
    const m = model(events);
    expect(codes(m)).toContain("MALFORMED_WORK_EVENT");
    expect(mustWork(m, "agent_test_engineer", "work_evidence").state).toBe("active");
    expect(m.attention.some((i: { workItemId: string }) => i.workItemId === "work_evidence")).toBe(
      false,
    );
  });
});

describe("registry and auxiliary boundaries", () => {
  it("ignores and reports a registry entry that carries a workflow state", () => {
    const registry = REGISTRY.map((entry) =>
      entry.entityId === "agent_test_engineer" ? { ...entry, state: "Reviewing tests" } : entry,
    );
    const m = model(office(), { registry });
    expect(codes(m)).toContain("REGISTRY_FACT_REFUSED");
    expect(JSON.stringify(entity(m, "agent_test_engineer"))).not.toContain("Reviewing tests");
  });

  it("shows runtime binding and permissions only from an allowed record, marked as fixture", () => {
    const m = model(office(), {
      auxiliary: [
        {
          entityId: "agent_test_engineer",
          source: "graybox-fixture",
          version: 3,
          fixture: true,
          runtimeBinding: { session: "loopback" },
          permissions: ["inspect", "select"],
        },
      ],
    });
    expect(entity(m, "agent_test_engineer").runtime).toEqual({
      status: "recorded",
      source: "graybox-fixture",
      version: 3,
      fixture: true,
      binding: { session: "loopback" },
      permissions: ["inspect", "select"],
    });
  });
});

/** Phase 7-O Task 8b: the Project Library's evidence is the log's evidence, not a list. */
describe("office library evidence", () => {
  const library = (events: readonly unknown[]) => {
    const snapshot = replayProject(events);
    return projectOfficeLibraryEvidence({ snapshot, model: model(events) });
  };
  const recorded = (events: readonly unknown[], evidenceId: string) =>
    (events as { kind: string; eventId: string; payload: Record<string, unknown> }[]).find(
      (event) => event.kind === "evidence.recorded" && event.payload.evidenceId === evidenceId,
    )!;

  it("projects each recorded evidence item with its own kind, version, result and cause", () => {
    const events = office({ evidenceVersion: 2 });
    const source = recorded(events, "evidence_unit");
    const [record, ...rest] = library(events);
    expect(rest).toEqual([]);
    expect(record).toEqual({
      evidenceId: "evidence_unit",
      kind: source.payload.kind,
      status: source.payload.result === "passed" ? "complete" : "failed",
      summary: null,
      version: 2,
      revision: replayProject(events).eventIds.length,
      originatingEntityId: "agent_implementation_engineer",
      approved: false,
      workItemId: "work_release",
      causeEventId: source.eventId,
    });
  });

  it("marks evidence approved only when an approval cites that exact version", () => {
    expect(library(office({ approveRelease: true }))[0]).toMatchObject({
      status: "approved",
      approved: true,
    });
    const stale = library(
      office({ approveRelease: true, evidenceVersion: 2, approvalEvidenceVersion: 1 }),
    )[0];
    expect(stale).toMatchObject({ approved: false });
    expect(stale!.status).not.toBe("approved");
  });

  it("gives no origin when no office entity holds the work", () => {
    const unheld = office().filter(
      (event) => (event as { eventId: string }).eventId !== "event_bind_release",
    );
    expect(library(unheld)[0]).toMatchObject({
      evidenceId: "evidence_unit",
      originatingEntityId: null,
    });
  });
});

/** Phase 7-O Task 9, owner ruling (a): the office's handoff cue comes only from recorded handoffs. */
describe("office read model: handoffs", () => {
  const handoff = (fromAgentId: string, toAgentId: string) => ({
    ...office()[1]!,
    eventId: "event_handoff_release",
    kind: "handoff.recorded",
    occurredAt: "2026-09-25T20:00:57.000Z",
    receivedAt: "2026-09-25T20:00:57.000Z",
    payload: {
      handoffId: "handoff_release",
      participantIds: [fromAgentId, toAgentId],
      fromAgentId,
      toAgentId,
      workItemId: "work_release",
    },
  });

  it("joins a recorded handoff to its office people, at the revision it was recorded", () => {
    const events = [...office(), handoff("agent_implementation", "agent_test")];
    const m = model(events);
    const revision = replayProject(events).eventIds.indexOf("event_handoff_release") + 1;
    expect(revision).toBeGreaterThan(0);
    expect(m.handoffs).toEqual([
      {
        handoffId: "handoff_release",
        fromEntityId: "agent_implementation_engineer",
        toEntityId: "agent_test_engineer",
        workItemId: "work_release",
        causeEventId: "event_handoff_release",
        revision,
      },
    ]);
    expect(m.current).toBe(true);
  });

  it("shows no handoff when none is recorded", () => {
    expect(model(office()).handoffs).toEqual([]);
  });

  it("reports a handoff naming someone not in the office, and shows no cue for it", () => {
    const m = model([...office(), handoff("agent_implementation", "agent_stranger")]);
    expect(m.handoffs).toEqual([]);
    expect(codes(m)).toContain("HANDOFF_UNJOINED");
    expect(m.current).toBe(false);
  });
});

/** Phase 7-O Task 9d (F-9-1, V1): work nobody holds must have somewhere to show. */
describe("office read model: unassigned work", () => {
  it("lists work no office person holds, and nothing that someone holds", () => {
    const unheld = office().filter(
      (event) => (event as { eventId: string }).eventId !== "event_bind_release",
    );
    const m = model(unheld);
    expect(m.unassignedWork.map((view) => view.workItemId)).toEqual(["work_release"]);
    expect(m.unassignedWork[0]).toMatchObject({ workItemId: "work_release", assignment: null });
    const held = m.entities.flatMap((entity) =>
      entity.kind === "person" ? entity.work.map((view) => view.workItemId) : [],
    );
    expect(held).not.toContain("work_release");
  });

  it("lists nothing when everyone's work is held", () => {
    expect(model(office()).unassignedWork).toEqual([]);
  });
});
