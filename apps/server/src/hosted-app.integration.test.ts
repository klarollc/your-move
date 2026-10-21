import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHostedApp, type HostedApp } from "./hosted-app.js";

const origin = "https://your-move.example.test";
const accessPassword = "r1-owner-password-for-tests-only";
const sessionSigningKey = Buffer.alloc(32, 9).toString("base64");
const credentialEncryptionKey = Buffer.alloc(32, 7).toString("base64");
const directories: string[] = [];
const apps: HostedApp[] = [];

function createApp(existingDataDir?: string): HostedApp {
  const dataDir =
    existingDataDir ??
    mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "your-move-r1-hosted-app-"));
  directories.push(dataDir);
  const app = createHostedApp({
    mode: "test",
    appOrigin: origin,
    accessPassword,
    sessionSigningKey,
    credentialEncryptionKey,
    dataDir,
    providerFetch: vi.fn<typeof fetch>(async () => new Response("{}")),
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("hosted owner session boundary", () => {
  it("requires one owner session before exposing provider state", async () => {
    const app = createApp();

    const anonymous = await app.inject({ method: "GET", url: "/api/providers" });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ code: "OWNER_SESSION_REQUIRED" });

    const login = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { origin },
      payload: { password: accessPassword },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({ authenticated: true });
    expect(JSON.stringify(login.json())).not.toContain(accessPassword);
    expect(login.headers["set-cookie"]).toContain("HttpOnly");
    expect(login.headers["set-cookie"]).toContain("SameSite=Strict");

    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const providers = await app.inject({
      method: "GET",
      url: "/api/providers",
      headers: { cookie },
    });
    expect(providers.statusCode).toBe(200);
    expect(providers.json()).toEqual({
      providers: [
        { id: "openai", status: "disconnected" },
        { id: "anthropic", status: "disconnected" },
      ],
      modelSelection: { mode: "automatic" },
    });
  });

  it("rejects wrong-password and cross-origin login attempts without issuing a session", async () => {
    const app = createApp();

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { origin },
      payload: { password: "incorrect-password" },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
    expect(wrongPassword.json()).toEqual({ code: "LOGIN_REJECTED" });

    const crossOrigin = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { origin: "https://attacker.example.test" },
      payload: { password: accessPassword },
    });
    expect(crossOrigin.statusCode).toBe(403);
    expect(crossOrigin.json()).toEqual({ code: "ORIGIN_REJECTED" });
  });

  it("limits invalid logins across distinct client addresses", async () => {
    const app = createApp();
    const dataDir = directories.at(-1)!;
    const attemptLogin = (ip: string, password: string) =>
      app.inject({
        method: "POST",
        url: "/api/session",
        headers: { origin, "x-real-ip": ip },
        payload: { password },
      });

    for (let index = 1; index <= 32; index += 1) {
      expect((await attemptLogin(`203.0.113.${index}`, "incorrect-password")).statusCode).toBe(401);
    }

    await app.close();
    apps.splice(apps.indexOf(app), 1);
    const restartedApp = createApp(dataDir);
    const attemptAfterRestart = (ip: string, password: string) =>
      restartedApp.inject({
        method: "POST",
        url: "/api/session",
        headers: { origin, "x-real-ip": ip },
        payload: { password },
      });

    expect((await attemptAfterRestart("198.51.100.33", "incorrect-password")).statusCode).toBe(429);

    expect((await attemptAfterRestart("198.51.100.34", accessPassword)).statusCode).toBe(200);
  });

  it("clears the session cookie on logout and confirms the session is no longer valid", async () => {
    const app = createApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { origin },
      payload: { password: accessPassword },
    });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];

    const logout = await app.inject({
      method: "DELETE",
      url: "/api/session",
      headers: { origin, cookie },
    });

    expect(logout.statusCode).toBe(204);
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
    const session = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { cookie },
    });
    expect(session.json()).toEqual({ authenticated: false });
  });
});
