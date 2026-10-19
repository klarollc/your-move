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

export type ToolCall = Readonly<{
  id: string;
  name: string;
  arguments: unknown;
  /** Responses API only: the tool namespace the call came back with, echoed on replay. */
  namespace?: string;
}>;

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

// ---- R4 Track D: the Responses API path, used when the ChatGPT plan credential is active ----
//
// OpenAI's plan-usage route (developers.openai.com/siwc/token-sharing-open-source/preview-limitations,
// read 2026-10-19): POST /v1/responses only; store:false and stream:true on every request; full
// history in `input` (no previous_response_id); system text goes in `instructions` (system-role
// input items are rejected); function tools are grouped in a namespace; temperature,
// max_output_tokens, metadata, user, etc. are not sent. Chat Completions stays for pasted keys.

export const RESPONSES_TOOL_NAMESPACE = "your_move";
export const PLAN_USAGE_LIMIT_CODE = "subscription_sharing_usage_limit_exceeded";

/** The plan's usage limit (the plan's, or the per-app cap) was reached. Defined, never silent. */
export class PlanUsageLimitError extends Error {
  constructor() {
    super(PLAN_USAGE_LIMIT_CODE);
    this.name = "PlanUsageLimitError";
  }
}

type ResponsesInputItem =
  | { role: "user" | "assistant"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string; namespace?: string }
  | { type: "function_call_output"; call_id: string; output: string };

export function toResponsesRequest(
  transcript: readonly TranscriptEntry[],
  tools: readonly ChatTool[],
  model: string,
) {
  const instructions = transcript
    .filter((entry) => entry.role === "system")
    .map((entry) => entry.content)
    .join("\n\n");
  const input: ResponsesInputItem[] = [];
  for (const entry of transcript) {
    switch (entry.role) {
      case "system":
        break;
      case "user":
        input.push({ role: "user", content: entry.content });
        break;
      case "assistant":
        if (entry.content) input.push({ role: "assistant", content: entry.content });
        for (const call of entry.toolCalls) {
          input.push({
            type: "function_call",
            call_id: call.id,
            name: call.name,
            arguments: JSON.stringify(call.arguments ?? {}),
            ...(call.namespace ? { namespace: call.namespace } : {}),
          });
        }
        break;
      case "tool":
        input.push({
          type: "function_call_output",
          call_id: entry.toolCallId,
          output: entry.content,
        });
        break;
      case "proposal_outcome":
        input.push({ role: "user", content: proposalOutcomeText(entry) });
        break;
    }
  }
  return {
    model,
    instructions,
    input,
    ...(tools.length > 0
      ? {
          tools: [
            {
              type: "namespace",
              name: RESPONSES_TOOL_NAMESPACE,
              description: "Tools for the owner's approved work.",
              tools: tools.map((tool) => ({
                type: "function",
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              })),
            },
          ],
        }
      : {}),
    store: false,
    stream: true,
  };
}

const responsesItemSchema = z.object({ type: z.string() }).passthrough();

function readOutputItems(items: readonly z.infer<typeof responsesItemSchema>[]): ChatReply {
  let content = "";
  const toolCalls: ToolCall[] = [];
  for (const item of items) {
    if (item.type === "message") {
      const parts = Array.isArray(item.content) ? (item.content as unknown[]) : [];
      for (const part of parts) {
        const typed = part as { type?: unknown; text?: unknown };
        if (typed.type === "output_text" && typeof typed.text === "string") content += typed.text;
      }
    }
    if (item.type === "function_call") {
      const call = item as {
        call_id?: unknown;
        name?: unknown;
        arguments?: unknown;
        namespace?: unknown;
      };
      if (typeof call.call_id !== "string" || typeof call.name !== "string") {
        throw new ProviderResponseError();
      }
      toolCalls.push({
        id: call.call_id,
        name: call.name,
        arguments: parseArguments(typeof call.arguments === "string" ? call.arguments : ""),
        ...(typeof call.namespace === "string" ? { namespace: call.namespace } : {}),
      });
    }
  }
  return { content, toolCalls };
}

function errorCodeOf(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { code?: unknown; error?: unknown };
  if (typeof record.code === "string") return record.code;
  return errorCodeOf(record.error);
}

/** Consumes a Responses event stream through its terminal event. */
export async function readResponsesStream(body: ReadableStream<Uint8Array>): Promise<ChatReply> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const doneItems: z.infer<typeof responsesItemSchema>[] = [];
  let completed: unknown[] | undefined;
  let failedCode: string | undefined;
  let incomplete = false;

  const handle = (raw: string) => {
    const data = raw
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    let event: { type?: unknown; item?: unknown; response?: { output?: unknown; error?: unknown } };
    try {
      event = JSON.parse(data) as typeof event;
    } catch {
      throw new ProviderResponseError();
    }
    switch (event.type) {
      case "response.output_item.done": {
        const item = responsesItemSchema.safeParse(event.item);
        if (item.success) doneItems.push(item.data);
        break;
      }
      case "response.completed":
        completed = Array.isArray(event.response?.output) ? event.response.output : [];
        break;
      case "response.failed":
        failedCode = errorCodeOf(event.response?.error) ?? "response_failed";
        break;
      case "response.incomplete":
        incomplete = true;
        break;
      case "error":
        failedCode = errorCodeOf(event) ?? "stream_error";
        break;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.search(/\r?\n\r?\n/u);
      while (boundary !== -1) {
        const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/u)![0];
        handle(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + separator.length);
        boundary = buffer.search(/\r?\n\r?\n/u);
      }
    }
    if (buffer.trim()) handle(buffer);
  } catch (error) {
    if (error instanceof ProviderResponseError) throw error;
    // The stream broke before a terminal event.
    throw new ProviderUnavailableError();
  }

  if (failedCode === PLAN_USAGE_LIMIT_CODE) throw new PlanUsageLimitError();
  if (failedCode) {
    if (failedCode === "subscription_sharing_usage_unavailable")
      throw new ProviderUnavailableError();
    if (failedCode === "subscription_sharing_user_unavailable")
      throw new ProviderUnavailableError();
    throw new ProviderResponseError();
  }
  if (incomplete) throw new ProviderResponseError();
  // Success only on response.completed (OpenAI: an interrupted stream is not a completed inference).
  if (!completed) throw new ProviderUnavailableError();
  const items = completed.length > 0 ? completed : doneItems;
  const parsedItems = items.flatMap((item) => {
    const parsed = responsesItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  return readOutputItems(parsedItems);
}

export async function chatWithResponses(options: {
  accessToken: string;
  model: string;
  transcript: readonly TranscriptEntry[];
  tools: readonly ChatTool[];
  fetcher: typeof fetch;
  signal?: AbortSignal;
  url?: string;
}): Promise<ChatReply> {
  const timeout = AbortSignal.timeout(CHAT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  let response: Response;
  try {
    response = await options.fetcher(options.url ?? "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.accessToken}`,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify(toResponsesRequest(options.transcript, options.tools, options.model)),
      signal,
    });
  } catch {
    throw new ProviderUnavailableError();
  }
  if (!response.ok) {
    // Before the stream opens the body may be an API error object or {"detail": "..."}.
    const body: unknown = await response.json().catch(() => undefined);
    const code = errorCodeOf(body);
    if (response.status === 429 && code === PLAN_USAGE_LIMIT_CODE) throw new PlanUsageLimitError();
    if (response.status === 401 || response.status === 403) throw new ProviderAuthorizationError();
    if (response.status === 400) throw new ProviderResponseError();
    throw new ProviderUnavailableError();
  }
  if (!response.body) throw new ProviderResponseError();
  return readResponsesStream(response.body);
}
