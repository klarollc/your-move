import type { WorkspaceCommand } from "@cuckcode/contracts";
import { describe, expect, it } from "vitest";

import { toWorkCommand } from "./work-command-mapping.js";

const contract = { outcome: "x" };
const command = (over: Partial<WorkspaceCommand>): WorkspaceCommand => ({
  schemaVersion: 1,
  commandId: "cmd1",
  projectId: "project_alpha",
  expectedRevision: 4,
  actor: { actorType: "manager", actorId: "manager_nate" },
  intent: "work.create",
  targetEntityId: "work_slug",
  payload: { contract },
  ...over,
});

describe("toWorkCommand", () => {
  it("maps work.create to a create command carrying the contract", () => {
    expect(toWorkCommand(command({}))).toEqual({
      ok: true,
      value: {
        commandId: "cmd1",
        projectId: "project_alpha",
        expectedRevision: 4,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "create",
        workItemId: "work_slug",
        contract,
      },
    });
  });

  it("maps work.assign to an assign command carrying the role assignment id", () => {
    const result = toWorkCommand(
      command({ intent: "work.assign", payload: { roleAssignmentId: "role-assignment_a" } }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: { intent: "assign", workItemId: "work_slug", roleAssignmentId: "role-assignment_a" },
    });
    if (result.ok) expect("contract" in result.value).toBe(false);
  });

  it("refuses any other intent", () => {
    expect(toWorkCommand(command({ intent: "approve" }))).toMatchObject({
      ok: false,
      code: "INTENT_UNSUPPORTED",
    });
  });

  it("refuses a create without a contract object, and an assign without a role assignment", () => {
    expect(toWorkCommand(command({ payload: {} }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
    expect(toWorkCommand(command({ payload: { contract: "no" } }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
    expect(toWorkCommand(command({ intent: "work.assign", payload: {} }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
  });

  it("refuses unexpected payload fields rather than ignoring them", () => {
    expect(toWorkCommand(command({ payload: { contract, extra: 1 } }))).toMatchObject({
      ok: false,
      code: "COMMAND_INVALID",
    });
    expect(
      toWorkCommand(
        command({
          intent: "work.assign",
          payload: { roleAssignmentId: "role-assignment_a", extra: 1 },
        }),
      ),
    ).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
  });
});

describe("toWorkCommand: work.record_evidence", () => {
  const ev = (payload: Record<string, unknown>) =>
    toWorkCommand(command({ intent: "work.record_evidence", payload }));

  it("maps the payload to an evidence input", () => {
    expect(
      ev({ kind: "test-run", result: "passed", note: "n", outputSha256: "a".repeat(64) }),
    ).toEqual({
      ok: true,
      value: {
        commandId: "cmd1",
        projectId: "project_alpha",
        expectedRevision: 4,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "record_evidence",
        workItemId: "work_slug",
        evidence: { kind: "test-run", result: "passed", note: "n", outputSha256: "a".repeat(64) },
      },
    });
  });

  it("passes unexpected evidence fields through so the command refuses them by name", () => {
    const result = ev({ kind: "test-run", result: "passed", extra: 1 });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.evidence).toMatchObject({ extra: 1 });
  });
});

describe("toWorkCommand: work.request_review", () => {
  it("maps an empty payload to a request_review command", () => {
    expect(toWorkCommand(command({ intent: "work.request_review", payload: {} }))).toEqual({
      ok: true,
      value: {
        commandId: "cmd1",
        projectId: "project_alpha",
        expectedRevision: 4,
        actor: { actorType: "manager", actorId: "manager_nate" },
        intent: "request_review",
        workItemId: "work_slug",
      },
    });
  });

  it("refuses any payload field: the review request carries no claims", () => {
    const result = toWorkCommand(
      command({ intent: "work.request_review", payload: { toState: "completed" } }),
    );
    expect(result).toMatchObject({ ok: false, code: "COMMAND_INVALID" });
    if (!result.ok) expect(result.issues.join(" ")).toContain("toState");
  });
});
