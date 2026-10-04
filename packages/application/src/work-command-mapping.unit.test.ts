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
