import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createHostedApp, type HostedApp } from "./hosted-app.js";

const origin = "https://your-move.example.test";
const signingKey = Buffer.alloc(32, 3).toString("base64");
const encryptionKey = Buffer.alloc(32, 4).toString("base64");
const roots: string[] = [];
const apps: HostedApp[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "cuckcode-r1-static-"));
  roots.push(root);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>Hosted UI</title>");
  writeFileSync(join(root, "hosted.html"), "<!doctype html><title>Provider Setup</title>");
  writeFileSync(join(root, "assets", "app.js"), "globalThis.hostedUiReady = true;");
  writeFileSync(join(root, "secret.txt"), "must-not-be-served");
  return root;
}

function makeApp(staticRoot: string, staticEntryFile?: string): HostedApp {
  const app = createHostedApp({
    mode: "test",
    appOrigin: origin,
    accessPassword: "hosted-static-tests-only-password",
    sessionSigningKey: signingKey,
    credentialEncryptionKey: encryptionKey,
    dataDir: resolve(join(staticRoot, "data")),
    staticRoot,
    ...(staticEntryFile ? { staticEntryFile } : {}),
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("hosted static app boundary", () => {
  it("serves the built app shell and assets with safe content and cache headers", async () => {
    const root = makeRoot();
    const app = makeApp(root);

    const document = await app.inject({ method: "GET", url: "/" });
    expect(document.statusCode).toBe(200);
    expect(document.headers["content-type"]).toContain("text/html");
    expect(document.headers["cache-control"]).toContain("no-cache");
    expect(document.body).toContain("Hosted UI");

    const asset = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers["content-type"]).toContain("javascript");
    expect(asset.headers["x-content-type-options"]).toBe("nosniff");
    expect(asset.headers["cache-control"]).toContain("immutable");
    expect(asset.body).toContain("hostedUiReady");
  });

  it("serves a configured hosted entry without changing the default local entry", async () => {
    const root = makeRoot();
    const hostedApp = makeApp(root, "hosted.html");
    const hostedDocument = await hostedApp.inject({ method: "GET", url: "/" });
    expect(hostedDocument.statusCode).toBe(200);
    expect(hostedDocument.body).toContain("Provider Setup");
    expect(hostedDocument.body).not.toContain("Hosted UI");
  });

  it("does not expose files outside the static root through encoded traversal", async () => {
    const root = makeRoot();
    const app = makeApp(root);

    const response = await app.inject({ method: "GET", url: "/assets/%2e%2e/secret.txt" });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("must-not-be-served");
  });
});
