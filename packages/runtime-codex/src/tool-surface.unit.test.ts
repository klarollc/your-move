import { describe, expect, it } from "vitest";

import { enumerateMcpServers } from "./tool-surface.js";

function lister(pages: unknown[]) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    supervisor: {
      async request(method: string, params: Record<string, unknown>) {
        calls.push({ method, params });
        return pages[calls.length - 1];
      },
    },
  };
}

const appsServer = {
  name: "codex_apps",
  authStatus: "oAuth",
  runtimeStatus: "connected",
  tools: { github_search: {}, calendar_create: {} },
  resources: [],
  resourceTemplates: [],
};

describe("MCP enumeration (F1.3)", () => {
  it("asks for the thread's servers with tools and auth only, and reports each server's tools", async () => {
    const fake = lister([{ data: [appsServer], nextCursor: null }]);
    const servers = await enumerateMcpServers(fake.supervisor, "thread_1");
    expect(fake.calls).toEqual([
      {
        method: "mcpServerStatus/list",
        params: { threadId: "thread_1", detail: "toolsAndAuthOnly" },
      },
    ]);
    expect(servers).toEqual([
      { name: "codex_apps", status: "connected", toolNames: ["calendar_create", "github_search"] },
    ]);
  });

  it("reports the auth status when the runtime status is unavailable", async () => {
    const fake = lister([
      { data: [{ ...appsServer, runtimeStatus: null, tools: {} }], nextCursor: null },
    ]);
    expect(await enumerateMcpServers(fake.supervisor, "thread_1")).toEqual([
      { name: "codex_apps", status: "oAuth", toolNames: [] },
    ]);
  });

  it("follows the cursor to the last page, so a second page cannot hide a server", async () => {
    const fake = lister([
      { data: [], nextCursor: "page_2" },
      { data: [{ ...appsServer, name: "later" }], nextCursor: null },
    ]);
    const servers = await enumerateMcpServers(fake.supervisor, "thread_1");
    expect(servers.map((server) => server.name)).toEqual(["later"]);
    expect(fake.calls[1]?.params).toEqual({
      threadId: "thread_1",
      detail: "toolsAndAuthOnly",
      cursor: "page_2",
    });
  });

  it("refuses a response it cannot read rather than reporting an empty surface", async () => {
    await expect(
      enumerateMcpServers(lister([{ servers: [] }]).supervisor, "thread_1"),
    ).rejects.toThrow(/MCP_ENUMERATION_INVALID/u);
    await expect(
      enumerateMcpServers(
        lister([{ data: [{ name: "x", tools: {} }], nextCursor: null }]).supervisor,
        "thread_1",
      ),
    ).rejects.toThrow(/MCP_ENUMERATION_INVALID/u);
  });

  it("refuses a cursor that never ends", async () => {
    const endless = { data: [], nextCursor: "again" };
    await expect(
      enumerateMcpServers(lister(Array.from({ length: 50 }, () => endless)).supervisor, "t"),
    ).rejects.toThrow(/MCP_ENUMERATION_UNBOUNDED/u);
  });
});
