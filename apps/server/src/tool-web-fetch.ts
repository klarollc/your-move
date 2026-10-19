import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import type { Tool, ToolResult } from "./execution-tools.js";

export const WEB_FETCH_TIMEOUT_MS = 30_000;
export const WEB_FETCH_MAX_BYTES = 500 * 1024;
export const WEB_FETCH_MAX_CHARS = 32_000;
const MAX_REDIRECTS = 5;

export type ResolveHost = (hostname: string) => Promise<string[]>;

export const resolveHostWithDns: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);

// Private, loopback, link-local, carrier-grade NAT, documentation, multicast and reserved ranges.
// Cloud metadata endpoints fall inside them: 169.254.169.254 (AWS, GCP, Azure, OCI) is link-local,
// 100.100.100.200 (Alibaba) is CGNAT, and fd00:ec2::254 (AWS IPv6) is unique-local.
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

const BLOCKED_HOSTNAMES = [/^localhost$/i, /\.localhost$/i, /^metadata\.google\.internal$/i];

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;
  // An IPv4-mapped IPv6 address (::ffff:a.b.c.d) is the IPv4 address in disguise.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped?.[1]) return isBlockedAddress(mapped[1]);
  if (/^::ffff:/i.test(address)) return true;
  return blocked.check(address, "ipv6");
}

/**
 * Refuses a URL whose host is, or resolves to, a blocked address.
 *
 * TOCTOU limitation: this resolves the hostname, checks every address, then lets `fetch` resolve
 * it again. A hostile DNS server can answer the check with a public address and the fetch with a
 * private one (DNS rebinding). Closing that gap means pinning the checked address into the
 * connection (a custom undici dispatcher with a fixed `lookup`); v1 accepts the window, keeps
 * redirects manual so every hop is re-checked, and runs on a host with no private services.
 */
export async function checkFetchTarget(url: URL, resolveHost: ResolveHost): Promise<string | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return "only http and https are allowed";
  if (url.username || url.password) return "URLs with credentials are not allowed";
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return "the URL has no host";
  if (BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname))) {
    return "private and internal hosts are not allowed";
  }
  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = await resolveHost(hostname);
    } catch {
      return "the host could not be resolved";
    }
  }
  if (addresses.length === 0) return "the host could not be resolved";
  if (addresses.some(isBlockedAddress)) return "private and internal addresses are not allowed";
  return null;
}

async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Buffer; truncated: boolean }> {
  if (!response.body) return { bytes: Buffer.alloc(0), truncated: false };
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    if (value.byteLength > remaining) {
      chunks.push(Buffer.from(value.subarray(0, remaining)));
      total += remaining;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(Buffer.from(value));
    total += value.byteLength;
  }
  return { bytes: Buffer.concat(chunks, total), truncated };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : entity;
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ""));

/** Pulls the title and main readable text from HTML: `<main>` or `<article>` when present. */
export function extractFromHtml(
  html: string,
  mode: "text" | "markdown",
): { title?: string; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1] ? stripTags(titleMatch[1]).replace(/\s+/g, " ").trim() : "";
  let body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, "");
  const main =
    /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(body) ??
    /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(body);
  if (main?.[1]) {
    body = main[1];
  } else {
    body = body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, "");
    const bodyMatch = /<body\b[^>]*>([\s\S]*?)(?:<\/body>|$)/i.exec(body);
    if (bodyMatch?.[1]) body = bodyMatch[1];
  }
  if (mode === "markdown") {
    body = body
      .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
        return `\n\n${"#".repeat(Number(level))} ${stripTags(inner).trim()}\n\n`;
      })
      .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
        const label = stripTags(String(inner)).trim();
        return label ? `[${label}](${String(href)})` : "";
      })
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "_$2_")
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  } else {
    body = body.replace(/<li\b[^>]*>/gi, "\n• ");
  }
  const text = stripTags(
    body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|section|tr|h[1-6]|ul|ol|pre)>/gi, "\n\n"),
  )
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return title ? { title, text } : { text };
}

const failure = (code: string, message: string): ToolResult => ({ ok: false, code, message });

export function createWebFetchTool(options: {
  fetcher: typeof fetch;
  resolveHost?: ResolveHost;
}): Tool {
  const resolveHost = options.resolveHost ?? resolveHostWithDns;
  return {
    name: "web_fetch",
    description:
      "Fetch a public web page over http(s) and return its title and main text (at most 32,000 " +
      "characters). Private, internal and cloud-metadata addresses are refused.",
    sideEffectClass: "read",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The http or https address to read" },
        extract: {
          type: "string",
          enum: ["text", "markdown"],
          description: "Plain text (default) or light markdown",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    async run(args, ctx) {
      let url: URL;
      try {
        url = new URL(String(args.url));
      } catch {
        return failure("WEB_FETCH_URL_INVALID", "url is not a valid address");
      }
      const mode = args.extract === "markdown" ? "markdown" : "text";
      const timeout = AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS);
      const signal = ctx.signal ? AbortSignal.any([timeout, ctx.signal]) : timeout;

      let response: Response | undefined;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        const refusal = await checkFetchTarget(url, resolveHost);
        if (refusal) return failure("WEB_FETCH_BLOCKED", refusal);
        try {
          response = await options.fetcher(url, {
            method: "GET",
            redirect: "manual",
            headers: {
              accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.5",
              "user-agent": "cuckcode-hosted",
            },
            signal,
          });
        } catch {
          return failure("WEB_FETCH_UNAVAILABLE", "the page could not be fetched");
        }
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          await response.body?.cancel().catch(() => undefined);
          try {
            url = new URL(location, url);
          } catch {
            return failure("WEB_FETCH_UNAVAILABLE", "the page redirected to an invalid address");
          }
          response = undefined;
          continue;
        }
        break;
      }
      if (!response) return failure("WEB_FETCH_UNAVAILABLE", "too many redirects");
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return failure("WEB_FETCH_HTTP_ERROR", `the page returned ${response.status}`);
      }
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      const isHtml = contentType.includes("html");
      const isText =
        isHtml ||
        contentType.startsWith("text/") ||
        contentType.includes("json") ||
        contentType.includes("xml") ||
        contentType === "";
      if (!isText) {
        await response.body?.cancel().catch(() => undefined);
        return failure("WEB_FETCH_UNSUPPORTED", `content type ${contentType} is not text`);
      }
      let read: { bytes: Buffer; truncated: boolean };
      try {
        read = await readCapped(response, WEB_FETCH_MAX_BYTES);
      } catch {
        return failure("WEB_FETCH_UNAVAILABLE", "the page could not be read");
      }
      const raw = read.bytes.toString("utf8");
      const extracted = isHtml ? extractFromHtml(raw, mode) : { text: raw.trim() };
      const marker = "\n[…truncated]";
      const text =
        extracted.text.length > WEB_FETCH_MAX_CHARS
          ? `${extracted.text.slice(0, WEB_FETCH_MAX_CHARS - marker.length)}${marker}`
          : extracted.text;
      const data = {
        url: url.toString(),
        ...(extracted.title ? { title: extracted.title } : {}),
        text,
      };
      return {
        ok: true,
        data,
        summary: `fetched ${data.url} (${text.length} chars${read.truncated ? ", body capped at 500 KB" : ""})`,
      };
    },
  };
}
