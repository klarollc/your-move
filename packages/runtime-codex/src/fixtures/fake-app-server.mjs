import { createInterface } from "node:readline";
import { join } from "node:path";

const mode = process.env.CUCKCODE_FAKE_MODE ?? "normal";
const lines = createInterface({ input: process.stdin });

for await (const line of lines) {
  const message = JSON.parse(line);
  if (mode === "silent") continue;
  if (message.method === "initialize") {
    process.stderr.write("Authorization: Bearer secret-canary\n");
    const response = `${JSON.stringify({
      id: message.id,
      result: {
        codexHome: "C:/synthetic/codex",
        platformFamily: "windows",
        platformOs: "windows",
        userAgent: "codex_cli_rs/0.146.0",
      },
    })}\n`;
    process.stdout.write(response.slice(0, 11));
    process.stdout.write(response.slice(11));
  } else if (message.method === "initialized") {
    process.stdout.write('{"method":"fixture/ready","params":{}}\n');
  } else if (message.method === "account/read") {
    const account = mode === "exercise" ? { type: "chatgpt" } : null;
    process.stdout.write(`${JSON.stringify({ id: message.id, result: { account } })}\n`);
  } else if (message.method === "thread/start") {
    const exercise =
      mode === "exercise"
        ? {
            model: message.params.model,
            reasoningEffort: message.params.config?.model_reasoning_effort,
            sandbox: { type: "readOnly", networkAccess: false },
            approvalPolicy: "never",
            multiAgentMode: "explicitRequestOnly",
            instructionSources: [join(process.env.CODEX_HOME, "AGENTS.md")],
          }
        : {};
    process.stdout.write(
      `${JSON.stringify({ id: message.id, result: { thread: { id: "thread_fixture" }, ...exercise } })}\n`,
    );
  } else if (message.method === "turn/start") {
    process.stdout.write(
      `${JSON.stringify({ id: message.id, result: { turn: { id: "turn_fixture" } } })}\n`,
    );
    process.stdout.write(
      `${JSON.stringify({ method: "turn/completed", params: { threadId: "thread_fixture", turn: { id: "turn_fixture", status: "completed", items: mode === "exercise" ? [{ id: "item_fixture", type: "agentMessage", text: "EXERCISE_OK" }] : [] } } })}\n`,
    );
  }
}
