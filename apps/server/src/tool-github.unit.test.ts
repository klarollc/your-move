import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "./execution-tools.js";
import {
  GITHUB_READ_CAP_BYTES,
  PROPOSAL_STALE_CODE,
  PROPOSAL_STALE_MESSAGE,
  createGithubProposeWriteTool,
  createGithubReadTool,
} from "./tool-github.js";

const token = "github_pat_unit_test_only_0123456789";
const ctx: ToolContext = {
  executionId: "exec_test",
  credentials: { github: token },
  audit: () => undefined,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const file = (content: string, sha = "sha_current") => ({
  type: "file",
  path: "docs/a.md",
  sha,
  size: content.length,
  encoding: "base64",
  content: Buffer.from(content).toString("base64"),
});

describe("github_read", () => {
  it("reads through the contents API with the vault token and returns path, sha and content", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(file("# Hello")));
    const result = await createGithubReadTool({ fetcher }).run(
      { repo: "octo/repo", path: "docs/a.md", ref: "main" },
      ctx,
    );
    expect(result).toMatchObject({
      ok: true,
      data: { path: "docs/a.md", sha: "sha_current", content: "# Hello" },
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://api.github.com/repos/octo/repo/contents/docs/a.md?ref=main");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
  });

  it("truncates files over 256 KB with a marker", async () => {
    const big = "x".repeat(GITHUB_READ_CAP_BYTES + 10);
    const fetcher = vi.fn<typeof fetch>(async () => json(file(big)));
    const result = await createGithubReadTool({ fetcher }).run(
      { repo: "octo/repo", path: "docs/a.md" },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const content = (result.data as { content: string }).content;
    expect(content.startsWith("x".repeat(GITHUB_READ_CAP_BYTES))).toBe(true);
    expect(content).toContain("[…truncated");
    expect(content.length).toBeLessThan(big.length + 200);
  });

  it.each([
    ["a traversal path", { repo: "octo/repo", path: "../secrets" }],
    ["a malformed repo", { repo: "https://evil.example/x", path: "a" }],
  ])("refuses %s without calling GitHub", async (_name, args) => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await createGithubReadTool({ fetcher }).run(args, ctx);
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports a missing connection instead of calling GitHub", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await createGithubReadTool({ fetcher }).run(
      { repo: "octo/repo", path: "a" },
      { ...ctx, credentials: {} },
    );
    expect(result).toMatchObject({ ok: false, code: "GITHUB_NOT_CONNECTED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("github_propose_write applier (server-side, owner-approved only)", () => {
  const args = {
    repo: "octo/repo",
    path: "docs/a.md",
    content: "# New",
    message: "Update a.md",
    base_sha: "sha_current",
  };

  it("re-checks the sha, then PUTs the approved content", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PUT"
        ? json({ content: { path: "docs/a.md", sha: "sha_new" }, commit: { sha: "commit_1" } })
        : json(file("# Old")),
    );
    const result = await createGithubProposeWriteTool({ fetcher }).run(args, ctx);
    expect(result).toMatchObject({ ok: true, data: { path: "docs/a.md", commitSha: "commit_1" } });
    const put = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(String(put[0])).toBe("https://api.github.com/repos/octo/repo/contents/docs/a.md");
    expect(JSON.parse(String(put[1]?.body))).toEqual({
      message: "Update a.md",
      content: Buffer.from("# New").toString("base64"),
      sha: "sha_current",
    });
  });

  it("marks the proposal stale when the file changed, and never writes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(file("# Changed", "sha_other")));
    const result = await createGithubProposeWriteTool({ fetcher }).run(args, ctx);
    expect(result).toEqual({
      ok: false,
      code: PROPOSAL_STALE_CODE,
      message: PROPOSAL_STALE_MESSAGE,
    });
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("creates a new file when base_sha is empty and the file does not exist", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PUT"
        ? json({ content: { path: "docs/new.md", sha: "sha_new" }, commit: { sha: "commit_2" } })
        : json({ message: "Not Found" }, 404),
    );
    const result = await createGithubProposeWriteTool({ fetcher }).run(
      { ...args, path: "docs/new.md", base_sha: "" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const put = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(String(put[1]?.body))).not.toHaveProperty("sha");
  });
});
