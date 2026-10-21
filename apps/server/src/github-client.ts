import { z } from "zod";

// Minimal GitHub REST client for the v1 integration: token validation at connect, and the Contents
// API for read and (owner-approved, server-side) write. The token is only ever placed in the
// Authorization header; it is never logged, echoed, or returned.

const API = "https://api.github.com";
const TIMEOUT_MS = 30_000;

export type GithubFailure = Readonly<{ ok: false; code: string; message: string }>;

function headers(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "your-move-hosted",
  };
}

function withTimeout(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

function failureFor(status: number): GithubFailure {
  if (status === 401) {
    return { ok: false, code: "GITHUB_AUTH_REJECTED", message: "GitHub rejected the token" };
  }
  if (status === 403) {
    return {
      ok: false,
      code: "GITHUB_FORBIDDEN",
      message: "The token is not allowed to do this (check the token's repository access)",
    };
  }
  if (status === 404) return { ok: false, code: "GITHUB_NOT_FOUND", message: "Not found" };
  if (status === 409 || status === 422) {
    return { ok: false, code: "GITHUB_CONFLICT", message: `GitHub refused the change (${status})` };
  }
  return { ok: false, code: "GITHUB_UNAVAILABLE", message: `GitHub returned ${status}` };
}

async function call(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit & { token: string },
): Promise<Response | GithubFailure> {
  const { token, ...rest } = init;
  try {
    return await fetcher(url, {
      ...rest,
      headers: { ...headers(token), ...(rest.body ? { "content-type": "application/json" } : {}) },
      signal: withTimeout(rest.signal ?? undefined),
    });
  } catch {
    return { ok: false, code: "GITHUB_UNAVAILABLE", message: "GitHub could not be reached" };
  }
}

export const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

/** `owner/name` and a repository-relative path, or a failure. Never lets ".." or a URL through. */
export function contentsUrl(repo: string, path: string, ref?: string): string | GithubFailure {
  if (!REPO_PATTERN.test(repo) || repo.endsWith("/.") || repo.endsWith("/..")) {
    return { ok: false, code: "GITHUB_REPO_INVALID", message: "repo must look like owner/name" };
  }
  const segments = path.split("/").filter((segment) => segment.length > 0);
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    return { ok: false, code: "GITHUB_PATH_INVALID", message: "path must be repository-relative" };
  }
  const url = new URL(
    `${API}/repos/${repo}/contents/${segments.map(encodeURIComponent).join("/")}`,
  );
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}

const userSchema = z.object({ login: z.string() });

export async function validateGithubToken(
  token: string,
  fetcher: typeof fetch,
): Promise<{ ok: true; login: string } | GithubFailure> {
  const response = await call(fetcher, `${API}/user`, { method: "GET", token });
  if (!(response instanceof Response)) return response;
  if (!response.ok) return failureFor(response.status);
  const parsed = userSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    return { ok: false, code: "GITHUB_RESPONSE_INVALID", message: "Unexpected reply from GitHub" };
  }
  return { ok: true, login: parsed.data.login };
}

const fileSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
  sha: z.string(),
  size: z.number().optional(),
  encoding: z.string().optional(),
  content: z.string().optional(),
});
const directorySchema = z.array(
  z.object({ type: z.string(), name: z.string(), path: z.string(), sha: z.string() }),
);

export type GithubContents =
  | Readonly<{ ok: true; kind: "file"; path: string; sha: string; bytes: Buffer | null }>
  | Readonly<{
      ok: true;
      kind: "directory";
      path: string;
      entries: { type: string; name: string; path: string; sha: string }[];
    }>;

export async function getContents(
  fetcher: typeof fetch,
  token: string,
  repo: string,
  path: string,
  ref: string | undefined,
  signal?: AbortSignal,
): Promise<GithubContents | GithubFailure> {
  const url = contentsUrl(repo, path, ref);
  if (typeof url !== "string") return url;
  const response = await call(fetcher, url, { method: "GET", token, signal: signal ?? null });
  if (!(response instanceof Response)) return response;
  if (!response.ok) return failureFor(response.status);
  const body: unknown = await response.json().catch(() => undefined);
  const directory = directorySchema.safeParse(body);
  if (directory.success) return { ok: true, kind: "directory", path, entries: directory.data };
  const file = fileSchema.safeParse(body);
  if (!file.success) {
    return { ok: false, code: "GITHUB_RESPONSE_INVALID", message: "Not a file or directory" };
  }
  // Files over 1 MB come back with encoding "none" and no content through this endpoint.
  const bytes =
    file.data.encoding === "base64" && typeof file.data.content === "string"
      ? Buffer.from(file.data.content.replace(/\s/g, ""), "base64")
      : null;
  return { ok: true, kind: "file", path: file.data.path, sha: file.data.sha, bytes };
}

const putSchema = z.object({
  content: z.object({ path: z.string(), sha: z.string() }).nullable(),
  commit: z.object({ sha: z.string(), html_url: z.string().optional() }),
});

export async function putContents(
  fetcher: typeof fetch,
  token: string,
  input: Readonly<{ repo: string; path: string; content: string; message: string; sha?: string }>,
  signal?: AbortSignal,
): Promise<
  { ok: true; path: string; contentSha: string | null; commitSha: string } | GithubFailure
> {
  const url = contentsUrl(input.repo, input.path);
  if (typeof url !== "string") return url;
  const response = await call(fetcher, url, {
    method: "PUT",
    token,
    signal: signal ?? null,
    body: JSON.stringify({
      message: input.message,
      content: Buffer.from(input.content, "utf8").toString("base64"),
      ...(input.sha ? { sha: input.sha } : {}),
    }),
  });
  if (!(response instanceof Response)) return response;
  if (!response.ok) return failureFor(response.status);
  const parsed = putSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    return { ok: false, code: "GITHUB_RESPONSE_INVALID", message: "Unexpected reply from GitHub" };
  }
  return {
    ok: true,
    path: parsed.data.content?.path ?? input.path,
    contentSha: parsed.data.content?.sha ?? null,
    commitSha: parsed.data.commit.sha,
  };
}
