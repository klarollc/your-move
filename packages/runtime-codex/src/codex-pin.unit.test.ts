import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CODEX_PIN, codexTargetFor, readCodexPin, resolveCodexExecutable } from "./codex-pin.js";

const manifest = (version: unknown): string =>
  JSON.stringify({
    name: "@cuckcode/runtime-codex",
    devDependencies: { "@openai/codex": version },
  });

describe("the Codex pin", () => {
  it("reads an exact version from the declaration", () => {
    expect(readCodexPin(manifest("0.157.1"))).toBe("0.157.1");
  });

  it("refuses a range, a tag or a missing declaration, because only an exact version is a pin", () => {
    expect(() => readCodexPin(manifest("^0.157.1"))).toThrow("CODEX_PIN_NOT_EXACT");
    expect(() => readCodexPin(manifest("latest"))).toThrow("CODEX_PIN_NOT_EXACT");
    expect(() => readCodexPin(JSON.stringify({ devDependencies: {} }))).toThrow(
      "CODEX_PIN_MISSING",
    );
  });

  it("is the version declared in this package's manifest, not a copy of it", () => {
    const declared = (
      JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
        devDependencies: Record<string, string>;
      }
    ).devDependencies["@openai/codex"];
    expect(CODEX_PIN).toBe(declared);
  });
});

describe("the Codex target", () => {
  it("maps each supported host to the triple and platform package Codex itself uses", () => {
    expect(codexTargetFor("win32", "x64")).toEqual({
      triple: "x86_64-pc-windows-msvc",
      platformPackage: "@openai/codex-win32-x64",
    });
    expect(codexTargetFor("linux", "x64")).toEqual({
      triple: "x86_64-unknown-linux-musl",
      platformPackage: "@openai/codex-linux-x64",
    });
    expect(codexTargetFor("darwin", "arm64")).toEqual({
      triple: "aarch64-apple-darwin",
      platformPackage: "@openai/codex-darwin-arm64",
    });
  });

  it("refuses a host Codex does not ship for", () => {
    expect(() => codexTargetFor("freebsd", "x64")).toThrow("CODEX_PLATFORM_UNSUPPORTED");
  });
});

describe("resolving the Codex executable", () => {
  const packageDir = "/repo/node_modules/@openai/codex-win32-x64";
  const layout = (version: string) =>
    JSON.stringify({
      layoutVersion: 1,
      version,
      target: "x86_64-pc-windows-msvc",
      entrypoint: "bin/codex.exe",
    });
  const base = {
    env: {},
    platform: "win32",
    arch: "x64",
    pin: "0.157.1",
    locatePackageDir: (name: string) => {
      if (name !== "@openai/codex-win32-x64") throw new Error(`unexpected ${name}`);
      return packageDir;
    },
    readText: (path: string) => {
      if (path !== join(packageDir, "vendor", "x86_64-pc-windows-msvc", "codex-package.json"))
        throw new Error(`unexpected ${path}`);
      return layout("0.157.1");
    },
  };

  it("takes the entrypoint the installed platform package declares", () => {
    expect(resolveCodexExecutable(base)).toBe(
      join(packageDir, "vendor", "x86_64-pc-windows-msvc", "bin/codex.exe"),
    );
  });

  it("honours CUCKCODE_CODEX_EXE, which the drift preflight still checks", () => {
    expect(resolveCodexExecutable({ ...base, env: { CUCKCODE_CODEX_EXE: "D:/codex.exe" } })).toBe(
      "D:/codex.exe",
    );
  });

  it("refuses when the platform package is not installed rather than falling back to another binary", () => {
    expect(() =>
      resolveCodexExecutable({
        ...base,
        locatePackageDir: () => {
          throw new Error("Cannot find module");
        },
      }),
    ).toThrow("CODEX_EXECUTABLE_UNRESOLVED");
  });

  it("refuses an installed package whose own layout names a different version than the pin", () => {
    expect(() => resolveCodexExecutable({ ...base, readText: () => layout("0.156.1") })).toThrow(
      "CODEX_PACKAGE_VERSION_MISMATCH",
    );
  });
});
