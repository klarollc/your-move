import { validateWorkspaceCommand } from "@cuckcode/contracts";
import Fastify, { type FastifyInstance } from "fastify";

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
  fixtureMode?: boolean;
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

  app.get("/api/session", async () => ({
    sessionId: options.sessionId,
    csrfToken: options.csrfToken,
    projectId: options.projectId,
    revision: options.initialRevision,
  }));

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

    const result = validateWorkspaceCommand(request.body, {
      projectId: options.projectId,
      revision: options.initialRevision,
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

    return reply.code(202).send({
      receiptId: `receipt_${result.value.commandId}`,
      commandId: result.value.commandId,
      acceptedRevision: options.initialRevision,
    });
  });

  return app;
}
