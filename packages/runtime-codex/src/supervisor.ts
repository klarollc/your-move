import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";

// Exported so the kickoff policy asserts against the values the supervisor actually uses rather
// than a copy of them. A second declaration is how an allow-list and its guard drift apart.
export const CODEX_ARGS = ["app-server", "--stdio", "--strict-config"] as const;
export const ALLOWED_REQUEST_METHODS: ReadonlySet<string> = new Set([
  "account/read",
  "thread/start",
  "turn/start",
  "turn/interrupt",
  "thread/read",
]);

type SpawnOptions = SpawnOptionsWithoutStdio & {
  shell: false;
  stdio: ["pipe", "pipe", "pipe"];
  windowsHide: true;
};

export type SpawnRuntimeProcess = (
  executable: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcessWithoutNullStreams;

type JsonRecord = Record<string, unknown>;

export class CodexStdioSupervisor {
  readonly #executable: string;
  readonly #spawnProcess: SpawnRuntimeProcess;
  readonly #handshakeTimeoutMs: number;
  readonly #codexHome: string | undefined;
  readonly #maxLineBytes: number;
  readonly #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  readonly #notifications: JsonRecord[] = [];
  readonly #notificationWaiters = new Map<string, ((value: JsonRecord) => boolean | void)[]>();
  /** Notifications already handed to a waiter, so a later wait cannot pick the same one up. */
  readonly #consumedNotifications = new WeakSet<JsonRecord>();
  #child: ChildProcessWithoutNullStreams | undefined;
  #stdoutBuffer = "";
  #requestId = 0;
  #ready = false;
  readonly stderr: string[] = [];

  constructor(options: {
    executable: string;
    spawnProcess?: SpawnRuntimeProcess;
    handshakeTimeoutMs?: number;
    maxLineBytes?: number;
    /**
     * The instruction environment this session runs in. Proved honoured by the Task 17c-1b probe:
     * setting it replaces the default instruction sources entirely, which is what lets a role run
     * under exactly its own contract rather than under whatever the machine's Codex home holds.
     */
    codexHome?: string;
  }) {
    this.#executable = options.executable;
    this.#codexHome = options.codexHome;
    this.#spawnProcess = options.spawnProcess ?? defaultSpawn;
    this.#handshakeTimeoutMs = options.handshakeTimeoutMs ?? 5_000;
    this.#maxLineBytes = options.maxLineBytes ?? 1_048_576;
  }

  async start(): Promise<{
    codexHome: string;
    platformFamily: string;
    platformOs: string;
    userAgent: string;
  }> {
    if (this.#child) throw new Error("PROCESS_ALREADY_STARTED");
    // Unconfigured, no env is passed at all, so the child inherits this process's environment.
    // That is deliberate: copying the environment here would create a second version of it that
    // could drift from the real one.
    const environment =
      this.#codexHome === undefined ? {} : { env: { ...process.env, CODEX_HOME: this.#codexHome } };

    this.#child = this.#spawnProcess(this.#executable, CODEX_ARGS, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      ...environment,
    });
    this.#child.stdout.setEncoding("utf8");
    this.#child.stderr.setEncoding("utf8");
    this.#child.stdout.on("data", (chunk: string) => this.#acceptStdout(chunk));
    this.#child.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/u).filter(Boolean)) this.stderr.push(redact(line));
    });
    this.#child.on("exit", () => this.#failPending(new Error("PROCESS_EXITED")));
    this.#child.on("error", (error) => this.#failPending(error));

    const result = await this.#request(
      "initialize",
      { clientInfo: { name: "CuckCode", title: "CuckCode", version: "0.0.0" } },
      this.#handshakeTimeoutMs,
      "HANDSHAKE_TIMEOUT",
    );
    if (!isInitializeResult(result)) {
      await this.stop();
      throw new Error("PROTOCOL_SCHEMA_MISMATCH");
    }
    this.#write({ method: "initialized" });
    this.#ready = true;
    return result;
  }

  async request(method: string, params: JsonRecord, timeoutMs = 30_000): Promise<unknown> {
    this.#assertReady();
    if (!ALLOWED_REQUEST_METHODS.has(method)) throw new Error("METHOD_NOT_ALLOWED");
    return await this.#request(method, params, timeoutMs);
  }
  async readAccountStatus(): Promise<
    { ok: true; mode: "chatgpt" | "api_key_managed" } | { ok: false; code: "AUTH_REQUIRED" }
  > {
    this.#assertReady();
    const result = await this.#request("account/read", { refreshToken: false });
    if (!isRecord(result) || result.account === null || result.account === undefined)
      return { ok: false, code: "AUTH_REQUIRED" };
    const account = result.account;
    if (isRecord(account) && account.type === "chatgpt") return { ok: true, mode: "chatgpt" };
    return { ok: true, mode: "api_key_managed" };
  }

  /**
   * Waits for the completion of one specific turn.
   *
   * `waitForNotification` returns the first cached notification of a method and never consumes it,
   * which is correct for a single-turn session and silently wrong for a thread that takes several.
   * A thirteen-turn kickoff would have replayed turn one twelve times and reported success — a run
   * that is green and means nothing. Matching on the turn id makes each wait pick out its own turn,
   * and consuming it means a later wait cannot pick it up again.
   */
  async waitForTurnCompleted(turnId: string, timeoutMs = 90_000): Promise<JsonRecord> {
    const matches = (notification: JsonRecord): boolean => {
      if (notification.method !== "turn/completed") return false;
      const params = notification.params;
      if (!isRecord(params)) return false;
      const turn = params.turn;
      return isRecord(turn) && turn.id === turnId;
    };

    const existing = this.#notifications.find(
      (notification) => matches(notification) && !this.#consumedNotifications.has(notification),
    );
    if (existing) {
      this.#consumedNotifications.add(existing);
      return existing;
    }

    return await new Promise<JsonRecord>((resolve, reject) => {
      const waiters = this.#notificationWaiters.get("turn/completed") ?? [];
      const timer = setTimeout(() => reject(new Error("NOTIFICATION_TIMEOUT")), timeoutMs);
      waiters.push((value) => {
        if (!matches(value) || this.#consumedNotifications.has(value)) return false;
        clearTimeout(timer);
        this.#consumedNotifications.add(value);
        resolve(value);
        return true;
      });
      this.#notificationWaiters.set("turn/completed", waiters);
    });
  }

  async waitForNotification(method: string, timeoutMs = 1_000): Promise<JsonRecord> {
    const existing = this.#notifications.find((notification) => notification.method === method);
    if (existing) return existing;
    return await new Promise<JsonRecord>((resolve, reject) => {
      const waiters = this.#notificationWaiters.get(method) ?? [];
      const timer = setTimeout(() => reject(new Error("NOTIFICATION_TIMEOUT")), timeoutMs);
      waiters.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
      this.#notificationWaiters.set(method, waiters);
    });
  }

  async stop(): Promise<void> {
    const child = this.#child;
    this.#child = undefined;
    this.#ready = false;
    if (!child || child.exitCode !== null) return;
    child.stdin.end();
    if (!(await waitForExit(child, 2_000)) && child.exitCode === null) {
      child.kill();
      if (!(await waitForExit(child, 2_000)) && child.exitCode === null) {
        child.kill("SIGKILL");
        await waitForExit(child, 2_000);
      }
    }
  }

  #request(method: string, params: JsonRecord, timeoutMs = 5_000, timeoutCode = "REQUEST_TIMEOUT") {
    const id = ++this.#requestId;
    const response = new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#write({ id, method, params });
    });
    return withTimeout(response, timeoutMs, timeoutCode, () => {
      this.#pending.delete(id);
      this.#child?.kill();
    });
  }

  #write(message: JsonRecord): void {
    if (!this.#child?.stdin.writable) throw new Error("PROCESS_NOT_WRITABLE");
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #acceptStdout(chunk: string): void {
    this.#stdoutBuffer += chunk;
    const lines = this.#stdoutBuffer.split("\n");
    this.#stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (Buffer.byteLength(line, "utf8") > this.#maxLineBytes) {
        this.#failPending(new Error("LINE_TOO_LARGE"));
        this.#child?.kill();
        return;
      }
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        this.#failPending(new Error("MALFORMED_JSON"));
        this.#child?.kill();
        return;
      }
      if (!isRecord(message)) continue;
      if (typeof message.id === "number") {
        const pending = this.#pending.get(message.id);
        if (!pending) continue;
        this.#pending.delete(message.id);
        if ("error" in message) pending.reject(new Error("PROVIDER_REQUEST_FAILED"));
        else pending.resolve(message.result);
      } else if (typeof message.method === "string") {
        this.#notifications.push(message);
        const waiters = this.#notificationWaiters.get(message.method) ?? [];
        this.#notificationWaiters.delete(message.method);
        // A waiter that declines this notification stays queued. Dropping it would leave a
        // turn-scoped wait pending forever against a notification meant for a different turn.
        const undelivered = waiters.filter((resolve) => resolve(message) === false);
        if (undelivered.length > 0) this.#notificationWaiters.set(message.method, undelivered);
      }
    }
  }

  #failPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error("HANDSHAKE_REQUIRED");
  }
}

function defaultSpawn(executable: string, args: readonly string[], options: SpawnOptions) {
  return spawn(executable, [...args], options);
}

async function waitForExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: string,
  onTimeout: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error(code));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("RUNTIME_FAILURE"));
      },
    );
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInitializeResult(value: unknown): value is {
  codexHome: string;
  platformFamily: string;
  platformOs: string;
  userAgent: string;
} {
  return (
    isRecord(value) &&
    typeof value.codexHome === "string" &&
    typeof value.platformFamily === "string" &&
    typeof value.platformOs === "string" &&
    typeof value.userAgent === "string" &&
    /0\.146\.0/u.test(value.userAgent)
  );
}

function redact(value: string): string {
  return value.replace(/(authorization\s*:\s*bearer)\s+\S+/giu, "$1 [REDACTED]");
}
