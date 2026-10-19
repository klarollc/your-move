import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "./execution-tools.js";
import {
  WEB_FETCH_MAX_CHARS,
  checkFetchTarget,
  createWebFetchTool,
  extractFromHtml,
  isBlockedAddress,
} from "./tool-web-fetch.js";

const ctx: ToolContext = { executionId: "exec_test", credentials: {}, audit: () => undefined };
const publicHost = async () => ["93.184.216.34"];

function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

describe("web_fetch SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.9",
    "192.168.1.1",
    "100.64.0.1",
    "100.100.100.200",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fd00:ec2::254",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "224.0.0.1",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("allows public %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it.each([
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]:8080/",
    "http://[fd00:ec2::254]/",
    "http://localhost:3000/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "http://user:pass@example.com/",
  ])("denies %s before any fetch", async (url) => {
    const fetcher = vi.fn<typeof fetch>();
    const tool = createWebFetchTool({ fetcher, resolveHost: publicHost });
    const result = await tool.run({ url }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEB_FETCH_BLOCKED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("denies a public-looking hostname that resolves to a private address", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const resolveHost = vi.fn(async () => ["93.184.216.34", "10.0.0.5"]);
    const tool = createWebFetchTool({ fetcher, resolveHost });
    const result = await tool.run({ url: "https://rebind.example.test/" }, ctx);
    expect(result.ok).toBe(false);
    expect(resolveHost).toHaveBeenCalledWith("rebind.example.test");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("re-checks every redirect hop and refuses a redirect into metadata", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        }),
    );
    const tool = createWebFetchTool({ fetcher, resolveHost: publicHost });
    const result = await tool.run({ url: "https://example.com/start" }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEB_FETCH_BLOCKED");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports an unresolvable host as blocked", async () => {
    expect(
      await checkFetchTarget(new URL("https://nowhere.example.test/"), async () => {
        throw new Error("ENOTFOUND");
      }),
    ).toMatch(/could not be resolved/);
  });
});

describe("web_fetch extraction", () => {
  it("returns url, title and the main text, without scripts, navigation or markup", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      html(
        "<html><head><title>Example &amp; Co</title><script>steal()</script></head><body>" +
          "<nav>Menu</nav><main><h1>Hello</h1><p>World &lt;3</p><ul><li>one</li></ul></main>" +
          "<footer>Footer</footer></body></html>",
      ),
    );
    const tool = createWebFetchTool({ fetcher, resolveHost: publicHost });
    const result = await tool.run({ url: "https://example.com/page" }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { url: string; title?: string; text: string };
    expect(data.url).toBe("https://example.com/page");
    expect(data.title).toBe("Example & Co");
    expect(data.text).toContain("Hello");
    expect(data.text).toContain("World <3");
    expect(data.text).not.toMatch(/steal|Menu|Footer|<p>/);
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.redirect).toBe("manual");
  });

  it("renders light markdown on request", () => {
    const { text } = extractFromHtml(
      '<main><h2>Title</h2><p>See <a href="https://a.example">docs</a></p><li>item</li></main>',
      "markdown",
    );
    expect(text).toContain("## Title");
    expect(text).toContain("[docs](https://a.example)");
    expect(text).toContain("- item");
  });

  it("caps the fetched body at 500 KB and the returned text at 32k characters", async () => {
    const big = `<main>${"word ".repeat(200_000)}</main>`;
    const fetcher = vi.fn<typeof fetch>(async () => html(big));
    const tool = createWebFetchTool({ fetcher, resolveHost: publicHost });
    const result = await tool.run({ url: "https://example.com/big" }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { text: string };
    expect(data.text.length).toBeLessThanOrEqual(WEB_FETCH_MAX_CHARS);
    expect(data.text.endsWith("[…truncated]")).toBe(true);
    expect(result.summary).toContain("capped at 500 KB");
  });

  it("refuses binary content", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("\u0000PNG", { headers: { "content-type": "image/png" } }),
    );
    const tool = createWebFetchTool({ fetcher, resolveHost: publicHost });
    const result = await tool.run({ url: "https://example.com/logo.png" }, ctx);
    expect(result.ok).toBe(false);
  });
});
