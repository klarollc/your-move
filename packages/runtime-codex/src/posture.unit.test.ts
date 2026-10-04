import {
  postureRecordSchema,
  type RequestedPosture,
  type SandboxPosture,
} from "@cuckcode/contracts";
import { describe, expect, it } from "vitest";

import { FEATURE_POLICY } from "./feature-policy.js";
import {
  buildPostureRecord,
  compareRequestedToGranted,
  declareCapabilities,
  requestedPostureOf,
} from "./posture.js";
import type { BindingExpectation } from "./binding.js";
import { exerciseThreadStartParams } from "./role-exercise.js";

const writeRequest: RequestedPosture = {
  sandboxMode: "workspace-write",
  approvalPolicy: "never",
  networkAccess: false,
  windowsSandbox: "unelevated",
};
const readOnlyRequest: RequestedPosture = {
  sandboxMode: "read-only",
  approvalPolicy: "never",
  networkAccess: false,
  windowsSandbox: null,
};

const granted = (overrides: Partial<SandboxPosture> = {}): SandboxPosture => ({
  type: "workspaceWrite",
  networkAccess: false,
  approvalPolicy: "never",
  multiAgentMode: "explicitRequestOnly",
  ...overrides,
});

const expectation: BindingExpectation = {
  requestedModel: "gpt-5.6-luna",
  expectedReasoningEffort: "medium",
  expectedAuthMode: "chatgpt",
  protocolVersion: "0.146.0",
  promotedSourceSha256: "source",
  promotedOverlaySha256: "overlay",
};

describe("compareRequestedToGranted", () => {
  it("accepts a granted posture equal to what was requested", () => {
    expect(compareRequestedToGranted(writeRequest, granted())).toEqual({ ok: true });
    expect(compareRequestedToGranted(readOnlyRequest, granted({ type: "readOnly" }))).toEqual({
      ok: true,
    });
  });

  it("refuses the DF-043 downgrade and names the sandbox type", () => {
    const result = compareRequestedToGranted(writeRequest, granted({ type: "readOnly" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.differences[0]).toEqual({
      field: "sandbox.type",
      requested: "workspaceWrite",
      granted: "readOnly",
    });
  });

  it("refuses a granted network the request never asked for", () => {
    const result = compareRequestedToGranted(writeRequest, granted({ networkAccess: true }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.differences.map((d) => d.field)).toEqual(["sandbox.networkAccess"]);
  });

  it("refuses a different approval policy", () => {
    const result = compareRequestedToGranted(
      writeRequest,
      granted({ approvalPolicy: "onRequest" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.differences).toEqual([
      { field: "approvalPolicy", requested: "never", granted: "onRequest" },
    ]);
  });

  it("lists every difference, in a fixed order, sandbox type first", () => {
    const result = compareRequestedToGranted(
      writeRequest,
      granted({ type: "readOnly", networkAccess: true, approvalPolicy: "onRequest" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.differences.map((d) => d.field)).toEqual([
      "sandbox.type",
      "sandbox.networkAccess",
      "approvalPolicy",
    ]);
  });

  it("never treats a broader or unknown granted sandbox as a match", () => {
    for (const type of ["dangerFullAccess", "externalSandbox", "something-new"]) {
      expect(compareRequestedToGranted(writeRequest, granted({ type })).ok).toBe(false);
      expect(compareRequestedToGranted(readOnlyRequest, granted({ type })).ok).toBe(false);
    }
  });
});

describe("declareCapabilities", () => {
  it("declares the DF-046 state for the tracer posture: write possible, read no, run no", () => {
    const declared = declareCapabilities(granted());
    expect(declared).toMatchObject({
      kind: "declared",
      read: "no",
      write: "possible",
      run: "no",
      observed: null,
    });
    expect(declared.basis.join(" ")).toContain("shell_tool");
  });

  it("declares read-only as unable to write", () => {
    expect(declareCapabilities(granted({ type: "readOnly" })).write).toBe("no");
  });

  it("declares an unrecognised sandbox type as unknown for writing", () => {
    expect(declareCapabilities(granted({ type: "something-new" })).write).toBe("unknown");
  });

  it("declares read and run as possible only when the policy keeps the shell tool", () => {
    const kept = declareCapabilities(granted(), { ...FEATURE_POLICY, shell_tool: "keep" });
    expect(kept.read).toBe("possible");
    expect(kept.run).toBe("possible");
    const execOnly = declareCapabilities(granted(), {
      ...FEATURE_POLICY,
      shell_tool: "disable",
      unified_exec: "keep",
    });
    expect(execOnly.run).toBe("possible");
    expect(execOnly.read).toBe("no");
  });

  it("states that a missing policy entry is unknown, not assumed", () => {
    const withoutShell = Object.fromEntries(
      Object.entries(FEATURE_POLICY).filter(([name]) => name !== "shell_tool"),
    );
    const declared = declareCapabilities(granted(), withoutShell);
    expect(declared.read).toBe("unknown");
    expect(declared.run).toBe("unknown");
    expect(declared.write).toBe("possible");
  });
});

describe("requestedPostureOf", () => {
  it("matches what exerciseThreadStartParams actually sends, by default", () => {
    const params = exerciseThreadStartParams("/work", expectation);
    const posture = requestedPostureOf();
    expect(posture.sandboxMode).toBe(params.sandbox);
    expect(posture.approvalPolicy).toBe(params.approvalPolicy);
    expect(posture.windowsSandbox).toBeNull();
    expect(posture.networkAccess).toBe(false);
  });

  it("matches what is sent for the tracer's scoped-edit options", () => {
    const options = { sandbox: "workspace-write", windowsSandbox: "unelevated" } as const;
    const params = exerciseThreadStartParams("/work", expectation, undefined, options);
    const posture = requestedPostureOf(options);
    expect(posture.sandboxMode).toBe(params.sandbox);
    expect(posture.approvalPolicy).toBe(params.approvalPolicy);
    expect(posture.windowsSandbox).toBe(
      (params.config as { windows?: { sandbox?: string } }).windows?.sandbox,
    );
  });
});

describe("buildPostureRecord", () => {
  it("records a match with no differences", () => {
    const record = buildPostureRecord(writeRequest, granted());
    expect(record.match).toBe(true);
    expect(record.differences).toEqual([]);
    expect(postureRecordSchema.safeParse(record).success).toBe(true);
  });

  it("records a mismatch with its differences and still validates", () => {
    const record = buildPostureRecord(writeRequest, granted({ type: "readOnly" }));
    expect(record.match).toBe(false);
    expect(record.differences[0]?.field).toBe("sandbox.type");
    expect(postureRecordSchema.safeParse(record).success).toBe(true);
  });

  it("derives declared capability from what was granted, never from what was requested", () => {
    const record = buildPostureRecord(writeRequest, granted({ type: "readOnly" }));
    expect(record.declared.write).toBe("no");
  });
});
