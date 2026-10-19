import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";

import { decryptCredential, encryptCredential, parseEncryptionKey } from "./provider-vault.js";

// Credentials for tool integrations (v1: GitHub only). Mirrors provider-vault.ts: a separate
// SQLite file, AES-256-GCM envelopes, and no read path that returns a credential to a client.

export type IntegrationKind = "github";
export type IntegrationStatus = "disconnected" | "connected";

const INTEGRATIONS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS integration_connections (
    integration TEXT PRIMARY KEY CHECK (integration IN ('github')),
    status TEXT NOT NULL CHECK (status IN ('connected')),
    encrypted_credential TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

// R4 additions (new tables only; integration_connections is unchanged).
// - lamp_endpoint: the owner's Ollama base URL for the lamp classifier, plus an optional bearer
//   token their tunnel or proxy enforces. Absent row = the default http://localhost:11434.
// - chatgpt_plan: the imported "Continue with ChatGPT" credential (access + refresh tokens and
//   their metadata, one AES-256-GCM envelope). `active` is the owner's choice to run work on the
//   plan; `limit_reached_at` records the last plan-usage-limit stop.
// - host_identity: this server's own ext_agent_host_id, created once, kept across imports.
const R4_SCHEMA = `
  CREATE TABLE IF NOT EXISTS lamp_endpoint (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    base_url TEXT NOT NULL,
    encrypted_token TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chatgpt_plan (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    status TEXT NOT NULL CHECK (status IN ('connected', 'needs_reauth')),
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    email TEXT,
    encrypted_credential TEXT NOT NULL,
    limit_reached_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS host_identity (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    host_id TEXT NOT NULL
  );
`;

export const DEFAULT_LAMP_BASE_URL = "http://localhost:11434";

export type PlanStatus = {
  status: "disconnected" | "connected" | "needs_reauth";
  active: boolean;
  email: string | null;
  limitReachedAt: string | null;
};

export function openIntegrationsVault(options: { dataDir: string; encryptionKey: string }) {
  const encryptionKey = parseEncryptionKey(options.encryptionKey);
  if (!isAbsolute(options.dataDir)) throw new Error("INTEGRATIONS_VAULT_DATA_DIR_MUST_BE_ABSOLUTE");
  const dataDir = resolve(options.dataDir);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const databasePath = join(dataDir, "integrations.sqlite");
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("secure_delete = ON");
  database.exec(INTEGRATIONS_SCHEMA);
  database.exec(R4_SCHEMA);
  if (process.platform !== "win32") chmodSync(databasePath, 0o700);
  database
    .prepare("INSERT OR IGNORE INTO host_identity (singleton_id, host_id) VALUES (1, ?)")
    .run(`urn:uuid:${randomUUID()}`);

  return {
    getStatus(integration: IntegrationKind): IntegrationStatus {
      const row = database
        .prepare("SELECT status FROM integration_connections WHERE integration = ?")
        .get(integration) as { status: "connected" } | undefined;
      return row?.status ?? "disconnected";
    },
    saveCredential(integration: IntegrationKind, credential: string): void {
      database
        .prepare(
          `
          INSERT INTO integration_connections(integration, status, encrypted_credential, updated_at)
          VALUES (?, 'connected', ?, ?)
          ON CONFLICT(integration) DO UPDATE SET
            status = 'connected',
            encrypted_credential = excluded.encrypted_credential,
            updated_at = excluded.updated_at
        `,
        )
        .run(integration, encryptCredential(credential, encryptionKey), new Date().toISOString());
    },
    /** Server-side only: tools receive this through their context, never a client. */
    getCredential(integration: IntegrationKind): string | null {
      const row = database
        .prepare("SELECT encrypted_credential FROM integration_connections WHERE integration = ?")
        .get(integration) as { encrypted_credential: string } | undefined;
      return row ? decryptCredential(row.encrypted_credential, encryptionKey) : null;
    },
    disconnect(integration: IntegrationKind): void {
      database
        .prepare("DELETE FROM integration_connections WHERE integration = ?")
        .run(integration);
    },

    // ---- R4: the lamp's Ollama endpoint ----
    /** Server-side only. `token` never reaches a client; GET routes report only whether one is set. */
    getLampEndpoint(): { baseUrl: string; token: string | null; configured: boolean } {
      const row = database
        .prepare("SELECT base_url, encrypted_token FROM lamp_endpoint WHERE singleton_id = 1")
        .get() as { base_url: string; encrypted_token: string | null } | undefined;
      if (!row) return { baseUrl: DEFAULT_LAMP_BASE_URL, token: null, configured: false };
      return {
        baseUrl: row.base_url,
        token: row.encrypted_token ? decryptCredential(row.encrypted_token, encryptionKey) : null,
        configured: true,
      };
    },
    saveLampEndpoint(baseUrl: string, token: string | null): void {
      database
        .prepare(
          `INSERT INTO lamp_endpoint (singleton_id, base_url, encrypted_token, updated_at)
           VALUES (1, ?, ?, ?)
           ON CONFLICT(singleton_id) DO UPDATE SET base_url = excluded.base_url,
             encrypted_token = excluded.encrypted_token, updated_at = excluded.updated_at`,
        )
        .run(
          baseUrl,
          token ? encryptCredential(token, encryptionKey) : null,
          new Date().toISOString(),
        );
    },
    clearLampEndpoint(): void {
      database.prepare("DELETE FROM lamp_endpoint WHERE singleton_id = 1").run();
    },

    // ---- R4: the ChatGPT plan credential ----
    getHostId(): string {
      return (
        database.prepare("SELECT host_id FROM host_identity WHERE singleton_id = 1").get() as {
          host_id: string;
        }
      ).host_id;
    },
    getPlanStatus(): PlanStatus {
      const row = database
        .prepare(
          "SELECT status, active, email, limit_reached_at FROM chatgpt_plan WHERE singleton_id = 1",
        )
        .get() as
        | {
            status: "connected" | "needs_reauth";
            active: number;
            email: string | null;
            limit_reached_at: string | null;
          }
        | undefined;
      if (!row) return { status: "disconnected", active: false, email: null, limitReachedAt: null };
      return {
        status: row.status,
        active: row.active === 1,
        email: row.email,
        limitReachedAt: row.limit_reached_at,
      };
    },
    /** Server-side only: the decrypted credential JSON. Never returned by any route. */
    getPlanCredential(): string | null {
      const row = database
        .prepare("SELECT encrypted_credential FROM chatgpt_plan WHERE singleton_id = 1")
        .get() as { encrypted_credential: string } | undefined;
      return row ? decryptCredential(row.encrypted_credential, encryptionKey) : null;
    },
    /** Import (or replace) the credential. A new import is connected, active, and limit-free. */
    savePlanCredential(credentialJson: string, email: string | null): void {
      database
        .prepare(
          `INSERT INTO chatgpt_plan
             (singleton_id, status, active, email, encrypted_credential, limit_reached_at, updated_at)
           VALUES (1, 'connected', 1, ?, ?, NULL, ?)
           ON CONFLICT(singleton_id) DO UPDATE SET status = 'connected', active = 1,
             email = excluded.email, encrypted_credential = excluded.encrypted_credential,
             limit_reached_at = NULL, updated_at = excluded.updated_at`,
        )
        .run(email, encryptCredential(credentialJson, encryptionKey), new Date().toISOString());
    },
    /** After a refresh: replace the token set together, keeping status and the owner's choices. */
    replacePlanCredential(credentialJson: string): void {
      database
        .prepare(
          "UPDATE chatgpt_plan SET encrypted_credential = ?, updated_at = ? WHERE singleton_id = 1",
        )
        .run(encryptCredential(credentialJson, encryptionKey), new Date().toISOString());
    },
    setPlanActive(active: boolean): boolean {
      return (
        database
          .prepare("UPDATE chatgpt_plan SET active = ?, updated_at = ? WHERE singleton_id = 1")
          .run(active ? 1 : 0, new Date().toISOString()).changes === 1
      );
    },
    markPlanNeedsReauth(): void {
      database
        .prepare(
          "UPDATE chatgpt_plan SET status = 'needs_reauth', updated_at = ? WHERE singleton_id = 1",
        )
        .run(new Date().toISOString());
    },
    recordPlanLimit(now: string): void {
      database
        .prepare("UPDATE chatgpt_plan SET limit_reached_at = ? WHERE singleton_id = 1")
        .run(now);
    },
    clearPlanLimit(): void {
      database
        .prepare("UPDATE chatgpt_plan SET limit_reached_at = NULL WHERE singleton_id = 1")
        .run();
    },
    disconnectPlan(): void {
      database.prepare("DELETE FROM chatgpt_plan WHERE singleton_id = 1").run();
    },
    close(): void {
      encryptionKey.fill(0);
      database.close();
    },
  };
}

export type IntegrationsVault = ReturnType<typeof openIntegrationsVault>;
