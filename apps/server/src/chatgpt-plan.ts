import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

import { z } from "zod";

// "Continue with ChatGPT" (Sign in with ChatGPT, open-source plan usage) — R4 Track D, as amended
// 2026-10-19: the sign-in runs on the owner's machine (`npm run siwc:login`, siwc-login.ts) because
// OpenAI requires the OAuth callback at http://127.0.0.1:<port>/auth/callback. This server only
// imports the resulting credential, stores it encrypted, and refreshes the tokens itself.
// Source for every constant here: developers.openai.com/siwc/token-sharing-open-source
// (sign-in, profiles-and-sessions, token-reference, errors-and-recovery, preview-limitations),
// read 2026-10-19.

export const SIWC_ISSUER = "https://auth.openai.com";
export const SIWC_AUTHORIZE_URL = `${SIWC_ISSUER}/api/accounts/authorize`;
export const SIWC_TOKEN_URL = `${SIWC_ISSUER}/api/accounts/oauth/token`;
export const SIWC_DISCOVERY_URL = `${SIWC_ISSUER}/.well-known/openid-configuration`;
export const SIWC_RESOURCE = "https://api.openai.com/v1";
export const SIWC_DYNAMIC_CLIENT = "dynamic_agent_client";
export const SIWC_AGENT_NAME = "Your Move";
export const SIWC_PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const SIWC_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "resource.invoke",
  SIWC_PLAN_SCOPE,
] as const;
export const PLAN_RESPONSES_URL = `${SIWC_RESOURCE}/responses`;
export const PLAN_MODELS_URL = `${SIWC_RESOURCE}/models`;
/** OpenAI's "Manage usage" destination (ChatGPT settings -> Usage), per the SIWC UI guidelines. */
export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
/** OpenAI's in-use label. */
export const PLAN_IN_USE_LABEL = "Using ChatGPT plan";
export const PLAN_LIMIT_NOTE =
  "Plan allowance exhausted for Your Move. Raise the limit in ChatGPT settings (Manage usage), or switch this work to your API key, then reply to continue.";

/** Refresh this long before expiry, so a turn never starts on a token about to lapse. */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const planCredentialSchema = z
  .object({
    format: z.literal("your-move-siwc-credential/1"),
    issuer: z.literal(SIWC_ISSUER),
    subject: z.string().min(1).max(512),
    email: z.string().max(320).nullable(),
    client_id: z
      .string()
      .min(1)
      .max(512)
      .refine((id) => id !== SIWC_DYNAMIC_CLIENT),
    id_token: z.string().min(1).max(16_384),
    access_token: z.string().min(1).max(16_384),
    refresh_token: z.string().min(1).max(16_384),
    token_type: z.string().min(1).max(32),
    /** Absolute access-token expiry, epoch milliseconds. */
    expires_at: z.number().int().positive(),
    scopes: z.array(z.string().min(1).max(128)).max(32),
    saved_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type PlanCredential = z.infer<typeof planCredentialSchema>;

const BUNDLE_PREFIX = "yourmove-siwc1.";

/** The single line siwc:login prints for the owner to paste into the connect UI. */
export function encodeCredentialBundle(credential: PlanCredential): string {
  return `${BUNDLE_PREFIX}${Buffer.from(JSON.stringify(credential), "utf8").toString("base64url")}`;
}

export function decodeCredentialBundle(bundle: string): PlanCredential | undefined {
  const text = bundle.trim();
  if (!text.startsWith(BUNDLE_PREFIX) || text.length > 64_000) return undefined;
  try {
    const json: unknown = JSON.parse(
      Buffer.from(text.slice(BUNDLE_PREFIX.length), "base64url").toString("utf8"),
    );
    const parsed = planCredentialSchema.safeParse(json);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export class PlanRefreshError extends Error {
  /** True when the refresh token itself is unusable: the owner must sign in again. */
  readonly terminal: boolean;
  constructor(
    readonly code: string,
    terminal: boolean,
  ) {
    super(code);
    this.name = "PlanRefreshError";
    this.terminal = terminal;
  }
}

const TERMINAL_REFRESH_CODES = new Set([
  "invalid_grant",
  "invalid_refresh_token",
  "token_expired",
  "refresh_token_expired",
  "refresh_token_invalidated",
  "refresh_token_reused",
  "invalid_client",
]);

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  id_token: z.string().min(1).optional(),
  token_type: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

async function postForm(
  fetcher: typeof fetch,
  url: string,
  form: Record<string, string>,
): Promise<Response> {
  return fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(30_000),
  });
}

/** The OAuth error code of a failed token-endpoint response, if any. */
async function oauthErrorCode(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const nested = body.error && typeof body.error === "object" ? body.error : undefined;
  const code =
    typeof body.error === "string"
      ? body.error
      : nested && typeof (nested as { code?: unknown }).code === "string"
        ? (nested as { code: string }).code
        : `http_${response.status}`;
  return code;
}

/** Authorization-code exchange (owner machine). */
export async function exchangeCode(input: {
  fetcher: typeof fetch;
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const response = await postForm(input.fetcher, SIWC_TOKEN_URL, {
    grant_type: "authorization_code",
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri,
    resource: SIWC_RESOURCE,
  });
  if (!response.ok) throw new PlanRefreshError(await oauthErrorCode(response), false);
  const parsed = tokenResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new PlanRefreshError("token_response_invalid", false);
  return parsed.data;
}

/**
 * Standard refresh: the issued client_id (never dynamic_agent_client), the saved refresh token, the
 * resource, and no scope. The access token, expiry, scopes and rotating refresh token are replaced
 * together.
 */
export async function refreshPlanCredential(
  credential: PlanCredential,
  fetcher: typeof fetch,
  nowMs: number,
): Promise<PlanCredential> {
  let response: Response;
  try {
    response = await postForm(fetcher, SIWC_TOKEN_URL, {
      grant_type: "refresh_token",
      client_id: credential.client_id,
      refresh_token: credential.refresh_token,
      resource: SIWC_RESOURCE,
    });
  } catch {
    throw new PlanRefreshError("network_error", false);
  }
  if (!response.ok) {
    const code = await oauthErrorCode(response);
    throw new PlanRefreshError(code, TERMINAL_REFRESH_CODES.has(code));
  }
  const parsed = tokenResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new PlanRefreshError("token_response_invalid", false);
  return {
    ...credential,
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token,
    ...(parsed.data.id_token ? { id_token: parsed.data.id_token } : {}),
    token_type: parsed.data.token_type ?? credential.token_type,
    expires_at: nowMs + parsed.data.expires_in * 1000,
    scopes: parsed.data.scope ? parsed.data.scope.split(" ").filter(Boolean) : credential.scopes,
    saved_at: new Date(nowMs).toISOString(),
  };
}

// ---- ID token validation (RS256 against OpenAI's published JWKS) ----

const discoverySchema = z.object({
  issuer: z.string(),
  jwks_uri: z.string().url(),
  revocation_endpoint: z.string().url().optional(),
});
const jwksSchema = z.object({ keys: z.array(z.record(z.string(), z.unknown())) });

export async function fetchDiscovery(fetcher: typeof fetch) {
  const response = await fetcher(SIWC_DISCOVERY_URL, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("SIWC_DISCOVERY_UNAVAILABLE");
  const parsed = discoverySchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success || parsed.data.issuer !== SIWC_ISSUER)
    throw new Error("SIWC_DISCOVERY_INVALID");
  return parsed.data;
}

export type IdTokenClaims = { sub: string; email: string | null };

export async function verifyIdToken(
  idToken: string,
  options: {
    fetcher: typeof fetch;
    clientId: string;
    nowMs: number;
    /** Required at sign-in; the server import has no nonce to compare. */
    nonce?: string;
    /** The server import checks signature, issuer and audience; a retained ID token may be expired. */
    allowExpired?: boolean;
  },
): Promise<IdTokenClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("ID_TOKEN_MALFORMED");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  let header: { alg?: unknown; kid?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as typeof header;
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as typeof payload;
  } catch {
    throw new Error("ID_TOKEN_MALFORMED");
  }
  if (header.alg !== "RS256") throw new Error("ID_TOKEN_ALGORITHM_UNSUPPORTED");

  const discovery = await fetchDiscovery(options.fetcher);
  const jwksResponse = await options.fetcher(discovery.jwks_uri, {
    signal: AbortSignal.timeout(15_000),
  });
  const jwks = jwksSchema.safeParse(await jwksResponse.json().catch(() => undefined));
  if (!jwksResponse.ok || !jwks.success) throw new Error("SIWC_JWKS_UNAVAILABLE");
  const jwk = jwks.data.keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("ID_TOKEN_KEY_UNKNOWN");
  const key = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`, "utf8"),
    key,
    Buffer.from(signatureB64, "base64url"),
  );
  if (!valid) throw new Error("ID_TOKEN_SIGNATURE_INVALID");

  if (payload.iss !== SIWC_ISSUER) throw new Error("ID_TOKEN_ISSUER_INVALID");
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(options.clientId)) throw new Error("ID_TOKEN_AUDIENCE_INVALID");
  if (!options.allowExpired) {
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= options.nowMs) {
      throw new Error("ID_TOKEN_EXPIRED");
    }
  }
  if (options.nonce !== undefined && payload.nonce !== options.nonce) {
    throw new Error("ID_TOKEN_NONCE_INVALID");
  }
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("ID_TOKEN_SUBJECT_MISSING");
  return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

/** Best-effort revocation of the renewable session on disconnect. True only on HTTP 200. */
export async function revokePlanSession(
  credential: PlanCredential,
  fetcher: typeof fetch,
): Promise<boolean> {
  try {
    const discovery = await fetchDiscovery(fetcher);
    if (!discovery.revocation_endpoint) return false;
    const response = await postForm(fetcher, discovery.revocation_endpoint, {
      token: credential.refresh_token,
      token_type_hint: "refresh_token",
      client_id: credential.client_id,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// ---- Model catalog for the plan account ----

const planModelsSchema = z.object({
  models: z.array(
    z.object({
      slug: z.string().min(1),
      display_name: z.string().optional(),
      visibility: z.string().optional(),
    }),
  ),
});

/** The account's display models in the server's order (visibility "list"). */
export async function listPlanModels(
  accessToken: string,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<{ slug: string; displayName: string }[]> {
  const response = await fetcher(PLAN_MODELS_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (response.status === 401 || response.status === 403) throw new PlanAccessRejectedError();
  if (!response.ok) throw new PlanUnavailableError();
  const parsed = planModelsSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new PlanUnavailableError();
  return parsed.data.models
    .filter((model) => model.visibility === "list")
    .map((model) => ({ slug: model.slug, displayName: model.display_name ?? model.slug }));
}

export class PlanAccessRejectedError extends Error {
  constructor() {
    super("PLAN_ACCESS_REJECTED");
    this.name = "PlanAccessRejectedError";
  }
}
export class PlanUnavailableError extends Error {
  constructor() {
    super("PLAN_UNAVAILABLE");
    this.name = "PlanUnavailableError";
  }
}

// ---- Server-side access: refresh near expiry, serialized ----

export type PlanVault = {
  getPlanStatus(): { status: "disconnected" | "connected" | "needs_reauth"; active: boolean };
  getPlanCredential(): string | null;
  replacePlanCredential(credentialJson: string): void;
  markPlanNeedsReauth(): void;
};

export function createPlanAccess(options: {
  vault: PlanVault;
  fetcher: typeof fetch;
  nowMs?: () => number;
}) {
  const nowMs = options.nowMs ?? (() => Date.now());
  let inFlight: Promise<string | null> | undefined;

  const read = (): PlanCredential | undefined => {
    const json = options.vault.getPlanCredential();
    if (!json) return undefined;
    const parsed = planCredentialSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  };

  async function refreshIfNeeded(force: boolean): Promise<string | null> {
    const credential = read();
    if (!credential) return null;
    if (!force && credential.expires_at - nowMs() > REFRESH_MARGIN_MS) {
      return credential.access_token;
    }
    try {
      const next = await refreshPlanCredential(credential, options.fetcher, nowMs());
      options.vault.replacePlanCredential(JSON.stringify(next));
      return next.access_token;
    } catch (error) {
      if (error instanceof PlanRefreshError && error.terminal) {
        options.vault.markPlanNeedsReauth();
        return null;
      }
      // Temporary failure: keep the credentials (OpenAI: never erase on a transient failure).
      if (credential.expires_at > nowMs()) return credential.access_token;
      throw new PlanUnavailableError();
    }
  }

  return {
    /** The owner imported a plan credential, it is usable, and they chose to run work on it. */
    isActive(): boolean {
      const status = options.vault.getPlanStatus();
      return status.status === "connected" && status.active;
    },
    /**
     * A valid access token, refreshed when within REFRESH_MARGIN_MS of expiry. Refreshes are
     * serialized (rotating refresh tokens must not race). null = reauth needed or not connected.
     */
    getAccessToken(force = false): Promise<string | null> {
      if (options.vault.getPlanStatus().status !== "connected") return Promise.resolve(null);
      if (!inFlight) {
        inFlight = refreshIfNeeded(force).finally(() => {
          inFlight = undefined;
        });
      }
      return inFlight;
    },
    markNeedsReauth(): void {
      options.vault.markPlanNeedsReauth();
    },
  };
}

export type PlanAccess = ReturnType<typeof createPlanAccess>;
