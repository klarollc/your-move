import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SIWC_RESOURCE,
  createPlanAccess,
  decodeCredentialBundle,
  encodeCredentialBundle,
  refreshPlanCredential,
  verifyIdToken,
} from "./chatgpt-plan.js";
import { openIntegrationsVault } from "./integrations-vault.js";
import {
  ISSUED_CLIENT_ID,
  credential,
  fakeAuthServer,
  idTokenFor,
  jsonResponse,
  otherKey,
  signIdToken,
} from "./siwc.fixture.js";

const directories: string[] = [];
const vaults: ReturnType<typeof openIntegrationsVault>[] = [];
afterEach(() => {
  for (const vault of vaults.splice(0)) vault.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function vaultWith(saved: ReturnType<typeof credential>) {
  const directory = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r4-plan-"));
  directories.push(directory);
  const vault = openIntegrationsVault({
    dataDir: directory,
    encryptionKey: Buffer.alloc(32, 9).toString("base64"),
  });
  vaults.push(vault);
  vault.savePlanCredential(JSON.stringify(saved), saved.email);
  return vault;
}

const fetcherFor = (server: ReturnType<typeof fakeAuthServer>) =>
  vi.fn<typeof fetch>(async (input, init) => {
    const handled = server.handle(String(input), init);
    if (!handled) throw new Error(`unexpected ${String(input)}`);
    return handled;
  });

describe("ChatGPT plan credential (R4 Track D)", () => {
  it("round-trips the import bundle and rejects anything else", () => {
    const original = credential();
    expect(decodeCredentialBundle(encodeCredentialBundle(original))).toEqual(original);
    expect(decodeCredentialBundle("not-a-bundle")).toBeUndefined();
    const dynamic = encodeCredentialBundle({ ...original, client_id: "dynamic_agent_client" });
    expect(decodeCredentialBundle(dynamic)).toBeUndefined();
  });

  it("refreshes with the issued client id, the refresh token and the resource, and replaces the set together", async () => {
    const server = fakeAuthServer({});
    const next = await refreshPlanCredential(credential(), fetcherFor(server), 1_000_000);
    expect(server.tokenRequests).toEqual([
      {
        grant_type: "refresh_token",
        client_id: ISSUED_CLIENT_ID,
        refresh_token: "plan-refresh-1",
        resource: SIWC_RESOURCE,
      },
    ]);
    expect(next.access_token).toBe("plan-access-2");
    expect(next.refresh_token).toBe("plan-refresh-2");
    expect(next.expires_at).toBe(1_000_000 + 3_600_000);
  });

  it("refreshes near expiry, once, even when two turns ask at the same time", async () => {
    const server = fakeAuthServer({});
    const vault = vaultWith(credential({ expires_at: Date.now() + 60_000 }));
    const access = createPlanAccess({ vault, fetcher: fetcherFor(server) });
    const [first, second] = await Promise.all([access.getAccessToken(), access.getAccessToken()]);
    expect(first).toBe("plan-access-2");
    expect(second).toBe("plan-access-2");
    expect(server.tokenRequests).toHaveLength(1);
    const stored = JSON.parse(vault.getPlanCredential()!) as { refresh_token: string };
    expect(stored.refresh_token).toBe("plan-refresh-2");
    // Fresh now: no further refresh.
    expect(await access.getAccessToken()).toBe("plan-access-2");
    expect(server.tokenRequests).toHaveLength(1);
  });

  it("marks the plan for re-sign-in on an unusable refresh token, and keeps it on a transient failure", async () => {
    const terminal = fakeAuthServer({
      token: () => jsonResponse({ error: "invalid_grant" }, 400),
    });
    const expiring = vaultWith(credential({ expires_at: Date.now() + 1_000 }));
    const access = createPlanAccess({ vault: expiring, fetcher: fetcherFor(terminal) });
    expect(await access.getAccessToken()).toBeNull();
    expect(expiring.getPlanStatus().status).toBe("needs_reauth");
    expect(access.isActive()).toBe(false);

    const transient = fakeAuthServer({ token: () => jsonResponse({}, 503) });
    const stillValid = vaultWith(credential({ expires_at: Date.now() + 60_000 }));
    const second = createPlanAccess({ vault: stillValid, fetcher: fetcherFor(transient) });
    expect(await second.getAccessToken()).toBe("plan-access-1");
    expect(stillValid.getPlanStatus().status).toBe("connected");
  });

  it("verifies the ID token against the published keys: signature, issuer, audience, expiry, nonce", async () => {
    const fetcher = fetcherFor(fakeAuthServer({}));
    const base = { fetcher, clientId: ISSUED_CLIENT_ID, nowMs: Date.now() };
    await expect(
      verifyIdToken(idTokenFor({ nonce: "n1" }), { ...base, nonce: "n1" }),
    ).resolves.toEqual({
      sub: "user_subject_1",
      email: "owner@example.test",
    });
    await expect(
      verifyIdToken(idTokenFor({ nonce: "n1" }), { ...base, nonce: "n2" }),
    ).rejects.toThrow("ID_TOKEN_NONCE_INVALID");
    await expect(verifyIdToken(idTokenFor({ clientId: "someone_else" }), base)).rejects.toThrow(
      "ID_TOKEN_AUDIENCE_INVALID",
    );
    const expired = idTokenFor({ expSeconds: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyIdToken(expired, base)).rejects.toThrow("ID_TOKEN_EXPIRED");
    await expect(verifyIdToken(expired, { ...base, allowExpired: true })).resolves.toBeTruthy();
    const forged = signIdToken(
      { iss: "https://auth.openai.com", aud: ISSUED_CLIENT_ID, sub: "x", exp: 9e9 },
      otherKey,
    );
    await expect(verifyIdToken(forged, base)).rejects.toThrow("ID_TOKEN_SIGNATURE_INVALID");
  });
});
