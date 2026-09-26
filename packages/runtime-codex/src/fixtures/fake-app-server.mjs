import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mode = process.env.CUCKCODE_FAKE_MODE ?? "normal";
// `tool-surface` is `exercise` with one MCP server started, as a signed-in Codex starts codex_apps
// when its tool features are on (F1.4).
// `apps-by-feature` is a signed-in Codex whose codex_apps server starts unless the latest
// thread/start turned the `apps` feature off: the shape the surface probe proves (F1.5).
const exerciseLike = mode === "exercise" || mode === "tool-surface" || mode === "apps-by-feature";
let latestFeatures;
// Reports the pinned version, as the real binary would. Read from the declaration, never copied.
const pinned = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
  .devDependencies["@openai/codex"];
// `multiturn` gives each turn a distinct id, so a caller can be tested for consuming the right one.
let turnSequence = 0;
const lines = createInterface({ input: process.stdin });

// `server-request` holds the turn/start answer until its own request to the client is answered.
let heldTurnStart;
const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

for await (const line of lines) {
  const message = JSON.parse(line);
  if (mode === "silent") continue;
  if (message.method === undefined && message.id !== undefined) {
    // A response from the client to this server's own request. Report what arrived, then finish
    // the turn the request interrupted.
    write({ method: "fixture/serverRequestAnswered", params: { response: message } });
    if (heldTurnStart !== undefined) {
      write({ id: heldTurnStart, result: { turn: { id: "turn_fixture" } } });
      write({
        method: "turn/completed",
        params: {
          threadId: "thread_fixture",
          turn: {
            id: "turn_fixture",
            status: "failed",
            items: [],
            error: { message: "input refused" },
          },
        },
      });
      heldTurnStart = undefined;
    }
    continue;
  }
  if (message.method === "initialize") {
    process.stderr.write("Authorization: Bearer secret-canary\n");
    const response = `${JSON.stringify({
      id: message.id,
      result: {
        codexHome: "C:/synthetic/codex",
        platformFamily: "windows",
        platformOs: "windows",
        userAgent: `codex_cli_rs/${pinned}`,
      },
    })}\n`;
    process.stdout.write(response.slice(0, 11));
    process.stdout.write(response.slice(11));
  } else if (message.method === "initialized") {
    process.stdout.write('{"method":"fixture/ready","params":{}}\n');
  } else if (message.method === "account/read") {
    const account = exerciseLike ? { type: "chatgpt" } : null;
    process.stdout.write(`${JSON.stringify({ id: message.id, result: { account } })}\n`);
  } else if (message.method === "thread/start") {
    latestFeatures = message.params?.config?.features;
    const exercise = exerciseLike
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
  } else if (message.method === "mcpServerStatus/list") {
    const appsOn =
      mode === "tool-surface" || (mode === "apps-by-feature" && latestFeatures?.apps !== false);
    const data = appsOn
      ? [
          {
            name: "codex_apps",
            authStatus: "oAuth",
            runtimeStatus: "connected",
            tools: { github_search: {}, gmail_send: {} },
            resources: [],
            resourceTemplates: [],
          },
        ]
      : [];
    write({ id: message.id, result: { data, nextCursor: null } });
  } else if (message.method === "turn/start" && mode === "tool-surface") {
    // A session that reaches a turn in this mode has skipped the refusal.
    process.stderr.write("fixture: turn/start reached in tool-surface mode\n");
    write({ id: message.id, result: { turn: { id: "turn_fixture" } } });
    write({
      method: "turn/completed",
      params: {
        threadId: "thread_fixture",
        turn: {
          id: "turn_fixture",
          status: "completed",
          items: [{ id: "item_1", type: "agentMessage", text: "EXERCISE_OK" }],
        },
      },
    });
  } else if (message.method === "turn/start" && mode === "server-request") {
    // Deliberately reuses the client's own request id: a client that routes by id alone would take
    // this request for the answer to turn/start.
    heldTurnStart = message.id;
    write({
      id: message.id,
      method: "item/tool/requestUserInput",
      params: { threadId: "thread_fixture", turnId: "turn_fixture", itemId: "item_ask" },
    });
  } else if (message.method === "turn/start" && mode === "retry-then-fail") {
    write({ id: message.id, result: { turn: { id: "turn_fixture" } } });
    const disconnected = { responseStreamDisconnected: { httpStatusCode: null } };
    for (const willRetry of [true, true, false]) {
      write({
        method: "error",
        params: {
          threadId: "thread_fixture",
          turnId: "turn_fixture",
          willRetry,
          error: {
            message: "stream disconnected before completion",
            codexErrorInfo: disconnected,
            additionalDetails: null,
          },
        },
      });
    }
    write({
      method: "turn/completed",
      params: {
        threadId: "thread_fixture",
        turn: {
          id: "turn_fixture",
          status: "failed",
          items: [],
          error: {
            message: "stream disconnected before completion",
            codexErrorInfo: disconnected,
            additionalDetails: "error sending request",
          },
        },
      },
    });
  } else if (message.method === "turn/interrupt" && mode === "silent-turn") {
    write({ id: message.id, result: {} });
    write({
      method: "turn/completed",
      params: {
        threadId: "thread_fixture",
        turn: { id: message.params.turnId, status: "interrupted", items: [] },
      },
    });
  } else if (message.method === "turn/start" && mode === "silent-turn") {
    write({ id: message.id, result: { turn: { id: "turn_silent" } } });
    write({
      method: "turn/started",
      params: { threadId: "thread_fixture", turnId: "turn_silent" },
    });
  } else if (
    message.method === "turn/start" &&
    ["transport-fail-once", "transport-fail-twice", "non-transport-fail"].includes(mode)
  ) {
    turnSequence += 1;
    const turnId = `turn_${turnSequence}`;
    write({ id: message.id, result: { turn: { id: turnId } } });
    const fail =
      mode === "non-transport-fail" || mode === "transport-fail-twice" || turnSequence === 1;
    const codexErrorInfo =
      mode === "non-transport-fail"
        ? "usageLimitExceeded"
        : { responseStreamDisconnected: { httpStatusCode: null } };
    write({
      method: "turn/completed",
      params: {
        threadId: "thread_fixture",
        turn: fail
          ? {
              id: turnId,
              status: "failed",
              items: [],
              error: { message: "failed", codexErrorInfo, additionalDetails: null },
            }
          : {
              id: turnId,
              status: "completed",
              items: [{ id: `item_${turnSequence}`, type: "agentMessage", text: "RECOVERED" }],
            },
      },
    });
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
