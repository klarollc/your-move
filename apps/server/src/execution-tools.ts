import type { JsonSchema } from "./json-schema-lite.js";
import { UnsupportedSchemaError, assertSupportedSchema } from "./json-schema-lite.js";
import type { BoundedContract } from "./work-contract.js";

// The tool interface (R3 brief, design 1). It mirrors the shape of an MCP tool (name, description,
// JSON Schema input) so a future MCP-client adapter can register remote tools here without any
// change to the execution loop or the approval gate. `sideEffectClass` is Your Move's own addition:
// it is what the gate routes on.
export type SideEffectClass = "read" | "propose";

export type ToolAuditEntry = Readonly<{
  tool: string;
  args: unknown;
  resultSummary: string;
  proposalId?: string;
}>;

/** Credentials come from the vaults only. They never enter a prompt, a transcript or an audit row. */
export type ToolCredentials = Readonly<{ github?: string }>;

export type ToolContext = Readonly<{
  executionId: string;
  audit: (entry: ToolAuditEntry) => void;
  credentials: ToolCredentials;
  /** Aborted when the server shuts down, so a tool call never outlives a bounded shutdown. */
  signal?: AbortSignal;
}>;

export type ToolResult =
  | Readonly<{ ok: true; data: unknown; summary: string }>
  | Readonly<{ ok: false; code: string; message: string }>;

export type Tool = Readonly<{
  name: string;
  /** Model-facing. */
  description: string;
  inputSchema: JsonSchema;
  sideEffectClass: SideEffectClass;
  /**
   * For a "read" tool, the gate runs this on the model's call. For a "propose" tool this is the
   * server-side applier: only the owner-approval path ever calls it, never the agent path.
   */
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}>;

export type ToolRegistry = ReadonlyMap<string, Tool>;

/** The exact v1 tool set. Boot refuses to start the execution subsystem on any drift from it. */
export const V1_TOOL_ALLOWLIST = ["web_fetch", "github_read", "github_propose_write"] as const;

export type ToolScope = Readonly<{ name: string; tools: readonly string[] }>;

export const DEFAULT_TOOL_SCOPE: ToolScope = { name: "default", tools: V1_TOOL_ALLOWLIST };

/**
 * Maps a contract's permission ceiling to the tools a run may see. v1 has one ceiling and one
 * scope; this function is the single place a richer ceiling is added later.
 */
export function toolScopeForCeiling(ceiling: BoundedContract["permissionCeiling"]): ToolScope {
  switch (ceiling) {
    case "draft_only":
      return DEFAULT_TOOL_SCOPE;
  }
}

/** The tools a model is offered for a scope, in scope order. Names outside the registry are dropped. */
export function toolsForScope(registry: ToolRegistry, scope: ToolScope): Tool[] {
  return scope.tools.flatMap((name) => {
    const tool = registry.get(name);
    return tool ? [tool] : [];
  });
}

export function createToolRegistry(tools: readonly Tool[]): ToolRegistry {
  const registry = new Map<string, Tool>();
  for (const tool of tools) {
    if (registry.has(tool.name)) throw new Error(`TOOL_REGISTERED_TWICE: ${tool.name}`);
    registry.set(tool.name, tool);
  }
  return registry;
}

export class ExecutionSubsystemRefusedError extends Error {
  readonly code: "TOOL_ALLOWLIST_DRIFT" | "TOOL_SCHEMA_UNSUPPORTED" | "TOOL_CLASS_INVALID";
  constructor(code: ExecutionSubsystemRefusedError["code"], detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ExecutionSubsystemRefusedError";
    this.code = code;
  }
}

/**
 * Boot-time verification. Fails closed: the registered names must EXACTLY equal the allowlist,
 * every tool must declare a known side-effect class, and every input schema must use only what the
 * in-repo validator enforces.
 */
export function verifyToolRegistry(
  registry: ToolRegistry,
  allowlist: readonly string[] = V1_TOOL_ALLOWLIST,
): void {
  const registered = [...registry.keys()].sort();
  const expected = [...allowlist].sort();
  if (
    registered.length !== expected.length ||
    registered.some((name, index) => name !== expected[index])
  ) {
    throw new ExecutionSubsystemRefusedError(
      "TOOL_ALLOWLIST_DRIFT",
      `registered [${registered.join(", ")}] != allowlist [${expected.join(", ")}]`,
    );
  }
  for (const tool of registry.values()) {
    if (tool.sideEffectClass !== "read" && tool.sideEffectClass !== "propose") {
      throw new ExecutionSubsystemRefusedError("TOOL_CLASS_INVALID", tool.name);
    }
    try {
      assertSupportedSchema(tool.inputSchema);
    } catch (error) {
      if (error instanceof UnsupportedSchemaError) {
        throw new ExecutionSubsystemRefusedError(
          "TOOL_SCHEMA_UNSUPPORTED",
          `${tool.name}: ${error.message}`,
        );
      }
      throw error;
    }
    if (tool.inputSchema.type !== "object") {
      throw new ExecutionSubsystemRefusedError(
        "TOOL_SCHEMA_UNSUPPORTED",
        `${tool.name}: input schema must be an object`,
      );
    }
  }
}
