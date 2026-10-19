import { createSign, generateKeyPairSync } from "node:crypto";

import {
  SIWC_DISCOVERY_URL,
  SIWC_ISSUER,
  SIWC_TOKEN_URL,
  encodeCredentialBundle,
  type PlanCredential,
} from "./chatgpt-plan.js";

// Test fixture: a fake OpenAI auth server (discovery, JWKS, token endpoint, revocation) with a real
// RSA key, so ID-token signature checks run for real. Placeholder tokens only.

export const FAKE_JWKS_URL = `${SIWC_ISSUER}/.well-known/jwks.json`;
export const FAKE_REVOCATION_URL = `${SIWC_ISSUER}/oauth/revoke`;
export const ISSUED_CLIENT_ID = "oaiapp_test_issued_client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-key-1";

export function signIdToken(claims: Record<string, unknown>, key = privateKey): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(key).toString("base64url")}`;
}

export const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

export function idTokenFor(options: {
  clientId?: string;
  nonce?: string;
  expSeconds?: number;
  sub?: string;
}): string {
  return signIdToken({
    iss: SIWC_ISSUER,
    aud: options.clientId ?? ISSUED_CLIENT_ID,
    sub: options.sub ?? "user_subject_1",
    email: "owner@example.test",
    exp: options.expSeconds ?? Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...(options.nonce ? { nonce: options.nonce } : {}),
  });
}

export function credential(overrides: Partial<PlanCredential> = {}): PlanCredential {
  return {
    format: "your-move-siwc-credential/1",
    issuer: SIWC_ISSUER,
    subject: "user_subject_1",
    email: "owner@example.test",
    client_id: ISSUED_CLIENT_ID,
    id_token: idTokenFor({}),
    access_token: "plan-access-1",
    refresh_token: "plan-refresh-1",
    token_type: "Bearer",
    expires_at: Date.now() + 60 * 60 * 1000,
    scopes: [
      "chatgpt.tokens.use.direct",
      "email",
      "offline_access",
      "openid",
      "profile",
      "resource.invoke",
    ],
    saved_at: new Date().toISOString(),
    ...overrides,
  };
}

export const bundleFor = (overrides: Partial<PlanCredential> = {}) =>
  encodeCredentialBundle(credential(overrides));

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export type TokenRequest = Record<string, string>;

/**
 * Handles the auth-server URLs; returns undefined for anything else so a caller can chain it.
 * `token` answers the token endpoint (code exchange and refresh).
 */
export function fakeAuthServer(options: {
  token?: (form: TokenRequest) => Response;
  revoked?: TokenRequest[];
}) {
  const tokenRequests: TokenRequest[] = [];
  const handle = (url: string, init?: RequestInit): Response | undefined => {
    if (url === SIWC_DISCOVERY_URL) {
      return jsonResponse({
        issuer: SIWC_ISSUER,
        jwks_uri: FAKE_JWKS_URL,
        revocation_endpoint: FAKE_REVOCATION_URL,
      });
    }
    if (url === FAKE_JWKS_URL) {
      const jwk = publicKey.export({ format: "jwk" });
      return jsonResponse({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] });
    }
    if (url === SIWC_TOKEN_URL) {
      const form = Object.fromEntries(new URLSearchParams(String(init?.body)));
      tokenRequests.push(form);
      return (
        options.token?.(form) ??
        jsonResponse({
          access_token: `plan-access-${tokenRequests.length + 1}`,
          refresh_token: `plan-refresh-${tokenRequests.length + 1}`,
          expires_in: 3600,
          token_type: "Bearer",
          scope: "chatgpt.tokens.use.direct email offline_access openid profile resource.invoke",
        })
      );
    }
    if (url === FAKE_REVOCATION_URL) {
      options.revoked?.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return new Response(null, { status: 200 });
    }
    return undefined;
  };
  return { handle, tokenRequests };
}

/** A Responses API event stream, as OpenAI sends it. */
export function sseResponse(events: readonly Record<string, unknown>[], status = 200): Response {
  const body = events
    .map((event) => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

export function completedWith(output: readonly Record<string, unknown>[]) {
  return sseResponse([
    { type: "response.created", response: { id: "resp_1", output: [] } },
    ...output.map((item) => ({ type: "response.output_item.done", item })),
    { type: "response.completed", response: { id: "resp_1", output } },
  ]);
}
