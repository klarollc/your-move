// Child-process target for the kill -9 recovery test (execution-crash.integration.test.ts).
// Boots the hosted app on the given data dir, starts two executions, lets the first complete one
// turn and then hang mid-turn, prints READY, and waits to be killed. Not a test file itself.
import { createHostedApp } from "./hosted-app.js";

const [dataDir, origin, password, signingKey, encryptionKey] = process.argv.slice(2) as [
  string,
  string,
  string,
  string,
  string,
];

const contract = JSON.stringify({
  outcome: "Survive a crash.",
  scope: ["Fetch the docs"],
  exclusions: [],
  acceptanceCriteria: ["The transcript survives"],
  permissionCeiling: "draft_only",
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

let executionTurns = 0;
let signalHanging!: () => void;
const hanging = new Promise<void>((resolve) => (signalHanging = resolve));
const app = createHostedApp({
  mode: "test",
  appOrigin: origin,
  accessPassword: password,
  sessionSigningKey: signingKey,
  credentialEncryptionKey: encryptionKey,
  dataDir,
  resolveHost: async () => ["93.184.216.34"],
  providerFetch: async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) return json({ data: [{ id: "gpt-4o-mini" }] });
    if (url.endsWith("/v1/chat/completions")) {
      const body = JSON.parse(String(init?.body)) as { tools?: unknown };
      if (!body.tools) return json({ choices: [{ message: { content: contract } }] });
      executionTurns += 1;
      if (executionTurns === 1) {
        return json({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "call_crash_1",
                    type: "function",
                    function: {
                      name: "web_fetch",
                      arguments: JSON.stringify({ url: "https://docs.example.com/" }),
                    },
                  },
                ],
              },
            },
          ],
        });
      }
      // Turn 2 never answers: the process is killed while this turn is in flight.
      signalHanging();
      return new Promise<Response>(() => undefined);
    }
    if (url.startsWith("https://docs.example.com/")) {
      return new Response("<main><p>Docs.</p></main>", {
        headers: { "content-type": "text/html" },
      });
    }
    return new Response("{}", { status: 404 });
  },
});

const login = await app.inject({
  method: "POST",
  url: "/api/session",
  headers: { origin },
  payload: { password },
});
const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
const post = (url: string, payload?: object) =>
  app.inject({ method: "POST", url, headers: { origin, cookie }, ...(payload ? { payload } : {}) });

await post("/api/providers/openai", { apiKey: "sk-crash-test-only" });
for (const description of ["First work", "Second work"]) {
  const created = await post("/api/work-drafts", { description });
  await post(`/api/work-drafts/${created.json().id as string}/approve`);
}
// Ready once the second run is queued behind the first, and the first is mid-turn.
await hanging;
process.stdout.write("READY\n");
// Stay alive until killed.
setInterval(() => undefined, 60_000);
