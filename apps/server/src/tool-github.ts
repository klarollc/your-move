import type { Tool, ToolResult } from "./execution-tools.js";
import { getContents, putContents } from "./github-client.js";

export const GITHUB_READ_CAP_BYTES = 256 * 1024;
const PROPOSE_MAX_BYTES = 1024 * 1024;
export const PROPOSAL_STALE_CODE = "PROPOSAL_STALE";
export const PROPOSAL_STALE_MESSAGE = "proposal went stale (sha changed), re-read the file";

const notConnected: ToolResult = {
  ok: false,
  code: "GITHUB_NOT_CONNECTED",
  message: "GitHub is not connected. Ask the owner to connect it.",
};

export function createGithubReadTool(options: { fetcher: typeof fetch }): Tool {
  return {
    name: "github_read",
    description:
      "Read a file (or list a directory) in a GitHub repository the owner's token can access. " +
      "Returns the path, the file's sha (needed as base_sha when proposing a change), and its " +
      "content. Files over 256 KB are truncated with a marker.",
    sideEffectClass: "read",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository as owner/name" },
        path: { type: "string", description: "Repository-relative path; empty for the root" },
        ref: { type: "string", description: "Branch, tag or commit; default branch if omitted" },
      },
      required: ["repo", "path"],
      additionalProperties: false,
    },
    async run(args, ctx) {
      const token = ctx.credentials.github;
      if (!token) return notConnected;
      const ref = typeof args.ref === "string" && args.ref.length > 0 ? args.ref : undefined;
      const result = await getContents(
        options.fetcher,
        token,
        String(args.repo),
        String(args.path),
        ref,
        ctx.signal,
      );
      if (!result.ok) return result;
      if (result.kind === "directory") {
        const content = result.entries.map((entry) => `${entry.type} ${entry.path}`).join("\n");
        return {
          ok: true,
          data: { path: result.path, sha: "", content },
          summary: `listed ${result.path || "/"} (${result.entries.length} entries)`,
        };
      }
      if (!result.bytes) {
        return {
          ok: true,
          data: {
            path: result.path,
            sha: result.sha,
            content: "[file too large to read through the GitHub contents API]",
          },
          summary: `read ${result.path} (too large to return)`,
        };
      }
      const truncated = result.bytes.length > GITHUB_READ_CAP_BYTES;
      const content = truncated
        ? `${result.bytes.subarray(0, GITHUB_READ_CAP_BYTES).toString("utf8")}\n[…truncated: the file is ${result.bytes.length} bytes; only the first 256 KB are shown]`
        : result.bytes.toString("utf8");
      return {
        ok: true,
        data: { path: result.path, sha: result.sha, content },
        summary: `read ${result.path} (${result.bytes.length} bytes${truncated ? ", truncated" : ""})`,
      };
    },
  };
}

/**
 * A propose-class tool. The model calls it like any other tool, but the approval gate diverts the
 * call into a pending proposal; `run` below is the server-side applier, invoked only after the
 * owner approves. It re-checks the file's sha first, so a file that changed since the agent read it
 * is never overwritten.
 */
export function createGithubProposeWriteTool(options: { fetcher: typeof fetch }): Tool {
  return {
    name: "github_propose_write",
    description:
      "Propose creating or replacing one file in a GitHub repository. This does NOT change the " +
      "file: it records a proposal and pauses the work until the owner approves or denies it. " +
      "Read the file with github_read first and pass its sha as base_sha (use an empty string " +
      "for a new file). Content is the complete new file text.",
    sideEffectClass: "propose",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository as owner/name" },
        path: { type: "string", description: "Repository-relative file path" },
        content: { type: "string", description: "The complete new file content" },
        message: { type: "string", description: "Commit message" },
        base_sha: {
          type: "string",
          description: "The sha github_read returned for this file; empty string for a new file",
        },
      },
      required: ["repo", "path", "content", "message", "base_sha"],
      additionalProperties: false,
    },
    async run(args, ctx) {
      const token = ctx.credentials.github;
      if (!token) return notConnected;
      const repo = String(args.repo);
      const path = String(args.path);
      const content = String(args.content);
      const message = String(args.message).trim();
      const baseSha = String(args.base_sha);
      if (!message) return { ok: false, code: "PROPOSAL_INVALID", message: "message is empty" };
      if (Buffer.byteLength(content, "utf8") > PROPOSE_MAX_BYTES) {
        return { ok: false, code: "PROPOSAL_INVALID", message: "content is over 1 MB" };
      }

      const current = await getContents(options.fetcher, token, repo, path, undefined, ctx.signal);
      let currentSha: string;
      if (current.ok) {
        if (current.kind !== "file") {
          return { ok: false, code: "PROPOSAL_INVALID", message: "path is a directory" };
        }
        currentSha = current.sha;
      } else if (current.code === "GITHUB_NOT_FOUND") {
        currentSha = "";
      } else {
        return current;
      }
      if (currentSha !== baseSha) {
        return { ok: false, code: PROPOSAL_STALE_CODE, message: PROPOSAL_STALE_MESSAGE };
      }

      const written = await putContents(
        options.fetcher,
        token,
        { repo, path, content, message, ...(baseSha ? { sha: baseSha } : {}) },
        ctx.signal,
      );
      if (!written.ok) return written;
      return {
        ok: true,
        data: { path: written.path, commitSha: written.commitSha, contentSha: written.contentSha },
        summary: `${baseSha ? "updated" : "created"} ${written.path} in ${repo} (commit ${written.commitSha})`,
      };
    },
  };
}
