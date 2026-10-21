import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHostedApp, type HostedApp } from "./hosted-app.js";

const origin = "https://your-move.example.test";
const accessPassword = "r1-provider-workflow-tests-only";
const sessionSigningKey = Buffer.alloc(32, 9).toString("base64");
const credentialEncryptionKey = Buffer.alloc(32, 7).toString("base64");
const directories: string[] = [];
const apps: HostedApp[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createApp(providerFetch: typeof fetch): HostedApp {
  const dataDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "your-move-r1-provider-api-"));
  directories.push(dataDir);
  const app = createHostedApp({
    mode: "test",
    appOrigin: origin,
    accessPassword,
    sessionSigningKey,
    credentialEncryptionKey,
    dataDir,
    providerFetch,
  });
  apps.push(app);
  return app;
}

async function login(app: HostedApp): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/session",
    headers: { origin },
    payload: { password: accessPassword },
  });
  if (response.statusCode !== 200) throw new Error(`TEST_LOGIN_FAILED_${response.statusCode}`);
  return String(response.headers["set-cookie"]).split(";")[0]!;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("hosted provider lifecycle API", () => {
  it("does not let a cross-origin GET persist a provider reauth transition", async () => {
    const credential = "sk-test-readonly-credential";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    const app = createApp(fetcher);
    const cookie = await login(app);

    const connected = await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: credential },
    });
    expect(connected.statusCode).toBe(201);

    const crossOriginRead = await app.inject({
      method: "GET",
      url: "/api/providers/openai/models",
      headers: { cookie, origin: "https://attacker.example.test" },
    });
    expect(crossOriginRead.statusCode).toBe(404);

    const state = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(state.json().providers[0]).toEqual({ id: "openai", status: "connected" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("validates an OpenAI key before saving it and never returns credential material", async () => {
    const credential = "sk-r1-mocked-openai-credential";
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: [{ id: "gpt-r1-test" }] }),
    );
    const app = createApp(fetcher);
    const cookie = await login(app);

    const connected = await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: credential },
    });

    expect(connected.statusCode).toBe(201);
    expect(connected.json()).toEqual({
      provider: "openai",
      status: "connected",
      models: [{ id: "gpt-r1-test", label: "gpt-r1-test" }],
    });
    expect(JSON.stringify(connected.json())).not.toContain(credential);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      `Bearer ${credential}`,
    );

    const status = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(status.json()).toMatchObject({
      providers: [
        { id: "openai", status: "connected" },
        { id: "anthropic", status: "disconnected" },
      ],
      modelSelection: { mode: "automatic" },
    });
    expect(JSON.stringify(status.json())).not.toContain(credential);
  });

  it("does not replace a saved provider key when validation rejects a pasted key", async () => {
    const credential = "sk-r1-invalid-test-key";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    const app = createApp(fetcher);
    const cookie = await login(app);

    const connected = await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: "sk-r1-initial-mocked-key" },
    });
    expect(connected.statusCode).toBe(201);

    const rejected = await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: credential },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toEqual({ code: "INVALID_CREDENTIALS" });
    expect(JSON.stringify(rejected.json())).not.toContain(credential);

    const status = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(status.json().providers[0]).toEqual({ id: "openai", status: "connected" });
  });

  it("marks rejected stored credentials for reauth and reconnects without losing model choice", async () => {
    const initialCredential = "sk-r1-initial-mocked-key";
    const replacementCredential = "sk-r1-replacement-mocked-key";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }));
    const app = createApp(fetcher);
    const cookie = await login(app);

    await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: initialCredential },
    });
    const selection = await app.inject({
      method: "POST",
      url: "/api/model-selection",
      headers: { origin, cookie },
      payload: { mode: "specific", provider: "openai", modelId: "gpt-r1-test" },
    });
    expect(selection.statusCode).toBe(200);

    const rejected = await app.inject({
      method: "POST",
      url: "/api/providers/openai/models/refresh",
      headers: { origin, cookie },
    });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.json()).toEqual({ code: "PROVIDER_REAUTH_REQUIRED" });

    const afterRejection = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(afterRejection.json().providers[0]).toEqual({ id: "openai", status: "needs_reauth" });

    const reconnected = await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: replacementCredential },
    });
    expect(reconnected.statusCode).toBe(201);
    expect(JSON.stringify(reconnected.json())).not.toContain(replacementCredential);

    const finalState = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(finalState.json()).toMatchObject({
      providers: [
        { id: "openai", status: "connected" },
        { id: "anthropic", status: "disconnected" },
      ],
      modelSelection: { mode: "specific", provider: "openai", modelId: "gpt-r1-test" },
    });
  });

  it("disconnects immediately without erasing the manual model preference", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-r1-test" }] }));
    const app = createApp(fetcher);
    const cookie = await login(app);

    await app.inject({
      method: "POST",
      url: "/api/providers/openai",
      headers: { origin, cookie },
      payload: { apiKey: "sk-r1-mocked-key" },
    });
    await app.inject({
      method: "POST",
      url: "/api/model-selection",
      headers: { origin, cookie },
      payload: { mode: "specific", provider: "openai", modelId: "gpt-r1-test" },
    });

    const disconnected = await app.inject({
      method: "DELETE",
      url: "/api/providers/openai",
      headers: { origin, cookie },
    });
    expect(disconnected.statusCode).toBe(200);
    expect(disconnected.json()).toEqual({ provider: "openai", status: "disconnected" });

    const status = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(status.json()).toMatchObject({
      providers: [
        { id: "openai", status: "disconnected" },
        { id: "anthropic", status: "disconnected" },
      ],
      modelSelection: { mode: "specific", provider: "openai", modelId: "gpt-r1-test" },
    });
  });
});
