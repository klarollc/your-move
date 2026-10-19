import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";
import {
  classifyLampV2,
  LAMP_V2_MODEL,
  LAMP_V2_PROMPT,
  LAMP_V2_PROMPT_VERSION,
} from "./lamp-v2.js";

// sha256 of feature/lamp-body-phase-b:packages/runtime-codex/src/lamp-v2.ts LAMP_V2_PROMPT (c94612e).
const LOCKED_PROMPT_SHA256 = "607c9d106ae1b170a3c0d2abd41d0f58f64f88706ec00595b4678e3376fdc81d";

describe("locked v2 lamp adapter", () => {
  it("uses the pinned model, prompt and deterministic request options", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.model).toBe("qwen3:8b");
      expect(body.options).toEqual({ temperature: 0, num_gpu: -1, num_predict: 16 });
      expect(body.messages).toEqual([
        { role: "user", content: `${LAMP_V2_PROMPT}The full utterance.` },
      ]);
      return Response.json({ message: { content: "lamp" } });
    });
    const result = await classifyLampV2("The full utterance.", {
      fetcher: fetcher as typeof fetch,
    });
    expect(LAMP_V2_MODEL).toBe("qwen3:8b");
    expect(result.verdict).toBe("lamp");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves the v2 prompt and model from the offline evaluation runner", () => {
    expect(LAMP_V2_PROMPT).toContain("THE HANDOFF TEST");
    expect(LAMP_V2_PROMPT).toContain("Utterance:");
    expect(LAMP_V2_MODEL).toBe("qwen3:8b");
    expect(LAMP_V2_PROMPT_VERSION).toBe("v2");
  });

  it("fails closed for anything except the exact binary label", async () => {
    const fetcher = vi.fn(async () => Response.json({ message: { content: "lamp because" } }));
    await expect(classifyLampV2("A text.", { fetcher: fetcher as typeof fetch })).rejects.toThrow(
      "LAMP_INVALID_BINARY_RESPONSE",
    );
  });

  it("keeps the ported prompt byte-for-byte equal to the locked v2 on branch B", () => {
    expect(createHash("sha256").update(LAMP_V2_PROMPT, "utf8").digest("hex")).toBe(
      LOCKED_PROMPT_SHA256,
    );
  });

  it("calls the owner's endpoint and sends the optional bearer token only when set", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return Response.json({ message: { content: "no-lamp\n" } });
    });
    const endpoint = "https://ollama.example.test/api/chat";
    await classifyLampV2("x", { fetcher: fetcher as typeof fetch, endpoint, token: "tok-1" });
    await classifyLampV2("x", { fetcher: fetcher as typeof fetch, endpoint });
    expect(seen[0]).toEqual({
      url: endpoint,
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok-1" },
    });
    expect(seen[1]!.headers).toEqual({ "Content-Type": "application/json" });
  });
});
