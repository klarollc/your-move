/**
 * Maps a generic workspace command onto a work command (workflow-proof W5b).
 *
 * `WorkspaceCommand` already carries a free-form intent, a target entity and a payload, so create
 * and assign need no contract change: they are the intents `work.create` (payload `{contract}`)
 * and `work.assign` (payload `{roleAssignmentId}`), with the work item id as the target. Unknown
 * payload fields are refused, not ignored. The contract itself is not validated here; the work
 * command validates it against the schema and names the failing field.
 */
import type { WorkContract, WorkspaceCommand } from "@cuckcode/contracts";

import type { WorkCommand, WorkEvidenceInput } from "./work-commands.js";

export type WorkCommandMapping =
  | Readonly<{ ok: true; value: WorkCommand }>
  | Readonly<{
      ok: false;
      code: "INTENT_UNSUPPORTED" | "COMMAND_INVALID";
      issues: readonly string[];
    }>;

const invalid = (...issues: string[]): WorkCommandMapping => ({
  ok: false,
  code: "COMMAND_INVALID",
  issues,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function toWorkCommand(command: WorkspaceCommand): WorkCommandMapping {
  const common = {
    commandId: command.commandId,
    projectId: command.projectId,
    expectedRevision: command.expectedRevision,
    actor: command.actor,
    workItemId: command.targetEntityId,
  };
  const keys = Object.keys(command.payload);
  if (command.intent === "work.create") {
    if (keys.some((key) => key !== "contract")) {
      return invalid(
        `unexpected payload fields: ${keys.filter((k) => k !== "contract").join(", ")}`,
      );
    }
    if (!isRecord(command.payload.contract)) return invalid("payload.contract must be an object");
    return {
      ok: true,
      value: { ...common, intent: "create", contract: command.payload.contract as WorkContract },
    };
  }
  if (command.intent === "work.assign") {
    if (keys.some((key) => key !== "roleAssignmentId")) {
      return invalid(
        `unexpected payload fields: ${keys.filter((k) => k !== "roleAssignmentId").join(", ")}`,
      );
    }
    const id = command.payload.roleAssignmentId;
    if (typeof id !== "string" || id.length === 0) {
      return invalid("payload.roleAssignmentId must be a non-empty string");
    }
    return { ok: true, value: { ...common, intent: "assign", roleAssignmentId: id } };
  }
  if (command.intent === "work.record_evidence") {
    // The payload is the evidence input as given. The work command validates its fields and
    // refuses unexpected ones by name, so nothing is dropped silently here.
    return {
      ok: true,
      value: {
        ...common,
        intent: "record_evidence",
        evidence: command.payload as WorkEvidenceInput,
      },
    };
  }
  if (command.intent === "work.request_review") {
    if (keys.length > 0) return invalid(`unexpected payload fields: ${keys.join(", ")}`);
    return { ok: true, value: { ...common, intent: "request_review" } };
  }
  return {
    ok: false,
    code: "INTENT_UNSUPPORTED",
    issues: [`intent ${command.intent} is not a work intent`],
  };
}
