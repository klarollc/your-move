import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";

const CODEX_ARGS = ["app-server", "--stdio", "--strict-config"] as const;

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
  readonly #maxLineBytes: number;
  readonly #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  readonly #notifications: JsonRecord[] = [];
  readonly #notificationWaiters = new Map<string, ((value: JsonRecord) => void)[]>();
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
  }) {
    this.#executable = options.executable;
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
    this.#child = this.#spawnProcess(this.#executable, CODEX_ARGS, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
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
    if (!child || child.exitCode !== null || child.killed) return;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill();
      setTimeout(resolve, 250);
    });
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
        for (const resolve of waiters) resolve(message);
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
