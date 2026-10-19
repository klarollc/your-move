import { describe, expect, it, vi } from "vitest";

import {
  ProviderAuthorizationError,
  ProviderResponseError,
  ProviderUnavailableError,
  listProviderModels,
} from "./provider-client.js";

const testCredential = "sk-r1-test-not-a-real-provider-credential";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("provider model-list boundary", () => {
  it("validates OpenAI credentials through its model-list endpoint and returns only model IDs", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: [{ id: "gpt-test-a" }, { id: "gpt-test-b" }] }),
    );

    const models = await listProviderModels("openai", testCredential, fetcher as typeof fetch);

    expect(models).toEqual([
      { id: "gpt-test-a", label: "gpt-test-a" },
      { id: "gpt-test-b", label: "gpt-test-b" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://api.openai.com/v1/models");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${testCredential}`);
    expect(String(url)).not.toContain(testCredential);
  });

  it("paginates Anthropic models using the returned cursor and its documented headers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "claude-test-a", display_name: "Claude Test A" }],
          has_more: true,
          last_id: "claude-test-a",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "claude-test-b", display_name: "Claude Test B" }],
          has_more: false,
          last_id: "claude-test-b",
        }),
      );

    const models = await listProviderModels("anthropic", testCredential, fetcher as typeof fetch);

    expect(models).toEqual([
      { id: "claude-test-a", label: "Claude Test A" },
      { id: "claude-test-b", label: "Claude Test B" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetcher.mock.calls[0]!;
    const [secondUrl, secondInit] = fetcher.mock.calls[1]!;
    expect(new URL(String(firstUrl)).pathname).toBe("/v1/models");
    expect(new URL(String(firstUrl)).searchParams.get("limit")).toBe("1000");
    expect(new URL(String(secondUrl)).searchParams.get("after_id")).toBe("claude-test-a");
    expect(new Headers(firstInit?.headers).get("x-api-key")).toBe(testCredential);
    expect(new Headers(firstInit?.headers).get("anthropic-version")).toBe("2023-06-01");
    expect(new Headers(secondInit?.headers).get("x-api-key")).toBe(testCredential);
    expect(String(firstUrl)).not.toContain(testCredential);
  });

  it("classifies authorization rejection without returning provider response text", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("invalid credential", { status: 401 }),
    );

    await expect(
      listProviderModels("openai", testCredential, fetcher as typeof fetch),
    ).rejects.toBeInstanceOf(ProviderAuthorizationError);
  });

  it("separates provider outages from malformed model-list responses", async () => {
    const unavailable = vi.fn<typeof fetch>(async () => new Response("busy", { status: 503 }));
    const malformed = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: [{ display_name: "no id" }] }),
    );

    await expect(
      listProviderModels("anthropic", testCredential, unavailable as typeof fetch),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(
      listProviderModels("openai", testCredential, malformed as typeof fetch),
    ).rejects.toBeInstanceOf(ProviderResponseError);
  });
});
