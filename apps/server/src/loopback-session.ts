import websocket from "@fastify/websocket";
import { toWorkCommand, executeWorkCommand } from "@cuckcode/application";
import { validateWorkspaceCommand } from "@cuckcode/contracts";
import { replayProject } from "@cuckcode/domain";
import Fastify, { type FastifyInstance } from "fastify";

import { appendEventLog, readEventLog } from "./event-log.js";
import type { ContractDraftService } from "./contract-draft-service.js";
import type { WorkflowRunnerControl } from "./workflow-runner.js";
import { measureWorktreeSha256 } from "./worktree-digest.js";

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
  /** Manager identity comes from the authenticated local session, never from a command body. */
  managerActorId?: string;
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
  /** Trusted project checkout root used for server-measured evidence and final review digests. */
  worktreeRoot?: string;
  /**
   * Server-issued runner/session binding for agent speech acts. Credentials and principal are
   * created by the trusted runner/session adapter; neither identity field comes from a request.
   */
  authenticatedAgentSession?: Readonly<{
    sessionId: string;
    csrfToken: string;
    principal: Readonly<{ agentId: string; roleAssignmentId: string }>;
  }>;
  runner?: WorkflowRunnerControl;
  /** Omitted until the separate live-provider authorization is granted. */
  contractDraftService?: ContractDraftService;
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
  const runnerStatus = () =>
    options.runner?.status() ?? { available: false, state: "unavailable" as const };
  const runnerBusy = () =>
    ["starting", "running", "recovery_required"].includes(runnerStatus().state);

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
    revision:
      options.logPath && !runnerBusy()
        ? (await readEventLog(options.logPath)).revision
        : options.initialRevision,
    runner: runnerStatus(),
    contractDraftingAvailable: options.contractDraftService?.available === true,
  }));

  app.get("/api/workflow/status", async (request, reply) => {
    if (request.headers["x-cuckcode-session"] !== options.sessionId) {
      return reply.code(403).send({ code: "SESSION_REJECTED" });
    }
    return reply.code(200).send(runnerStatus());
  });

  app.post("/api/workflow/execute", async (request, reply) => {
    if (
      request.headers["x-cuckcode-session"] !== options.sessionId ||
      request.headers["x-cuckcode-csrf"] !== options.csrfToken
    ) {
      return reply.code(403).send({ code: "SESSION_OR_CSRF_REJECTED" });
    }
    const payload = request.body;
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload) ||
      Object.keys(payload).length !== 1 ||
      typeof (payload as Record<string, unknown>).workItemId !== "string" ||
      !/^work_[A-Za-z0-9][A-Za-z0-9._-]*$/u.test((payload as { workItemId: string }).workItemId)
    ) {
      return reply.code(400).send({ code: "WORKFLOW_REQUEST_INVALID" });
    }
    const workItemId = (payload as { workItemId: string }).workItemId;
    const control = options.runner;
    if (!control || !runnerStatus().available) {
      return reply.code(503).send({ code: "WORKFLOW_RUNNER_UNAVAILABLE" });
    }
    if (runnerBusy()) return reply.code(409).send({ code: "RUNNER_ALREADY_ACTIVE" });
    if (!options.logPath) return reply.code(503).send({ code: "LOG_NOT_CONFIGURED" });

    const log = await readEventLog(options.logPath);
    if (log.truncated || log.problems.length > 0) {
      return reply.code(503).send({ code: "LOG_DAMAGED" });
    }
    const snapshot = replayProject(log.events);
    const workItem = snapshot.work.workItems[workItemId];
    if (!workItem) return reply.code(404).send({ code: "WORK_ITEM_NOT_FOUND" });
    if (workItem.state !== "assigned" || !workItem.contract) {
      return reply.code(409).send({ code: "WORK_ITEM_NOT_ASSIGNED" });
    }

    const started = await control.start(workItemId);
    if (!started.ok) {
      const status = started.code === "RUNNER_ALREADY_ACTIVE" ? 409 : 503;
      return reply.code(status).send({ code: started.code });
    }
    return reply.code(202).send({ accepted: true, workItemId, runner: runnerStatus() });
  });

  // Log mode (W5c): the append-only event log is the source of truth. The surface replays and
  // projects it itself with the same pure code the office uses, so no read model is chosen here.
  app.get("/api/log", async (request, reply) => {
    if (request.headers["x-cuckcode-session"] !== options.sessionId) {
      return reply.code(403).send({ code: "SESSION_REJECTED" });
    }
    if (!options.logPath) return reply.code(404).send({ code: "LOG_NOT_CONFIGURED" });
    if (runnerBusy()) return reply.code(503).send({ code: "RUNNER_ACTIVE" });
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

  app.post("/api/contract-drafts", async (request, reply) => {
    if (
      request.headers["x-cuckcode-session"] !== options.sessionId ||
      request.headers["x-cuckcode-csrf"] !== options.csrfToken
    ) {
      return reply.code(403).send({ code: "SESSION_OR_CSRF_REJECTED" });
    }
    if (runnerBusy()) return reply.code(423).send({ code: "RUNNER_ACTIVE" });
    if (!options.logPath) {
      return reply.code(503).send({
        code: "LOG_NOT_CONFIGURED",
        detail: "Contract drafts require the shared project log.",
      });
    }
    if (!options.contractDraftService) {
      return reply.code(503).send({
        code: "CONTRACT_DRAFT_UNAVAILABLE",
        detail: "Agent contract drafting is unavailable until its provider session is authorized.",
      });
    }
    if (!options.contractDraftService.available && options.mode !== "test") {
      return reply.code(503).send({
        code: "CONTRACT_DRAFT_NOT_AUTHORIZED",
        detail: "Live agent drafting has not been separately authorized. No draft was created.",
      });
    }

    const body = request.body;
    const allowedKeys = new Set(["expectedRevision", "description"]);
    if (
      !isRecord(body) ||
      Object.keys(body).some((key) => !allowedKeys.has(key)) ||
      !Number.isSafeInteger(body.expectedRevision) ||
      typeof body.description !== "string" ||
      body.description.trim().length === 0
    ) {
      return reply.code(400).send({ code: "CONTRACT_DRAFT_REQUEST_INVALID" });
    }

    const log = await readEventLog(options.logPath);
    if (log.truncated || log.problems.length > 0) {
      return reply.code(503).send({ code: "LOG_DAMAGED" });
    }
    if (body.expectedRevision !== log.revision) {
      return reply.code(409).send({ code: "WORKSPACE_COMMAND_STALE" });
    }

    const result = await options.contractDraftService.create({
      managerSessionId: options.sessionId,
      projectId: options.projectId,
      expectedRevision: log.revision,
      description: body.description,
    });
    if (!result.ok) {
      return reply.code(503).send({ code: result.code, detail: result.detail });
    }
    if (options.mode === "production" && result.testOnly) {
      options.contractDraftService.discard(result.receiptHandle);
      return reply.code(503).send({
        code: "CONTRACT_DRAFT_TEST_SOURCE_FORBIDDEN",
        detail: "A test draft source cannot be used by the production surface.",
      });
    }
    return reply.code(200).send(result);
  });

  app.post("/api/commands", async (request, reply) => {
    const requestSessionId = request.headers["x-cuckcode-session"];
    const requestCsrfToken = request.headers["x-cuckcode-csrf"];
    const isManagerSession =
      requestSessionId === options.sessionId && requestCsrfToken === options.csrfToken;
    const agentSession = options.authenticatedAgentSession;
    const isAuthenticatedAgentSession =
      agentSession !== undefined &&
      requestSessionId === agentSession.sessionId &&
      requestCsrfToken === agentSession.csrfToken;
    if (!isManagerSession && !isAuthenticatedAgentSession) {
      return reply.code(403).send({ code: "SESSION_OR_CSRF_REJECTED" });
    }
    if (runnerBusy()) return reply.code(423).send({ code: "RUNNER_ACTIVE" });

    const body = request.body;
    const allowedCommandKeys = new Set([
      "schemaVersion",
      "commandId",
      "projectId",
      "expectedRevision",
      "actor",
      "intent",
      "targetEntityId",
      "payload",
      "draftReceiptHandle",
    ]);
    if (isRecord(body) && Object.keys(body).some((key) => !allowedCommandKeys.has(key))) {
      return reply.code(400).send({ code: "WORKSPACE_COMMAND_INVALID" });
    }
    const requestedActorType =
      isRecord(body) && isRecord(body.actor) ? body.actor.actorType : undefined;
    if (isManagerSession && requestedActorType !== "manager") {
      return reply.code(403).send({ code: "WORKSPACE_AUTHORITY_INVALID" });
    }
    const requestedIntent = isRecord(body) ? body.intent : undefined;
    if (requestedIntent !== "work.create" && isRecord(body) && "draftReceiptHandle" in body) {
      return reply.code(400).send({ code: "WORKSPACE_COMMAND_INVALID" });
    }
    const agentSpeechIntent =
      requestedIntent === "work.ask_question" ||
      requestedIntent === "work.propose_rescope" ||
      requestedIntent === "work.dispute_send_back";
    if (isAuthenticatedAgentSession !== agentSpeechIntent) {
      return reply.code(403).send({ code: "WORKSPACE_AUTHORITY_INVALID" });
    }
    // The browser may include a stale or forged actor field. For an authenticated agent session,
    // replace it from server-held session context before workspace validation and command mapping.
    const commandInput = isRecord(body)
      ? {
          ...body,
          actor: isAuthenticatedAgentSession
            ? {
                actorType: "agent",
                actorId: agentSession.principal.agentId,
              }
            : { actorType: "manager", actorId: options.managerActorId ?? "manager_local" },
        }
      : body;

    const logPath = options.logPath;
    const log = logPath ? await readEventLog(logPath) : undefined;
    const result = validateWorkspaceCommand(commandInput, {
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
      let worktreeSha256: string | undefined;
      const needsDigest =
        mapped.value.intent === "record_evidence" ||
        (mapped.value.intent === "record_ruling" && mapped.value.ruling?.decision === "accept");
      const commandNow = (options.now ?? (() => new Date().toISOString()))();
      const draftReceiptHandle = isRecord(body) ? body.draftReceiptHandle : undefined;
      const suppliedDraftReceipt = isRecord(body) && "draftReceiptHandle" in body;
      if (
        mapped.value.intent === "create" &&
        suppliedDraftReceipt &&
        typeof draftReceiptHandle !== "string"
      ) {
        return reply.code(422).send({ code: "CONTRACT_DRAFT_RECEIPT_INVALID" });
      }
      if (
        mapped.value.intent === "create" &&
        typeof draftReceiptHandle === "string" &&
        !options.contractDraftService
      ) {
        return reply.code(422).send({ code: "CONTRACT_DRAFT_RECEIPT_INVALID" });
      }
      const draftReceipt =
        mapped.value.intent === "create" &&
        typeof draftReceiptHandle === "string" &&
        options.contractDraftService
          ? options.contractDraftService.resolveForCommand(draftReceiptHandle, {
              managerSessionId: options.sessionId,
              projectId: options.projectId,
              expectedRevision: log.revision,
            })
          : undefined;
      if (mapped.value.intent === "create" && suppliedDraftReceipt && !draftReceipt) {
        return reply.code(422).send({ code: "CONTRACT_DRAFT_RECEIPT_INVALID" });
      }
      const trustedContext = {
        ...(isAuthenticatedAgentSession ? { authenticatedAgent: agentSession!.principal } : {}),
        ...(isManagerSession ? { authenticatedManagerSessionId: options.sessionId } : {}),
        ...(draftReceipt ? { contractDraftReceipt: draftReceipt as never } : {}),
      };
      let outcome = executeWorkCommand({
        log: log.events,
        currentRevision: log.revision,
        now: commandNow,
        command: mapped.value,
        trustedContext,
      });
      // Validate the command before walking the worktree. Invalid evidence, stale revisions, and
      // unsupported rulings should fail on their own terms without requiring a digest collector.
      if (needsDigest && (outcome.ok || outcome.code === "WORKTREE_DIGEST_MISSING")) {
        try {
          worktreeSha256 = await measureWorktreeSha256(options.worktreeRoot ?? process.cwd());
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : "worktree digest could not be measured";
          return reply.code(503).send({ code: "WORKTREE_DIGEST_UNAVAILABLE", detail });
        }
        outcome = executeWorkCommand({
          log: log.events,
          currentRevision: log.revision,
          now: commandNow,
          command: mapped.value,
          trustedContext: {
            ...trustedContext,
            worktreeSha256,
          },
        });
      }
      if (!outcome.ok) {
        if (mapped.value.intent === "create" && typeof draftReceiptHandle === "string") {
          options.contractDraftService?.discard(draftReceiptHandle);
        }
        const status =
          outcome.code === "STALE_REVISION" ? 409 : outcome.code === "NOT_AUTHORIZED" ? 403 : 422;
        return reply.code(status).send({ code: outcome.code, issues: outcome.issues });
      }
      const appended = await appendEventLog(logPath, outcome.events, log.revision);
      if (!appended.ok) {
        if (mapped.value.intent === "create" && typeof draftReceiptHandle === "string") {
          options.contractDraftService?.discard(draftReceiptHandle);
        }
        const status =
          appended.code === "STALE_REVISION" ? 409 : appended.code === "LOG_DAMAGED" ? 503 : 422;
        return reply.code(status).send({ code: appended.code, detail: appended.detail });
      }
      if (mapped.value.intent === "create" && typeof draftReceiptHandle === "string") {
        options.contractDraftService?.consume(draftReceiptHandle);
      }
      const readback = await readEventLog(logPath);
      if (
        readback.truncated ||
        readback.problems.length > 0 ||
        readback.revision !== appended.revision ||
        !outcome.events.every((candidate, index) => {
          const actual = readback.events[log.revision + index];
          return (
            isRecord(actual) &&
            typeof actual.eventId === "string" &&
            actual.eventId === candidate.eventId
          );
        })
      ) {
        return reply.code(503).send({ code: "LOG_READBACK_FAILED" });
      }
      return reply.code(202).send({ ...outcome.receipt, readbackRevision: readback.revision });
    }

    return reply.code(202).send({
      receiptId: `receipt_${result.value.commandId}`,
      commandId: result.value.commandId,
      acceptedRevision: options.initialRevision,
    });
  });

  return app;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
