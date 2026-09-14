import { createInterface } from "node:readline";
import { join } from "node:path";

const mode = process.env.CUCKCODE_FAKE_MODE ?? "normal";
// `multiturn` gives each turn a distinct id, so a caller can be tested for consuming the right one.
let turnSequence = 0;
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
    turnSequence += 1;
    const turnId = mode === "multiturn" ? `turn_${turnSequence}` : "turn_fixture";
    const text =
      mode === "multiturn" ? `TURN_${turnSequence}_OK` : mode === "exercise" ? "EXERCISE_OK" : null;
    const items = text === null ? [] : [{ id: `item_${turnSequence}`, type: "agentMessage", text }];
    process.stdout.write(
      `${JSON.stringify({ id: message.id, result: { turn: { id: turnId } } })}\n`,
    );
    process.stdout.write(
      `${JSON.stringify({ method: "turn/completed", params: { threadId: "thread_fixture", turn: { id: turnId, status: "completed", items } } })}\n`,
    );
  }
}
