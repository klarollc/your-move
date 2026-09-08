import { describe, expect, it } from "vitest";

import { checkRequestMethod, checkSpawnArgs } from "./kickoff-policy.js";
import { ALLOWED_REQUEST_METHODS, CODEX_ARGS } from "./supervisor.js";

describe("kickoff spawn policy", () => {
  it("accepts exactly the supervisor's fixed arguments", () => {
    expect(checkSpawnArgs([...CODEX_ARGS])).toBeUndefined();
  });

  it("rejects any added argument, including one that looks harmless", () => {
    expect(checkSpawnArgs([...CODEX_ARGS, "--yolo"])?.code).toBe("SPAWN_ARGS_NOT_EXACT");
    expect(checkSpawnArgs([...CODEX_ARGS, "--cd", "/tmp"])?.code).toBe("SPAWN_ARGS_NOT_EXACT");
  });

  it("rejects a dropped hardening flag", () => {
    expect(checkSpawnArgs(["app-server", "--stdio"])?.code).toBe("SPAWN_ARGS_NOT_EXACT");
  });

  it("rejects reordered arguments rather than treating the set as equivalent", () => {
    expect(checkSpawnArgs(["--stdio", "app-server", "--strict-config"])?.code).toBe(
      "SPAWN_ARGS_NOT_EXACT",
    );
  });
});

describe("kickoff request policy", () => {
  it("allows every method the supervisor allows", () => {
    for (const method of ALLOWED_REQUEST_METHODS) {
      expect(checkRequestMethod(method)).toBeUndefined();
    }
  });

  it("rejects methods that would produce an external effect", () => {
    for (const method of ["exec/run", "file/write", "tool/call", "patch/apply"]) {
      expect(checkRequestMethod(method)?.code).toBe("METHOD_NOT_ALLOWED");
    }
  });
});
