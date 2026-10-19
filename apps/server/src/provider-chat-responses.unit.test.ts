import { describe, expect, it, vi } from "vitest";

import {
  PlanUsageLimitError,
  RESPONSES_TOOL_NAMESPACE,
  chatWithResponses,
  toResponsesRequest,
  type ChatTool,
  type TranscriptEntry,
} from "./provider-chat.js";
import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
} from "./provider-client.js";
import { completedWith, jsonResponse, sseResponse } from "./siwc.fixture.js";

const tools: ChatTool[] = [
  {
    name: "web_fetch",
    description: "Fetch a page.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

const transcript: TranscriptEntry[] = [
  { role: "system", content: "SYSTEM PROMPT" },
  { role: "user", content: "Begin the approved work now." },
  {
    role: "assistant",
    content: "Reading first.",
    toolCalls: [
      {
        id: "call_1",
        name: "web_fetch",
        arguments: { url: "https://a.test" },
        namespace: "your_move",
      },
    ],
  },
  { role: "tool", toolCallId: "call_1", name: "web_fetch", content: '{"text":"hi"}' },
  { role: "proposal_outcome", proposalId: "proposal_1", content: "Applied." },
];

describe("Responses API path (R4 Track D #11)", () => {
  it("builds the plan-route request: instructions, full input history, namespaced tools, store:false, stream:true", () => {
    const body = toResponsesRequest(transcript, tools, "gpt-plan-model");
    expect(body).toEqual({
      model: "gpt-plan-model",
      instructions: "SYSTEM PROMPT",
      input: [
        { role: "user", content: "Begin the approved work now." },
        { role: "assistant", content: "Reading first." },
        {
          type: "function_call",
          call_id: "call_1",
          name: "web_fetch",
          arguments: '{"url":"https://a.test"}',
          namespace: "your_move",
        },
        { type: "function_call_output", call_id: "call_1", output: '{"text":"hi"}' },
        { role: "user", content: "[Owner decision on proposal proposal_1] Applied." },
      ],
      tools: [
        {
          type: "namespace",
          name: RESPONSES_TOOL_NAMESPACE,
          description: "Tools for the owner's approved work.",
          tools: [
            {
              type: "function",
              name: "web_fetch",
              description: "Fetch a page.",
              parameters: tools[0]!.inputSchema,
            },
          ],
        },
      ],
      store: false,
      stream: true,
    });
    // Fields the plan route rejects are never sent, and no system-role input item exists.
    for (const field of [
      "temperature",
      "max_output_tokens",
      "previous_response_id",
      "metadata",
      "user",
    ]) {
      expect(body).not.toHaveProperty(field);
    }
    expect(JSON.stringify(body.input)).not.toContain('"system"');
  });

  it("reads text and function calls from the stream, only after response.completed", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      completedWith([
        { type: "reasoning", id: "rs_1", summary: [] },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Checking." }],
        },
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_9",
          name: "web_fetch",
          namespace: "your_move",
          arguments: '{"url":"https://b.test"}',
        },
      ]),
    );
    const reply = await chatWithResponses({
      accessToken: "plan-access-1",
      model: "m",
      transcript,
      tools,
      fetcher,
    });
    expect(reply).toEqual({
      content: "Checking.",
      toolCalls: [
        {
          id: "call_9",
          name: "web_fetch",
          arguments: { url: "https://b.test" },
          namespace: "your_move",
        },
      ],
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer plan-access-1");
  });

  it("turns a usage-limit error into PlanUsageLimitError, before the stream or mid-stream", async () => {
    const before = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: { code: "subscription_sharing_usage_limit_exceeded" } }, 429),
    );
    await expect(
      chatWithResponses({ accessToken: "a", model: "m", transcript, tools, fetcher: before }),
    ).rejects.toBeInstanceOf(PlanUsageLimitError);

    const midStream = vi.fn<typeof fetch>(async () =>
      sseResponse([
        { type: "response.created", response: { id: "r" } },
        { type: "response.output_text.delta", delta: "Partial" },
        {
          type: "response.failed",
          response: { error: { code: "subscription_sharing_usage_limit_exceeded" } },
        },
      ]),
    );
    await expect(
      chatWithResponses({ accessToken: "a", model: "m", transcript, tools, fetcher: midStream }),
    ).rejects.toBeInstanceOf(PlanUsageLimitError);
  });

  it("classifies other failures: auth, unavailable, interrupted stream, incomplete", async () => {
    const run = (response: Response) =>
      chatWithResponses({
        accessToken: "a",
        model: "m",
        transcript,
        tools,
        fetcher: vi.fn<typeof fetch>(async () => response),
      });
    await expect(run(jsonResponse({ detail: "no" }, 401))).rejects.toBeInstanceOf(
      ProviderAuthorizationError,
    );
    await expect(run(jsonResponse({ detail: "down" }, 503))).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    await expect(
      run(sseResponse([{ type: "response.created", response: { id: "r" } }])),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(
      run(sseResponse([{ type: "response.incomplete", response: { id: "r" } }])),
    ).rejects.toBeInstanceOf(ProviderResponseError);
  });
});
