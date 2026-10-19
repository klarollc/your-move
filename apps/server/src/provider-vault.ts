import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";

export type ProviderKind = "openai" | "anthropic";
export type ProviderConnectionStatus = "disconnected" | "connected" | "needs_reauth";
export type ModelSelection =
  { mode: "automatic" } | { mode: "specific"; provider: ProviderKind; modelId: string };

type ProviderVaultOptions = {
  dataDir: string;
  encryptionKey: string;
};

const PROVIDER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS provider_connections (
    provider TEXT PRIMARY KEY CHECK (provider IN ('openai', 'anthropic')),
    status TEXT NOT NULL CHECK (status IN ('connected', 'needs_reauth')),
    encrypted_credential TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS model_selection (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    mode TEXT NOT NULL CHECK (mode IN ('automatic', 'specific')),
    provider TEXT CHECK (provider IS NULL OR provider IN ('openai', 'anthropic')),
    model_id TEXT,
    updated_at TEXT NOT NULL,
    CHECK (
      (mode = 'automatic' AND provider IS NULL AND model_id IS NULL) OR
      (mode = 'specific' AND provider IS NOT NULL AND model_id IS NOT NULL)
    )
  );
  CREATE TABLE IF NOT EXISTS owner_session_state (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    version INTEGER NOT NULL CHECK (version >= 0)
  );
  INSERT OR IGNORE INTO owner_session_state(singleton_id, version) VALUES (1, 0);
  CREATE TABLE IF NOT EXISTS owner_login_rate_limit (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    failure_count INTEGER NOT NULL CHECK (failure_count >= 0),
    window_reset_at INTEGER NOT NULL CHECK (window_reset_at >= 0)
  );
  INSERT OR IGNORE INTO owner_login_rate_limit(singleton_id, failure_count, window_reset_at)
    VALUES (1, 0, 0);
`;

function encryptCredential(credential: string, key: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(credential, "utf8"), cipher.final()]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function decryptCredential(envelope: string, key: Buffer): string {
  try {
    const [version, nonce, authTag, ciphertext] = envelope.split(":");
    if (version !== "v1" || !nonce || !authTag || !ciphertext) throw new Error("INVALID_ENVELOPE");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("PROVIDER_CREDENTIAL_DECRYPTION_FAILED");
  }
}

function parseEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("PROVIDER_VAULT_ENCRYPTION_KEY_INVALID");
  }
  return key;
}

function setPrivatePermissions(path: string): void {
  if (process.platform !== "win32") chmodSync(path, 0o700);
}

export function openProviderVault(options: ProviderVaultOptions) {
  const encryptionKey = parseEncryptionKey(options.encryptionKey);
  if (!isAbsolute(options.dataDir)) throw new Error("PROVIDER_VAULT_DATA_DIR_MUST_BE_ABSOLUTE");

  const dataDir = resolve(options.dataDir);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  setPrivatePermissions(dataDir);

  const databasePath = join(dataDir, "provider-vault.sqlite");
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("secure_delete = ON");
  database.exec(PROVIDER_SCHEMA);
  setPrivatePermissions(databasePath);

  return {
    getProviderStatus(provider: ProviderKind): ProviderConnectionStatus {
      const row = database
        .prepare("SELECT status FROM provider_connections WHERE provider = ?")
        .get(provider) as { status: ProviderConnectionStatus } | undefined;
      return row?.status ?? "disconnected";
    },
    getSessionVersion(): number {
      const row = database
        .prepare("SELECT version FROM owner_session_state WHERE singleton_id = 1")
        .get() as { version: number };
      return row.version;
    },
    recordLoginFailureIfAllowed(now: number, windowMs: number, maxFailures: number): boolean {
      const record = database.transaction(() => {
        const row = database
          .prepare(
            "SELECT failure_count, window_reset_at FROM owner_login_rate_limit WHERE singleton_id = 1",
          )
          .get() as { failure_count: number; window_reset_at: number };
        let failureCount = row.failure_count;
        let windowResetAt = row.window_reset_at;
        if (windowResetAt <= now) {
          failureCount = 0;
          windowResetAt = 0;
        }
        if (failureCount >= maxFailures) return false;
        if (failureCount === 0) windowResetAt = now + windowMs;
        database
          .prepare(
            "UPDATE owner_login_rate_limit SET failure_count = ?, window_reset_at = ? WHERE singleton_id = 1",
          )
          .run(failureCount + 1, windowResetAt);
        return true;
      });
      return record();
    },
    resetLoginFailures(): void {
      database
        .prepare(
          "UPDATE owner_login_rate_limit SET failure_count = 0, window_reset_at = 0 WHERE singleton_id = 1",
        )
        .run();
    },
    revokeSessions(): void {
      database
        .prepare("UPDATE owner_session_state SET version = version + 1 WHERE singleton_id = 1")
        .run();
    },
    saveCredential(provider: ProviderKind, credential: string): void {
      const encryptedCredential = encryptCredential(credential, encryptionKey);
      database
        .prepare(
          `
          INSERT INTO provider_connections(provider, status, encrypted_credential, updated_at)
          VALUES (?, 'connected', ?, ?)
          ON CONFLICT(provider) DO UPDATE SET
            status = 'connected',
            encrypted_credential = excluded.encrypted_credential,
            updated_at = excluded.updated_at
        `,
        )
        .run(provider, encryptedCredential, new Date().toISOString());
    },
    getCredential(provider: ProviderKind): string | null {
      const row = database
        .prepare("SELECT encrypted_credential FROM provider_connections WHERE provider = ?")
        .get(provider) as { encrypted_credential: string } | undefined;
      return row ? decryptCredential(row.encrypted_credential, encryptionKey) : null;
    },
    markNeedsReauth(provider: ProviderKind): void {
      database
        .prepare(
          "UPDATE provider_connections SET status = 'needs_reauth', updated_at = ? WHERE provider = ?",
        )
        .run(new Date().toISOString(), provider);
    },
    disconnect(provider: ProviderKind): void {
      database.prepare("DELETE FROM provider_connections WHERE provider = ?").run(provider);
    },
    setModelSelection(selection: ModelSelection): void {
      if (
        selection.mode === "specific" &&
        (!selection.modelId.trim() || selection.modelId.length > 128)
      ) {
        throw new Error("MODEL_SELECTION_INVALID");
      }
      const values =
        selection.mode === "automatic"
          ? ["automatic", null, null]
          : ["specific", selection.provider, selection.modelId];
      database
        .prepare(
          `
          INSERT INTO model_selection(singleton_id, mode, provider, model_id, updated_at)
          VALUES (1, ?, ?, ?, ?)
          ON CONFLICT(singleton_id) DO UPDATE SET
            mode = excluded.mode,
            provider = excluded.provider,
            model_id = excluded.model_id,
            updated_at = excluded.updated_at
        `,
        )
        .run(...values, new Date().toISOString());
    },
    getModelSelection(): ModelSelection {
      const row = database
        .prepare("SELECT mode, provider, model_id FROM model_selection WHERE singleton_id = 1")
        .get() as
        { mode: string; provider: ProviderKind | null; model_id: string | null } | undefined;
      if (!row || row.mode === "automatic") return { mode: "automatic" };
      return { mode: "specific", provider: row.provider!, modelId: row.model_id! };
    },
    close(): void {
      encryptionKey.fill(0);
      database.close();
    },
  };
}
