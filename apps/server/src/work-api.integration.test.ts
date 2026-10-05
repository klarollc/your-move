import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { replayProject } from "@cuckcode/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readEventLog } from "./event-log.js";
import { createLoopbackApp, type LoopbackApp } from "./loopback-session.js";
import { measureWorktreeSha256 } from "./worktree-digest.js";

const origin = "http://127.0.0.1:4173";
const headers = { origin, "x-cuckcode-session": "session_t", "x-cuckcode-csrf": "csrf_t" };
const NOW = "2026-10-04T12:00:00.000Z";

const staffingEvents = [
  {
    schemaVersion: 1,
    eventId: "event_s1",
    projectId: "project_alpha",
    kind: "agent.registered",
    occurredAt: "2026-10-04T09:00:00.000Z",
    receivedAt: "2026-10-04T09:00:00.000Z",
    source: "system",
    trust: "verified",
    payload: { agentId: "agent_engineer", capabilities: ["engineer"], health: "connected" },
  },
  {
    schemaVersion: 1,
    eventId: "event_s2",
    projectId: "project_alpha",
    kind: "role.assigned",
    occurredAt: "2026-10-04T09:00:01.000Z",
    receivedAt: "2026-10-04T09:00:01.000Z",
    source: "system",
    trust: "verified",
    payload: {
      roleAssignmentId: "role-assignment_engineer",
      roleId: "engineer",
      agentId: "agent_engineer",
      requiredCapabilities: ["engineer"],
    },
  },
];

const contract = {
  outcome: "Implement slugify",
  exclusions: [],
  acceptanceCriteria: ["the test is green"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "RED then GREEN" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["turn cap"],
  definitionOfDone: "owner acceptance",
  contextRefs: [],
  maxTurns: 5,
};

/** Historical replay fixture used by command tests that begin after work was already created. */
const staffingAndWorkEvents = [
  ...staffingEvents,
  {
    schemaVersion: 1,
    eventId: "event_api_seed_work",
    projectId: "project_alpha",
    workItemId: "work_slug",
    kind: "work.created",
    occurredAt: "2026-10-04T09:00:02.000Z",
    receivedAt: "2026-10-04T09:00:02.000Z",
    source: "manager",
    trust: "verified",
    actor: { actorType: "manager", actorId: "manager_nate" },
    payload: {
      payloadVersion: 3,
      workItemId: "work_slug",
      outcome: contract.outcome,
      requiredEvidenceKinds: ["test-run"],
      contract,
    },
  },
];

const body = (over: Record<string, unknown>) => ({
  schemaVersion: 1,
  commandId: "cmd1",
  projectId: "project_alpha",
  expectedRevision: 2,
  actor: { actorType: "manager", actorId: "manager_nate" },
  intent: "work.create",
  targetEntityId: "work_slug",
  payload: { contract },
  ...over,
});

let dir = "";
let logPath = "";
let digestRoot = "";
const apps: LoopbackApp[] = [];
const authenticatedAgentSession = {
  sessionId: "session_agent_runner",
  csrfToken: "csrf_agent_runner",
  principal: { agentId: "agent_engineer", roleAssignmentId: "role-assignment_engineer" },
};
const start = async (
  events: readonly unknown[] = staffingEvents,
  runner?: {
    status: () => {
      available: boolean;
      state:
        | "unavailable"
        | "idle"
        | "starting"
        | "running"
        | "completed"
        | "failed"
        | "recovery_required";
      workItemId?: string;
    };
    start: (workItemId: string) => Promise<{ ok: true } | { ok: false; code: string }>;
    waitUntilIdle: () => Promise<void>;
  },
  worktreeRoot: string = digestRoot,
  agentSession?: typeof authenticatedAgentSession,
) => {
  await writeFile(logPath, events.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
  const app = createLoopbackApp({
    mode: "test",
    host: "127.0.0.1",
    allowedOrigin: origin,
    projectId: "project_alpha",
    initialRevision: 0,
    sessionId: "session_t",
    csrfToken: "csrf_t",
    managerActorId: "manager_nate",
    readModel: {},
    logPath,
    worktreeRoot,
    ...(runner ? { runner } : {}),
    ...(agentSession ? { authenticatedAgentSession: agentSession } : {}),
    now: () => NOW,
  });
  apps.push(app);
  return app;
};
const post = (app: LoopbackApp, payload: unknown, extra: Record<string, string> = {}) =>
  app.inject({
    method: "POST",
    url: "/api/commands",
    headers: { ...headers, ...extra },
    payload: payload as never,
  });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-api-"));
  logPath = join(dir, "events.jsonl");
  digestRoot = join(dir, "digest-root");
  await mkdir(digestRoot);
  await writeFile(join(digestRoot, "tracked.txt"), "digest fixture\n", "utf8");
  execFileSync("git", ["init", "--quiet"], { cwd: digestRoot });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: digestRoot });
  execFileSync("git", ["add", "tracked.txt"], { cwd: digestRoot });
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await rm(dir, { recursive: true, force: true });
});

describe("work API in log mode", () => {
  it("binds agent speech-act identity from the authenticated session and appends to the shared log", async () => {
    const app = await start(
      staffingAndWorkEvents,
      undefined,
      digestRoot,
      authenticatedAgentSession,
    );
    await post(
      app,
      body({
        commandId: "manager_assign",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );

    const before = await readEventLog(logPath);
    const response = await post(
      app,
      body({
        commandId: "agent_question",
        expectedRevision: before.revision,
        actor: { actorType: "agent", actorId: "agent_forged" },
        intent: "work.ask_question",
        payload: { question: "Which compatibility behavior must remain?" },
      }),
      {
        "x-cuckcode-session": authenticatedAgentSession.sessionId,
        "x-cuckcode-csrf": authenticatedAgentSession.csrfToken,
      },
    );

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      actorId: "agent_engineer",
      acceptedRevision: before.revision,
      resultingRevision: before.revision + 1,
    });
    const after = await readEventLog(logPath);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.events.at(-1)).toMatchObject({
      kind: "work.question_asked",
      source: "adapter",
      trust: "reported",
      actor: { actorType: "agent", actorId: "agent_engineer" },
      roleAssignmentId: "role-assignment_engineer",
      payload: { question: "Which compatibility behavior must remain?", workItemId: "work_slug" },
    });
    expect(replayProject(after.events).work.workItems.work_slug?.speechActs).toMatchObject([
      {
        kind: "work.question_asked",
        actor: { actorType: "agent", actorId: "agent_engineer" },
        trust: "reported",
      },
    ]);
  });

  it("uses the same command endpoint for proposal, dispute and manager disposition events", async () => {
    const app = await start(
      staffingAndWorkEvents,
      undefined,
      digestRoot,
      authenticatedAgentSession,
    );
    await post(
      app,
      body({
        commandId: "manager_assign",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    const agentHeaders = {
      "x-cuckcode-session": authenticatedAgentSession.sessionId,
      "x-cuckcode-csrf": authenticatedAgentSession.csrfToken,
    };
    const current = await readEventLog(logPath);
    const proposed = await post(
      app,
      body({
        commandId: "agent_proposal",
        expectedRevision: current.revision,
        intent: "work.propose_rescope",
        payload: {
          proposalId: "rescope-proposal_api",
          expectedContractRevision: 1,
          contract: { ...contract, outcome: "Preserve compatibility" },
        },
      }),
      agentHeaders,
    );
    expect(proposed.statusCode).toBe(202);

    const proposalLog = await readEventLog(logPath);
    const managerDecline = await post(
      app,
      body({
        commandId: "manager_decline",
        expectedRevision: proposalLog.revision,
        actor: { actorType: "manager", actorId: "manager_forged" },
        intent: "work.decline_rescope",
        payload: { proposalId: "rescope-proposal_api", reason: "Keep the bounded scope." },
      }),
    );
    expect(managerDecline.statusCode).toBe(202);
    expect((await readEventLog(logPath)).events.at(-1)).toMatchObject({
      kind: "work.rescope_declined",
      actor: { actorType: "manager", actorId: "manager_nate" },
      payload: { proposalId: "rescope-proposal_api" },
    });

    const afterDecline = await readEventLog(logPath);
    const latestAt = Date.parse(
      String((afterDecline.events.at(-1) as { occurredAt?: unknown })?.occurredAt),
    );
    const activeAt = new Date(latestAt + 1).toISOString();
    const reviewAt = new Date(latestAt + 2).toISOString();
    const reviewStateFixtures = [
      {
        schemaVersion: 1,
        eventId: "event_api_fixture_active",
        projectId: "project_alpha",
        workItemId: "work_slug",
        kind: "work.transitioned",
        occurredAt: activeAt,
        receivedAt: activeAt,
        source: "system",
        trust: "verified",
        payload: { workItemId: "work_slug", fromRevision: 2, toState: "active" },
      },
      {
        schemaVersion: 1,
        eventId: "event_api_fixture_review",
        projectId: "project_alpha",
        workItemId: "work_slug",
        kind: "work.transitioned",
        occurredAt: reviewAt,
        receivedAt: reviewAt,
        source: "system",
        trust: "verified",
        payload: { workItemId: "work_slug", fromRevision: 3, toState: "review_requested" },
      },
    ];
    await writeFile(
      logPath,
      [...afterDecline.events, ...reviewStateFixtures]
        .map((event) => `${JSON.stringify(event)}\n`)
        .join(""),
      "utf8",
    );
    const afterRequest = await readEventLog(logPath);
    const sentBack = await post(
      app,
      body({
        commandId: "manager_send_back",
        expectedRevision: afterRequest.revision,
        intent: "work.record_ruling",
        payload: { decision: "send_back", reason: "Add a compatibility example." },
      }),
    );
    expect(sentBack.statusCode).toBe(202);
    const beforeDispute = await readEventLog(logPath);
    expect(beforeDispute.events.at(-1)).toMatchObject({
      kind: "work.ruling_recorded",
      payload: { decision: "send_back" },
    });
    const disputed = await post(
      app,
      body({
        commandId: "agent_dispute",
        expectedRevision: beforeDispute.revision,
        actor: { actorType: "manager", actorId: "manager_forged" },
        intent: "work.dispute_send_back",
        payload: {
          rulingId: "ruling_manager_send_back",
          statement: "The example is already in the attachment.",
        },
      }),
      agentHeaders,
    );
    expect(disputed.statusCode, JSON.stringify(disputed.json())).toBe(202);
    const afterDispute = await readEventLog(logPath);
    expect(afterDispute.revision).toBe(beforeDispute.revision + 1);
    expect(afterDispute.events.at(-1)).toMatchObject({
      kind: "work.send_back_disputed",
      actor: { actorType: "agent", actorId: "agent_engineer" },
      source: "adapter",
      trust: "reported",
    });
  });

  it("rejects forged agent identity, stale revisions and damaged logs without append", async () => {
    const app = await start(
      staffingAndWorkEvents,
      undefined,
      digestRoot,
      authenticatedAgentSession,
    );
    await post(
      app,
      body({
        commandId: "manager_assign",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    const current = await readEventLog(logPath);
    const forgedAssignment = await post(
      app,
      body({
        commandId: "agent_forged_assignment",
        expectedRevision: current.revision,
        intent: "work.ask_question",
        payload: { question: "Question", roleAssignmentId: "role-assignment_forged" },
      }),
      {
        "x-cuckcode-session": authenticatedAgentSession.sessionId,
        "x-cuckcode-csrf": authenticatedAgentSession.csrfToken,
      },
    );
    expect(forgedAssignment.statusCode).toBe(422);
    expect((await readEventLog(logPath)).revision).toBe(current.revision);

    const stale = await post(
      app,
      body({
        commandId: "agent_stale",
        expectedRevision: current.revision - 1,
        intent: "work.ask_question",
        payload: { question: "Question" },
      }),
      {
        "x-cuckcode-session": authenticatedAgentSession.sessionId,
        "x-cuckcode-csrf": authenticatedAgentSession.csrfToken,
      },
    );
    expect(stale.statusCode).toBe(409);
    expect((await readEventLog(logPath)).revision).toBe(current.revision);

    await writeFile(logPath, `${JSON.stringify(staffingEvents[0])}\nnot-json\n`, "utf8");
    const before = await readFile(logPath, "utf8");
    const damaged = await post(
      app,
      body({
        commandId: "agent_damaged_log",
        expectedRevision: 1,
        intent: "work.ask_question",
        payload: { question: "Question" },
      }),
      {
        "x-cuckcode-session": authenticatedAgentSession.sessionId,
        "x-cuckcode-csrf": authenticatedAgentSession.csrfToken,
      },
    );
    expect(damaged.statusCode).toBe(503);
    expect(damaged.json()).toMatchObject({ code: "LOG_DAMAGED" });
    expect(await readFile(logPath, "utf8")).toBe(before);
  });

  it("refuses invalid evidence before requiring a measurable worktree", async () => {
    const app = await start(staffingAndWorkEvents, undefined, dir);
    const afterCreate = await readEventLog(logPath);
    await post(
      app,
      body({
        commandId: "cmd_assign",
        expectedRevision: afterCreate.revision,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    const beforeEvidence = await readEventLog(logPath);
    const response = await post(
      app,
      body({
        commandId: "cmd_bad_evidence",
        expectedRevision: beforeEvidence.revision,
        intent: "work.record_evidence",
        payload: { kind: "tset-run", result: "passed" },
      }),
    );
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: "EVIDENCE_KIND_UNKNOWN" });
    expect((await readEventLog(logPath)).revision).toBe(beforeEvidence.revision);
  });

  it("reports that the live runner is unavailable unless the server is configured", async () => {
    const app = await start();
    const status = await app.inject({ method: "GET", url: "/api/workflow/status", headers });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ available: false, state: "unavailable" });

    const execute = await app.inject({
      method: "POST",
      url: "/api/workflow/execute",
      headers,
      payload: { workItemId: "work_slug" },
    });
    expect(execute.statusCode).toBe(503);
    expect(execute.json()).toMatchObject({ code: "WORKFLOW_RUNNER_UNAVAILABLE" });
  });

  it("starts only an assigned work item and blocks log reads and writes while the child runs", async () => {
    let state: "idle" | "running" = "idle";
    const runner = {
      status: () => ({ available: true, state }),
      start: vi.fn(async () => {
        state = "running";
        return { ok: true as const };
      }),
      waitUntilIdle: async () => undefined,
    };
    const app = await start(staffingAndWorkEvents, runner);

    const premature = await app.inject({
      method: "POST",
      url: "/api/workflow/execute",
      headers,
      payload: { workItemId: "work_slug" },
    });
    expect(premature.statusCode).toBe(409);
    expect(premature.json()).toMatchObject({ code: "WORK_ITEM_NOT_ASSIGNED" });
    expect(runner.start).not.toHaveBeenCalled();

    await post(
      app,
      body({
        commandId: "cmd2",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    const started = await app.inject({
      method: "POST",
      url: "/api/workflow/execute",
      headers,
      payload: { workItemId: "work_slug" },
    });
    expect(started.statusCode).toBe(202);
    expect(started.json()).toMatchObject({ accepted: true });
    expect(runner.start).toHaveBeenCalledWith("work_slug");

    const log = await app.inject({ method: "GET", url: "/api/log", headers });
    expect(log.statusCode).toBe(503);
    expect(log.json()).toMatchObject({ code: "RUNNER_ACTIVE" });
    const command = await post(app, body({ commandId: "cmd3", expectedRevision: 6 }));
    expect(command.statusCode).toBe(423);
    expect(command.json()).toMatchObject({ code: "RUNNER_ACTIVE" });
    const arbitrary = await app.inject({
      method: "POST",
      url: "/api/workflow/execute",
      headers,
      payload: { workItemId: "work_slug", worktree: "C:\\sensitive" },
    });
    expect(arbitrary.statusCode).toBe(400);
    expect(arbitrary.json()).toMatchObject({ code: "WORKFLOW_REQUEST_INVALID" });
  });

  it("serves the log with its revision at /api/log, session-gated", async () => {
    const app = await start();
    const denied = await app.inject({ method: "GET", url: "/api/log", headers: { origin } });
    expect(denied.statusCode).toBe(403);
    const ok = await app.inject({ method: "GET", url: "/api/log", headers });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ revision: 2, truncated: false, problems: [] });
    expect(ok.json().events).toHaveLength(2);
  });

  it("reports the log's revision from /api/session", async () => {
    const app = await start();
    const res = await app.inject({ method: "GET", url: "/api/session", headers: { origin } });
    expect(res.json()).toMatchObject({ revision: 2 });
  });

  it("keeps new work unavailable until the contract-draft provider is separately authorized", async () => {
    const app = await start();
    const res = await post(app, body({}));
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "CONTRACT_DRAFT_UNAVAILABLE" });
    const log = await readEventLog(logPath);
    expect(log.revision).toBe(2);
    expect(replayProject(log.events).work.workItems.work_slug).toBeUndefined();
  });

  it("assigns it: the replayed log then shows state assigned with the assignment bound", async () => {
    const app = await start(staffingAndWorkEvents);
    const res = await post(
      app,
      body({
        commandId: "cmd2",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    expect(res.statusCode).toBe(202);
    const log = await readEventLog(logPath);
    const item = replayProject(log.events).work.workItems.work_slug;
    expect(item).toMatchObject({ state: "assigned" });
    expect(item?.assignment?.roleAssignmentId).toBe("role-assignment_engineer");
    expect(log.revision).toBe(3 + 3);
  });

  it("returns 409 for a stale revision and appends nothing", async () => {
    const app = await start();
    const res = await post(app, body({ expectedRevision: 1 }));
    expect(res.statusCode).toBe(409);
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("keeps invalid and valid create requests disabled without an authorized draft session", async () => {
    const app = await start();
    const res = await post(
      app,
      body({ payload: { contract: { ...contract, acceptanceCriteria: [] } } }),
    );
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "CONTRACT_DRAFT_UNAVAILABLE" });
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("refuses an agent actor with 403 and appends nothing", async () => {
    const app = await start();
    const res = await post(app, body({ actor: { actorType: "agent", actorId: "agent_engineer" } }));
    expect(res.statusCode).toBe(403);
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("refuses an intent that is not a work intent, instead of acknowledging it", async () => {
    const app = await start();
    const res = await post(app, body({ intent: "approve", payload: {} }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: "INTENT_UNSUPPORTED" });
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("refuses without the CSRF token, and refuses a secret in the payload", async () => {
    const app = await start();
    const noCsrf = await app.inject({
      method: "POST",
      url: "/api/commands",
      headers: { origin, "x-cuckcode-session": "session_t" },
      payload: body({}) as never,
    });
    expect(noCsrf.statusCode).toBe(403);
    const secret = await post(
      app,
      body({ payload: { contract: { ...contract, outcome: "use sk-abc123" } } }),
    );
    expect(secret.statusCode).toBe(403);
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("does not create work under concurrent requests without a draft service", async () => {
    const app = await start();
    const [a, b] = await Promise.all([
      post(app, body({ commandId: "cmdA", targetEntityId: "work_a" })),
      post(app, body({ commandId: "cmdB", targetEntityId: "work_b" })),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([503, 503]);
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("reports a truncated log at /api/log and refuses commands with 503, leaving it untouched", async () => {
    const app = await start();
    await writeFile(
      logPath,
      `${JSON.stringify(staffingEvents[0])}\n{"schemaVersion":1,"ev`,
      "utf8",
    );
    const before = await readFile(logPath, "utf8");
    const log = await app.inject({ method: "GET", url: "/api/log", headers });
    expect(log.json()).toMatchObject({ truncated: true });
    const res = await post(app, body({ expectedRevision: 1 }));
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "LOG_DAMAGED" });
    expect(await readFile(logPath, "utf8")).toBe(before);
  });

  it("refuses a complete unreadable event-log line without appending around it", async () => {
    const app = await start();
    await writeFile(logPath, `${JSON.stringify(staffingEvents[0])}\nnot-json\n`, "utf8");
    const before = await readFile(logPath, "utf8");
    const res = await post(app, body({ expectedRevision: 1 }));
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "LOG_DAMAGED" });
    expect(await readFile(logPath, "utf8")).toBe(before);
  });

  it("records owner-run evidence from a surface command; an unknown kind is refused by name", async () => {
    const app = await start(staffingAndWorkEvents);
    await post(
      app,
      body({
        commandId: "cmd2",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    const bad = await post(
      app,
      body({
        commandId: "cmd3",
        expectedRevision: 6,
        intent: "work.record_evidence",
        payload: { kind: "tset-run", result: "passed" },
      }),
    );
    expect(bad.statusCode).toBe(422);
    expect(bad.json()).toMatchObject({ code: "EVIDENCE_KIND_UNKNOWN" });
    expect((await readEventLog(logPath)).revision).toBe(6);
    const forgedDigest = await post(
      app,
      body({
        commandId: "cmd_digest_forged",
        expectedRevision: 6,
        intent: "work.record_evidence",
        payload: { kind: "test-run", result: "passed", worktreeSha256: "b".repeat(64) },
      }),
    );
    expect(forgedDigest.statusCode).toBe(422);
    expect(forgedDigest.json()).toMatchObject({ code: "EVIDENCE_INVALID" });
    expect((await readEventLog(logPath)).revision).toBe(6);
    const good = await post(
      app,
      body({
        commandId: "cmd4",
        expectedRevision: 6,
        intent: "work.record_evidence",
        payload: { kind: "test-run", result: "passed" },
      }),
    );
    expect(good.statusCode).toBe(202);
    const log = await readEventLog(logPath);
    expect(log.revision).toBe(7);
    const evidence = Object.values(replayProject(log.events).work.evidence);
    expect(evidence).toMatchObject([{ kind: "test-run", result: "passed" }]);
    expect(evidence[0]?.worktreeSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("routes an attested ruling through the same command endpoint and log, then confirms by readback", async () => {
    const digest = await measureWorktreeSha256(digestRoot);
    const reviewEvents = [
      {
        schemaVersion: 1,
        eventId: "event_create",
        projectId: "project_alpha",
        workItemId: "work_slug",
        kind: "work.created",
        occurredAt: "2026-10-04T11:59:50.000Z",
        receivedAt: "2026-10-04T11:59:50.000Z",
        source: "manager",
        trust: "verified",
        payload: {
          payloadVersion: 3,
          workItemId: "work_slug",
          outcome: contract.outcome,
          requiredEvidenceKinds: ["test-run"],
          contract,
        },
      },
      ...(["ready", "assigned", "active", "review_requested"] as const).map((toState, index) => {
        const at = new Date(Date.parse("2026-10-04T11:59:51.000Z") + index * 1000).toISOString();
        return {
          schemaVersion: 1,
          eventId: `event_state_${String(index)}`,
          projectId: "project_alpha",
          workItemId: "work_slug",
          kind: "work.transitioned",
          occurredAt: at,
          receivedAt: at,
          source: "manager",
          trust: "verified",
          payload: { workItemId: "work_slug", fromRevision: index, toState },
        };
      }),
      {
        schemaVersion: 1,
        eventId: "event_evidence",
        projectId: "project_alpha",
        workItemId: "work_slug",
        kind: "evidence.recorded",
        occurredAt: "2026-10-04T11:59:55.000Z",
        receivedAt: "2026-10-04T11:59:55.000Z",
        source: "manager",
        trust: "verified",
        payload: {
          evidenceId: "evidence_tests",
          workItemId: "work_slug",
          kind: "test-run",
          version: 1,
          result: "passed",
          worktreeSha256: digest,
        },
      },
    ];
    const app = await start(reviewEvents);
    const forged = await post(
      app,
      body({
        commandId: "cmd_ruling",
        expectedRevision: reviewEvents.length,
        intent: "work.record_ruling",
        payload: {
          decision: "accept",
          evidenceVersions: [{ evidenceId: "evidence_fake", version: 99 }],
        },
      }),
    );
    expect(forged.statusCode).toBe(422);
    expect((await readEventLog(logPath)).revision).toBe(reviewEvents.length);

    const accepted = await post(
      app,
      body({
        commandId: "cmd_ruling",
        expectedRevision: reviewEvents.length,
        intent: "work.record_ruling",
        payload: { decision: "accept" },
      }),
    );
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toMatchObject({
      intent: "record_ruling",
      resultingRevision: reviewEvents.length + 1,
    });
    const readback = await app.inject({ method: "GET", url: "/api/log", headers });
    expect(readback.statusCode).toBe(200);
    expect(readback.json()).toMatchObject({ revision: reviewEvents.length + 1 });
    expect(readback.json().events.at(-1)).toMatchObject({
      kind: "work.ruling_recorded",
      payload: { decision: "accept" },
    });
    expect(replayProject(readback.json().events).work.workItems.work_slug?.state).toBe("verified");
  });

  it("refuses a review request on an item that is not active, by name, and appends nothing", async () => {
    const app = await start(staffingAndWorkEvents);
    await post(
      app,
      body({
        commandId: "cmd2",
        expectedRevision: 3,
        intent: "work.assign",
        payload: { roleAssignmentId: "role-assignment_engineer" },
      }),
    );
    const res = await post(
      app,
      body({ commandId: "cmd3", expectedRevision: 6, intent: "work.request_review", payload: {} }),
    );
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: "WORK_NOT_REVIEWABLE" });
    expect((await readEventLog(logPath)).revision).toBe(6);
    const extra = await post(
      app,
      body({
        commandId: "cmd4",
        expectedRevision: 6,
        intent: "work.request_review",
        payload: { toState: "completed" },
      }),
    );
    expect(extra.statusCode).toBe(422);
    expect(extra.json()).toMatchObject({ code: "COMMAND_INVALID" });
  });

  it("keeps the old validate-only behaviour when no log is configured", async () => {
    const app = createLoopbackApp({
      mode: "test",
      host: "127.0.0.1",
      allowedOrigin: origin,
      projectId: "project_alpha",
      initialRevision: 5,
      sessionId: "session_t",
      csrfToken: "csrf_t",
      readModel: {},
    });
    apps.push(app);
    const res = await post(app, body({ expectedRevision: 5, intent: "approve", payload: {} }));
    expect(res.statusCode).toBe(202);
  });
});
