import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  SIWC_AGENT_NAME,
  SIWC_AUTHORIZE_URL,
  SIWC_DYNAMIC_CLIENT,
  SIWC_PLAN_SCOPE,
  SIWC_RESOURCE,
  SIWC_SCOPES,
  encodeCredentialBundle,
  exchangeCode,
  verifyIdToken,
  type PlanCredential,
} from "./chatgpt-plan.js";

// `npm run siwc:login` — R4 Track D #9 (amended 2026-10-19). Runs "Continue with ChatGPT" on the
// OWNER's machine, because OpenAI requires the OAuth callback at http://127.0.0.1:<port>/auth/callback
// and that cannot reach a hosted server. OpenID Connect + PKCE, open-source flow, no client secret.
// Output: one credential bundle, written to an owner-only file, for the hosted connect UI's import
// step. The hosted server owns every later refresh (OpenAI's self-hosted-VM guidance), so no tokens
// are kept here; only the registration (issued client_id, account) and this machine's host id.

export const CALLBACK_PATH = "/auth/callback";
export const DEFAULT_CALLBACK_PORT = 1455;
const CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

type Registration = { client_id: string; subject: string; email: string | null };
type LocalState = { host_id: string; registration?: Registration };

export type SiwcLoginDeps = {
  fetcher: typeof fetch;
  stateDir: string;
  openBrowser: (url: string) => void;
  log: (line: string) => void;
  port?: number;
  nowMs?: () => number;
  timeoutMs?: number;
};

const base64url = (bytes: Buffer) => bytes.toString("base64url");

function readState(stateDir: string): LocalState {
  const path = join(stateDir, "siwc.json");
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as LocalState;
    if (typeof parsed.host_id === "string" && parsed.host_id) return parsed;
  }
  // The host id is chosen and persisted before the first sign-in (OpenAI), as a urn:uuid.
  const state: LocalState = { host_id: `urn:uuid:${randomUUID()}` };
  writeOwnerOnly(stateDir, "siwc.json", JSON.stringify(state, null, 2));
  return state;
}

function writeOwnerOnly(dir: string, name: string, text: string): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, name);
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") chmodSync(path, 0o600);
  return path;
}

async function listen(port: number): Promise<{ server: Server; port: number }> {
  const server = createServer();
  const bound = await new Promise<number>((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolvePort(typeof address === "object" && address ? address.port : port);
    });
  });
  return { server, port: bound };
}

/** Runs one sign-in attempt and returns the credential (also written as a bundle file). */
export async function runSiwcLogin(deps: SiwcLoginDeps): Promise<{
  credential: PlanCredential;
  bundlePath: string;
}> {
  const nowMs = deps.nowMs ?? (() => Date.now());
  const local = readState(deps.stateDir);
  const saved = local.registration;

  // Start the listener before opening the browser; only the port may vary (never "localhost").
  let listening: { server: Server; port: number };
  try {
    listening = await listen(deps.port ?? DEFAULT_CALLBACK_PORT);
  } catch {
    listening = await listen(0);
  }
  const redirectUri = `http://127.0.0.1:${listening.port}${CALLBACK_PATH}`;

  // Fresh state, nonce and PKCE for every attempt.
  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(48));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const clientId = saved?.client_id ?? SIWC_DYNAMIC_CLIENT;

  const params = new URLSearchParams({
    client_id: clientId,
    ...(saved ? {} : { agent_name_hint: SIWC_AGENT_NAME }),
    ext_agent_host_id: local.host_id,
    ...(saved?.email ? { login_hint: saved.email } : {}),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SIWC_SCOPES.join(" "),
    resource: SIWC_RESOURCE,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  // No id_token_hint is sent, so this URL carries no token and is safe to show.
  const authorizeUrl = `${SIWC_AUTHORIZE_URL}?${params.toString()}`;

  const callback = new Promise<URLSearchParams>((resolveCallback, reject) => {
    const timer = setTimeout(
      () => reject(new Error("SIWC_LOGIN_TIMED_OUT")),
      deps.timeoutMs ?? CALLBACK_TIMEOUT_MS,
    );
    timer.unref();
    listening.server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", redirectUri);
      if (url.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end(
          "<!doctype html><title>Your Move</title><p>Sign-in finished. You can close this tab and return to the terminal.</p>",
        );
      clearTimeout(timer);
      resolveCallback(url.searchParams);
    });
  });

  deps.log("Continue with ChatGPT: opening your browser to sign in.");
  deps.log(`If it does not open, visit:\n${authorizeUrl}`);
  deps.openBrowser(authorizeUrl);

  let result: URLSearchParams;
  try {
    result = await callback;
  } finally {
    listening.server.close();
  }

  if (result.get("state") !== state) throw new Error("SIWC_STATE_MISMATCH");
  const error = result.get("error");
  if (error === "access_denied") throw new Error("SIWC_ACCESS_DENIED");
  if (error) throw new Error(`SIWC_AUTHORIZATION_FAILED:${error.slice(0, 64)}`);
  const code = result.get("code");
  if (!code) throw new Error("SIWC_CODE_MISSING");

  // New registration: the callback carries the issued client_id. Reauthorization: it may omit it,
  // and a different one is rejected rather than replacing the saved registration.
  const returnedClientId = result.get("client_id");
  let issuedClientId: string;
  if (saved) {
    if (returnedClientId && returnedClientId !== saved.client_id) {
      throw new Error("SIWC_CLIENT_MISMATCH");
    }
    issuedClientId = saved.client_id;
  } else {
    if (!returnedClientId || returnedClientId === SIWC_DYNAMIC_CLIENT) {
      throw new Error("SIWC_REGISTRATION_INCOMPLETE");
    }
    issuedClientId = returnedClientId;
  }

  const tokens = await exchangeCode({
    fetcher: deps.fetcher,
    clientId: issuedClientId,
    code,
    codeVerifier,
    redirectUri,
  });
  if (!tokens.id_token) throw new Error("SIWC_ID_TOKEN_MISSING");
  const claims = await verifyIdToken(tokens.id_token, {
    fetcher: deps.fetcher,
    clientId: issuedClientId,
    nowMs: nowMs(),
    nonce,
  });
  if (saved && saved.subject !== claims.sub) throw new Error("SIWC_ACCOUNT_MISMATCH");

  const scopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  if (!scopes.includes(SIWC_PLAN_SCOPE)) {
    // OpenAI: a valid sign-in without plan permission must not proceed to inference.
    throw new Error("SIWC_PLAN_USAGE_NOT_ENABLED");
  }

  const credential: PlanCredential = {
    format: "your-move-siwc-credential/1",
    issuer: "https://auth.openai.com",
    subject: claims.sub,
    email: claims.email,
    client_id: issuedClientId,
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type ?? "Bearer",
    expires_at: nowMs() + tokens.expires_in * 1000,
    scopes,
    saved_at: new Date(nowMs()).toISOString(),
  };

  writeOwnerOnly(
    deps.stateDir,
    "siwc.json",
    JSON.stringify(
      {
        host_id: local.host_id,
        registration: { client_id: issuedClientId, subject: claims.sub, email: claims.email },
      } satisfies LocalState,
      null,
      2,
    ),
  );
  const bundlePath = writeOwnerOnly(
    deps.stateDir,
    "credential-bundle.txt",
    `${encodeCredentialBundle(credential)}\n`,
  );
  return { credential, bundlePath };
}

function openWithSystemBrowser(url: string): void {
  const [command, args] =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(command, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // The URL is printed as well.
  }
}

const MESSAGES: Record<string, string> = {
  SIWC_ACCESS_DENIED: "Sign-in was declined, so nothing was saved.",
  SIWC_PLAN_USAGE_NOT_ENABLED:
    "You signed in, but ChatGPT plan use was not allowed. Run this again and allow it, or keep using your API key.",
  SIWC_LOGIN_TIMED_OUT: "No sign-in arrived within 10 minutes. Run the command again.",
};

async function main(): Promise<void> {
  const stateDir = resolve(
    process.env.YOUR_MOVE_SIWC_DIR ?? join(homedir(), ".config", "your-move"),
  );
  try {
    const { credential, bundlePath } = await runSiwcLogin({
      fetcher: globalThis.fetch,
      stateDir,
      openBrowser: openWithSystemBrowser,
      log: (line) => console.info(line),
    });
    console.info("");
    console.info(
      `Signed in${credential.email ? ` as ${credential.email}` : ""}. ChatGPT plan use is allowed.`,
    );
    console.info(`Your credential is in ${bundlePath} (readable only by you).`);
    console.info(
      'Open Your Move, go to Connections → "Continue with ChatGPT", paste the file\'s one line into Import, then delete the file.',
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "SIWC_LOGIN_FAILED";
    console.error(MESSAGES[code] ?? `Sign-in failed (${code}).`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
