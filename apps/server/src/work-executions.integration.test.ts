import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openExecutionStore } from "./execution-store.js";
import { createToolRegistry, V1_TOOL_ALLOWLIST } from "./execution-tools.js";
import { createHostedApp, type HostedApp } from "./hosted-app.js";
import { CONTROL_MESSAGE } from "./execution-loop.js";
import { PROPOSAL_STALE_MESSAGE } from "./tool-github.js";
import { openWorkDraftStore } from "./work-drafts.js";

const origin = "https://r3-execution.example.test";
const accessPassword = "r3-execution-tests-only";
const sessionSigningKey = Buffer.alloc(32, 5).toString("base64");
const credentialEncryptionKey = Buffer.alloc(32, 6).toString("base64");
const githubToken = "github_pat_r3_tests_only_0123456789abcdef";
const directories: string[] = [];
const apps: HostedApp[] = [];

const contract = {
  outcome: "The README explains setup.",
  scope: ["Read the README", "Propose a setup section"],
  exclusions: ["Code changes"],
  acceptanceCriteria: ["README has a setup section"],
  permissionCeiling: "draft_only",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Call = { id: string; name: string; args: unknown };
const toolReply = (...calls: Call[]) =>
  jsonResponse({
    choices: [
      {
        message: {
          content: null,
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

type ChatBody = {
  model: string;
  messages: { role: string; content: unknown; tool_call_id?: string }[];
  tools?: { type: string; function: { name: string; parameters: unknown } }[];
};

/**
 * One routing fake for every outbound call. `turn` answers execution turns (requests that carry
 * tools); drafting requests (no tools) get the contract.
 */
function world(options: {
  turn: (body: ChatBody, index: number) => Response | Promise<Response>;
  github?: (url: URL, init: RequestInit | undefined) => Response;
}) {
  const turns: ChatBody[] = [];
  const githubCalls: { method: string; url: string; body?: unknown }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.href === "https://api.openai.com/v1/models") {
      return jsonResponse({ data: [{ id: "gpt-4o-mini" }] });
    }
    if (url.href === "https://api.openai.com/v1/chat/completions") {
      const body = JSON.parse(String(init?.body)) as ChatBody;
      if (!body.tools) return textReply(JSON.stringify(contract));
      turns.push(body);
      return options.turn(body, turns.length - 1);
    }
    if (url.hostname === "api.github.com") {
      githubCalls.push({
        method: init?.method ?? "GET",
        url: url.href,
        ...(init?.body ? { body: JSON.parse(String(init.body)) as unknown } : {}),
      });
      if (url.pathname === "/user") return jsonResponse({ login: "octo" });
      return options.github?.(url, init) ?? jsonResponse({ message: "Not Found" }, 404);
    }
    if (url.hostname === "docs.example.com") {
      return new Response("<title>Docs</title><main><p>Install with npm ci.</p></main>", {
        headers: { "content-type": "text/html" },
      });
    }
    return jsonResponse({ code: "UNEXPECTED_URL", url: url.href }, 599);
  });
  return { fetcher, turns, githubCalls };
}

function createApp(fetcher: typeof fetch, dataDir?: string, extra: object = {}): HostedApp {
  const directory =
    dataDir ?? mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r3-exec-"));
  if (!dataDir) directories.push(directory);
  const app = createHostedApp({
    mode: "test",
    appOrigin: origin,
    accessPassword,
    sessionSigningKey,
    credentialEncryptionKey,
    dataDir: directory,
    providerFetch: fetcher,
    resolveHost: async () => ["93.184.216.34"],
    ...extra,
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

async function post(app: HostedApp, cookie: string, url: string, payload?: object) {
  return app.inject({
    method: "POST",
    url,
    headers: { origin, cookie },
    ...(payload ? { payload } : {}),
  });
}

async function setUp(app: HostedApp, { github = true } = {}) {
  const cookie = await login(app);
  expect(
    (await post(app, cookie, "/api/providers/openai", { apiKey: "sk-r3-tests-only" })).statusCode,
  ).toBe(201);
  if (github) {
    expect(
      (await post(app, cookie, "/api/integrations/github", { token: githubToken })).statusCode,
    ).toBe(201);
  }
  return cookie;
}

async function approveNewDraft(app: HostedApp, cookie: string) {
  const created = await post(app, cookie, "/api/work-drafts", {
    description: "Add a setup section",
  });
  expect(created.statusCode).toBe(201);
  const approved = await post(
    app,
    cookie,
    `/api/work-drafts/${created.json().id as string}/approve`,
  );
  expect(approved.statusCode).toBe(200);
  return approved.json() as {
    id: string;
    status: string;
    execution: { id: string; status: string } | null;
  };
}

async function execution(app: HostedApp, cookie: string, id: string) {
  const response = await app.inject({
    method: "GET",
    url: `/api/work-executions/${id}`,
    headers: { cookie },
  });
  return response.json() as {
    id: string;
    status: string;
    turnCount: number;
    maxTurns: number;
    attempt: number;
    restartedFrom: string | null;
    output: string | null;
    error: string | null;
    proposals: { id: string; status: string; change: { repo: string; path: string } }[];
  };
}

async function waitFor(app: HostedApp, cookie: string, id: string, status: string) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const current = await execution(app, cookie, id);
    if (current.status === status) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `execution ${id} never reached ${status}: ${JSON.stringify(await execution(app, cookie, id))}`,
  );
}

function transcriptOf(app: HostedApp, id: string) {
  const store = openExecutionStore({ dataDir: dataDirOf(app) });
  try {
    return { record: store.get(id)!, audit: store.listAudit(id) };
  } finally {
    store.close();
  }
}

const readmeFile = (sha: string) => ({
  type: "file",
  path: "README.md",
  sha,
  encoding: "base64",
  content: Buffer.from("# Project").toString("base64"),
});
const proposeArgs = {
  repo: "octo/repo",
  path: "README.md",
  content: "# Project\n\n## Setup\n\nRun npm ci.\n",
  message: "Add setup section",
  base_sha: "sha_readme_1",
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("R3 live execution: trigger and loop", () => {
  it("approve starts the run with no manual step: queued → working → waiting-on-you, offering exactly the allowlisted tools", async () => {
    const seen: string[] = [];
    let cookie = "";
    const fake = world({
      turn: async () => {
        const list = await app.inject({
          method: "GET",
          url: "/api/work-executions",
          headers: { cookie },
        });
        seen.push((list.json() as { executions: { status: string }[] }).executions[0]!.status);
        return textReply("I need the repository name to continue.");
      },
    });
    const app = createApp(fake.fetcher);
    cookie = await setUp(app);

    const approved = await approveNewDraft(app, cookie);
    expect(approved.status).toBe("approved");
    expect(approved.execution?.status).toBe("queued");

    const done = await waitFor(app, cookie, approved.execution!.id, "waiting-on-you");
    expect(seen).toEqual(["working"]);
    expect(done.output).toBe("I need the repository name to continue.");
    expect(done.turnCount).toBe(1);
    expect(done.maxTurns).toBe(10);
    expect(fake.turns[0]!.tools!.map((tool) => tool.function.name)).toEqual([...V1_TOOL_ALLOWLIST]);

    // The system prompt is built from the contract fields.
    const system = fake.turns[0]!.messages[0]!;
    expect(system.role).toBe("system");
    expect(String(system.content)).toContain(contract.outcome);
    expect(String(system.content)).toContain("README has a setup section");

    // The additive execution field on the draft view.
    const draft = await app.inject({
      method: "GET",
      url: `/api/work-drafts/${approved.id}`,
      headers: { cookie },
    });
    expect(draft.json().execution.status).toBe("waiting-on-you");
  });

  it("approving is idempotent per draft revision: the explicit start refuses a second run", async () => {
    const fake = world({ turn: () => textReply("Done.") });
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    await waitFor(app, cookie, approved.execution!.id, "waiting-on-you");
    const again = await post(app, cookie, "/api/work-executions", { draftId: approved.id });
    expect(again.statusCode).toBe(409);
    const list = await app.inject({
      method: "GET",
      url: "/api/work-executions",
      headers: { cookie },
    });
    expect(list.json().executions).toHaveLength(1);
  });

  it("does not auto-start work approved before R3; an explicit start runs it", async () => {
    const fake = world({ turn: () => textReply("Started and waiting.") });
    const dataDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r3-legacy-"));
    directories.push(dataDir);
    // Approved under R2, before any execution subsystem existed.
    const legacy = openWorkDraftStore({ dataDir });
    const draft = legacy.insert("Legacy work", contract as never, "2026-10-18T00:00:00.000Z");
    legacy.approve(draft.id, "2026-10-18T00:00:01.000Z");
    legacy.close();

    const app = createApp(fake.fetcher, dataDir);
    const cookie = await setUp(app);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const before = await app.inject({
      method: "GET",
      url: `/api/work-drafts/${draft.id}`,
      headers: { cookie },
    });
    expect(before.json().execution).toBeNull();
    expect(fake.turns).toHaveLength(0);

    const started = await post(app, cookie, "/api/work-executions", { draftId: draft.id });
    expect(started.statusCode).toBe(201);
    const done = await waitFor(app, cookie, started.json().id as string, "waiting-on-you");
    expect(done.output).toBe("Started and waiting.");
  });

  it("refuses an explicit start for a draft that is not approved", async () => {
    const fake = world({ turn: () => textReply("x") });
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const created = await post(app, cookie, "/api/work-drafts", { description: "Not yet" });
    const started = await post(app, cookie, "/api/work-executions", { draftId: created.json().id });
    expect(started.statusCode).toBe(409);
    expect(started.json()).toEqual({ code: "WORK_DRAFT_NOT_APPROVED" });
  });

  it("enforces max_turns: a model that never stops ends failed after ten turns", async () => {
    const fake = world({
      turn: (_body, index) =>
        toolReply({
          id: `call_${index}`,
          name: "web_fetch",
          args: { url: "https://docs.example.com/" },
        }),
    });
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const failed = await waitFor(app, cookie, approved.execution!.id, "failed");
    expect(failed.error).toBe("TURN_BUDGET_EXHAUSTED");
    expect(failed.turnCount).toBe(10);
    expect(fake.turns).toHaveLength(10);
  });

  it("is refused at boot on allowlist drift: execution routes 503, approval still works without a run", async () => {
    const fake = world({ turn: () => textReply("must not run") });
    const drifted = createToolRegistry(
      [...V1_TOOL_ALLOWLIST, "shell_exec"].map((name) => ({
        name,
        description: name,
        sideEffectClass: "read" as const,
        inputSchema: { type: "object", properties: {} },
        run: async () => ({ ok: true as const, data: null, summary: "" }),
      })),
    );
    const app = createApp(fake.fetcher, undefined, { toolRegistry: drifted });
    const cookie = await setUp(app);
    const list = await app.inject({
      method: "GET",
      url: "/api/work-executions",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(503);
    expect(list.json()).toEqual({ code: "EXECUTION_SUBSYSTEM_UNAVAILABLE" });
    const approved = await approveNewDraft(app, cookie);
    expect(approved.status).toBe("approved");
    expect(approved.execution).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.turns).toHaveLength(0);
  });
});

describe("R3 approval gate: propose-class tools never execute on the agent path", () => {
  function proposingWorld(
    github: (url: URL, init: RequestInit | undefined) => Response,
    after = "Change applied; done.",
  ) {
    return world({
      turn: (_body, index) =>
        index === 0
          ? toolReply(
              {
                id: "call_read",
                name: "github_read",
                args: { repo: "octo/repo", path: "README.md" },
              },
              { id: "call_propose", name: "github_propose_write", args: proposeArgs },
              { id: "call_after", name: "web_fetch", args: { url: "https://docs.example.com/" } },
            )
          : textReply(after),
      github,
    });
  }

  it("diverts github_propose_write into a pending proposal with zero GitHub writes", async () => {
    const fake = proposingWorld(() => jsonResponse(readmeFile("sha_readme_1")));
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const waiting = await waitFor(app, cookie, approved.execution!.id, "waiting-on-you");

    expect(fake.githubCalls.filter((call) => call.method !== "GET")).toEqual([]);
    expect(waiting.proposals).toHaveLength(1);
    expect(waiting.proposals[0]).toMatchObject({
      status: "pending",
      change: { repo: "octo/repo", path: "README.md" },
    });
    expect(fake.turns).toHaveLength(1);

    const { record, audit } = transcriptOf(app, waiting.id);
    const results = record.transcript.filter((entry) => entry.role === "tool");
    // Every call has exactly one result; the propose call's one result is the control message.
    expect(results.map((entry) => entry.role === "tool" && entry.toolCallId)).toEqual([
      "call_read",
      "call_propose",
      "call_after",
    ]);
    const byId = Object.fromEntries(
      results.map((entry) => [
        entry.role === "tool" ? entry.toolCallId : "",
        entry.role === "tool" ? JSON.parse(entry.content) : null,
      ]),
    );
    expect(byId.call_read).toMatchObject({
      path: "README.md",
      sha: "sha_readme_1",
      content: "# Project",
    });
    expect(byId.call_propose).toEqual({
      status: "pending_owner_approval",
      proposalId: waiting.proposals[0]!.id,
      message: CONTROL_MESSAGE,
    });
    expect(byId.call_after.status).toBe("not_run");
    // web_fetch after the proposal never ran.
    expect(
      fake.fetcher.mock.calls.some(([input]) => String(input).includes("docs.example.com")),
    ).toBe(false);

    // One audit row per tool call, the proposal linked, and no credential anywhere.
    expect(audit.map((row) => row.tool)).toEqual([
      "github_read",
      "github_propose_write",
      "web_fetch",
    ]);
    expect(audit[1]!.proposalId).toBe(waiting.proposals[0]!.id);
    const everything = JSON.stringify({ transcript: record.transcript, audit });
    expect(everything).not.toContain(githubToken);
    expect(everything).not.toContain("sk-r3-tests-only");
  });

  it("owner approval: the server-side applier re-checks the sha, PUTs the content, and the run resumes", async () => {
    const fake = proposingWorld((_url, init) =>
      init?.method === "PUT"
        ? jsonResponse({
            content: { path: "README.md", sha: "sha_readme_2" },
            commit: { sha: "commit_abc" },
          })
        : jsonResponse(readmeFile("sha_readme_1")),
    );
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const waiting = await waitFor(app, cookie, approved.execution!.id, "waiting-on-you");
    const proposalId = waiting.proposals[0]!.id;

    const decision = await post(
      app,
      cookie,
      `/api/work-executions/${waiting.id}/proposals/${proposalId}/approve`,
    );
    expect(decision.statusCode).toBe(200);
    for (let attempt = 0; attempt < 400 && fake.turns.length < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const finished = await waitFor(app, cookie, waiting.id, "waiting-on-you");

    const puts = fake.githubCalls.filter((call) => call.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      url: "https://api.github.com/repos/octo/repo/contents/README.md",
      body: {
        message: "Add setup section",
        content: Buffer.from(proposeArgs.content).toString("base64"),
        sha: "sha_readme_1",
      },
    });
    expect(finished.proposals[0]!.status).toBe("applied");
    expect(finished.output).toBe("Change applied; done.");
    expect(finished.turnCount).toBe(2);

    // The outcome reached the model as a follow-up message, not a second tool result.
    const secondTurn = fake.turns[1]!;
    expect(
      secondTurn.messages.filter((message) => message.tool_call_id === "call_propose"),
    ).toHaveLength(1);
    const followUp = secondTurn.messages.at(-1)!;
    expect(followUp.role).toBe("user");
    expect(String(followUp.content)).toContain(proposalId);
    expect(String(followUp.content)).toContain("commit_abc");

    // A decided proposal cannot be decided again.
    const twice = await post(
      app,
      cookie,
      `/api/work-executions/${waiting.id}/proposals/${proposalId}/approve`,
    );
    expect(twice.statusCode).toBe(409);
  });

  it("stale base_sha: no write, proposal stale, transcript note, run resumes", async () => {
    // The agent's read (turn 1) sees sha_readme_1; by approval time the file has changed.
    let reads = 0;
    const fake = proposingWorld(() => {
      reads += 1;
      return jsonResponse(readmeFile(reads === 1 ? "sha_readme_1" : "sha_changed_meanwhile"));
    }, "I will re-read the file.");
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const waiting = await waitFor(app, cookie, approved.execution!.id, "waiting-on-you");
    const proposalId = waiting.proposals[0]!.id;
    await post(app, cookie, `/api/work-executions/${waiting.id}/proposals/${proposalId}/approve`);
    for (let attempt = 0; attempt < 400 && fake.turns.length < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const resumed = await waitFor(app, cookie, waiting.id, "waiting-on-you");

    expect(fake.githubCalls.filter((call) => call.method === "PUT")).toEqual([]);
    expect(resumed.proposals[0]!.status).toBe("stale");
    expect(resumed.output).toBe("I will re-read the file.");
    const { record } = transcriptOf(app, waiting.id);
    expect(record.transcript).toContainEqual({
      role: "proposal_outcome",
      proposalId,
      content: PROPOSAL_STALE_MESSAGE,
    });
  });

  it("owner denial: no GitHub call, a denial note, and the run resumes within its remaining turns", async () => {
    const fake = proposingWorld(
      () => jsonResponse(readmeFile("sha_readme_1")),
      "Understood, stopping here.",
    );
    const app = createApp(fake.fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const waiting = await waitFor(app, cookie, approved.execution!.id, "waiting-on-you");
    const proposalId = waiting.proposals[0]!.id;
    const githubBefore = fake.githubCalls.length;

    const decision = await post(
      app,
      cookie,
      `/api/work-executions/${waiting.id}/proposals/${proposalId}/deny`,
    );
    expect(decision.statusCode).toBe(200);
    for (let attempt = 0; attempt < 400 && fake.turns.length < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const resumed = await waitFor(app, cookie, waiting.id, "waiting-on-you");

    expect(fake.githubCalls.length).toBe(githubBefore);
    expect(resumed.proposals[0]!.status).toBe("denied");
    expect(resumed.turnCount).toBe(2);
    expect(resumed.turnCount).toBeLessThanOrEqual(resumed.maxTurns);
    expect(resumed.output).toBe("Understood, stopping here.");
    const lastSent = fake.turns[1]!.messages.at(-1)!;
    expect(String(lastSent.content)).toContain(`proposal ${proposalId}`);
    expect(String(lastSent.content)).toContain("denied");
    const { audit } = transcriptOf(app, waiting.id);
    expect(audit.at(-1)).toMatchObject({ resultSummary: "denied by the owner", proposalId });
  });
});

describe("R3 disconnect, restart and shutdown", () => {
  it("disconnecting the provider mid-run stops cleanly after the current turn; reconnecting does not resume", async () => {
    let cookie = "";
    const fake = world({
      turn: async () => {
        // The owner disconnects while this turn is in flight.
        const removed = await app.inject({
          method: "DELETE",
          url: "/api/providers/openai",
          headers: { origin, cookie },
        });
        expect(removed.statusCode).toBe(200);
        return toolReply({
          id: "call_1",
          name: "web_fetch",
          args: { url: "https://docs.example.com/" },
        });
      },
    });
    const app = createApp(fake.fetcher);
    cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const stopped = await waitFor(app, cookie, approved.execution!.id, "interrupted");

    expect(stopped.error).toBe("PROVIDER_DISCONNECTED");
    expect(stopped.turnCount).toBe(1);
    expect(fake.turns).toHaveLength(1);
    // The turn in flight finished: its tool call ran and its result is in the transcript.
    const { record } = transcriptOf(app, stopped.id);
    expect(record.transcript.at(-1)).toMatchObject({ role: "tool", toolCallId: "call_1" });

    await post(app, cookie, "/api/providers/openai", { apiKey: "sk-r3-tests-only" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await execution(app, cookie, stopped.id)).status).toBe("interrupted");
    expect(fake.turns).toHaveLength(1);
  });

  it("the owner restarts a stopped run as a new linked attempt that carries the prior transcript", async () => {
    let disconnect = true;
    let cookie = "";
    const fake = world({
      turn: async (_body, index) => {
        if (index === 0 && disconnect) {
          disconnect = false;
          await app.inject({
            method: "DELETE",
            url: "/api/providers/openai",
            headers: { origin, cookie },
          });
          return toolReply({
            id: "call_1",
            name: "web_fetch",
            args: { url: "https://docs.example.com/" },
          });
        }
        return textReply("Finished on the second attempt.");
      },
    });
    const app = createApp(fake.fetcher);
    cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    const first = await waitFor(app, cookie, approved.execution!.id, "interrupted");
    await post(app, cookie, "/api/providers/openai", { apiKey: "sk-r3-tests-only" });

    const restarted = await post(app, cookie, `/api/work-executions/${first.id}/restart`);
    expect(restarted.statusCode).toBe(201);
    const second = await waitFor(app, cookie, restarted.json().id as string, "waiting-on-you");
    expect(second.attempt).toBe(2);
    expect(second.restartedFrom).toBe(first.id);
    expect(second.output).toBe("Finished on the second attempt.");
    const sent = fake.turns[1]!.messages;
    expect(sent.some((message) => message.tool_call_id === "call_1")).toBe(true);
    expect(String(sent.at(-1)!.content)).toContain("previous attempt stopped");

    // Only the latest stopped attempt restarts.
    expect((await post(app, cookie, `/api/work-executions/${first.id}/restart`)).statusCode).toBe(
      409,
    );
    const draft = await app.inject({
      method: "GET",
      url: `/api/work-drafts/${approved.id}`,
      headers: { cookie },
    });
    expect(draft.json().execution.id).toBe(second.id);
  });

  it("graceful shutdown cancels a run in flight (bounded) and records it interrupted", async () => {
    let entered!: () => void;
    const inFlight = new Promise<void>((resolve) => (entered = resolve));
    const fake = world({
      turn: () =>
        new Promise<Response>(() => {
          entered();
        }),
    });
    // Honour abort like a real fetch would.
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      const pending = fake.fetcher(input, init);
      if (!init?.signal) return pending;
      return Promise.race([
        pending,
        new Promise<Response>((_resolve, reject) =>
          init.signal!.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
      ]);
    });
    const app = createApp(fetcher);
    const cookie = await setUp(app);
    const approved = await approveNewDraft(app, cookie);
    await inFlight;
    const dataDir = dataDirOf(app);

    const started = Date.now();
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    expect(Date.now() - started).toBeLessThan(5_000);

    const store = openExecutionStore({ dataDir });
    try {
      expect(store.get(approved.execution!.id)).toMatchObject({
        status: "interrupted",
        error: "SERVER_SHUTDOWN",
      });
    } finally {
      store.close();
    }
  });
});

describe("R3 GitHub integration vault", () => {
  it("validates the PAT at connect, never returns it, stores it encrypted, and disconnect deletes it", async () => {
    let accept = false;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/user") {
        return accept
          ? jsonResponse({ login: "octo" })
          : jsonResponse({ message: "Bad credentials" }, 401);
      }
      if (url === "https://api.openai.com/v1/models") return jsonResponse({ data: [] });
      return jsonResponse({}, 404);
    });
    const app = createApp(fetcher);
    const cookie = await login(app);

    const rejected = await post(app, cookie, "/api/integrations/github", { token: githubToken });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toEqual({ code: "INVALID_CREDENTIALS" });

    accept = true;
    const connected = await post(app, cookie, "/api/integrations/github", { token: githubToken });
    expect(connected.statusCode).toBe(201);
    const userCall = fetcher.mock.calls.find(
      ([input]) => String(input) === "https://api.github.com/user",
    )!;
    expect(new Headers(userCall[1]?.headers).get("authorization")).toBe(`Bearer ${githubToken}`);

    const status = await app.inject({
      method: "GET",
      url: "/api/integrations",
      headers: { cookie },
    });
    expect(status.json()).toEqual({ integrations: [{ id: "github", status: "connected" }] });
    expect(status.body).not.toContain(githubToken);

    for (const name of readdirSync(dataDirOf(app))) {
      expect(readFileSync(join(dataDirOf(app), name)).includes(githubToken)).toBe(false);
    }

    const removed = await app.inject({
      method: "DELETE",
      url: "/api/integrations/github",
      headers: { origin, cookie },
    });
    expect(removed.json()).toEqual({ id: "github", status: "disconnected" });
    const after = await app.inject({
      method: "GET",
      url: "/api/integrations",
      headers: { cookie },
    });
    expect(after.json().integrations[0].status).toBe("disconnected");
  });

  it("requires the owner session and same-origin writes", async () => {
    const app = createApp(world({ turn: () => textReply("x") }).fetcher);
    expect((await app.inject({ method: "GET", url: "/api/integrations" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/work-executions" })).statusCode).toBe(401);
    const cookie = await login(app);
    const crossOrigin = await app.inject({
      method: "POST",
      url: "/api/integrations/github",
      headers: { origin: "https://evil.example.test", cookie },
      payload: { token: githubToken },
    });
    expect(crossOrigin.statusCode).toBe(403);
  });
});
