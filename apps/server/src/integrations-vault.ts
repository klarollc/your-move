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
  if (process.platform !== "win32") chmodSync(databasePath, 0o700);

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
    close(): void {
      encryptionKey.fill(0);
      database.close();
    },
  };
}

export type IntegrationsVault = ReturnType<typeof openIntegrationsVault>;
