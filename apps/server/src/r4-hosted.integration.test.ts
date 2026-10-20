import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { sharedLampVerdictMessageSchema } from "@cuckcode/contracts";

import { openExecutionStore } from "./execution-store.js";
import { createHostedApp, projectExecutionConversation, type HostedApp } from "./hosted-app.js";
import { PLAN_LIMIT_NOTE } from "./chatgpt-plan.js";
import { LAMP_V2_MODEL } from "./lamp-v2.js";
import {
  FAKE_REVOCATION_URL,
  bundleFor,
  completedWith,
  fakeAuthServer,
  jsonResponse,
  sseResponse,
} from "./siwc.fixture.js";

// R4 end-to-end on the hosted app: lamp tap + feed (A), materials (B), triage (C), plan auth (D).

const origin = "https://r4-hosted.example.test";
const accessPassword = "r4-hosted-tests-only-pw";
const sessionSigningKey = Buffer.alloc(32, 7).toString("base64");
const credentialEncryptionKey = Buffer.alloc(32, 8).toString("base64");
const directories: string[] = [];
const apps: HostedApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const contract = {
  outcome: "The README explains setup.",
  scope: ["Read the README", "Propose a setup section"],
  exclusions: ["Code changes"],
  acceptanceCriteria: ["README has a setup section"],
  permissionCeiling: "draft_only",
};

type ChatBody = {
  messages: { role: string; content: unknown }[];
  tools?: unknown[];
};
type Call = { id: string; name: string; args: unknown };
const toolReply = (content: string | null, ...calls: Call[]) =>
  jsonResponse({
    choices: [
      {
        message: {
          content,
          tool_calls: calls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.args) },
          })),
        },
      },
    ],
  });
const textReply = (text: string) => jsonResponse({ choices: [{ message: { content: text } }] });
const fetchDocs = (id: string) => ({
  id,
  name: "web_fetch",
  args: { url: "https://docs.example.com/setup" },
});

type ResponsesBody = Record<string, unknown> & { input: Record<string, unknown>[] };

function world(options: {
  turn?: (body: ChatBody, index: number) => Response | Promise<Response>;
  plan?: (body: ResponsesBody, index: number) => Response | Promise<Response>;
}) {
  const turns: ChatBody[] = [];
  const planTurns: ResponsesBody[] = [];
  const revoked: Record<string, string>[] = [];
  const auth = fakeAuthServer({ revoked });
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const authorization =
      (init?.headers as Record<string, string> | undefined)?.authorization ?? "";
    const handled = auth.handle(url.href, init);
    if (handled) return handled;
    if (url.href === "https://api.openai.com/v1/models") {
      if (authorization.startsWith("Bearer plan-")) {
        return jsonResponse({
          models: [
            { slug: "hidden-model", visibility: "hide" },
            { slug: "plan-model-1", display_name: "Plan Model", visibility: "list" },
          ],
        });
      }
      return jsonResponse({ data: [{ id: "gpt-4o-mini" }] });
    }
    if (url.href === "https://api.openai.com/v1/responses") {
      const body = JSON.parse(String(init?.body)) as ResponsesBody;
      planTurns.push(body);
      return options.plan!(body, planTurns.length - 1);
    }
    if (url.href === "https://api.openai.com/v1/chat/completions") {
      const body = JSON.parse(String(init?.body)) as ChatBody;
      if (!body.tools) return textReply(JSON.stringify(contract));
      turns.push(body);
      return options.turn!(body, turns.length - 1);
    }
    if (url.hostname === "api.github.com" && url.pathname === "/user") {
      return jsonResponse({ login: "octo" });
    }
    if (url.hostname === "docs.example.com") {
      return new Response("<title>Docs</title><main><p>Install with npm ci.</p></main>", {
        headers: { "content-type": "text/html" },
      });
    }
    return jsonResponse({ code: "UNEXPECTED_URL", url: url.href }, 599);
  });
  return { fetcher, turns, planTurns, auth, revoked };
}

/** A fake Ollama: /api/tags lists the locked model; /api/chat answers "lamp" for review handoffs. */
function ollama(options: { fail?: boolean; requireToken?: string } = {}) {
  const chats: { url: string; text: string; authorization?: string }[] = [];
  const lampFetch = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (options.requireToken && headers.Authorization !== `Bearer ${options.requireToken}`) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    if (url.endsWith("/api/tags")) return jsonResponse({ models: [{ name: LAMP_V2_MODEL }] });
    if (options.fail) throw new Error("ECONNREFUSED");
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const text = body.messages[0]!.content.split("Utterance:\n").at(-1)!;
    chats.push({
      url,
      text,
      ...(headers.Authorization ? { authorization: headers.Authorization } : {}),
    });
    return jsonResponse({ message: { content: /review/i.test(text) ? "lamp" : "no-lamp" } });
  });
  return { lampFetch, chats };
}

function createApp(fetcher: typeof fetch, lampFetch: typeof fetch): HostedApp {
  const directory = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r4-hosted-"));
  directories.push(directory);
  const app = createHostedApp({
    mode: "test",
    appOrigin: origin,
    accessPassword,
    sessionSigningKey,
    credentialEncryptionKey,
    dataDir: directory,
    providerFetch: fetcher,
    lampFetch,
    resolveHost: async () => ["93.184.216.34"],
  });
  apps.push(app);
  (app as HostedApp & { dataDir?: string }).dataDir = directory;
  return app;
}
const dataDirOf = (app: HostedApp) => (app as HostedApp & { dataDir: string }).dataDir;

async function login(app: HostedApp): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/session",
    headers: { origin },
    payload: { password: accessPassword },
  });
  return String(response.headers["set-cookie"]).split(";")[0]!;
}

const send = (
  app: HostedApp,
  cookie: string,
  method: "POST" | "PUT" | "DELETE",
  url: string,
  payload?: object,
) => app.inject({ method, url, headers: { origin, cookie }, ...(payload ? { payload } : {}) });
const get = (app: HostedApp, cookie: string, url: string) =>
  app.inject({ method: "GET", url, headers: { cookie } });

async function setUp(app: HostedApp, { key = true } = {}) {
  const cookie = await login(app);
  if (key) {
    expect(
      (
        await send(app, cookie, "POST", "/api/providers/openai", {
          apiKey: "sk-test-r4-placeholder",
        })
      ).statusCode,
    ).toBe(201);
  }
  return cookie;
}

async function newDraft(app: HostedApp, cookie: string) {
  const created = await send(app, cookie, "POST", "/api/work-drafts", {
    description: "Add a setup section",
  });
  expect(created.statusCode).toBe(201);
  return created.json() as { id: string; revision: number };
}

async function approve(app: HostedApp, cookie: string, draftId: string) {
  const approved = await send(app, cookie, "POST", `/api/work-drafts/${draftId}/approve`);
  expect(approved.statusCode).toBe(200);
  return approved.json() as { execution: { id: string } };
}

type ExecutionView = {
  id: string;
  status: string;
  turnCount: number;
  maxTurns: number;
  attempt: number;
  output: string | null;
  error: string | null;
  fundedBy: string | null;
  utterances: { turnIndex: number; text: string }[];
  conversation: { role: "agent" | "owner"; text: string; turnIndex?: number }[];
  lampVerdicts: {
    utteranceId: string;
    turnIndex: number;
    verdict: string;
    ownerChoice: string | null;
  }[];
  proposals: { id: string; status: string }[];
};

const view = async (app: HostedApp, cookie: string, id: string) =>
  (await get(app, cookie, `/api/work-executions/${id}`)).json() as ExecutionView;

async function waitUntil(
  app: HostedApp,
  cookie: string,
  id: string,
  ok: (v: ExecutionView) => boolean,
) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const current = await view(app, cookie, id);
    if (ok(current)) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`never reached the condition: ${JSON.stringify(await view(app, cookie, id))}`);
}

const auditOf = (app: HostedApp, executionId: string) => {
  const store = openExecutionStore({ dataDir: dataDirOf(app) });
  try {
    return store.listAudit(executionId);
  } finally {
    store.close();
  }
};

describe("execution conversation projection", () => {
  it("includes legacy unmarked owner turns after the startup prompt", () => {
    expect(
      projectExecutionConversation([
        { role: "system", content: "System prompt." },
        { role: "user", content: "Begin the approved work now." },
        { role: "assistant", content: "Which branch should I use?", toolCalls: [] },
        { role: "user", content: "Use main." },
        { role: "assistant", content: "Done on main.", toolCalls: [] },
      ]),
    ).toEqual({
      utterances: [
        { turnIndex: 1, text: "Which branch should I use?" },
        { turnIndex: 2, text: "Done on main." },
      ],
      conversation: [
        { role: "agent", turnIndex: 1, text: "Which branch should I use?" },
        { role: "owner", text: "Use main." },
        { role: "agent", turnIndex: 2, text: "Done on main." },
      ],
    });
  });

  it("does not expose a legacy restart instruction as an owner reply", () => {
    const restartInstruction =
      "The previous attempt stopped before finishing (error). This is a new attempt: continue the work from where it left off.";

    expect(
      projectExecutionConversation([
        { role: "system", content: "System prompt." },
        { role: "user", content: "Begin the approved work now." },
        { role: "assistant", content: "I need one detail before I continue.", toolCalls: [] },
        { role: "user", content: restartInstruction },
        { role: "assistant", content: "I resumed the previous work.", toolCalls: [] },
      ]).conversation,
    ).toEqual([
      { role: "agent", turnIndex: 1, text: "I need one detail before I continue." },
      { role: "agent", turnIndex: 2, text: "I resumed the previous work." },
    ]);
  });

  it("does not expose a marked restart control message as an owner reply", () => {
    const restartInstruction =
      "The previous attempt stopped before finishing (error). This is a new attempt: continue the work from where it left off.";

    expect(
      projectExecutionConversation([
        { role: "system", content: "System prompt." },
        { role: "user", content: "Begin the approved work now." },
        { role: "assistant", content: "I need one detail before I continue.", toolCalls: [] },
        { role: "user", content: restartInstruction, ownerReply: false },
        { role: "assistant", content: "I resumed the previous work.", toolCalls: [] },
      ]).conversation,
    ).toEqual([
      { role: "agent", turnIndex: 1, text: "I need one detail before I continue." },
      { role: "agent", turnIndex: 2, text: "I resumed the previous work." },
    ]);
  });
});

describe("R4 Track A — the lamp on the hosted loop", () => {
  it("taps once per committed non-empty utterance; verdicts are stored, textless, and joinable to the transcript", async () => {
    const { lampFetch, chats } = ollama();
    const { fetcher } = world({
      turn: (_body, index) =>
        index === 0
          ? toolReply(null, fetchDocs("call_a")) // tool-only turn: empty content, no tap
          : index === 1
            ? toolReply("Reading the setup docs first.", fetchDocs("call_b"))
            : textReply("The setup section is ready for your review."),
    });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    const done = await waitUntil(app, cookie, execution.id, (v) => v.lampVerdicts.length === 2);

    expect(done.status).toBe("waiting-on-you");
    expect(chats.map((chat) => chat.text)).toEqual([
      "Reading the setup docs first.",
      "The setup section is ready for your review.",
    ]);
    expect(chats.every((chat) => chat.url === "http://localhost:11434/api/chat")).toBe(true);
    expect(done.lampVerdicts.map((v) => [v.utteranceId, v.turnIndex, v.verdict])).toEqual([
      [`utterance_${execution.id}_2_1`, 2, "no-lamp"],
      [`utterance_${execution.id}_3_1`, 3, "lamp"],
    ]);
    expect(done.utterances).toEqual([
      { turnIndex: 2, text: "Reading the setup docs first." },
      { turnIndex: 3, text: "The setup section is ready for your review." },
    ]);
    expect(JSON.stringify(done.lampVerdicts)).not.toContain("ready for your review");
    const lamp = (await get(app, cookie, "/api/lamp")).json() as {
      latency: { count: number; p50Ms: number };
      degraded: boolean;
    };
    expect(lamp.latency.count).toBe(2);
    expect(lamp.degraded).toBe(false);
  });

  it("streams B's exact lamp.verdict message over the hosted /api/events, to the owner's own origin only", async () => {
    const { lampFetch } = ollama();
    const { fetcher } = world({
      turn: () => textReply("Here is the plan, ready for your review."),
    });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("ADDRESS_MISSING");
    const url = `ws://127.0.0.1:${address.port}/api/events`;

    const refused = async (headers: Record<string, string>) =>
      new Promise<number>((resolve) => {
        const socket = new WebSocket(url, { headers });
        socket.once("unexpected-response", (_request, response) =>
          resolve(response.statusCode ?? 0),
        );
        socket.once("open", () => resolve(101));
      });
    expect(await refused({ origin })).toBe(401);
    expect(await refused({ origin: "https://evil.example", cookie })).toBe(403);

    const socket = new WebSocket(url, { headers: { origin, cookie } });
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    const received = new Promise<unknown>((resolve) =>
      socket.once("message", (data) => resolve(JSON.parse(String(data)))),
    );
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    const message = (await received) as Record<string, unknown>;
    socket.close();

    expect(Object.keys(message).sort()).toEqual([
      "attemptId",
      "ts",
      "type",
      "utteranceId",
      "verdict",
    ]);
    expect(sharedLampVerdictMessageSchema.parse(message)).toEqual(message);
    expect(message).toMatchObject({
      type: "lamp.verdict",
      attemptId: execution.id,
      utteranceId: `utterance_${execution.id}_1_1`,
      verdict: "lamp",
    });
    expect(message).not.toHaveProperty("text");
  });

  it("never lets the lamp change the loop: a dead classifier leaves the run exactly as it would be", async () => {
    const { lampFetch } = ollama({ fail: true });
    const { fetcher } = world({ turn: () => textReply("All done, please review.") });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    const done = await waitUntil(app, cookie, execution.id, (v) => v.status === "waiting-on-you");
    expect(done.output).toBe("All done, please review.");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const lamp = (await get(app, cookie, "/api/lamp")).json() as { failures: number };
      if (lamp.failures > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const lamp = (await get(app, cookie, "/api/lamp")).json() as {
      failures: number;
      degraded: boolean;
    };
    expect(lamp).toMatchObject({ failures: 1, degraded: true });
    expect((await view(app, cookie, execution.id)).lampVerdicts).toEqual([]);
  });

  it("validates the owner's Ollama endpoint at connect, with the optional bearer token, and never returns the token", async () => {
    const { lampFetch, chats } = ollama({ requireToken: "tunnel-secret-1" });
    const { fetcher } = world({ turn: () => textReply("Ready for your review.") });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);

    const noToken = await send(app, cookie, "POST", "/api/lamp/endpoint", {
      baseUrl: "https://ollama.example.test/",
    });
    expect(noToken.statusCode).toBe(400);
    expect(noToken.json()).toEqual({ code: "LAMP_ENDPOINT_AUTH_REJECTED" });
    const bad = await send(app, cookie, "POST", "/api/lamp/endpoint", { baseUrl: "ftp://x.test" });
    expect(bad.json()).toEqual({ code: "LAMP_ENDPOINT_INVALID" });

    const saved = await send(app, cookie, "POST", "/api/lamp/endpoint", {
      baseUrl: "https://ollama.example.test/",
      token: "tunnel-secret-1",
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toEqual({
      baseUrl: "https://ollama.example.test",
      configured: true,
      tokenSet: true,
    });
    const status = await get(app, cookie, "/api/lamp");
    expect(status.body).not.toContain("tunnel-secret-1");
    expect(status.json()).toMatchObject({
      endpoint: { baseUrl: "https://ollama.example.test", configured: true, tokenSet: true },
      model: "qwen3:8b",
    });

    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    await waitUntil(app, cookie, execution.id, (v) => v.lampVerdicts.length === 1);
    expect(chats).toEqual([
      {
        url: "https://ollama.example.test/api/chat",
        text: "Ready for your review.",
        authorization: "Bearer tunnel-secret-1",
      },
    ]);
  });

  it("refuses an endpoint that does not serve the locked model", async () => {
    const lampFetch = vi.fn<typeof fetch>(async () =>
      jsonResponse({ models: [{ name: "llama3:8b" }] }),
    );
    const app = createApp(world({}).fetcher, lampFetch);
    const cookie = await setUp(app, { key: false });
    const response = await send(app, cookie, "POST", "/api/lamp/endpoint", {
      baseUrl: "http://10.0.0.5:11434",
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "LAMP_MODEL_MISSING", model: "qwen3:8b" });
  });
});

describe("R4 Track B — work_materials", () => {
  it("stores materials on the draft revision, injects them into the system prompt, and freezes them into the run", async () => {
    const { lampFetch } = ollama();
    const { fetcher, turns } = world({ turn: () => textReply("Done.") });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    const draft = await newDraft(app, cookie);
    const materials = {
      items: [
        { kind: "text", label: "Style notes", text: "Use short sentences. No jargon." },
        { kind: "url", url: "https://docs.example.com/setup" },
        { kind: "repo_path", repo: "octo/widgets", path: "README.md" },
      ],
    };
    const attached = await send(
      app,
      cookie,
      "PUT",
      `/api/work-drafts/${draft.id}/materials`,
      materials,
    );
    expect(attached.statusCode).toBe(200);
    expect(attached.json()).toMatchObject({ revision: draft.revision + 1, materials });
    expect(
      (
        await send(app, cookie, "PUT", `/api/work-drafts/${draft.id}/materials`, {
          items: [{ kind: "url", url: "javascript:alert(1)" }],
        })
      ).statusCode,
    ).toBe(400);

    const { execution } = await approve(app, cookie, draft.id);
    await waitUntil(app, cookie, execution.id, (v) => v.status === "waiting-on-you");
    const system = String(turns[0]!.messages[0]!.content);
    expect(system).toContain("Materials:");
    expect(system).toContain(
      "[1] Style notes (pasted text):\n<<<\nUse short sentences. No jargon.\n>>>",
    );
    expect(system).toContain("[2] (link): https://docs.example.com/setup");
    expect(system).toContain("[3] (repository path): octo/widgets — README.md");

    // Frozen: the stored run carries them, and the draft can no longer change them.
    const store = openExecutionStore({ dataDir: dataDirOf(app) });
    const stored = store.get(execution.id)!;
    store.close();
    expect(stored.revision).toBe(draft.revision + 1);
    expect(stored.transcript[0]).toEqual({ role: "system", content: system });
    const late = await send(app, cookie, "PUT", `/api/work-drafts/${draft.id}/materials`, {
      items: [],
    });
    expect(late.statusCode).toBe(409);
    expect(late.json()).toEqual({ code: "WORK_DRAFT_NOT_EDITABLE" });
  });
});

describe("R4 Track C — owner triage", () => {
  it("reply re-queues a waiting run and it resumes within its remaining turns", async () => {
    const { lampFetch } = ollama();
    const { fetcher, turns } = world({
      turn: (_body, index) =>
        index === 0 ? textReply("Which branch should I use?") : textReply("Done on main."),
    });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    await waitUntil(app, cookie, execution.id, (v) => v.status === "waiting-on-you");

    expect(
      (
        await send(app, cookie, "POST", `/api/work-executions/${execution.id}/reply`, {
          message: " ",
        })
      ).statusCode,
    ).toBe(400);
    const replied = await send(app, cookie, "POST", `/api/work-executions/${execution.id}/reply`, {
      message: "Use main.",
    });
    expect(replied.statusCode).toBe(200);
    const resumed = await waitUntil(
      app,
      cookie,
      execution.id,
      (v) => v.status === "waiting-on-you" && v.turnCount === 2,
    );
    expect(resumed).toMatchObject({ attempt: 1, maxTurns: 10, output: "Done on main." });
    expect(resumed.conversation).toEqual([
      { role: "agent", turnIndex: 1, text: "Which branch should I use?" },
      { role: "owner", text: "Use main." },
      { role: "agent", turnIndex: 2, text: "Done on main." },
    ]);
    expect(turns[1]!.messages.at(-1)).toEqual({ role: "user", content: "Use main." });
    expect(auditOf(app, execution.id).map((row) => [row.tool, row.resultSummary])).toContainEqual([
      "owner",
      "owner replied; run resumed",
    ]);

    // No turns left: reply is refused, and Close is still available.
    const db = new Database(join(dataDirOf(app), "executions.sqlite"));
    db.prepare("UPDATE work_executions SET turn_count = max_turns WHERE id = ?").run(execution.id);
    db.close();
    const noTurns = await send(app, cookie, "POST", `/api/work-executions/${execution.id}/reply`, {
      message: "More.",
    });
    expect(noTurns.json()).toEqual({ code: "WORK_EXECUTION_NO_TURNS_LEFT" });
    expect(
      (await send(app, cookie, "POST", `/api/work-executions/${execution.id}/close`)).statusCode,
    ).toBe(200);
  });

  it("reply is refused while a proposal waits for a decision", async () => {
    const { lampFetch } = ollama();
    const { fetcher } = world({
      turn: () =>
        toolReply("I propose a setup section.", {
          id: "call_p",
          name: "github_propose_write",
          args: {
            repo: "octo/widgets",
            path: "SETUP.md",
            content: "# Setup",
            message: "Add setup",
            base_sha: "",
          },
        }),
    });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    expect(
      (
        await send(app, cookie, "POST", "/api/integrations/github", {
          token: "ghp_placeholderplaceholderplaceholder1",
        })
      ).statusCode,
    ).toBe(201);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    const waiting = await waitUntil(app, cookie, execution.id, (v) => v.proposals.length === 1);
    const refused = await send(app, cookie, "POST", `/api/work-executions/${execution.id}/reply`, {
      message: "Hi",
    });
    expect(refused.json()).toEqual({ code: "PROPOSAL_PENDING" });

    // Close with a pending proposal: not sent (denied), both choices logged, status done.
    const closed = await send(app, cookie, "POST", `/api/work-executions/${execution.id}/close`);
    expect(closed.json()).toMatchObject({
      status: "done",
      proposals: [{ id: waiting.proposals[0]!.id, status: "denied" }],
    });
    expect(
      auditOf(app, execution.id)
        .filter((row) => row.tool === "owner")
        .map((row) => row.resultSummary),
    ).toEqual(["closed by the owner; proposal not sent", "closed as done by the owner"]);
  });

  it("close writes done (its only writer), stops a working run at the turn boundary, and done can be picked up again", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const { lampFetch } = ollama();
    const { fetcher, turns } = world({
      turn: async (_body, index) => {
        if (index === 0) {
          await hold;
          return toolReply("Fetching docs.", fetchDocs("call_late"));
        }
        return textReply("Picked up again.");
      },
    });
    const app = createApp(fetcher, lampFetch);
    const cookie = await setUp(app);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    await waitUntil(app, cookie, execution.id, () => turns.length === 1);
    const closed = await send(app, cookie, "POST", `/api/work-executions/${execution.id}/close`);
    expect(closed.json()).toMatchObject({ status: "done" });
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = await view(app, cookie, execution.id);
    expect(after).toMatchObject({ status: "done", turnCount: 0, utterances: [] });
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("docs.example.com"))).toBe(
      false,
    );
    expect(
      (await send(app, cookie, "POST", `/api/work-executions/${execution.id}/close`)).json(),
    ).toEqual({
      code: "WORK_EXECUTION_NOT_CLOSABLE",
    });
    expect(
      (
        await send(app, cookie, "POST", `/api/work-executions/${execution.id}/reply`, {
          message: "x",
        })
      ).json(),
    ).toEqual({ code: "WORK_EXECUTION_NOT_WAITING" });

    const restarted = await send(
      app,
      cookie,
      "POST",
      `/api/work-executions/${execution.id}/restart`,
    );
    expect(restarted.statusCode).toBe(201);
    const next = restarted.json() as { id: string; attempt: number };
    expect(next.attempt).toBe(2);
    await waitUntil(app, cookie, next.id, (v) => v.status === "waiting-on-you");

    // The only SQL that writes 'done' is closeRun's.
    const source = readFileSync(new URL("./execution-store.ts", import.meta.url), "utf8");
    expect(source.match(/status = 'done'/g)).toHaveLength(1);
    expect(source.indexOf("status = 'done'")).toBeGreaterThan(source.indexOf("closeRun("));
  });
});

describe("R4 Track D — Continue with ChatGPT (imported credential, Responses API)", () => {
  async function importPlan(app: HostedApp, cookie: string, overrides = {}) {
    return send(app, cookie, "POST", "/api/chatgpt-plan/import", { bundle: bundleFor(overrides) });
  }

  it("imports the credential, validates it, stores it encrypted, and never returns a token", async () => {
    const w = world({});
    const app = createApp(w.fetcher, ollama().lampFetch);
    const cookie = await setUp(app, { key: false });
    expect((await importPlan(app, cookie, { scopes: ["openid", "email"] })).json()).toEqual({
      code: "PLAN_SCOPE_MISSING",
    });
    expect((await importPlan(app, cookie, { subject: "someone_else" })).json()).toEqual({
      code: "INVALID_CREDENTIALS",
    });
    const imported = await importPlan(app, cookie);
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({
      status: "connected",
      active: true,
      email: "owner@example.test",
      inUseLabel: "Using ChatGPT plan",
      manageUsageUrl: "https://chatgpt.com/settings/usage",
    });
    const status = await get(app, cookie, "/api/chatgpt-plan");
    for (const secret of ["plan-access-1", "plan-refresh-1", "eyJ"])
      expect(status.body).not.toContain(secret);
    const raw = readFileSync(join(dataDirOf(app), "integrations.sqlite"));
    expect(raw.includes(Buffer.from("plan-refresh-1"))).toBe(false);

    const removed = await send(app, cookie, "DELETE", "/api/chatgpt-plan");
    expect(removed.json()).toMatchObject({ status: "disconnected", revoked: true });
    expect(w.revoked).toEqual([
      {
        token: "plan-refresh-1",
        token_type_hint: "refresh_token",
        client_id: "oaiapp_test_issued_client",
      },
    ]);
    expect(w.fetcher.mock.calls.some(([input]) => String(input) === FAKE_REVOCATION_URL)).toBe(
      true,
    );
  });

  it("runs work on the plan through the Responses API, round-tripping a namespaced function call", async () => {
    const w = world({
      plan: (_body, index) =>
        index === 0
          ? completedWith([
              {
                type: "function_call",
                id: "fc_1",
                call_id: "call_plan_1",
                name: "web_fetch",
                namespace: "your_move",
                arguments: JSON.stringify({ url: "https://docs.example.com/setup" }),
              },
            ])
          : completedWith([
              {
                type: "message",
                role: "assistant",
                content: [
                  { type: "output_text", text: "Setup is drafted, ready for your review." },
                ],
              },
            ]),
    });
    const app = createApp(w.fetcher, ollama().lampFetch);
    // A pasted key is connected too (drafting uses it); the active plan still wins for the run.
    const cookie = await setUp(app);
    expect((await importPlan(app, cookie)).statusCode).toBe(201);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    const done = await waitUntil(app, cookie, execution.id, (v) => v.status === "waiting-on-you");

    expect(w.turns).toHaveLength(0);
    expect(done).toMatchObject({
      fundedBy: "chatgpt_plan",
      turnCount: 2,
      output: "Setup is drafted, ready for your review.",
    });
    const [first, second] = w.planTurns;
    expect(first).toMatchObject({ model: "plan-model-1", store: false, stream: true });
    expect((first!.tools as { type: string; name: string }[])[0]).toMatchObject({
      type: "namespace",
      name: "your_move",
    });
    expect(String(first!.instructions)).toContain("You are carrying out one piece of work");
    expect(second!.input.slice(-2)).toEqual([
      {
        type: "function_call",
        call_id: "call_plan_1",
        name: "web_fetch",
        arguments: JSON.stringify({ url: "https://docs.example.com/setup" }),
        namespace: "your_move",
      },
      expect.objectContaining({ type: "function_call_output", call_id: "call_plan_1" }),
    ]);
    const output = String(second!.input.at(-1)!.output);
    expect(output).toContain("Install with npm ci.");
  });

  it("parks the run with an owner note on a plan usage limit, and the owner can resume it on their key", async () => {
    const w = world({
      plan: () =>
        sseResponse([
          { type: "response.created", response: { id: "r" } },
          {
            type: "response.failed",
            response: { error: { code: "subscription_sharing_usage_limit_exceeded" } },
          },
        ]),
      turn: () => textReply("Finished on the API key."),
    });
    const app = createApp(w.fetcher, ollama().lampFetch);
    const cookie = await setUp(app);
    expect((await importPlan(app, cookie)).statusCode).toBe(201);
    const { execution } = await approve(app, cookie, (await newDraft(app, cookie)).id);
    const parked = await waitUntil(app, cookie, execution.id, (v) => v.status === "waiting-on-you");
    expect(parked).toMatchObject({
      error: "PLAN_USAGE_LIMIT_REACHED",
      output: PLAN_LIMIT_NOTE,
      turnCount: 0,
    });
    expect((await get(app, cookie, "/api/chatgpt-plan")).json()).toMatchObject({
      limitReachedAt: expect.any(String),
    });

    expect(
      (await send(app, cookie, "POST", "/api/chatgpt-plan/active", { active: false })).json(),
    ).toMatchObject({ active: false });
    expect(
      (
        await send(app, cookie, "POST", `/api/work-executions/${execution.id}/reply`, {
          message: "Continue on my key.",
        })
      ).statusCode,
    ).toBe(200);
    const resumed = await waitUntil(
      app,
      cookie,
      execution.id,
      (v) => v.output === "Finished on the API key.",
    );
    expect(resumed).toMatchObject({ status: "waiting-on-you", fundedBy: "openai", error: null });
  });
});
