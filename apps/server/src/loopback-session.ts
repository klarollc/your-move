import websocket from "@fastify/websocket";
import { toWorkCommand, executeWorkCommand } from "@cuckcode/application";
import { validateWorkspaceCommand } from "@cuckcode/contracts";
import Fastify, { type FastifyInstance } from "fastify";

import { appendEventLog, readEventLog } from "./event-log.js";

export type LoopbackApp = FastifyInstance;

type LoopbackMode = "development" | "test" | "production";

type LoopbackAppOptions = {
  mode: LoopbackMode;
  host: string;
  allowedOrigin: string;
  projectId: string;
  initialRevision: number;
  sessionId: string;
  csrfToken: string;
  readModel: unknown;
  eventHistory?: Array<{
    revision: number;
    eventId: string;
    type: string;
    payload: Record<string, unknown>;
  }>;
  fixtureMode?: boolean;
  /** Log mode (W5c): the append-only JSONL event log this server reads and appends to. */
  logPath?: string;
  now?: () => string;
};

export function createLoopbackApp(options: LoopbackAppOptions): LoopbackApp {
  if (options.host !== "127.0.0.1") {
    throw new Error("LOOPBACK_HOST_REQUIRED");
  }
  if (options.mode === "production" && options.fixtureMode === true) {
    throw new Error("PRODUCTION_FIXTURE_MODE_FORBIDDEN");
  }

  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/") && request.headers.origin !== options.allowedOrigin) {
      await reply.code(403).send({ code: "ORIGIN_REJECTED" });
    }
  });

  app.register(websocket);
  app.register(async (instance) => {
    instance.get(
      "/api/events",
      {
        websocket: true,
        preValidation: async (request, reply) => {
          if (request.headers["x-cuckcode-session"] !== options.sessionId) {
            await reply.code(403).send({ code: "SESSION_REJECTED" });
          }
        },
      },
      (socket, request) => {
        const sinceRevision = Number(
          new URL(request.url, "http://127.0.0.1").searchParams.get("sinceRevision"),
        );
        const history = options.eventHistory ?? [];
        for (const event of history) {
          if (Number.isInteger(sinceRevision) && event.revision > sinceRevision) {
            socket.send(JSON.stringify(event));
          }
        }
      },
    );
  });

  app.get("/api/session", async () => ({
    sessionId: options.sessionId,
    csrfToken: options.csrfToken,
    projectId: options.projectId,
    revision: options.logPath
      ? (await readEventLog(options.logPath)).revision
      : options.initialRevision,
  }));

  // Log mode (W5c): the append-only event log is the source of truth. The surface replays and
  // projects it itself with the same pure code the office uses, so no read model is chosen here.
  app.get("/api/log", async (request, reply) => {
    if (request.headers["x-cuckcode-session"] !== options.sessionId) {
      return reply.code(403).send({ code: "SESSION_REJECTED" });
    }
    if (!options.logPath) return reply.code(404).send({ code: "LOG_NOT_CONFIGURED" });
    const log = await readEventLog(options.logPath);
    return reply.code(200).send({
      revision: log.revision,
      events: log.events,
      truncated: log.truncated,
      problems: log.problems,
    });
  });

  app.get("/api/workspace", async (request, reply) => {
    if (request.headers["x-cuckcode-session"] !== options.sessionId) {
      return reply.code(403).send({ code: "SESSION_REJECTED" });
    }
    return reply.code(200).send(options.readModel);
  });

  app.post("/api/commands", async (request, reply) => {
    if (
      request.headers["x-cuckcode-session"] !== options.sessionId ||
      request.headers["x-cuckcode-csrf"] !== options.csrfToken
    ) {
      return reply.code(403).send({ code: "SESSION_OR_CSRF_REJECTED" });
    }

    const logPath = options.logPath;
    const log = logPath ? await readEventLog(logPath) : undefined;
    const result = validateWorkspaceCommand(request.body, {
      projectId: options.projectId,
      revision: log ? log.revision : options.initialRevision,
    });
    if (!result.ok) {
      if (result.code === "WORKSPACE_COMMAND_STALE") {
        return reply.code(409).send({
          code: result.code,
          retrySafe: true,
          requiredAction: "Refresh the workspace read model before retrying.",
        });
      }
      const statusCode =
        result.code === "WORKSPACE_PROJECT_MISMATCH" ||
        result.code === "WORKSPACE_COMMAND_SECRET" ||
        result.code === "WORKSPACE_AUTHORITY_INVALID"
          ? 403
          : 400;
      return reply.code(statusCode).send({ code: result.code });
    }

    if (logPath && log) {
      if (log.truncated || log.problems.length > 0) {
        return reply
          .code(503)
          .send({ code: "LOG_DAMAGED", detail: "the event log has unreadable records" });
      }
      const mapped = toWorkCommand(result.value);
      if (!mapped.ok) return reply.code(422).send({ code: mapped.code, issues: mapped.issues });
      const outcome = executeWorkCommand({
        log: log.events,
        currentRevision: log.revision,
        now: (options.now ?? (() => new Date().toISOString()))(),
        command: mapped.value,
      });
      if (!outcome.ok) {
        const status =
          outcome.code === "STALE_REVISION" ? 409 : outcome.code === "NOT_AUTHORIZED" ? 403 : 422;
        return reply.code(status).send({ code: outcome.code, issues: outcome.issues });
      }
      const appended = await appendEventLog(logPath, outcome.events, log.revision);
      if (!appended.ok) {
        const status =
          appended.code === "STALE_REVISION" ? 409 : appended.code === "LOG_DAMAGED" ? 503 : 422;
        return reply.code(status).send({ code: appended.code, detail: appended.detail });
      }
      return reply.code(202).send(outcome.receipt);
    }

    return reply.code(202).send({
      receiptId: `receipt_${result.value.commandId}`,
      commandId: result.value.commandId,
      acceptedRevision: options.initialRevision,
    });
  });

  return app;
}
