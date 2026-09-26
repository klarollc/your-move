import type { ObservedMcpServer } from "@cuckcode/contracts";

type Requester = {
  request(method: string, params: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
};

/** A cursor that has not ended after this many pages is refused rather than followed forever. */
const MAX_PAGES = 20;

/**
 * Lists the MCP servers a session started (F1.3), following the cursor to the last page. Read-only:
 * `toolsAndAuthOnly` asks for the tool catalog and auth state, not resources. Anything it cannot
 * read is refused, because an unreadable answer reported as an empty list would pass the binding's
 * TOOL_SURFACE_PRESENT check on a session nobody actually looked at.
 */
export async function enumerateMcpServers(
  supervisor: Requester,
  threadId: string | null,
): Promise<ObservedMcpServer[]> {
  const servers: ObservedMcpServer[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await supervisor.request(
      "mcpServerStatus/list",
      { threadId, detail: "toolsAndAuthOnly", ...(cursor === null ? {} : { cursor }) },
      30_000,
    );
    const body = record(result);
    if (!body || !Array.isArray(body.data)) throw new Error("MCP_ENUMERATION_INVALID");
    for (const entry of body.data) servers.push(readServer(entry));
    const next = body.nextCursor;
    if (next === null || next === undefined) {
      return servers.sort((left, right) => left.name.localeCompare(right.name));
    }
    if (typeof next !== "string" || next.length === 0) throw new Error("MCP_ENUMERATION_INVALID");
    cursor = next;
  }
  throw new Error("MCP_ENUMERATION_UNBOUNDED");
}

function readServer(value: unknown): ObservedMcpServer {
  const server = record(value);
  const name = server?.name;
  const tools = record(server?.tools);
  const status = nonEmpty(server?.runtimeStatus) ?? nonEmpty(server?.authStatus);
  if (typeof name !== "string" || name.length === 0 || !tools || !status) {
    throw new Error("MCP_ENUMERATION_INVALID");
  }
  return { name, status, toolNames: Object.keys(tools).sort() };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
