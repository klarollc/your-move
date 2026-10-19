import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHostedApp, type HostedApp } from "./hosted-app.js";

const origin = "https://work-creation.example.test";
const accessPassword = "r2-work-creation-tests-only";
const sessionSigningKey = Buffer.alloc(32, 9).toString("base64");
const credentialEncryptionKey = Buffer.alloc(32, 7).toString("base64");
const directories: string[] = [];
const apps: HostedApp[] = [];

const contractJson = JSON.stringify({
  outcome: "Owners see provider status on one page.",
  scope: ["Status line per provider"],
  exclusions: ["Billing"],
  acceptanceCriteria: ["Status shows connected, disconnected, or needs renewal"],
  permissionCeiling: "draft_only",
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Fake providers: a model list for OpenAI, and a chat completion that returns a contract.
function fakeFetch(completion: string = contractJson): typeof fetch {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url === "https://api.openai.com/v1/models")
      return jsonResponse({ data: [{ id: "gpt-4o-mini" }] });
    if (url === "https://api.openai.com/v1/chat/completions") {
      return jsonResponse({ choices: [{ message: { content: completion } }] });
    }
    return jsonResponse({ code: "NOT_FOUND" }, 404);
  });
}

function createApp(providerFetch: typeof fetch): HostedApp {
  const dataDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r2-work-"));
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
  return String(response.headers["set-cookie"]).split(";")[0]!;
}

async function connectOpenAI(app: HostedApp, cookie: string): Promise<void> {
  const response = await app.inject({
    method: "POST",
    url: "/api/providers/openai",
    headers: { origin, cookie },
    payload: { apiKey: "sk-r2-test-key-0000" },
  });
  if (response.statusCode !== 201) throw new Error(`CONNECT_FAILED_${response.statusCode}`);
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("R2 plain-language work creation API", () => {
  it("requires an owner session on every work-draft route", async () => {
    const app = createApp(fakeFetch());
    const response = await app.inject({ method: "GET", url: "/api/work-drafts" });
    expect(response.statusCode).toBe(401);
  });

  it("drafts from a description, returns prose only, and never exposes schema or JSON", async () => {
    const app = createApp(fakeFetch());
    const cookie = await login(app);
    await connectOpenAI(app, cookie);

    const created = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin, cookie },
      payload: { description: "I want owners to see provider status clearly." },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.status).toBe("draft");
    expect(body.prose.doneWhen).toEqual(["Status shows connected, disconnected, or needs renewal"]);
    // The owner-facing text is the prose fields only; the API envelope is not shown to the owner.
    const ownerText = [
      body.prose.achieve,
      ...body.prose.inScope,
      ...body.prose.outOfScope,
      ...body.prose.doneWhen,
    ].join("\n");
    expect(ownerText).not.toMatch(/[{}]/);
    expect(ownerText).not.toMatch(/permissionCeiling|draft_only|acceptanceCriteria/);
  });

  it("automatic selection tries the next listed model when its preferred model is unavailable", async () => {
    const attemptedModels: string[] = [];
    const providerFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://api.openai.com/v1/models") {
        return jsonResponse({ data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o" }] });
      }
      if (url === "https://api.openai.com/v1/chat/completions") {
        const body = JSON.parse(String(init?.body)) as { model: string };
        attemptedModels.push(body.model);
        if (body.model === "gpt-4o-mini") return new Response("model unavailable", { status: 404 });
        return jsonResponse({ choices: [{ message: { content: contractJson } }] });
      }
      return jsonResponse({ code: "NOT_FOUND" }, 404);
    });
    const app = createApp(providerFetch);
    const cookie = await login(app);
    await connectOpenAI(app, cookie);

    const manualSelection = await app.inject({
      method: "POST",
      url: "/api/model-selection",
      headers: { origin, cookie },
      payload: { mode: "specific", provider: "openai", modelId: "gpt-4o" },
    });
    expect(manualSelection.statusCode).toBe(200);
    const manuallyDrafted = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin, cookie },
      payload: { description: "Create a bounded item" },
    });
    expect(manuallyDrafted.statusCode).toBe(201);
    expect(attemptedModels).toEqual(["gpt-4o"]);

    const automaticSelection = await app.inject({
      method: "POST",
      url: "/api/model-selection",
      headers: { origin, cookie },
      payload: { mode: "automatic" },
    });
    expect(automaticSelection.statusCode).toBe(200);
    attemptedModels.length = 0;
    const created = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin, cookie },
      payload: { description: "Create a bounded item" },
    });

    expect(created.statusCode).toBe(201);
    expect(attemptedModels).toEqual(["gpt-4o-mini", "gpt-4o"]);
  });

  it("returns a plain error (no draft stored) when the model output is not a valid contract", async () => {
    const app = createApp(fakeFetch("I think you should do it differently."));
    const cookie = await login(app);
    await connectOpenAI(app, cookie);
    const response = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin, cookie },
      payload: { description: "Do the thing" },
    });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ code: "CONTRACT_DRAFT_INVALID" });
    const list = await app.inject({ method: "GET", url: "/api/work-drafts", headers: { cookie } });
    expect(list.json().drafts).toEqual([]);
  });

  it("refuses to draft when no provider is connected", async () => {
    const app = createApp(fakeFetch());
    const cookie = await login(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin, cookie },
      payload: { description: "Anything" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "PROVIDER_NOT_CONNECTED" });
  });

  it("gates approval: a draft is not approved until an explicit approve call, and approval is one-way", async () => {
    const app = createApp(fakeFetch());
    const cookie = await login(app);
    await connectOpenAI(app, cookie);

    const created = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin, cookie },
      payload: { description: "Ship it" },
    });
    const id = created.json().id as string;

    // Creating or revising never approves.
    const revised = await app.inject({
      method: "POST",
      url: `/api/work-drafts/${id}/revise`,
      headers: { origin, cookie },
      payload: { feedback: "Make it smaller" },
    });
    expect(revised.json().status).toBe("draft");

    const approved = await app.inject({
      method: "POST",
      url: `/api/work-drafts/${id}/approve`,
      headers: { origin, cookie },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("approved");

    // Approved work cannot be revised or re-approved.
    const reRevise = await app.inject({
      method: "POST",
      url: `/api/work-drafts/${id}/revise`,
      headers: { origin, cookie },
      payload: { feedback: "Change it after approval" },
    });
    expect(reRevise.statusCode).toBe(409);
    const reApprove = await app.inject({
      method: "POST",
      url: `/api/work-drafts/${id}/approve`,
      headers: { origin, cookie },
    });
    expect(reApprove.statusCode).toBe(409);
  });

  it("rejects cross-origin writes to work-draft routes", async () => {
    const app = createApp(fakeFetch());
    const cookie = await login(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/work-drafts",
      headers: { origin: "https://evil.example.test", cookie },
      payload: { description: "Sneaky" },
    });
    expect(response.statusCode).toBe(403);
  });
});
