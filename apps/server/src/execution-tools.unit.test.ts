import { describe, expect, it, vi } from "vitest";

import {
  gateToolCalls,
  hasTurnsRemaining,
  redactForAudit,
  CONTROL_MESSAGE,
} from "./execution-loop.js";
import {
  DEFAULT_TOOL_SCOPE,
  ExecutionSubsystemRefusedError,
  V1_TOOL_ALLOWLIST,
  createToolRegistry,
  toolScopeForCeiling,
  toolsForScope,
  verifyToolRegistry,
  type Tool,
  type ToolContext,
} from "./execution-tools.js";
import { createNativeToolRegistry } from "./native-tools.js";

const noFetch = vi.fn<typeof fetch>(async () => {
  throw new Error("no network in unit tests");
});

function fakeTool(name: string, overrides: Partial<Tool> = {}): Tool {
  return {
    name,
    description: `${name} test tool`,
    sideEffectClass: "read",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
      additionalProperties: false,
    },
    run: vi.fn(async () => ({ ok: true as const, data: { echoed: name }, summary: `${name} ran` })),
    ...overrides,
  };
}

function context(): ToolContext & { audits: unknown[] } {
  const audits: unknown[] = [];
  return {
    executionId: "exec_test",
    credentials: {},
    audit: (entry) => audits.push(entry),
    audits,
  };
}

describe("tool allowlist (boot verification)", () => {
  it("is exactly the three v1 tools", () => {
    expect([...V1_TOOL_ALLOWLIST]).toEqual(["web_fetch", "github_read", "github_propose_write"]);
  });

  it("accepts the native registry: names equal the allowlist and every schema is supported", () => {
    const registry = createNativeToolRegistry({ fetcher: noFetch });
    expect([...registry.keys()].sort()).toEqual([...V1_TOOL_ALLOWLIST].sort());
    expect(() => verifyToolRegistry(registry)).not.toThrow();
  });

  it.each([
    ["an extra tool", [...V1_TOOL_ALLOWLIST, "shell_exec"]],
    ["a missing tool", ["web_fetch", "github_read"]],
    ["a renamed tool", ["web_fetch", "github_read", "github_write"]],
  ])("refuses to start the subsystem on drift: %s", (_name, names) => {
    const registry = createToolRegistry(names.map((name) => fakeTool(name)));
    expect(() => verifyToolRegistry(registry)).toThrow(ExecutionSubsystemRefusedError);
    try {
      verifyToolRegistry(registry);
    } catch (error) {
      expect((error as ExecutionSubsystemRefusedError).code).toBe("TOOL_ALLOWLIST_DRIFT");
    }
  });

  it("refuses to start when a registered tool uses a schema feature the validator cannot enforce", () => {
    const registry = createToolRegistry(
      V1_TOOL_ALLOWLIST.map((name) =>
        name === "web_fetch"
          ? fakeTool(name, {
              inputSchema: {
                type: "object",
                properties: { url: { type: "string", format: "uri" } },
              },
            })
          : fakeTool(name),
      ),
    );
    expect(() => verifyToolRegistry(registry)).toThrow(/TOOL_SCHEMA_UNSUPPORTED/);
  });

  it("refuses a tool with an unknown side-effect class", () => {
    const registry = createToolRegistry(
      V1_TOOL_ALLOWLIST.map((name) =>
        fakeTool(name, name === "github_read" ? { sideEffectClass: "write" as never } : {}),
      ),
    );
    expect(() => verifyToolRegistry(registry)).toThrow(/TOOL_CLASS_INVALID/);
  });
});

describe("tool scope", () => {
  it("maps the draft_only ceiling to DEFAULT_TOOL_SCOPE: all three v1 tools", () => {
    expect(toolScopeForCeiling("draft_only")).toBe(DEFAULT_TOOL_SCOPE);
    const registry = createNativeToolRegistry({ fetcher: noFetch });
    expect(toolsForScope(registry, DEFAULT_TOOL_SCOPE).map(({ name }) => name)).toEqual([
      ...V1_TOOL_ALLOWLIST,
    ]);
  });

  it("filters what the model sees to the scope", () => {
    const registry = createNativeToolRegistry({ fetcher: noFetch });
    expect(
      toolsForScope(registry, { name: "narrow", tools: ["github_read", "not_registered"] }).map(
        ({ name }) => name,
      ),
    ).toEqual(["github_read"]);
  });
});

describe("turn bound", () => {
  it("allows a turn only while turns remain", () => {
    expect(hasTurnsRemaining(0, 10)).toBe(true);
    expect(hasTurnsRemaining(9, 10)).toBe(true);
    expect(hasTurnsRemaining(10, 10)).toBe(false);
    expect(hasTurnsRemaining(11, 10)).toBe(false);
    expect(hasTurnsRemaining(Number.NaN, 10)).toBe(false);
  });
});

describe("approval gate", () => {
  it("runs reads, diverts the first propose call, and answers every call exactly once", async () => {
    const read = fakeTool("github_read");
    const propose = fakeTool("github_propose_write", { sideEffectClass: "propose" });
    const later = fakeTool("web_fetch");
    const ctx = context();
    const outcome = await gateToolCalls(
      [
        { id: "call_1", name: "github_read", arguments: { q: "a" } },
        { id: "call_2", name: "github_propose_write", arguments: { q: "b" } },
        { id: "call_3", name: "web_fetch", arguments: { q: "c" } },
        { id: "call_4", name: "github_propose_write", arguments: { q: "d" } },
      ],
      { tools: [read, propose, later], ctx, newProposalId: () => "proposal_fixed" },
    );

    expect(read.run).toHaveBeenCalledTimes(1);
    // The agent path never executes a propose-class tool, and nothing runs after the proposal.
    expect(propose.run).not.toHaveBeenCalled();
    expect(later.run).not.toHaveBeenCalled();
    expect(outcome.proposal).toEqual({
      id: "proposal_fixed",
      tool: "github_propose_write",
      args: { q: "b" },
    });

    const ids = outcome.results.map((entry) => (entry.role === "tool" ? entry.toolCallId : ""));
    expect(ids).toEqual(["call_1", "call_2", "call_3", "call_4"]);
    const contents = outcome.results.map((entry) =>
      entry.role === "tool" ? (JSON.parse(entry.content) as Record<string, unknown>) : {},
    );
    expect(contents[0]).toEqual({ echoed: "github_read" });
    expect(contents[1]).toEqual({
      status: "pending_owner_approval",
      proposalId: "proposal_fixed",
      message: CONTROL_MESSAGE,
    });
    expect(contents[2]).toEqual({
      status: "not_run",
      message: "not run — turn ended at proposal proposal_fixed",
    });
    expect(contents[3]?.status).toBe("not_run");

    // One audit row per call: the read now, the rest with the proposal's transaction.
    expect(ctx.audits).toHaveLength(1);
    expect(outcome.deferredAudits).toHaveLength(3);
    expect(outcome.deferredAudits.every((entry) => entry.proposalId === "proposal_fixed")).toBe(
      true,
    );
  });

  it("refuses invalid arguments and unknown tools without running anything", async () => {
    const read = fakeTool("github_read");
    const ctx = context();
    const outcome = await gateToolCalls(
      [
        { id: "call_1", name: "github_read", arguments: { q: 1 } },
        { id: "call_2", name: "shell_exec", arguments: { cmd: "rm -rf /" } },
        { id: "call_3", name: "github_read", arguments: { __unparsed_arguments: "{" } },
      ],
      { tools: [read], ctx },
    );
    expect(read.run).not.toHaveBeenCalled();
    expect(outcome.proposal).toBeUndefined();
    const errors = outcome.results.map((entry) =>
      entry.role === "tool" ? (JSON.parse(entry.content) as { error: string }).error : "",
    );
    expect(errors).toEqual([
      "TOOL_ARGUMENTS_INVALID",
      "TOOL_NOT_AVAILABLE",
      "TOOL_ARGUMENTS_INVALID",
    ]);
    expect(ctx.audits).toHaveLength(3);
  });

  it("refuses an invalid propose call instead of recording a proposal", async () => {
    const propose = fakeTool("github_propose_write", { sideEffectClass: "propose" });
    const outcome = await gateToolCalls(
      [{ id: "call_1", name: "github_propose_write", arguments: {} }],
      { tools: [propose], ctx: context() },
    );
    expect(outcome.proposal).toBeUndefined();
    expect(propose.run).not.toHaveBeenCalled();
  });
});

describe("audit redaction", () => {
  it("removes known credentials, token-shaped values and secret-named fields", () => {
    const pat = "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz";
    const redacted = redactForAudit(
      {
        url: `https://example.com/?q=${pat}`,
        note: "classic ghp_abcdefghijklmnopqrstuvwxyz0123 token",
        apiKey: "anything",
        nested: [{ authorization: "Bearer xyz" }, "the-known-secret-value"],
      },
      ["the-known-secret-value"],
    );
    const text = JSON.stringify(redacted);
    expect(text).not.toContain(pat);
    expect(text).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123");
    expect(text).not.toContain("the-known-secret-value");
    expect(text).not.toContain("anything");
    expect(text).not.toContain("xyz");
  });
});
