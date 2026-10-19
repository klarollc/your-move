import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openProviderVault } from "./provider-vault.js";

const directories: string[] = [];
const vaults: Array<ReturnType<typeof openProviderVault>> = [];
const encryptionKey = Buffer.alloc(32, 7).toString("base64");

function openVault(dataDir: string) {
  const vault = openProviderVault({ dataDir, encryptionKey });
  vaults.push(vault);
  return vault;
}

function createVault() {
  const scratchRoot = process.env.TMPDIR ?? tmpdir();
  const dataDir = mkdtempSync(join(scratchRoot, "cuckcode-r1-provider-vault-"));
  directories.push(dataDir);
  return openVault(dataDir);
}

function closeVault(vault: ReturnType<typeof openProviderVault>): void {
  vault.close();
  const index = vaults.indexOf(vault);
  if (index >= 0) vaults.splice(index, 1);
}

afterEach(() => {
  for (const vault of vaults.splice(0)) vault.close();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("hosted provider vault", () => {
  it("starts with both supported providers disconnected and model choice automatic", () => {
    const vault = createVault();

    expect(vault.getProviderStatus("openai")).toBe("disconnected");
    expect(vault.getProviderStatus("anthropic")).toBe("disconnected");
    expect(vault.getModelSelection()).toEqual({ mode: "automatic" });

    closeVault(vault);
  });

  it("encrypts provider credentials before persisting and only decrypts them for server use", () => {
    const vault = createVault();
    const credential = "sk-r1-test-not-a-real-provider-secret";

    vault.saveCredential("openai", credential);

    expect(vault.getProviderStatus("openai")).toBe("connected");
    expect(vault.getCredential("openai")).toBe(credential);
    closeVault(vault);

    const databaseBytes = readFileSync(join(directories[0]!, "provider-vault.sqlite"));
    expect(databaseBytes.includes(Buffer.from(credential))).toBe(false);
  });

  it("retains a rejected credential and model choice until a validated reconnect replaces it", () => {
    const vault = createVault();
    const dataDir = directories[0]!;
    const credential = "sk-ant-r1-invalid-test-value";
    const replacement = "sk-ant-r1-mocked-valid-value";
    const selection = {
      mode: "specific" as const,
      provider: "anthropic" as const,
      modelId: "claude-test",
    };

    vault.saveCredential("anthropic", credential);
    vault.setModelSelection(selection);
    vault.markNeedsReauth("anthropic");

    expect(vault.getProviderStatus("anthropic")).toBe("needs_reauth");
    expect(vault.getCredential("anthropic")).toBe(credential);
    expect(vault.getModelSelection()).toEqual(selection);
    closeVault(vault);

    const reopened = openVault(dataDir);
    expect(reopened.getProviderStatus("anthropic")).toBe("needs_reauth");
    reopened.saveCredential("anthropic", replacement);
    expect(reopened.getProviderStatus("anthropic")).toBe("connected");
    expect(reopened.getCredential("anthropic")).toBe(replacement);
    expect(reopened.getModelSelection()).toEqual(selection);
  });

  it("disconnects immediately while preserving the model preference", () => {
    const vault = createVault();
    const selection = {
      mode: "specific" as const,
      provider: "openai" as const,
      modelId: "gpt-test",
    };
    vault.saveCredential("openai", "sk-r1-disconnect-test");
    vault.setModelSelection(selection);

    vault.disconnect("openai");

    expect(vault.getProviderStatus("openai")).toBe("disconnected");
    expect(vault.getCredential("openai")).toBeNull();
    expect(vault.getModelSelection()).toEqual(selection);
  });
});
