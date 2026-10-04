import { describe, expect, it } from "vitest";

import {
  declaredCapabilitiesSchema,
  postureRecordSchema,
  requestedPostureSchema,
  type DeclaredCapabilities,
  type PostureRecord,
  type RequestedPosture,
} from "./posture.js";

const requested: RequestedPosture = {
  sandboxMode: "workspace-write",
  approvalPolicy: "never",
  networkAccess: false,
  windowsSandbox: "unelevated",
};

const declared: DeclaredCapabilities = {
  kind: "declared",
  read: "no",
  write: "possible",
  run: "no",
  basis: ["shell_tool is disabled by the feature policy"],
  observed: null,
};

const granted = {
  type: "workspaceWrite",
  networkAccess: false,
  approvalPolicy: "never",
  multiAgentMode: "explicitRequestOnly",
} as const;

const record: PostureRecord = {
  schemaVersion: 1,
  requested,
  granted,
  declared,
  match: true,
  differences: [],
};

describe("requested posture", () => {
  it("accepts the postures a caller may request", () => {
    expect(requestedPostureSchema.safeParse(requested).success).toBe(true);
    expect(
      requestedPostureSchema.safeParse({
        ...requested,
        sandboxMode: "read-only",
        windowsSandbox: null,
      }).success,
    ).toBe(true);
  });

  it("rejects danger-full-access, a network request and unknown fields", () => {
    expect(
      requestedPostureSchema.safeParse({ ...requested, sandboxMode: "danger-full-access" }).success,
    ).toBe(false);
    expect(requestedPostureSchema.safeParse({ ...requested, networkAccess: true }).success).toBe(
      false,
    );
    expect(requestedPostureSchema.safeParse({ ...requested, extra: 1 }).success).toBe(false);
  });

  it("rejects the elevated Windows sandbox, which has not been ruled", () => {
    expect(
      requestedPostureSchema.safeParse({ ...requested, windowsSandbox: "elevated" }).success,
    ).toBe(false);
  });
});

describe("declared capabilities", () => {
  it("accepts no, possible and unknown, each with a basis", () => {
    expect(declaredCapabilitiesSchema.safeParse(declared).success).toBe(true);
    expect(
      declaredCapabilitiesSchema.safeParse({ ...declared, read: "unknown", run: "possible" })
        .success,
    ).toBe(true);
  });

  it("never accepts a claim of yes: nothing has observed the role", () => {
    expect(declaredCapabilitiesSchema.safeParse({ ...declared, read: "yes" }).success).toBe(false);
  });

  it("requires a stated basis and a null observation", () => {
    expect(declaredCapabilitiesSchema.safeParse({ ...declared, basis: [] }).success).toBe(false);
    expect(declaredCapabilitiesSchema.safeParse({ ...declared, observed: {} }).success).toBe(false);
    expect(declaredCapabilitiesSchema.safeParse({ ...declared, kind: "observed" }).success).toBe(
      false,
    );
  });
});

describe("posture record", () => {
  it("accepts a matching record", () => {
    expect(postureRecordSchema.safeParse(record).success).toBe(true);
  });

  it("accepts a mismatch only when it names the differing fields", () => {
    const mismatch = {
      ...record,
      granted: { ...granted, type: "readOnly" },
      match: false,
      differences: [{ field: "sandbox.type", requested: "workspaceWrite", granted: "readOnly" }],
    };
    expect(postureRecordSchema.safeParse(mismatch).success).toBe(true);
  });

  it("rejects a record whose match flag disagrees with its differences", () => {
    expect(postureRecordSchema.safeParse({ ...record, match: false }).success).toBe(false);
    expect(
      postureRecordSchema.safeParse({
        ...record,
        match: true,
        differences: [{ field: "approvalPolicy", requested: "never", granted: "onRequest" }],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields and a missing granted layer", () => {
    expect(postureRecordSchema.safeParse({ ...record, extra: 1 }).success).toBe(false);
    const withoutGranted = Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== "granted"),
    );
    expect(postureRecordSchema.safeParse(withoutGranted).success).toBe(false);
  });
});
