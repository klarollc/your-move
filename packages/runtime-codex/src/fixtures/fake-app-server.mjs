import { createInterface } from "node:readline";

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
    process.stdout.write(`${JSON.stringify({ id: message.id, result: { account: null } })}\n`);
  } else if (message.method === "thread/start") {
    process.stdout.write(
      `${JSON.stringify({ id: message.id, result: { thread: { id: "thread_fixture" } } })}\n`,
    );
  } else if (message.method === "turn/start") {
    process.stdout.write(
      `${JSON.stringify({ id: message.id, result: { turn: { id: "turn_fixture" } } })}\n`,
    );
    process.stdout.write(
      `${JSON.stringify({ method: "turn/completed", params: { threadId: "thread_fixture", turn: { id: "turn_fixture", status: "completed", items: [] } } })}\n`,
    );
  }
}
