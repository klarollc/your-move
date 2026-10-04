import { judgeDoneClaim, replayProject } from "@cuckcode/domain";
import { describe, expect, it } from "vitest";

import { executeWorkCommand, type WorkCommand } from "./work-commands.js";

let clock = 0;
const event = (eventId: string, kind: string, payload: Record<string, unknown>) => {
  clock += 1;
  const at = new Date(Date.parse("2026-10-04T10:00:00.000Z") + clock * 1000).toISOString();
  return {
    schemaVersion: 1,
    eventId,
    projectId: "project_alpha",
    kind,
    occurredAt: at,
    receivedAt: at,
    source: "system",
    trust: "verified",
    payload,
  };
};

const ROLE = "role-assignment_engineer";
const staffing = () => [
  event("event_agent", "agent.registered", {
    agentId: "agent_engineer",
    capabilities: ["engineer"],
    health: "connected",
  }),
  event("event_role", "role.assigned", {
    roleAssignmentId: ROLE,
    roleId: "engineer",
    agentId: "agent_engineer",
    requiredCapabilities: ["engineer"],
  }),
];

const contract = () => ({
  outcome: "Implement slugify",
  exclusions: ["no other files"],
  acceptanceCriteria: ["the test is green"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "RED then GREEN" }],
  permissionCeiling: {
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "never",
    networkAccess: false as const,
    windowsSandbox: "unelevated" as const,
  },
  stopConditions: ["turn cap"],
  definitionOfDone: "owner acceptance",
  contextRefs: [],
});

const manager = { actorType: "manager" as const, actorId: "manager_nate" };
const NOW = "2026-10-04T11:00:00.000Z";
type Override = { [K in keyof WorkCommand]?: WorkCommand[K] | undefined };
const base = (over: Override): WorkCommand =>
  Object.fromEntries(
    Object.entries({
      commandId: "cmd1",
      projectId: "project_alpha",
      expectedRevision: 0,
      actor: manager,
      intent: "create",
      workItemId: "work_slug",
      contract: contract(),
      ...over,
    }).filter(([, value]) => value !== undefined),
  ) as WorkCommand;
const run = (log: readonly unknown[], command: WorkCommand, currentRevision = log.length) =>
  executeWorkCommand({ log, currentRevision, now: NOW, command });

const created = () => {
  const log = staffing();
  const result = run(log, base({ expectedRevision: log.length }));
  if (!result.ok) throw new Error(`setup failed: ${result.code}`);
  return [...log, ...result.events];
};

describe("executeWorkCommand: create", () => {
  it("creates a draft work item carrying the contract, with a receipt", () => {
    const log = staffing();
    const result = run(log, base({ expectedRevision: log.length }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ kind: "work.created", projectId: "project_alpha" });
    expect(result.state.workItems.work_slug).toMatchObject({ state: "draft" });
    expect(result.state.workItems.work_slug?.contract?.outcome).toBe("Implement slugify");
    expect(result.receipt).toMatchObject({
      receiptId: "receipt_cmd1",
      commandId: "cmd1",
      acceptedRevision: log.length,
      resultingRevision: log.length + 1,
      intent: "create",
      workItemId: "work_slug",
      actorId: "manager_nate",
    });
    expect(result.receipt.eventIds).toEqual(result.events.map((e) => e.eventId));
  });

  it("refuses an incomplete contract, naming the field", () => {
    const incomplete: Record<string, unknown> = { ...contract() };
    delete incomplete.acceptanceCriteria;
    const result = run([], base({ contract: incomplete as never }));
    expect(result).toMatchObject({ ok: false, code: "CONTRACT_INVALID" });
    if (!result.ok) expect(result.issues.join(" ")).toContain("acceptanceCriteria");
  });

  it("refuses a missing contract", () => {
    const result = run([], base({ contract: undefined }));
    expect(result).toMatchObject({ ok: false, code: "CONTRACT_INVALID" });
  });

  it("refuses a stale revision", () => {
    const result = run([], base({ expectedRevision: 3 }), 5);
    expect(result).toMatchObject({ ok: false, code: "STALE_REVISION" });
  });

  it("refuses an agent as actor", () => {
    const result = run([], base({ actor: { actorType: "agent", actorId: "agent_engineer" } }));
    expect(result).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  });

  it("refuses a work item that already exists", () => {
    const log = created();
    const result = run(log, base({ commandId: "cmd2", expectedRevision: log.length }));
    expect(result).toMatchObject({ ok: false, code: "WORK_ITEM_EXISTS" });
  });

  it("refuses a malformed command id and a malformed work item id", () => {
    expect(run([], base({ commandId: "bad id!" }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
    expect(run([], base({ workItemId: "slug" }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
  });

  it("refuses rather than silently drops an event that would not parse", () => {
    const result = run([], base({ projectId: "alpha" }));
    expect(result).toMatchObject({ ok: false, code: "EVENT_INVALID" });
  });
});

describe("executeWorkCommand: assign", () => {
  const assign = (log: readonly unknown[], over: Override = {}) =>
    run(
      log,
      base({
        commandId: "cmd_assign",
        intent: "assign",
        roleAssignmentId: ROLE,
        contract: undefined,
        expectedRevision: log.length,
        ...over,
      }),
    );

  it("moves a draft item to assigned in three events and binds the assignment", () => {
    const log = created();
    const result = assign(log);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.kind)).toEqual([
      "work.transitioned",
      "work.assigned",
      "work.transitioned",
    ]);
    const item = result.state.workItems.work_slug;
    expect(item).toMatchObject({ state: "assigned", revision: 2 });
    expect(item?.assignment?.roleAssignmentId).toBe(ROLE);
    expect(result.state.issues).toEqual([]);
    expect(result.receipt.resultingRevision).toBe(log.length + 3);
  });

  it("uses two events for an item that is already ready", () => {
    const log = created();
    // Stamped after the create command's events (at NOW), as canonical replay needs.
    const ready = {
      ...event("event_ready", "work.transitioned", {
        payloadVersion: 3,
        workItemId: "work_slug",
        fromRevision: 0,
        toState: "ready",
      }),
      occurredAt: "2026-10-04T11:00:01.000Z",
      receivedAt: "2026-10-04T11:00:01.000Z",
    };
    const result = assign([...log, ready]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events.map((e) => e.kind)).toEqual(["work.assigned", "work.transitioned"]);
      expect(result.state.workItems.work_slug?.state).toBe("assigned");
    }
  });

  it("refuses an unknown work item", () => {
    expect(assign(staffing())).toMatchObject({ ok: false, code: "WORK_ITEM_NOT_FOUND" });
  });

  it("refuses an item that has no contract", () => {
    const log = [
      ...staffing(),
      event("event_old", "work.created", {
        workItemId: "work_slug",
        outcome: "x",
        requiredEvidenceKinds: [],
      }),
    ];
    expect(assign(log)).toMatchObject({ ok: false, code: "CONTRACT_MISSING" });
  });

  it("refuses a second assignment of the same item", () => {
    const first = assign(created());
    if (!first.ok) throw new Error("setup failed");
    const log = [...created(), ...first.events];
    expect(assign(log, { commandId: "cmd_again" })).toMatchObject({
      ok: false,
      code: "WORK_NOT_ASSIGNABLE",
    });
  });

  it("passes through the reducer's refusal for an unknown role assignment", () => {
    const result = assign(created(), { roleAssignmentId: "role-assignment_nobody" });
    expect(result).toMatchObject({ ok: false, code: "WORK_ASSIGNMENT_INVALID" });
  });

  it("refuses a stale revision and a missing role assignment id", () => {
    const log = created();
    expect(assign(log, { expectedRevision: log.length - 1 })).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(assign(log, { roleAssignmentId: undefined })).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
  });
});

describe("executeWorkCommand: judged against the canonical replay order", () => {
  it("stamps new events after everything in the log, so a tied timestamp cannot reorder them", () => {
    // Staffing and the command share one instant. Canonical replay breaks time ties by event id
    // with a locale-aware comparison, which would put the assignment before the role assignment
    // it depends on. New events are stamped after the log's newest time instead.
    const stamp = (e: ReturnType<typeof event>) => ({ ...e, occurredAt: NOW, receivedAt: NOW });
    const tied = staffing().map(stamp);
    const made = run(tied, base({ expectedRevision: tied.length }));
    if (!made.ok) throw new Error("setup failed");
    const log = [...tied, ...made.events];
    const result = run(
      log,
      base({
        commandId: "cmd_assign",
        intent: "assign",
        roleAssignmentId: ROLE,
        contract: undefined,
        expectedRevision: log.length,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const newest = Math.max(
      ...log.map((e) => Date.parse((e as { occurredAt: string }).occurredAt)),
    );
    for (const e of result.events) {
      expect(Date.parse(e.occurredAt as string)).toBeGreaterThan(newest);
    }
    expect(replayProject([...log, ...result.events]).work.issues).toEqual([]);
    expect(replayProject([...log, ...result.events]).work.workItems.work_slug?.state).toBe(
      "assigned",
    );
  });
});

describe("executeWorkCommand: record_evidence (owner-run check results)", () => {
  const assignedLog = () => {
    const log = created();
    const r = run(
      log,
      base({
        commandId: "cmd_assign",
        intent: "assign",
        roleAssignmentId: ROLE,
        contract: undefined,
        expectedRevision: log.length,
      }),
    );
    if (!r.ok) throw new Error("setup failed");
    return [...log, ...r.events];
  };
  const record = (log: readonly unknown[], evidence: unknown, over: Override = {}) =>
    run(
      log,
      base({
        commandId: "cmd_ev",
        intent: "record_evidence",
        contract: undefined,
        evidence: evidence as never,
        expectedRevision: log.length,
        ...over,
      }),
    );
  const good = { kind: "test-run", result: "passed" as const };

  it("records manager-verified evidence that the done-claim rule then accepts", () => {
    const log = assignedLog();
    const result = record(log, { ...good, note: "RED then GREEN", outputSha256: "b".repeat(64) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      kind: "evidence.recorded",
      source: "manager",
      trust: "verified",
      workItemId: "work_slug",
      payload: {
        evidenceId: "evidence_cmd_ev",
        workItemId: "work_slug",
        kind: "test-run",
        version: 1,
        result: "passed",
        note: "RED then GREEN",
        outputSha256: "b".repeat(64),
        recordedBy: "manager_nate",
      },
    });
    expect(Object.values(result.state.evidence)).toMatchObject([
      { kind: "test-run", result: "passed" },
    ]);
    expect(judgeDoneClaim({ log: [...log, ...result.events], workItemId: "work_slug" })).toEqual({
      ok: true,
    });
    expect(result.receipt).toMatchObject({
      intent: "record_evidence",
      resultingRevision: log.length + 1,
    });
  });

  it("refuses a kind the contract does not oblige, so a typo cannot silently never count", () => {
    const result = record(assignedLog(), { kind: "tset-run", result: "passed" });
    expect(result).toMatchObject({ ok: false, code: "EVIDENCE_KIND_UNKNOWN" });
    if (!result.ok) expect(result.issues.join(" ")).toContain("test-run");
  });

  it("refuses a bad result, a malformed digest, an over-long note, and a missing evidence object", () => {
    const log = assignedLog();
    for (const bad of [
      { kind: "test-run", result: "ok" },
      { ...good, outputSha256: "nope" },
      { ...good, note: "x".repeat(281) },
      { ...good, extra: 1 },
    ]) {
      expect(record(log, bad)).toMatchObject({ ok: false, code: "EVIDENCE_INVALID" });
    }
    expect(record(log, undefined)).toMatchObject({ ok: false, code: "EVIDENCE_INVALID" });
  });

  it("refuses an unknown item, an item with no contract, and an item that cannot take evidence", () => {
    expect(record(staffing(), good)).toMatchObject({ ok: false, code: "WORK_ITEM_NOT_FOUND" });
    const old = [
      ...staffing(),
      event("event_old", "work.created", {
        workItemId: "work_slug",
        outcome: "x",
        requiredEvidenceKinds: [],
      }),
    ];
    expect(record(old, good)).toMatchObject({ ok: false, code: "CONTRACT_MISSING" });
    expect(record(created(), good)).toMatchObject({
      ok: false,
      code: "WORK_NOT_ACCEPTING_EVIDENCE",
    });
  });

  it("refuses an agent actor and a stale revision", () => {
    const log = assignedLog();
    expect(
      record(log, good, { actor: { actorType: "agent", actorId: "agent_engineer" } }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(record(log, good, { expectedRevision: log.length - 1 })).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
  });
});
