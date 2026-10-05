import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createContractDraftService,
  type ContractDraftSessionAdapter,
} from "./contract-draft-service.js";
import { readEventLog } from "./event-log.js";
import { createLoopbackApp, type LoopbackApp } from "./loopback-session.js";

const origin = "http://127.0.0.1:4173";
const headers = {
  origin,
  "x-cuckcode-session": "session_manager",
  "x-cuckcode-csrf": "csrf_manager",
};
const NOW = "2026-10-05T13:00:00.000Z";
const staffingEvents = [
  {
    schemaVersion: 1,
    eventId: "event_agent_registered",
    projectId: "project_alpha",
    kind: "agent.registered",
    occurredAt: NOW,
    receivedAt: NOW,
    source: "system",
    trust: "verified",
    payload: { agentId: "agent_engineer", capabilities: ["engineer"], health: "connected" },
  },
  {
    schemaVersion: 1,
    eventId: "event_role_assigned",
    projectId: "project_alpha",
    kind: "role.assigned",
    occurredAt: NOW,
    receivedAt: NOW,
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
const candidate = {
  outcome: "Implement slugify",
  exclusions: ["Do not change unrelated routes"],
  acceptanceCriteria: ["slugify.test.ts passes"],
  dependencies: [],
  evidenceObligations: [{ kind: "test-run", description: "Run the focused test" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["Stop if the focused test fails"],
  definitionOfDone: "The test passes and the diff is reviewed",
  contextRefs: [],
  maxTurns: 3,
};

let dir = "";
let logPath = "";
let app: LoopbackApp | undefined;
let adapter: ContractDraftSessionAdapter;
let capture: ReturnType<typeof vi.fn>;

const makeAdapter = (): ContractDraftSessionAdapter => ({
  kind: "test-fake",
  capture: (capture = vi.fn(async () => ({
    providerSessionId: "provider_session_test",
    providerTurnId: "provider_turn_test",
    status: "completed" as const,
    assistantText: JSON.stringify(candidate),
  }))),
});

const start = async (withDraftService = true, mode: "test" | "production" = "test") => {
  await writeFile(logPath, staffingEvents.map((event) => `${JSON.stringify(event)}\n`).join(""));
  adapter = makeAdapter();
  const service = withDraftService
    ? createContractDraftService({
        mode: "test",
        adapter,
        now: () => NOW,
        createId: (() => {
          let next = 0;
          return () => `draft_test_${++next}`;
        })(),
      })
    : undefined;
  app = createLoopbackApp({
    mode,
    host: "127.0.0.1",
    allowedOrigin: origin,
    projectId: "project_alpha",
    initialRevision: 0,
    sessionId: "session_manager",
    csrfToken: "csrf_manager",
    managerActorId: "manager_nate",
    readModel: {},
    logPath,
    now: () => NOW,
    ...(service ? { contractDraftService: service } : {}),
  });
  return app;
};

const draft = async (application: LoopbackApp, payload: unknown, requestHeaders = headers) =>
  await application.inject({
    method: "POST",
    url: "/api/contract-drafts",
    headers: requestHeaders,
    payload: payload as never,
  });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-contract-draft-api-"));
  logPath = join(dir, "events.jsonl");
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true });
});

describe("contract draft loopback boundary", () => {
  it("authenticates the manager and keeps a test draft transient in the shared event log", async () => {
    const application = await start();
    const before = await readEventLog(logPath);
    const response = await draft(application, {
      expectedRevision: before.revision,
      description: "Implement slugify with one focused test.",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      candidate,
      testOnly: true,
      source: "test-fake",
      provenance: {
        providerSessionId: "provider_session_test",
        providerTurnId: "provider_turn_test",
      },
    });
    expect(response.json().receiptHandle).toMatch(/^draft-receipt_/u);
    expect((await readEventLog(logPath)).revision).toBe(before.revision);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("rejects browser supplied provenance, candidate, receipt, or alternate request fields", async () => {
    const application = await start();
    const response = await draft(application, {
      expectedRevision: 2,
      description: "Use my candidate.",
      candidate,
      provenance: { model: "gpt-6.1-sol", trust: "verified" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "CONTRACT_DRAFT_REQUEST_INVALID" });
    expect(capture).not.toHaveBeenCalled();
    expect((await readEventLog(logPath)).revision).toBe(2);
  });

  it("requires the authenticated manager session and CSRF token", async () => {
    const application = await start();
    const response = await draft(
      application,
      { expectedRevision: 2, description: "Make a draft." },
      { origin, "x-cuckcode-session": "forged", "x-cuckcode-csrf": "forged" },
    );

    expect(response.statusCode).toBe(403);
    expect(capture).not.toHaveBeenCalled();
  });

  it("checks the live log revision before invoking the session adapter", async () => {
    const application = await start();
    const response = await draft(application, {
      expectedRevision: 1,
      description: "Make a draft.",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "WORKSPACE_COMMAND_STALE" });
    expect(capture).not.toHaveBeenCalled();
  });

  it("fails closed when the shared log is damaged", async () => {
    const application = await start();
    const damagedText = `${JSON.stringify(staffingEvents[0])}\nnot-json\n`;
    await writeFile(logPath, damagedText);
    const response = await draft(application, { expectedRevision: 1, description: "Draft." });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "LOG_DAMAGED" });
    expect(await readFile(logPath, "utf8")).toBe(damagedText);
    expect(capture).not.toHaveBeenCalled();
  });

  it("cannot use a structurally isolated test receipt for a production work.created command", async () => {
    const application = await start();
    const draftResponse = await draft(application, {
      expectedRevision: 2,
      description: "Implement slugify with one focused test.",
    });
    const receiptHandle = draftResponse.json().receiptHandle as string;
    const before = await readEventLog(logPath);
    const response = await application.inject({
      method: "POST",
      url: "/api/commands",
      headers,
      payload: {
        schemaVersion: 1,
        commandId: "create_from_test_fake",
        projectId: "project_alpha",
        expectedRevision: before.revision,
        actor: { actorType: "manager", actorId: "browser_forged_manager" },
        intent: "work.create",
        targetEntityId: "work_fake",
        payload: { contract: candidate },
        draftReceiptHandle: receiptHandle,
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: "CONTRACT_DRAFT_RECEIPT_SOURCE" });
    expect((await readEventLog(logPath)).revision).toBe(before.revision);
    expect((await readEventLog(logPath)).events).toHaveLength(2);
  });

  it("rejects browser supplied draft provenance on the existing command path", async () => {
    const application = await start();
    const draftResponse = await draft(application, {
      expectedRevision: 2,
      description: "Implement slugify with one focused test.",
    });
    const before = await readEventLog(logPath);
    const response = await application.inject({
      method: "POST",
      url: "/api/commands",
      headers,
      payload: {
        schemaVersion: 1,
        commandId: "create_with_browser_provenance",
        projectId: "project_alpha",
        expectedRevision: before.revision,
        actor: { actorType: "manager", actorId: "browser_forged_manager" },
        intent: "work.create",
        targetEntityId: "work_fake",
        payload: {
          contract: candidate,
          contractDraft: draftResponse.json().provenance,
        },
        draftReceiptHandle: draftResponse.json().receiptHandle,
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: "COMMAND_INVALID" });
    expect((await readEventLog(logPath)).revision).toBe(before.revision);
  });

  it("refuses stale and unknown receipt handles without changing the event log", async () => {
    const application = await start();
    const draftResponse = await draft(application, {
      expectedRevision: 2,
      description: "Implement slugify with one focused test.",
    });
    const receiptHandle = draftResponse.json().receiptHandle as string;
    const staleWorkCreated = {
      schemaVersion: 1,
      eventId: "event_newer_work",
      projectId: "project_alpha",
      workItemId: "work_already_created",
      kind: "work.created",
      occurredAt: NOW,
      receivedAt: NOW,
      source: "manager",
      trust: "verified",
      actor: { actorType: "manager", actorId: "manager_nate" },
      payload: {
        payloadVersion: 3,
        workItemId: "work_already_created",
        outcome: "Existing work",
        requiredEvidenceKinds: ["test-run"],
        contract: candidate,
      },
    };
    await writeFile(
      logPath,
      `${staffingEvents.map((event) => `${JSON.stringify(event)}\n`).join("")}${JSON.stringify(staleWorkCreated)}\n`,
    );

    const stale = await application.inject({
      method: "POST",
      url: "/api/commands",
      headers,
      payload: {
        schemaVersion: 1,
        commandId: "create_stale_draft",
        projectId: "project_alpha",
        expectedRevision: 3,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "work.create",
        targetEntityId: "work_from_old_draft",
        payload: { contract: candidate },
        draftReceiptHandle: receiptHandle,
      },
    });
    expect(stale.statusCode).toBe(422);
    expect(stale.json()).toMatchObject({ code: "CONTRACT_DRAFT_RECEIPT_INVALID" });

    const unknown = await application.inject({
      method: "POST",
      url: "/api/commands",
      headers,
      payload: {
        schemaVersion: 1,
        commandId: "create_unknown_draft",
        projectId: "project_alpha",
        expectedRevision: 3,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "work.create",
        targetEntityId: "work_without_draft",
        payload: { contract: candidate },
        draftReceiptHandle: "draft-receipt_forged",
      },
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json()).toMatchObject({ code: "CONTRACT_DRAFT_RECEIPT_INVALID" });
    expect((await readEventLog(logPath)).revision).toBe(3);
  });

  it("keeps create unavailable when no separately authorized draft service is installed", async () => {
    const application = await start(false);
    const before = await readEventLog(logPath);
    const response = await draft(application, {
      expectedRevision: before.revision,
      description: "Make a contract.",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "CONTRACT_DRAFT_UNAVAILABLE" });
    expect((await readEventLog(logPath)).revision).toBe(before.revision);
  });

  it("never serves a test-only candidate from a production loopback app", async () => {
    const application = await start(true, "production");
    const before = await readEventLog(logPath);
    const response = await draft(application, {
      expectedRevision: before.revision,
      description: "Make a contract.",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "CONTRACT_DRAFT_NOT_AUTHORIZED" });
    expect((await readEventLog(logPath)).revision).toBe(before.revision);
  });
});
