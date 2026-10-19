import { describe, expect, it, vi } from "vitest";

import {
  chatWithTools,
  toAnthropicRequest,
  toOpenAIMessages,
  type TranscriptEntry,
} from "./provider-chat.js";

const transcript: TranscriptEntry[] = [
  { role: "system", content: "Rules." },
  { role: "user", content: "Begin." },
  {
    role: "assistant",
    content: "",
    toolCalls: [
      { id: "call_1", name: "github_read", arguments: { repo: "o/r", path: "a" } },
      { id: "call_2", name: "github_propose_write", arguments: { repo: "o/r" } },
    ],
  },
  { role: "tool", toolCallId: "call_1", name: "github_read", content: '{"sha":"s"}' },
  { role: "tool", toolCallId: "call_2", name: "github_propose_write", content: '{"status":"p"}' },
  { role: "proposal_outcome", proposalId: "proposal_1", content: "Applied." },
];

const tools = [
  {
    name: "github_read",
    description: "Read",
    inputSchema: { type: "object", properties: { repo: { type: "string" } } },
  },
];

describe("provider-native transcript mapping", () => {
  it("OpenAI: one tool message per call, the proposal outcome as a tagged user message", () => {
    const messages = toOpenAIMessages(transcript);
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "tool",
      "user",
    ]);
    expect(messages[2]).toMatchObject({
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "github_read" } },
        { id: "call_2" },
      ],
    });
    expect(messages[5]).toEqual({
      role: "user",
      content: "[Owner decision on proposal proposal_1] Applied.",
    });
  });

  it("Anthropic: system lifted out, roles alternate, tool results first in the following user turn", () => {
    const { system, messages } = toAnthropicRequest(transcript);
    expect(system).toBe("Rules.");
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[1]!.content.map((block) => block.type)).toEqual(["tool_use", "tool_use"]);
    expect(messages[2]!.content.map((block) => block.type)).toEqual([
      "tool_result",
      "tool_result",
      "text",
    ]);
  });
});

describe("chatWithTools", () => {
  it("sends Anthropic tool-use schemas and parses tool_use blocks", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            content: [
              { type: "text", text: "Reading." },
              { type: "tool_use", id: "toolu_1", name: "github_read", input: { repo: "o/r" } },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    const reply = await chatWithTools({
      provider: "anthropic",
      credential: "anthropic-test-key",
      model: "claude-test",
      transcript,
      tools,
      fetcher,
    });
    expect(reply).toEqual({
      content: "Reading.",
      toolCalls: [{ id: "toolu_1", name: "github_read", arguments: { repo: "o/r" } }],
    });
    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body)) as {
      tools: { name: string; input_schema: unknown }[];
    };
    expect(body.tools).toEqual([
      { name: "github_read", description: "Read", input_schema: tools[0]!.inputSchema },
    ]);
  });

  it("keeps unparseable OpenAI arguments so the gate can refuse them", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    { id: "c", type: "function", function: { name: "web_fetch", arguments: "{" } },
                  ],
                },
              },
            ],
          }),
        ),
    );
    const reply = await chatWithTools({
      provider: "openai",
      credential: "sk-test-only-key",
      model: "gpt-test",
      transcript: transcript.slice(0, 2),
      tools,
      fetcher,
    });
    expect(reply.toolCalls[0]!.arguments).toEqual({ __unparsed_arguments: "{" });
  });
});
