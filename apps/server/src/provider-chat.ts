import { z } from "zod";

import type { JsonSchema } from "./json-schema-lite.js";
import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
} from "./provider-client.js";
import type { ProviderKind } from "./provider-vault.js";

// A provider-neutral transcript and a chat client with tool calling for OpenAI (function calling)
// and Anthropic (tool use). The transcript is what work_executions.transcript_json stores.

export type ToolCall = Readonly<{ id: string; name: string; arguments: unknown }>;

export type TranscriptEntry =
  | Readonly<{ role: "system"; content: string }>
  | Readonly<{ role: "user"; content: string }>
  | Readonly<{ role: "assistant"; content: string; toolCalls: ToolCall[] }>
  // Exactly one per tool call: providers reject a request where a call has none, or two.
  | Readonly<{ role: "tool"; toolCallId: string; name: string; content: string }>
  // The owner's approve/deny/stale outcome for a proposal. It is deliberately NOT a second tool
  // result for the proposing call (the control message already is that call's one result); on the
  // wire it is a user-role message tagged with the proposal id.
  | Readonly<{ role: "proposal_outcome"; proposalId: string; content: string }>;

export type ChatTool = Readonly<{ name: string; description: string; inputSchema: JsonSchema }>;

export type ChatReply = Readonly<{ content: string; toolCalls: ToolCall[] }>;

export const CHAT_TIMEOUT_MS = 120_000;

export function proposalOutcomeText(entry: { proposalId: string; content: string }): string {
  return `[Owner decision on proposal ${entry.proposalId}] ${entry.content}`;
}

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAIMessages(transcript: readonly TranscriptEntry[]): OpenAIMessage[] {
  return transcript.map((entry): OpenAIMessage => {
    switch (entry.role) {
      case "system":
      case "user":
        return { role: entry.role, content: entry.content };
      case "assistant":
        return entry.toolCalls.length === 0
          ? { role: "assistant", content: entry.content }
          : {
              role: "assistant",
              content: entry.content || null,
              tool_calls: entry.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
              })),
            };
      case "tool":
        return { role: "tool", tool_call_id: entry.toolCallId, content: entry.content };
      case "proposal_outcome":
        return { role: "user", content: proposalOutcomeText(entry) };
    }
  });
}

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };
type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicBlock[] };

/** Anthropic wants alternating roles, with tool results first in the user turn that follows. */
export function toAnthropicRequest(transcript: readonly TranscriptEntry[]): {
  system: string;
  messages: AnthropicMessage[];
} {
  const system = transcript
    .filter((entry) => entry.role === "system")
    .map((entry) => entry.content)
    .join("\n\n");
  const messages: AnthropicMessage[] = [];
  const push = (role: AnthropicMessage["role"], block: AnthropicBlock) => {
    const last = messages.at(-1);
    if (last?.role === role) {
      if (block.type === "tool_result") {
        const firstOther = last.content.findIndex((existing) => existing.type !== "tool_result");
        if (firstOther === -1) last.content.push(block);
        else last.content.splice(firstOther, 0, block);
      } else {
        last.content.push(block);
      }
    } else {
      messages.push({ role, content: [block] });
    }
  };
  for (const entry of transcript) {
    switch (entry.role) {
      case "system":
        break;
      case "user":
        push("user", { type: "text", text: entry.content });
        break;
      case "assistant":
        if (entry.content) push("assistant", { type: "text", text: entry.content });
        for (const call of entry.toolCalls) {
          push("assistant", {
            type: "tool_use",
            id: call.id,
            name: call.name,
            input: call.arguments ?? {},
          });
        }
        if (!entry.content && entry.toolCalls.length === 0) {
          push("assistant", { type: "text", text: "(no reply)" });
        }
        break;
      case "tool":
        push("user", {
          type: "tool_result",
          tool_use_id: entry.toolCallId,
          content: entry.content,
        });
        break;
      case "proposal_outcome":
        push("user", { type: "text", text: proposalOutcomeText(entry) });
        break;
    }
  }
  return { system, messages };
}

const openAIReplySchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.string().optional(),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .nullable()
            .optional(),
        }),
      }),
    )
    .min(1),
});

const anthropicReplySchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
      input: z.unknown().optional(),
    }),
  ),
});

function parseArguments(raw: string): unknown {
  try {
    return raw.trim() ? (JSON.parse(raw) as unknown) : {};
  } catch {
    // Kept as-is so the gate's validation reports it back to the model as a bad call.
    return { __unparsed_arguments: raw };
  }
}

export async function chatWithTools(options: {
  provider: ProviderKind;
  credential: string;
  model: string;
  transcript: readonly TranscriptEntry[];
  tools: readonly ChatTool[];
  fetcher: typeof fetch;
  signal?: AbortSignal;
}): Promise<ChatReply> {
  const timeout = AbortSignal.timeout(CHAT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const openai = options.provider === "openai";
  const url = openai
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.anthropic.com/v1/messages";
  const headers = openai
    ? { authorization: `Bearer ${options.credential}`, "content-type": "application/json" }
    : {
        "x-api-key": options.credential,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      };
  const anthropic = openai ? undefined : toAnthropicRequest(options.transcript);
  const body = openai
    ? {
        model: options.model,
        messages: toOpenAIMessages(options.transcript),
        ...(options.tools.length > 0
          ? {
              tools: options.tools.map((tool) => ({
                type: "function",
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.inputSchema,
                },
              })),
            }
          : {}),
      }
    : {
        model: options.model,
        max_tokens: 4096,
        system: anthropic!.system,
        messages: anthropic!.messages,
        ...(options.tools.length > 0
          ? {
              tools: options.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
              })),
            }
          : {}),
      };

  let response: Response;
  try {
    response = await options.fetcher(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ProviderUnavailableError();
  }
  if (response.status === 401 || response.status === 403) throw new ProviderAuthorizationError();
  if (!response.ok) throw new ProviderUnavailableError();
  const json: unknown = await response.json().catch(() => undefined);

  if (openai) {
    const parsed = openAIReplySchema.safeParse(json);
    if (!parsed.success) throw new ProviderResponseError();
    const message = parsed.data.choices[0]!.message;
    return {
      content: message.content ?? "",
      toolCalls: (message.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseArguments(call.function.arguments),
      })),
    };
  }
  const parsed = anthropicReplySchema.safeParse(json);
  if (!parsed.success) throw new ProviderResponseError();
  const toolCalls: ToolCall[] = [];
  let content = "";
  for (const block of parsed.data.content) {
    if (block.type === "text") content += block.text ?? "";
    if (block.type === "tool_use") {
      if (!block.id || !block.name) throw new ProviderResponseError();
      toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
    }
  }
  return { content, toolCalls };
}
