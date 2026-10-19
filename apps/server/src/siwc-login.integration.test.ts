import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIWC_AUTHORIZE_URL, SIWC_RESOURCE, decodeCredentialBundle } from "./chatgpt-plan.js";
import { CALLBACK_PATH, runSiwcLogin } from "./siwc-login.js";
import { ISSUED_CLIENT_ID, fakeAuthServer, idTokenFor, jsonResponse } from "./siwc.fixture.js";

// `npm run siwc:login` against a fake OpenAI auth server, with a real 127.0.0.1 callback listener.
// The "browser" reads the authorize URL and calls back the way OpenAI's redirect would.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function harness(options: { grantedScope?: string; callbackClientId?: string | null } = {}) {
  const stateDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r4-siwc-login-"));
  directories.push(stateDir);
  const authorizeUrls: URL[] = [];
  let pendingNonce = "";
  const auth = fakeAuthServer({
    token: (form) =>
      jsonResponse({
        access_token: "plan-access-login",
        refresh_token: "plan-refresh-login",
        id_token: idTokenFor({ clientId: form.client_id!, nonce: pendingNonce }),
        token_type: "Bearer",
        expires_in: 3600,
        scope:
          options.grantedScope ??
          "chatgpt.tokens.use.direct email offline_access openid profile resource.invoke",
      }),
  });
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const handled = auth.handle(String(input), init);
    if (handled) return handled;
    return globalThis.fetch(input, init); // the simulated browser's callback request
  });
  const openBrowser = (url: string) => {
    const authorize = new URL(url);
    authorizeUrls.push(authorize);
    pendingNonce = authorize.searchParams.get("nonce")!;
    const callback = new URL(authorize.searchParams.get("redirect_uri")!);
    callback.searchParams.set("code", "auth-code-1");
    callback.searchParams.set("state", authorize.searchParams.get("state")!);
    const issued =
      options.callbackClientId === undefined ? ISSUED_CLIENT_ID : options.callbackClientId;
    if (issued) callback.searchParams.set("client_id", issued);
    setTimeout(() => void globalThis.fetch(callback), 5);
  };
  const run = () =>
    runSiwcLogin({
      fetcher,
      stateDir,
      openBrowser,
      log: () => undefined,
      port: 0,
      timeoutMs: 10_000,
    });
  return { run, authorizeUrls, auth, stateDir };
}

describe("siwc:login (R4 Track D #9, owner machine)", () => {
  it("registers with dynamic_agent_client, PKCE S256, the host id and the plan scopes, then writes an importable bundle", async () => {
    const h = harness();
    const { credential, bundlePath } = await h.run();

    const authorize = h.authorizeUrls[0]!;
    expect(`${authorize.origin}${authorize.pathname}`).toBe(SIWC_AUTHORIZE_URL);
    const params = Object.fromEntries(authorize.searchParams);
    expect(params).toMatchObject({
      client_id: "dynamic_agent_client",
      agent_name_hint: "Your Move",
      response_type: "code",
      scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
      resource: SIWC_RESOURCE,
      code_challenge_method: "S256",
    });
    expect(params.ext_agent_host_id).toMatch(/^urn:uuid:[0-9a-f-]{36}$/u);
    expect(params.redirect_uri).toMatch(
      new RegExp(`^http://127\\.0\\.0\\.1:\\d+${CALLBACK_PATH}$`, "u"),
    );
    expect(params).not.toHaveProperty("id_token_hint");

    const [exchange] = h.auth.tokenRequests;
    expect(exchange).toMatchObject({
      grant_type: "authorization_code",
      client_id: ISSUED_CLIENT_ID,
      code: "auth-code-1",
      redirect_uri: params.redirect_uri,
      resource: SIWC_RESOURCE,
    });
    expect(exchange).not.toHaveProperty("client_secret");
    expect(createHash("sha256").update(exchange!.code_verifier!).digest("base64url")).toBe(
      params.code_challenge,
    );

    expect(credential).toMatchObject({
      client_id: ISSUED_CLIENT_ID,
      subject: "user_subject_1",
      email: "owner@example.test",
      access_token: "plan-access-login",
      refresh_token: "plan-refresh-login",
    });
    expect(decodeCredentialBundle(readFileSync(bundlePath, "utf8"))).toEqual(credential);
    const saved = JSON.parse(readFileSync(join(h.stateDir, "siwc.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(saved.registration).toEqual({
      client_id: ISSUED_CLIENT_ID,
      subject: "user_subject_1",
      email: "owner@example.test",
    });
    expect(JSON.stringify(saved)).not.toContain("plan-refresh-login");

    // A returning sign-in reuses the issued client id and the same host id, without the name hint.
    await h.run();
    const again = Object.fromEntries(h.authorizeUrls[1]!.searchParams);
    expect(again.client_id).toBe(ISSUED_CLIENT_ID);
    expect(again.ext_agent_host_id).toBe(params.ext_agent_host_id);
    expect(again).not.toHaveProperty("agent_name_hint");
    expect(again.login_hint).toBe("owner@example.test");
  });

  it("stops when plan use was not granted, and when the registration came back incomplete", async () => {
    await expect(
      harness({ grantedScope: "openid email profile offline_access" }).run(),
    ).rejects.toThrow("SIWC_PLAN_USAGE_NOT_ENABLED");
    await expect(harness({ callbackClientId: null }).run()).rejects.toThrow(
      "SIWC_REGISTRATION_INCOMPLETE",
    );
  });
});
