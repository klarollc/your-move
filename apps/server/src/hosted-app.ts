import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import {
  MANAGE_USAGE_URL,
  PLAN_IN_USE_LABEL,
  REFRESH_MARGIN_MS,
  SIWC_PLAN_SCOPE,
  createPlanAccess,
  decodeCredentialBundle,
  listPlanModels,
  PlanAccessRejectedError,
  PlanRefreshError,
  refreshPlanCredential,
  revokePlanSession,
  verifyIdToken,
  planCredentialSchema,
} from "./chatgpt-plan.js";
import { createLampLiveFeed } from "./lamp-live-feed.js";
import { createLampPipeline, type Classify } from "./lamp-pipeline.js";
import { classifyLampV2, LAMP_V2_MODEL } from "./lamp-v2.js";
import { workMaterialsSchema } from "./work-materials.js";
import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
  listProviderModels,
} from "./provider-client.js";
import { openProviderVault, type ProviderKind } from "./provider-vault.js";
import { openWorkDraftStore, toView, type DraftRequest } from "./work-drafts.js";
import { type BoundedContract } from "./work-contract.js";
import {
  AuthRejected,
  DraftProviderUnavailableError,
  draftContractWithProvider,
} from "./work-drafts.js";
import { createExecutionEngine, type ExecutionEngine } from "./execution-loop.js";
import {
  openExecutionStore,
  type ExecutionRecord,
  type ExecutionStore,
} from "./execution-store.js";
import {
  ExecutionSubsystemRefusedError,
  verifyToolRegistry,
  type ToolRegistry,
} from "./execution-tools.js";
import { validateGithubToken } from "./github-client.js";
import { openIntegrationsVault } from "./integrations-vault.js";
import { createNativeToolRegistry } from "./native-tools.js";
import type { ResolveHost } from "./tool-web-fetch.js";

export type HostedApp = FastifyInstance;

type HostedAppOptions = {
  mode: "development" | "test" | "production";
  appOrigin: string;
  accessPassword: string;
  sessionSigningKey: string;
  credentialEncryptionKey: string;
  dataDir: string;
  staticRoot?: string;
  staticEntryFile?: string;
  providerFetch?: typeof fetch;
  /** Outbound fetch for tools and the GitHub integration. Defaults to providerFetch. */
  toolFetch?: typeof fetch;
  /** Hostname resolution for the web_fetch SSRF guard. Defaults to DNS. */
  resolveHost?: ResolveHost;
  /** Replaces the native tool registry (tests: allowlist drift must refuse the subsystem). */
  toolRegistry?: ToolRegistry;
  /** Outbound fetch for the lamp's Ollama endpoint. Defaults to global fetch. */
  lampFetch?: typeof fetch;
};

const SESSION_COOKIE = "cuckcode_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_LOGIN_FAILURES = 32;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginSchema = z.object({ password: z.string().min(1).max(4096) }).strict();
const providerSchema = z.enum(["openai", "anthropic"]);
const connectSchema = z
  .object({
    apiKey: z
      .string()
      .trim()
      .min(8)
      .max(4096)
      // eslint-disable-next-line no-control-regex -- Provider keys enter an HTTP authorization header.
      .regex(/^[^\u0000-\u001f\u007f]+$/),
  })
  .strict();
const modelSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("automatic") }).strict(),
  z
    .object({
      mode: z.literal("specific"),
      provider: providerSchema,
      modelId: z.string().trim().min(1).max(128),
    })
    .strict(),
]);
const assetContentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function decodeSecret(value: string, code: string): Buffer {
  const secret = Buffer.from(value, "base64");
  if (secret.length !== 32 || secret.toString("base64") !== value) throw new Error(code);
  return secret;
}

function assertOrigin(value: string, mode: HostedAppOptions["mode"]): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("HOSTED_APP_ORIGIN_INVALID");
  }
  if (parsed.origin !== value || (mode === "production" && parsed.protocol !== "https:")) {
    throw new Error("HOSTED_APP_ORIGIN_INVALID");
  }
}

function cookieValue(header: string | undefined): string | undefined {
  const prefix = `${SESSION_COOKIE}=`;
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function createSessionToken(key: Buffer, sessionVersion: number): string {
  const payload = `${Date.now() + SESSION_TTL_SECONDS * 1000}.${sessionVersion}.${randomBytes(32).toString("base64url")}`;
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isValidSession(header: string | undefined, key: Buffer, sessionVersion: number): boolean {
  const token = cookieValue(header);
  if (!token) return false;
  const [expiresAtText, versionText, nonce, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !expiresAtText || !versionText || !nonce || !signature) return false;
  const expiresAt = Number(expiresAtText);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now() ||
    Number(versionText) !== sessionVersion
  ) {
    return false;
  }
  const payload = `${expiresAtText}.${versionText}.${nonce}`;
  const expected = createHmac("sha256", key).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sessionCookie(token: string, mode: HostedAppOptions["mode"]): string {
  const secure = mode === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

function clearedSessionCookie(mode: HostedAppOptions["mode"]): string {
  const secure = mode === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function providerFailure(
  reply: FastifyReply,
  error: unknown,
  authorizationFailure: { statusCode: number; code: string },
) {
  if (error instanceof ProviderAuthorizationError) {
    return reply.code(authorizationFailure.statusCode).send({ code: authorizationFailure.code });
  }
  if (error instanceof ProviderResponseError) {
    return reply.code(502).send({ code: "PROVIDER_RESPONSE_INVALID" });
  }
  if (error instanceof ProviderUnavailableError) {
    return reply.code(503).send({ code: "PROVIDER_UNAVAILABLE" });
  }
  return reply.code(503).send({ code: "PROVIDER_UNAVAILABLE" });
}

function loadStaticRoot(path: string, entryFile: string) {
  const root = realpathSync(resolve(path));
  if (!statSync(root).isDirectory()) throw new Error("HOSTED_STATIC_ROOT_INVALID");
  if (!entryFile.endsWith(".html") || entryFile.includes("/") || entryFile.includes("\\")) {
    throw new Error("HOSTED_STATIC_ENTRY_INVALID");
  }
  const indexPath = realpathSync(resolve(root, entryFile));
  if (!indexPath.startsWith(`${root}${sep}`) || !statSync(indexPath).isFile()) {
    throw new Error("HOSTED_STATIC_INDEX_INVALID");
  }
  const assetsRoot = realpathSync(resolve(root, "assets"));
  if (!assetsRoot.startsWith(`${root}${sep}`) || !statSync(assetsRoot).isDirectory()) {
    throw new Error("HOSTED_STATIC_ASSETS_INVALID");
  }
  return { root, assetsRoot, indexHtml: readFileSync(indexPath) };
}

export function createHostedApp(options: HostedAppOptions): HostedApp {
  assertOrigin(options.appOrigin, options.mode);
  if (options.accessPassword.length < 16) throw new Error("HOSTED_ACCESS_PASSWORD_TOO_SHORT");
  const staticFiles = options.staticRoot
    ? loadStaticRoot(options.staticRoot, options.staticEntryFile ?? "index.html")
    : undefined;
  const signingKey = decodeSecret(options.sessionSigningKey, "HOSTED_SESSION_SIGNING_KEY_INVALID");
  const expectedPassword = createHash("sha256").update(options.accessPassword, "utf8").digest();
  const providerVault = openProviderVault({
    dataDir: options.dataDir,
    encryptionKey: options.credentialEncryptionKey,
  });
  const providerFetch = options.providerFetch ?? globalThis.fetch;
  const workDrafts = openWorkDraftStore({ dataDir: options.dataDir });
  const integrationsVault = openIntegrationsVault({
    dataDir: options.dataDir,
    encryptionKey: options.credentialEncryptionKey,
  });
  const executionStore: ExecutionStore = openExecutionStore({ dataDir: options.dataDir });
  const toolFetch = options.toolFetch ?? providerFetch;
  // R4 Track A: the lamp. Verdicts are a projection: lamp_verdicts + the live feed, never a log.
  const lampFetch = options.lampFetch ?? globalThis.fetch;
  const lampFeed = createLampLiveFeed();
  const classifyWithOwnerEndpoint: Classify = (text) => {
    const endpoint = integrationsVault.getLampEndpoint();
    return classifyLampV2(text, {
      fetcher: lampFetch,
      endpoint: `${endpoint.baseUrl}/api/chat`,
      ...(endpoint.token ? { token: endpoint.token } : {}),
    });
  };
  const lampPipeline = createLampPipeline({
    store: executionStore,
    feed: lampFeed,
    classify: classifyWithOwnerEndpoint,
  });
  // R4 Track D: the imported ChatGPT plan credential (refreshed here, never by the client).
  const planAccess = createPlanAccess({ vault: integrationsVault, fetcher: providerFetch });
  const toolRegistry =
    options.toolRegistry ??
    createNativeToolRegistry({
      fetcher: toolFetch,
      ...(options.resolveHost ? { resolveHost: options.resolveHost } : {}),
    });
  // Fail closed: on any tool allowlist or schema drift the execution subsystem does not start.
  // R1/R2 routes keep working; execution routes answer EXECUTION_SUBSYSTEM_UNAVAILABLE.
  let executionEngine: ExecutionEngine | undefined;
  try {
    verifyToolRegistry(toolRegistry);
    executionEngine = createExecutionEngine({
      store: executionStore,
      providerVault,
      integrationsVault,
      registry: toolRegistry,
      providerFetch,
      onUtterance: (utterance) => lampPipeline.observe(utterance),
      planAccess,
      getContract: (draftId) => {
        const draft = workDrafts.get(draftId);
        return draft?.status === "approved" ? draft.contract : undefined;
      },
    });
  } catch (error) {
    if (!(error instanceof ExecutionSubsystemRefusedError)) throw error;
    executionEngine = undefined;
  }
  const app = Fastify({ logger: false });
  void app.register(websocket);

  app.addHook("onRequest", async (request, reply) => {
    const pathname = new URL(request.url, options.appOrigin).pathname;
    if (!pathname.startsWith("/api/")) return;

    if (request.method !== "GET" && request.headers.origin !== options.appOrigin) {
      await reply.code(403).send({ code: "ORIGIN_REJECTED" });
      return;
    }

    if (pathname === "/api/session") return;
    if (!isValidSession(request.headers.cookie, signingKey, providerVault.getSessionVersion())) {
      await reply.code(401).send({ code: "OWNER_SESSION_REQUIRED" });
    }
  });

  app.addHook("onClose", async () => {
    // Stop the execution loop first (bounded), so no run writes to a store after it closes.
    await executionEngine?.close();
    await Promise.race([
      lampPipeline.flush(),
      new Promise((resolve) => setTimeout(resolve, 2_000).unref()),
    ]);
    lampFeed.clear();
    signingKey.fill(0);
    expectedPassword.fill(0);
    providerVault.close();
    workDrafts.close();
    integrationsVault.close();
    executionStore.close();
  });

  app.get("/health", async () => ({ status: "ok" }));

  // R4 Track A #4: the hosted live verdict feed. Owner session required (the onRequest hook), and
  // the upgrade must come from the app's own origin (a GET skips the hook's origin check, so a
  // cross-site page could otherwise open it with the owner's cookie). Messages are B's exact
  // lamp.verdict contract: no text. Execution status keeps its 2 s HTTP polling.
  void app.register(async (instance) => {
    instance.get(
      "/api/events",
      {
        websocket: true,
        preValidation: async (request, reply) => {
          if (request.headers.origin !== options.appOrigin) {
            await reply.code(403).send({ code: "ORIGIN_REJECTED" });
          }
        },
      },
      (socket) => {
        const unsubscribe = lampFeed.subscribe((message) => {
          socket.send(JSON.stringify(message));
        });
        socket.on("close", unsubscribe);
        socket.on("error", unsubscribe);
      },
    );
  });

  if (staticFiles) {
    app.get("/", async (_request, reply) =>
      reply
        .type("text/html; charset=utf-8")
        .header("cache-control", "no-cache")
        .header("x-content-type-options", "nosniff")
        .send(staticFiles.indexHtml),
    );
    app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
      let assetName: string;
      try {
        assetName = decodeURIComponent(request.params["*"]);
      } catch {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      if (
        !assetName ||
        assetName.includes("\\") ||
        assetName.split("/").some((segment) => !segment || segment === "." || segment === "..")
      ) {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      const contentType = assetContentTypes[extname(assetName).toLowerCase()];
      if (!contentType) return reply.code(404).send({ code: "NOT_FOUND" });

      let assetPath: string;
      try {
        assetPath = realpathSync(resolve(staticFiles.assetsRoot, assetName));
        if (
          !assetPath.startsWith(`${staticFiles.assetsRoot}${sep}`) ||
          !statSync(assetPath).isFile()
        ) {
          return reply.code(404).send({ code: "NOT_FOUND" });
        }
      } catch {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      return reply
        .type(contentType)
        .header("cache-control", "public, max-age=31536000, immutable")
        .header("x-content-type-options", "nosniff")
        .send(readFileSync(assetPath));
    });
  }

  app.get("/api/session", async (request) => ({
    authenticated: isValidSession(
      request.headers.cookie,
      signingKey,
      providerVault.getSessionVersion(),
    ),
  }));

  app.post("/api/session", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: "LOGIN_REQUEST_INVALID" });

    const candidate = createHash("sha256").update(parsed.data.password, "utf8").digest();
    const passwordMatches = timingSafeEqual(candidate, expectedPassword);
    candidate.fill(0);
    if (!passwordMatches) {
      if (
        !providerVault.recordLoginFailureIfAllowed(Date.now(), LOGIN_WINDOW_MS, MAX_LOGIN_FAILURES)
      ) {
        return reply.code(429).send({ code: "LOGIN_RATE_LIMITED" });
      }
      return reply.code(401).send({ code: "LOGIN_REJECTED" });
    }

    providerVault.resetLoginFailures();
    reply.header(
      "set-cookie",
      sessionCookie(
        createSessionToken(signingKey, providerVault.getSessionVersion()),
        options.mode,
      ),
    );
    return reply.code(200).send({ authenticated: true });
  });

  app.delete("/api/session", async (_request, reply) => {
    providerVault.revokeSessions();
    reply.header("set-cookie", clearedSessionCookie(options.mode));
    return reply.code(204).send();
  });

  app.get("/api/providers", async () => ({
    providers: [
      { id: "openai", status: providerVault.getProviderStatus("openai") },
      { id: "anthropic", status: providerVault.getProviderStatus("anthropic") },
    ],
    modelSelection: providerVault.getModelSelection(),
  }));

  app.post<{ Params: { provider: string } }>("/api/providers/:provider", async (request, reply) => {
    const provider = providerSchema.safeParse(request.params.provider);
    const body = connectSchema.safeParse(request.body);
    if (!provider.success) return reply.code(404).send({ code: "PROVIDER_NOT_FOUND" });
    if (!body.success) return reply.code(400).send({ code: "PROVIDER_REQUEST_INVALID" });

    try {
      const models = await listProviderModels(provider.data, body.data.apiKey, providerFetch);
      providerVault.saveCredential(provider.data, body.data.apiKey);
      return reply.code(201).send({ provider: provider.data, status: "connected", models });
    } catch (error) {
      return providerFailure(reply, error, { statusCode: 400, code: "INVALID_CREDENTIALS" });
    }
  });

  app.post<{ Params: { provider: string } }>(
    "/api/providers/:provider/models/refresh",
    async (request, reply) => {
      const provider = providerSchema.safeParse(request.params.provider);
      if (!provider.success) return reply.code(404).send({ code: "PROVIDER_NOT_FOUND" });
      const status = providerVault.getProviderStatus(provider.data);
      if (status === "needs_reauth") {
        return reply.code(401).send({ code: "PROVIDER_REAUTH_REQUIRED" });
      }
      if (status !== "connected") {
        return reply.code(409).send({ code: "PROVIDER_NOT_CONNECTED" });
      }
      const credential = providerVault.getCredential(provider.data);
      if (!credential) return reply.code(409).send({ code: "PROVIDER_NOT_CONNECTED" });

      try {
        const models = await listProviderModels(provider.data, credential, providerFetch);
        return reply.code(200).send({ models });
      } catch (error) {
        if (error instanceof ProviderAuthorizationError) {
          providerVault.markNeedsReauth(provider.data);
        }
        return providerFailure(reply, error, {
          statusCode: 401,
          code: "PROVIDER_REAUTH_REQUIRED",
        });
      }
    },
  );

  app.delete<{ Params: { provider: string } }>(
    "/api/providers/:provider",
    async (request, reply) => {
      const provider = providerSchema.safeParse(request.params.provider);
      if (!provider.success) return reply.code(404).send({ code: "PROVIDER_NOT_FOUND" });
      providerVault.disconnect(provider.data);
      return reply.code(200).send({ provider: provider.data, status: "disconnected" });
    },
  );

  app.post("/api/model-selection", async (request, reply) => {
    const selection = modelSelectionSchema.safeParse(request.body);
    if (!selection.success) return reply.code(400).send({ code: "MODEL_SELECTION_INVALID" });
    if (selection.data.mode === "automatic") {
      providerVault.setModelSelection(selection.data);
      return reply.code(200).send(selection.data);
    }
    const requestedModelId = selection.data.modelId;

    const status = providerVault.getProviderStatus(selection.data.provider);
    if (status === "needs_reauth") {
      return reply.code(401).send({ code: "PROVIDER_REAUTH_REQUIRED" });
    }
    if (status !== "connected") {
      return reply.code(409).send({ code: "PROVIDER_NOT_CONNECTED" });
    }
    const credential = providerVault.getCredential(selection.data.provider);
    if (!credential) return reply.code(409).send({ code: "PROVIDER_NOT_CONNECTED" });

    try {
      const models = await listProviderModels(selection.data.provider, credential, providerFetch);
      if (!models.some(({ id }) => id === requestedModelId)) {
        return reply.code(422).send({ code: "MODEL_NOT_AVAILABLE" });
      }
      providerVault.setModelSelection(selection.data);
      return reply.code(200).send(selection.data);
    } catch (error) {
      if (error instanceof ProviderAuthorizationError) {
        providerVault.markNeedsReauth(selection.data.provider);
      }
      return providerFailure(reply, error, {
        statusCode: 401,
        code: "PROVIDER_REAUTH_REQUIRED",
      });
    }
  });

  const workDescriptionSchema = z
    .object({ description: z.string().trim().min(1).max(4000) })
    .strict();
  const workRevisionSchema = z.object({ feedback: z.string().trim().min(1).max(4000) }).strict();

  function connectedDraftProviders(): { provider: ProviderKind; credential: string }[] {
    const providers: ProviderKind[] = ["openai", "anthropic"];
    const result: { provider: ProviderKind; credential: string }[] = [];
    for (const provider of providers) {
      if (providerVault.getProviderStatus(provider) !== "connected") continue;
      const credential = providerVault.getCredential(provider);
      if (credential) result.push({ provider, credential });
    }
    return result;
  }

  async function draftFor(
    request: DraftRequest,
    reply: FastifyReply,
  ): Promise<{ contract: BoundedContract } | undefined> {
    const providers = connectedDraftProviders();
    try {
      const contract = await draftContractWithProvider({
        request,
        providers,
        selection: providerVault.getModelSelection(),
        fetcher: providerFetch,
      });
      if (contract === "CONTRACT_DRAFT_INVALID") {
        void reply.code(502).send({ code: "CONTRACT_DRAFT_INVALID" });
        return undefined;
      }
      return { contract };
    } catch (error) {
      if (error instanceof DraftProviderUnavailableError) {
        void reply.code(409).send({ code: "PROVIDER_NOT_CONNECTED" });
        return undefined;
      }
      if (error instanceof AuthRejected) {
        providerVault.markNeedsReauth(error.provider);
        void reply.code(401).send({ code: "PROVIDER_REAUTH_REQUIRED" });
        return undefined;
      }
      providerFailure(reply, error, { statusCode: 401, code: "PROVIDER_REAUTH_REQUIRED" });
      return undefined;
    }
  }

  // R3: every draft view carries an additive `execution` field (latest attempt, or null).
  function executionView(record: ExecutionRecord) {
    // R4: the triage join. Verdicts stay textless; the text comes from the run's own transcript,
    // matched on turn index (verdict utteranceId = utterance_<executionId>_<turnIndex>_1).
    const utterances: { turnIndex: number; text: string }[] = [];
    let turnIndex = 0;
    for (const entry of record.transcript) {
      if (entry.role !== "assistant") continue;
      turnIndex += 1;
      if (entry.content.trim()) utterances.push({ turnIndex, text: entry.content });
    }
    return {
      id: record.id,
      draftId: record.draftId,
      revision: record.revision,
      attempt: record.attempt,
      restartedFrom: record.restartedFrom,
      status: record.status,
      turnCount: record.turnCount,
      maxTurns: record.maxTurns,
      output: record.output,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      fundedBy: record.fundedBy,
      utterances,
      lampVerdicts: executionStore.listVerdicts(record.id).map((verdict) => ({
        utteranceId: verdict.row.id,
        turnIndex: verdict.row.turnIndex,
        verdict: verdict.row.verdict,
        verdictTs: verdict.row.verdictTs,
        ownerChoice: verdict.ownerChoice,
      })),
      proposals: executionStore.listProposals(record.id).map((proposal) => ({
        id: proposal.id,
        tool: proposal.tool,
        status: proposal.status,
        createdAt: proposal.createdAt,
        decidedAt: proposal.decidedAt,
        change: {
          repo: String(proposal.args.repo ?? ""),
          path: String(proposal.args.path ?? ""),
          message: String(proposal.args.message ?? ""),
          content: String(proposal.args.content ?? ""),
        },
      })),
    };
  }

  function draftView(draft: Parameters<typeof toView>[0]) {
    const latest = executionEngine ? executionStore.latestForDraft(draft.id) : undefined;
    return { ...toView(draft), execution: latest ? executionView(latest) : null };
  }

  app.get("/api/work-drafts", async () => ({
    drafts: workDrafts.list().map(draftView),
  }));

  app.get<{ Params: { id: string } }>("/api/work-drafts/:id", async (request, reply) => {
    const draft = workDrafts.get(request.params.id);
    if (!draft) return reply.code(404).send({ code: "WORK_DRAFT_NOT_FOUND" });
    return reply.code(200).send(draftView(draft));
  });

  app.post("/api/work-drafts", async (request, reply) => {
    const body = workDescriptionSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "WORK_DRAFT_REQUEST_INVALID" });
    const drafted = await draftFor({ description: body.data.description }, reply);
    if (!drafted) return reply;
    const draft = workDrafts.insert(
      body.data.description,
      drafted.contract,
      new Date().toISOString(),
    );
    return reply.code(201).send(draftView(draft));
  });

  app.post<{ Params: { id: string } }>("/api/work-drafts/:id/revise", async (request, reply) => {
    const body = workRevisionSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "WORK_DRAFT_REQUEST_INVALID" });
    const existing = workDrafts.get(request.params.id);
    if (!existing) return reply.code(404).send({ code: "WORK_DRAFT_NOT_FOUND" });
    if (existing.status !== "draft")
      return reply.code(409).send({ code: "WORK_DRAFT_NOT_EDITABLE" });
    const drafted = await draftFor(
      {
        description: existing.description,
        currentContract: existing.contract,
        feedback: body.data.feedback,
      },
      reply,
    );
    if (!drafted) return reply;
    if (!workDrafts.revise(existing.id, drafted.contract, new Date().toISOString())) {
      return reply.code(409).send({ code: "WORK_DRAFT_NOT_EDITABLE" });
    }
    return reply.code(200).send(draftView(workDrafts.get(existing.id)!));
  });

  // The owner's explicit approval is the only transition that makes work real. It is a separate
  // POST so no draft or revision can approve itself, and it is one-way.
  // R3: approving now also enqueues the execution (idempotent per draft revision). The UI shows
  // what this arms before the owner confirms.
  app.post<{ Params: { id: string } }>("/api/work-drafts/:id/approve", async (request, reply) => {
    const existing = workDrafts.get(request.params.id);
    if (!existing) return reply.code(404).send({ code: "WORK_DRAFT_NOT_FOUND" });
    if (!workDrafts.approve(existing.id, new Date().toISOString())) {
      return reply.code(409).send({ code: "WORK_DRAFT_NOT_EDITABLE" });
    }
    const approved = workDrafts.get(existing.id)!;
    executionEngine?.enqueue(approved.id, approved.revision, approved.contract, approved.materials);
    return reply.code(200).send(draftView(approved));
  });

  // R4 Track B: the owner's materials, editable only while the work is a draft. Each edit is a new
  // revision; approval freezes them, and enqueue copies them into the run's initial transcript.
  app.put<{ Params: { id: string } }>("/api/work-drafts/:id/materials", async (request, reply) => {
    const body = workMaterialsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "WORK_MATERIALS_INVALID" });
    const existing = workDrafts.get(request.params.id);
    if (!existing) return reply.code(404).send({ code: "WORK_DRAFT_NOT_FOUND" });
    if (!workDrafts.setMaterials(existing.id, body.data, new Date().toISOString())) {
      return reply.code(409).send({ code: "WORK_DRAFT_NOT_EDITABLE" });
    }
    return reply.code(200).send(draftView(workDrafts.get(existing.id)!));
  });

  // ---- R3: executions, proposals, integrations ----

  function engineOrRefuse(reply: FastifyReply): ExecutionEngine | undefined {
    if (!executionEngine) {
      void reply.code(503).send({ code: "EXECUTION_SUBSYSTEM_UNAVAILABLE" });
      return undefined;
    }
    return executionEngine;
  }

  app.get("/api/work-executions", async (_request, reply) => {
    if (!engineOrRefuse(reply)) return reply;
    return reply.code(200).send({ executions: executionStore.list().map(executionView) });
  });

  app.get<{ Params: { id: string } }>("/api/work-executions/:id", async (request, reply) => {
    if (!engineOrRefuse(reply)) return reply;
    const execution = executionStore.get(request.params.id);
    if (!execution) return reply.code(404).send({ code: "WORK_EXECUTION_NOT_FOUND" });
    return reply.code(200).send(executionView(execution));
  });

  // Start for work approved before R3 existed: that approval did not show what it would arm, so
  // it never auto-starts. The owner starts it explicitly, from a button that states the scope.
  const startSchema = z.object({ draftId: z.string().min(1).max(200) }).strict();
  app.post("/api/work-executions", async (request, reply) => {
    const engine = engineOrRefuse(reply);
    if (!engine) return reply;
    const body = startSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "WORK_EXECUTION_REQUEST_INVALID" });
    const draft = workDrafts.get(body.data.draftId);
    if (!draft) return reply.code(404).send({ code: "WORK_DRAFT_NOT_FOUND" });
    if (draft.status !== "approved") {
      return reply.code(409).send({ code: "WORK_DRAFT_NOT_APPROVED" });
    }
    if (executionStore.latestForDraft(draft.id)) {
      return reply.code(409).send({ code: "WORK_EXECUTION_EXISTS" });
    }
    const execution = engine.enqueue(draft.id, draft.revision, draft.contract, draft.materials);
    return reply.code(201).send(executionView(execution));
  });

  app.post<{ Params: { id: string } }>(
    "/api/work-executions/:id/restart",
    async (request, reply) => {
      const engine = engineOrRefuse(reply);
      if (!engine) return reply;
      const result = engine.restart(request.params.id);
      if (result === "NOT_FOUND") return reply.code(404).send({ code: "WORK_EXECUTION_NOT_FOUND" });
      if (result === "NOT_RESTARTABLE") {
        return reply.code(409).send({ code: "WORK_EXECUTION_NOT_RESTARTABLE" });
      }
      return reply.code(201).send(executionView(result));
    },
  );

  for (const decision of ["approve", "deny"] as const) {
    app.post<{ Params: { id: string; proposalId: string } }>(
      `/api/work-executions/:id/proposals/:proposalId/${decision}`,
      async (request, reply) => {
        const engine = engineOrRefuse(reply);
        if (!engine) return reply;
        const result = engine.decide(
          request.params.id,
          request.params.proposalId,
          decision === "approve" ? "approved" : "denied",
        );
        if (result === "NOT_FOUND") return reply.code(404).send({ code: "PROPOSAL_NOT_FOUND" });
        if (result === "NOT_PENDING") return reply.code(409).send({ code: "PROPOSAL_NOT_PENDING" });
        return reply.code(200).send(executionView(executionStore.get(request.params.id)!));
      },
    );
  }

  // ---- R4 Track C: owner triage, so a run never has zero available actions ----

  const replySchema = z.object({ message: z.string().trim().min(1).max(4000) }).strict();
  app.post<{ Params: { id: string } }>("/api/work-executions/:id/reply", async (request, reply) => {
    const engine = engineOrRefuse(reply);
    if (!engine) return reply;
    const body = replySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "WORK_EXECUTION_REQUEST_INVALID" });
    const result = engine.reply(request.params.id, body.data.message);
    if (result === "NOT_FOUND") return reply.code(404).send({ code: "WORK_EXECUTION_NOT_FOUND" });
    if (result === "NOT_WAITING")
      return reply.code(409).send({ code: "WORK_EXECUTION_NOT_WAITING" });
    if (result === "PROPOSAL_PENDING") return reply.code(409).send({ code: "PROPOSAL_PENDING" });
    if (result === "NO_TURNS_LEFT") {
      return reply.code(409).send({ code: "WORK_EXECUTION_NO_TURNS_LEFT" });
    }
    return reply.code(200).send(executionView(executionStore.get(request.params.id)!));
  });

  app.post<{ Params: { id: string } }>("/api/work-executions/:id/close", async (request, reply) => {
    const engine = engineOrRefuse(reply);
    if (!engine) return reply;
    const result = engine.closeRun(request.params.id);
    if (result === "NOT_FOUND") return reply.code(404).send({ code: "WORK_EXECUTION_NOT_FOUND" });
    if (result === "NOT_CLOSABLE") {
      return reply.code(409).send({ code: "WORK_EXECUTION_NOT_CLOSABLE" });
    }
    return reply.code(200).send(executionView(executionStore.get(request.params.id)!));
  });

  // The owner's signal on a lamp cue: "Draw the curtain" (dismissed) or opened (engaged). Logged
  // beside the verdict as signal; it changes nothing about the run.
  const verdictChoiceSchema = z.object({ choice: z.enum(["dismissed", "engaged"]) }).strict();
  app.post<{ Params: { id: string } }>("/api/lamp-verdicts/:id/choice", async (request, reply) => {
    const body = verdictChoiceSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "LAMP_CHOICE_INVALID" });
    const executionId = executionStore.recordVerdictChoice(
      request.params.id,
      body.data.choice,
      new Date().toISOString(),
    );
    if (!executionId) return reply.code(404).send({ code: "LAMP_VERDICT_NOT_FOUND" });
    return reply.code(200).send({ utteranceId: request.params.id, choice: body.data.choice });
  });

  // ---- R4 Track A #2 / D #13: the lamp's Ollama endpoint ----

  app.get("/api/lamp", async () => {
    const endpoint = integrationsVault.getLampEndpoint();
    return {
      endpoint: {
        baseUrl: endpoint.baseUrl,
        configured: endpoint.configured,
        tokenSet: endpoint.token !== null,
      },
      model: LAMP_V2_MODEL,
      ...lampPipeline.snapshot(),
    };
  });

  const lampEndpointSchema = z
    .object({
      baseUrl: z.string().trim().min(1).max(2048),
      token: z
        .string()
        .trim()
        .max(4096)
        // eslint-disable-next-line no-control-regex -- The token enters an HTTP authorization header.
        .regex(/^[^\u0000-\u001f\u007f\s]*$/)
        .optional(),
    })
    .strict();

  // Validated at connect: the endpoint must answer /api/tags (with the token, when set) and list the
  // locked model. The URL is the owner's own choice and may be private (an Ollama on their network),
  // so it is not run through the web_fetch SSRF guard; only the owner's session can set it.
  app.post("/api/lamp/endpoint", async (request, reply) => {
    const body = lampEndpointSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "LAMP_ENDPOINT_INVALID" });
    let url: URL;
    try {
      url = new URL(body.data.baseUrl);
    } catch {
      return reply.code(400).send({ code: "LAMP_ENDPOINT_INVALID" });
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return reply.code(400).send({ code: "LAMP_ENDPOINT_INVALID" });
    }
    const baseUrl = `${url.origin}${url.pathname.replace(/\/+$/u, "")}`;
    const token = body.data.token ? body.data.token : null;
    let response: Response;
    try {
      response = await lampFetch(`${baseUrl}/api/tags`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return reply.code(503).send({ code: "LAMP_ENDPOINT_UNREACHABLE" });
    }
    if (response.status === 401 || response.status === 403) {
      return reply.code(400).send({ code: "LAMP_ENDPOINT_AUTH_REJECTED" });
    }
    if (!response.ok) return reply.code(503).send({ code: "LAMP_ENDPOINT_UNREACHABLE" });
    const tags = (await response.json().catch(() => undefined)) as
      { models?: { name?: unknown; model?: unknown }[] } | undefined;
    const hasModel = (tags?.models ?? []).some(
      (model) => model.name === LAMP_V2_MODEL || model.model === LAMP_V2_MODEL,
    );
    if (!hasModel)
      return reply.code(422).send({ code: "LAMP_MODEL_MISSING", model: LAMP_V2_MODEL });
    integrationsVault.saveLampEndpoint(baseUrl, token);
    return reply.code(201).send({ baseUrl, configured: true, tokenSet: token !== null });
  });

  app.delete("/api/lamp/endpoint", async () => {
    integrationsVault.clearLampEndpoint();
    const endpoint = integrationsVault.getLampEndpoint();
    return { baseUrl: endpoint.baseUrl, configured: false, tokenSet: false };
  });

  // ---- R4 Track D: "Continue with ChatGPT" (local sign-in, hosted import) ----

  function planView() {
    return {
      ...integrationsVault.getPlanStatus(),
      inUseLabel: PLAN_IN_USE_LABEL,
      manageUsageUrl: MANAGE_USAGE_URL,
      hostId: integrationsVault.getHostId(),
    };
  }

  app.get("/api/chatgpt-plan", async () => planView());

  const planImportSchema = z.object({ bundle: z.string().trim().min(1).max(64_000) }).strict();
  app.post("/api/chatgpt-plan/import", async (request, reply) => {
    const body = planImportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "PLAN_IMPORT_INVALID" });
    let credential = decodeCredentialBundle(body.data.bundle);
    if (!credential) return reply.code(400).send({ code: "PLAN_IMPORT_INVALID" });
    if (!credential.scopes.includes(SIWC_PLAN_SCOPE)) {
      return reply.code(422).send({ code: "PLAN_SCOPE_MISSING" });
    }
    try {
      // The bundle's ID token was validated at sign-in; check its signature, issuer and audience
      // again here (it may be past expiry: it only identifies the account).
      const claims = await verifyIdToken(credential.id_token, {
        fetcher: providerFetch,
        clientId: credential.client_id,
        nowMs: Date.now(),
        allowExpired: true,
      });
      if (claims.sub !== credential.subject) {
        return reply.code(400).send({ code: "INVALID_CREDENTIALS" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("SIWC_"))
        return reply.code(503).send({ code: "PROVIDER_UNAVAILABLE" });
      return reply.code(400).send({ code: "INVALID_CREDENTIALS" });
    }
    try {
      if (credential.expires_at - Date.now() <= REFRESH_MARGIN_MS) {
        credential = await refreshPlanCredential(credential, providerFetch, Date.now());
      }
      // Validate at import, like a pasted key: the plan account must answer with its models.
      await listPlanModels(credential.access_token, providerFetch);
    } catch (error) {
      if (error instanceof PlanAccessRejectedError) {
        return reply.code(400).send({ code: "INVALID_CREDENTIALS" });
      }
      if (error instanceof PlanRefreshError && error.terminal) {
        return reply.code(400).send({ code: "INVALID_CREDENTIALS" });
      }
      return reply.code(503).send({ code: "PROVIDER_UNAVAILABLE" });
    }
    integrationsVault.savePlanCredential(
      JSON.stringify(planCredentialSchema.parse(credential)),
      credential.email,
    );
    return reply.code(201).send(planView());
  });

  // The owner's choice between the plan and their pasted key. Switching takes effect at the next
  // turn boundary of a running pass.
  const planActiveSchema = z.object({ active: z.boolean() }).strict();
  app.post("/api/chatgpt-plan/active", async (request, reply) => {
    const body = planActiveSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "PLAN_REQUEST_INVALID" });
    if (!integrationsVault.setPlanActive(body.data.active)) {
      return reply.code(409).send({ code: "PLAN_NOT_CONNECTED" });
    }
    return reply.code(200).send(planView());
  });

  // Disconnect deletes. The renewable session is revoked first (best effort, OpenAI's guidance);
  // the response says whether revocation was confirmed.
  app.delete("/api/chatgpt-plan", async () => {
    const json = integrationsVault.getPlanCredential();
    let revoked = false;
    if (json) {
      const parsed = planCredentialSchema.safeParse(JSON.parse(json));
      if (parsed.success) revoked = await revokePlanSession(parsed.data, providerFetch);
    }
    integrationsVault.disconnectPlan();
    return { ...planView(), revoked };
  });

  const integrationSchema = z.enum(["github"]);
  const integrationConnectSchema = z
    .object({
      token: z
        .string()
        .trim()
        .min(8)
        .max(4096)
        // eslint-disable-next-line no-control-regex -- Tokens enter an HTTP authorization header.
        .regex(/^[^\u0000-\u001f\u007f\s]+$/),
    })
    .strict();

  app.get("/api/integrations", async () => ({
    integrations: [{ id: "github", status: integrationsVault.getStatus("github") }],
  }));

  app.post<{ Params: { integration: string } }>(
    "/api/integrations/:integration",
    async (request, reply) => {
      const integration = integrationSchema.safeParse(request.params.integration);
      if (!integration.success) return reply.code(404).send({ code: "INTEGRATION_NOT_FOUND" });
      const body = integrationConnectSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ code: "INTEGRATION_REQUEST_INVALID" });
      // Validate at connect, so a bad token fails here and never at first use.
      const validated = await validateGithubToken(body.data.token, toolFetch);
      if (!validated.ok) {
        if (validated.code === "GITHUB_AUTH_REJECTED" || validated.code === "GITHUB_FORBIDDEN") {
          return reply.code(400).send({ code: "INVALID_CREDENTIALS" });
        }
        return reply.code(503).send({ code: "INTEGRATION_UNAVAILABLE" });
      }
      integrationsVault.saveCredential(integration.data, body.data.token);
      return reply.code(201).send({ id: integration.data, status: "connected" });
    },
  );

  app.delete<{ Params: { integration: string } }>(
    "/api/integrations/:integration",
    async (request, reply) => {
      const integration = integrationSchema.safeParse(request.params.integration);
      if (!integration.success) return reply.code(404).send({ code: "INTEGRATION_NOT_FOUND" });
      integrationsVault.disconnect(integration.data);
      return reply.code(200).send({ id: integration.data, status: "disconnected" });
    },
  );

  return app;
}
