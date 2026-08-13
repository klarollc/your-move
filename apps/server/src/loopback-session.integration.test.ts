import { afterEach, describe, expect, it } from "vitest";

import { createLoopbackApp, type LoopbackApp } from "./loopback-session.js";

const allowedOrigin = "http://127.0.0.1:4173";
const apps: LoopbackApp[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createApp(
  eventHistory: Array<{
    revision: number;
    eventId: string;
    type: string;
    payload: Record<string, unknown>;
  }> = [],
) {
  const app = createLoopbackApp({
    mode: "test",
    host: "127.0.0.1",
    allowedOrigin,
    projectId: "project_fixture",
    initialRevision: 7,
    sessionId: "session_fixture",
    csrfToken: "csrf_fixture",
    readModel: { schemaVersion: 1, projectId: "project_fixture", revision: 7 },
    eventHistory,
  });
  apps.push(app);
  return app;
}

describe("loopback session boundary", () => {
  it("bootstraps an ephemeral session only for the exact allowed origin", async () => {
    const app = createApp();
    const accepted = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { origin: allowedOrigin },
    });
    const rejected = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { origin: "http://localhost:4173" },
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({
      sessionId: "session_fixture",
      csrfToken: "csrf_fixture",
      projectId: "project_fixture",
      revision: 7,
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toEqual({ code: "ORIGIN_REJECTED" });
  });

  it("requires the session and CSRF values on mutation without accepting them in the URL", async () => {
    const app = createApp();
    const command = {
      schemaVersion: 1,
      commandId: "command_select",
      projectId: "project_fixture",
      expectedRevision: 7,
      actor: { actorType: "manager", actorId: "manager_owner" },
      intent: "select_entity",
      targetEntityId: "agent_delivery",
      payload: {},
    };
    const missing = await app.inject({
      method: "POST",
      url: "/api/commands?csrfToken=csrf_fixture",
      headers: { origin: allowedOrigin },
      payload: command,
    });
    const accepted = await app.inject({
      method: "POST",
      url: "/api/commands",
      headers: {
        origin: allowedOrigin,
        "x-cuckcode-session": "session_fixture",
        "x-cuckcode-csrf": "csrf_fixture",
      },
      payload: command,
    });

    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toEqual({ code: "SESSION_OR_CSRF_REJECTED" });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toEqual({
      receiptId: "receipt_command_select",
      commandId: "command_select",
      acceptedRevision: 7,
    });
  });

  it("serves the current read model only to the active session", async () => {
    const app = createApp();
    const missing = await app.inject({
      method: "GET",
      url: "/api/workspace",
      headers: { origin: allowedOrigin },
    });
    const accepted = await app.inject({
      method: "GET",
      url: "/api/workspace",
      headers: {
        origin: allowedOrigin,
        "x-cuckcode-session": "session_fixture",
      },
    });

    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toEqual({ code: "SESSION_REJECTED" });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({
      schemaVersion: 1,
      projectId: "project_fixture",
      revision: 7,
    });
  });

  it("returns actionable stale and cross-project command failures", async () => {
    const app = createApp();
    const base = {
      schemaVersion: 1,
      commandId: "command_fixture",
      projectId: "project_fixture",
      expectedRevision: 7,
      actor: { actorType: "manager", actorId: "manager_owner" },
      intent: "select_entity",
      targetEntityId: "agent_delivery",
      payload: {},
    };
    const headers = {
      origin: allowedOrigin,
      "x-cuckcode-session": "session_fixture",
      "x-cuckcode-csrf": "csrf_fixture",
    };
    const stale = await app.inject({
      method: "POST",
      url: "/api/commands",
      headers,
      payload: { ...base, expectedRevision: 6 },
    });
    const crossProject = await app.inject({
      method: "POST",
      url: "/api/commands",
      headers,
      payload: { ...base, projectId: "project_other" },
    });

    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      code: "WORKSPACE_COMMAND_STALE",
      retrySafe: true,
      requiredAction: "Refresh the workspace read model before retrying.",
    });
    expect(crossProject.statusCode).toBe(403);
    expect(crossProject.json()).toMatchObject({ code: "WORKSPACE_PROJECT_MISMATCH" });
  });

  it("replays events after the persisted revision and rejects an unknown session", async () => {
    const app = createApp([
      {
        revision: 7,
        eventId: "event_revision_7",
        type: "workspace.updated",
        payload: { entityId: "agent_delivery" },
      },
    ]);
    await app.ready();

    let resolveMessage: (message: string) => void = () => undefined;
    const messagePromise = new Promise<string>((resolve) => {
      resolveMessage = resolve;
    });
    const socket = await app.injectWS(
      "/api/events?sinceRevision=6",
      {
        headers: {
          origin: allowedOrigin,
          "x-cuckcode-session": "session_fixture",
        },
      },
      {
        onInit: (client) => {
          client.once("message", (data) => resolveMessage(data.toString()));
        },
      },
    );
    const message = await messagePromise;

    expect(JSON.parse(message)).toEqual({
      revision: 7,
      eventId: "event_revision_7",
      type: "workspace.updated",
      payload: { entityId: "agent_delivery" },
    });
    socket.close();

    await expect(
      app.injectWS("/api/events?sinceRevision=6", {
        headers: {
          origin: allowedOrigin,
          "x-cuckcode-session": "session_other",
        },
      }),
    ).rejects.toThrow();
  });

  it("refuses construction for a non-loopback host", () => {
    expect(() =>
      createLoopbackApp({
        mode: "test",
        host: "0.0.0.0",
        allowedOrigin,
        projectId: "project_fixture",
        initialRevision: 7,
        sessionId: "session_fixture",
        csrfToken: "csrf_fixture",
        readModel: { schemaVersion: 1, projectId: "project_fixture", revision: 7 },
      }),
    ).toThrow("LOOPBACK_HOST_REQUIRED");
  });

  it("rejects fixture mode in production", () => {
    expect(() =>
      createLoopbackApp({
        mode: "production",
        host: "127.0.0.1",
        allowedOrigin,
        projectId: "project_fixture",
        initialRevision: 7,
        sessionId: "session_fixture",
        csrfToken: "csrf_fixture",
        readModel: { schemaVersion: 1, projectId: "project_fixture", revision: 7 },
        fixtureMode: true,
      }),
    ).toThrow("PRODUCTION_FIXTURE_MODE_FORBIDDEN");
  });
});
