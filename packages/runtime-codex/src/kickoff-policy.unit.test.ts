import { describe, expect, it } from "vitest";

import {
  checkObservedEvent,
  checkRequestMethod,
  checkSpawnArgs,
  checkTurnBudget,
} from "./kickoff-policy.js";
import { ALLOWED_REQUEST_METHODS, CODEX_ARGS } from "./supervisor.js";

function event(kind: string) {
  return {
    kind,
    phase: "item.completed",
    canonicalImpact: "reported_only",
    correlation: { bindingId: "b1", providerRunId: "r1", providerRequestId: "q1" },
    projectId: "project_live",
    workItemId: "kickoff_live",
    roleId: "delivery",
    sequence: 1,
    evidenceHash: "0".repeat(64),
  } as unknown as Parameters<typeof checkObservedEvent>[0];
}

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

describe("observed effect policy", () => {
  it("accepts the event kinds a text-only kickoff produces", () => {
    for (const kind of ["runtime.lifecycle", "runtime.message", "runtime.usage"]) {
      expect(checkObservedEvent(event(kind))).toBeUndefined();
    }
  });

  it("stops the run on any observed command, file, or tool effect", () => {
    for (const kind of ["runtime.command", "runtime.file", "runtime.tool"]) {
      const violation = checkObservedEvent(event(kind));
      expect(violation?.code).toBe("EXTERNAL_EFFECT_OBSERVED");
      expect(violation?.detail).toContain(kind);
    }
  });

  it("treats an artifact as an external effect, since a text-only turn produces none", () => {
    expect(checkObservedEvent(event("runtime.artifact"))?.code).toBe("EXTERNAL_EFFECT_OBSERVED");
  });

  it("does not treat an approval request as an effect, but does not permit acting on it", () => {
    // A permission request arriving is information. It is the manager's to decide, and D-25
    // forbids the provider deciding. Observing one must not itself stop the run.
    expect(checkObservedEvent(event("runtime.approval"))).toBeUndefined();
  });
});

describe("turn budget", () => {
  it("permits the D-25 shape exactly", () => {
    expect(checkTurnBudget({ contributions: 6, syntheses: 1, revisions: 6 })).toBeUndefined();
  });

  it("permits an under-filled round, because an unused revision is not a violation", () => {
    expect(checkTurnBudget({ contributions: 6, syntheses: 1, revisions: 0 })).toBeUndefined();
  });

  it("rejects a fourteenth turn", () => {
    expect(checkTurnBudget({ contributions: 6, syntheses: 1, revisions: 7 })?.code).toBe(
      "TURN_BUDGET_EXCEEDED",
    );
  });

  it("rejects more than one synthesis even within the total", () => {
    expect(checkTurnBudget({ contributions: 5, syntheses: 2, revisions: 5 })?.code).toBe(
      "TURN_BUDGET_EXCEEDED",
    );
  });
});
