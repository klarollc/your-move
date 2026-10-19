// R4 Track A #5 acceptance evidence: end-to-end lamp latency on the HOSTED app, measured against
// a real Ollama running the locked classifier (qwen3:8b, prompt v2). The agent's replies are
// replayed from a stored transcript (no provider session): each reply is committed by the real
// execution loop, observed by the real pipeline, classified by the real classifyLampV2, written
// to lamp_verdicts, and received by a real WebSocket subscriber on /api/events.
//
// Two numbers per utterance:
//   serverMs  — observe → verdict published (what the pipeline's own budget check uses)
//   clientMs  — provider reply returned → lamp.verdict received over the socket
// Utterances are paced like a run: the next reply is sent only after the previous verdict lands,
// so the figures are per-utterance latency, not queueing under a burst.
//
// Usage: npx tsx scripts/verify-r4-lamp-latency.ts [--ollama http://localhost:11434] [--token …]
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import WebSocket from "ws";

import { createHostedApp } from "../apps/server/src/hosted-app.ts";
import { percentile } from "../apps/server/src/lamp-pipeline.ts";
import {
  LAMP_V2_MODEL,
  LAMP_V2_PROMPT_VERSION,
  classifyLampV2,
} from "../apps/server/src/lamp-v2.ts";

const MIN_SAMPLES = 20;
const BUDGET_MS = 10_000;
const origin = "http://127.0.0.1:4318";
const password = "latency-replay-password";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const ollamaBase = flag("--ollama") ?? "http://localhost:11434";
const ollamaToken = flag("--token");
if (LAMP_V2_MODEL !== "qwen3:8b") throw new Error(`Locked model drift: ${LAMP_V2_MODEL}`);

const transcriptPath = "docs/evidence/phase-4/live-kickoff/task-17-run/run-attempt-2.json";
const doc = JSON.parse(readFileSync(transcriptPath, "utf8")) as {
  schema: string;
  transcript: { raw: string }[];
};
if (doc.schema !== "cuckcode.phase4-task17-run.v1") throw new Error("Unexpected transcript schema");
const source = doc.transcript.map((entry) => entry.raw);
const passes = Math.ceil(MIN_SAMPLES / source.length);
const replies = Array.from({ length: passes }, () => source).flat();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Fake provider: drafting gets a fixed contract; each agent turn returns the next transcript
// utterance as a plain reply (no tool call), so the run waits on the owner after every turn.
let nextReply = 0;
const replyReturnedAt = new Map<string, number>(); // `${turnCount}` per execution order
const replyOrder: number[] = [];
const providerFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://api.openai.com/v1/models") return json({ data: [{ id: "gpt-4o-mini" }] });
  if (url === "https://api.openai.com/v1/chat/completions") {
    const body = JSON.parse(String(init?.body)) as { tools?: unknown[] };
    if (!body.tools) {
      return json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                outcome: "Replay a stored transcript for latency",
                scope: ["Reply"],
                exclusions: [],
                acceptanceCriteria: ["Every reply is classified"],
                permissionCeiling: "draft_only",
              }),
            },
          },
        ],
      });
    }
    const index = nextReply++;
    const content = replies[index] ?? "Done.";
    replyOrder.push(performance.now());
    replyReturnedAt.set(String(index), replyOrder[index]!);
    return json({ choices: [{ message: { content } }] });
  }
  return json({ code: "UNEXPECTED" }, 599);
}) as typeof fetch;

// Cold start (model load) is measured once and reported separately, never in the samples.
const coldStarted = performance.now();
await classifyLampV2("Warm-up.", {
  endpoint: `${ollamaBase.replace(/\/$/u, "")}/api/chat`,
  ...(ollamaToken ? { token: ollamaToken } : {}),
});
const coldStartMs = performance.now() - coldStarted;

const dataDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "r4-latency-"));
const app = createHostedApp({
  mode: "development",
  appOrigin: origin,
  accessPassword: password,
  sessionSigningKey: Buffer.alloc(32, 7).toString("base64"),
  credentialEncryptionKey: Buffer.alloc(32, 8).toString("base64"),
  dataDir,
  providerFetch,
});
await app.listen({ host: "127.0.0.1", port: 4318 });

const login = await app.inject({
  method: "POST",
  url: "/api/session",
  headers: { origin },
  payload: { password },
});
const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
const post = (url: string, payload?: object) =>
  app.inject({ method: "POST", url, headers: { origin, cookie }, ...(payload ? { payload } : {}) });
const must = async (response: Awaited<ReturnType<typeof post>>, what: string) => {
  if (response.statusCode >= 300)
    throw new Error(`${what}: ${response.statusCode} ${response.body}`);
  return response.json() as Record<string, unknown>;
};
await must(await post("/api/providers/openai", { apiKey: "sk-latency-placeholder" }), "connect");
if (ollamaBase !== "http://localhost:11434" || ollamaToken) {
  await must(
    await post("/api/lamp/endpoint", {
      baseUrl: ollamaBase,
      ...(ollamaToken ? { token: ollamaToken } : {}),
    }),
    "lamp endpoint",
  );
}

const socket = new WebSocket("ws://127.0.0.1:4318/api/events", { headers: { origin, cookie } });
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
const waiters = new Map<string, (at: number, verdict: string) => void>();
socket.on("message", (data) => {
  const at = performance.now();
  const message = JSON.parse(String(data)) as {
    type: string;
    utteranceId: string;
    verdict: string;
  };
  if (message.type === "lamp.verdict") waiters.get(message.utteranceId)?.(at, message.verdict);
});
// Registered before the reply is sent so a fast verdict is never missed; cancelled (timer
// cleared, waiter removed) when the turn cap means no utterance will come.
const verdictFor = (utteranceId: string) => {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<{ at: number; verdict: string }>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`No verdict for ${utteranceId}`)), 200_000);
    waiters.set(utteranceId, (at, verdict) => {
      clearTimeout(timer);
      waiters.delete(utteranceId);
      resolve({ at, verdict });
    });
  });
  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
      waiters.delete(utteranceId);
    },
  };
};

type Sample = {
  replyIndex: number;
  turnIndex: number;
  chars: number;
  clientMs: number;
  verdict: string;
};
const samples: Sample[] = [];
while (samples.length < replies.length) {
  const draft = await must(
    await post("/api/work-drafts", { description: "Latency replay" }),
    "draft",
  );
  const approved = await must(
    await post(`/api/work-drafts/${String(draft.id)}/approve`),
    "approve",
  );
  const executionId = String((approved.execution as { id: string }).id);
  for (let turn = 1; samples.length < replies.length; turn += 1) {
    const replyIndex = samples.length;
    const pending = verdictFor(`utterance_${executionId}_${turn}_1`);
    if (turn > 1) {
      const sent = await post(`/api/work-executions/${executionId}/reply`, { message: "Go on." });
      if (sent.statusCode === 409) {
        pending.cancel();
        break; // turn cap reached: next execution
      }
      await must(sent, "reply");
    }
    const { at, verdict } = await pending.promise;
    samples.push({
      replyIndex,
      turnIndex: turn,
      chars: replies[replyIndex]!.length,
      clientMs: at - replyReturnedAt.get(String(replyIndex))!,
      verdict,
    });
    // Let the loop settle on waiting-on-you before replying.
    for (let i = 0; i < 100; i += 1) {
      const view = (
        await app.inject({
          method: "GET",
          url: `/api/work-executions/${executionId}`,
          headers: { origin, cookie },
        })
      ).json() as { status: string };
      if (view.status !== "queued" && view.status !== "working") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

const lamp = (
  await app.inject({ method: "GET", url: "/api/lamp", headers: { origin, cookie } })
).json() as {
  latency: { count: number; p50Ms: number; p95Ms: number };
  failures: number;
  degraded: boolean;
};
socket.close();
await app.close();

const client = samples.map((sample) => sample.clientMs);
const round = (value: number | null) => (value === null ? null : Math.round(value));
const result = {
  schema: "cuckcode.r4-lamp-latency.v1",
  method:
    "Hosted app, real execution loop, real lamp pipeline, real classifyLampV2 against a real Ollama, real WebSocket subscriber on /api/events. Agent replies replayed from a stored transcript; paced one utterance at a time. No provider session.",
  transcript: transcriptPath,
  model: LAMP_V2_MODEL,
  promptVersion: LAMP_V2_PROMPT_VERSION,
  ollama: { endpoint: ollamaBase, tokenUsed: Boolean(ollamaToken) },
  budgetMs: BUDGET_MS,
  coldStartMs: Math.round(coldStartMs),
  sampleCount: samples.length,
  server: {
    p50Ms: round(lamp.latency.p50Ms),
    p95Ms: round(lamp.latency.p95Ms),
    count: lamp.latency.count,
  },
  client: {
    p50Ms: round(percentile(client, 50)),
    p95Ms: round(percentile(client, 95)),
    minMs: Math.round(Math.min(...client)),
    maxMs: Math.round(Math.max(...client)),
  },
  overBudgetCount: client.filter((value) => value > BUDGET_MS).length,
  failures: lamp.failures,
  degraded: lamp.degraded,
  verdicts: {
    lamp: samples.filter((sample) => sample.verdict === "lamp").length,
    "no-lamp": samples.filter((sample) => sample.verdict === "no-lamp").length,
  },
  samples: samples.map((sample) => ({ ...sample, clientMs: Math.round(sample.clientMs) })),
};
mkdirSync("docs/evidence/your-move-r4", { recursive: true });
writeFileSync(
  "docs/evidence/your-move-r4/lamp-latency.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.info(JSON.stringify({ ...result, samples: undefined }, null, 2));
