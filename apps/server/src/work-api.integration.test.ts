import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { replayProject } from "@cuckcode/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEventLog } from "./event-log.js";
import { createLoopbackApp, type LoopbackApp } from "./loopback-session.js";

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
};

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
const apps: LoopbackApp[] = [];
const start = async (events: readonly unknown[] = staffingEvents) => {
  await writeFile(logPath, events.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
  const app = createLoopbackApp({
    mode: "test",
    host: "127.0.0.1",
    allowedOrigin: origin,
    projectId: "project_alpha",
    initialRevision: 0,
    sessionId: "session_t",
    csrfToken: "csrf_t",
    readModel: {},
    logPath,
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
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await rm(dir, { recursive: true, force: true });
});

describe("work API in log mode", () => {
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

  it("creates a work item from a surface command, appends it, and returns a receipt", async () => {
    const app = await start();
    const res = await post(app, body({}));
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({
      receiptId: "receipt_cmd1",
      commandId: "cmd1",
      acceptedRevision: 2,
      resultingRevision: 3,
    });
    const log = await readEventLog(logPath);
    expect(log.revision).toBe(3);
    const state = replayProject(log.events).work;
    expect(state.workItems.work_slug).toMatchObject({ state: "draft" });
  });

  it("assigns it: the replayed log then shows state assigned with the assignment bound", async () => {
    const app = await start();
    await post(app, body({}));
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

  it("returns 422 naming the field for an invalid contract, and appends nothing", async () => {
    const app = await start();
    const res = await post(
      app,
      body({ payload: { contract: { ...contract, acceptanceCriteria: [] } } }),
    );
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: "CONTRACT_INVALID" });
    expect(JSON.stringify(res.json())).toContain("acceptanceCriteria");
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

  it("lets only one of two simultaneous commands at the same revision succeed", async () => {
    const app = await start();
    const [a, b] = await Promise.all([
      post(app, body({ commandId: "cmdA", targetEntityId: "work_a" })),
      post(app, body({ commandId: "cmdB", targetEntityId: "work_b" })),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([202, 409]);
    expect((await readEventLog(logPath)).revision).toBe(3);
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

  it("records owner-run evidence from a surface command; an unknown kind is refused by name", async () => {
    const app = await start();
    await post(app, body({}));
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
  });

  it("refuses a review request on an item that is not active, by name, and appends nothing", async () => {
    const app = await start();
    await post(app, body({}));
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
