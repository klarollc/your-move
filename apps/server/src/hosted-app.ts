import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
  listProviderModels,
} from "./provider-client.js";
import { openProviderVault } from "./provider-vault.js";

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
  const app = Fastify({ logger: false });

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
    signingKey.fill(0);
    expectedPassword.fill(0);
    providerVault.close();
  });

  app.get("/health", async () => ({ status: "ok" }));

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

  return app;
}
