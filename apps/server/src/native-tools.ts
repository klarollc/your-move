import { createToolRegistry, type ToolRegistry } from "./execution-tools.js";
import { createGithubProposeWriteTool, createGithubReadTool } from "./tool-github.js";
import { createWebFetchTool, type ResolveHost } from "./tool-web-fetch.js";

/** The native v1 tools, registered in code. Boot verifies these against V1_TOOL_ALLOWLIST. */
export function createNativeToolRegistry(options: {
  fetcher: typeof fetch;
  resolveHost?: ResolveHost;
}): ToolRegistry {
  return createToolRegistry([
    createWebFetchTool({
      fetcher: options.fetcher,
      ...(options.resolveHost ? { resolveHost: options.resolveHost } : {}),
    }),
    createGithubReadTool({ fetcher: options.fetcher }),
    createGithubProposeWriteTool({ fetcher: options.fetcher }),
  ]);
}
