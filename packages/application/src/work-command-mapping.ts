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
  if (command.intent === "work.record_ruling") {
    if (keys.some((key) => !["decision", "reason", "note", "resurfaceAt"].includes(key))) {
      return invalid(
        `unexpected ruling payload fields: ${keys.filter((key) => !["decision", "reason", "note", "resurfaceAt"].includes(key)).join(", ")}`,
      );
    }
    return {
      ok: true,
      value: {
        ...common,
        intent: "record_ruling",
        ruling: command.payload as NonNullable<WorkCommand["ruling"]>,
      },
    };
  }
  if (command.intent === "work.grant_turns") {
    if (keys.some((key) => !["turnsGranted", "budgetRevision"].includes(key)))
      return invalid("unexpected turn grant payload fields");
    return {
      ok: true,
      value: {
        ...common,
        intent: "grant_turns",
        turnsGranted: command.payload.turnsGranted as number,
        budgetRevision: command.payload.budgetRevision as number,
      },
    };
  }
  if (command.intent === "work.rescope") {
    if (keys.some((key) => !["expectedContractRevision", "contract", "proposalId"].includes(key)))
      return invalid("unexpected re-scope payload fields");
    if (!isRecord(command.payload.contract)) return invalid("payload.contract must be an object");
    return {
      ok: true,
      value: {
        ...common,
        intent: "rescope",
        expectedContractRevision: command.payload.expectedContractRevision as number,
        contract: command.payload.contract as WorkContract,
        ...(typeof command.payload.proposalId === "string"
          ? { proposalId: command.payload.proposalId }
          : {}),
      },
    };
  }
  if (command.intent === "work.ask_question") {
    if (keys.some((key) => key !== "question"))
      return invalid(
        `unexpected question payload fields: ${keys.filter((key) => key !== "question").join(", ")}`,
      );
    return {
      ok: true,
      value: { ...common, intent: "ask_question", question: command.payload.question as string },
    };
  }
  if (command.intent === "work.propose_rescope") {
    if (keys.some((key) => !["proposalId", "expectedContractRevision", "contract"].includes(key)))
      return invalid("unexpected re-scope proposal payload fields");
    if (!isRecord(command.payload.contract)) return invalid("payload.contract must be an object");
    return {
      ok: true,
      value: {
        ...common,
        intent: "propose_rescope",
        proposalId: command.payload.proposalId as string,
        expectedContractRevision: command.payload.expectedContractRevision as number,
        contract: command.payload.contract as WorkContract,
      },
    };
  }
  if (command.intent === "work.decline_rescope") {
    if (keys.some((key) => !["proposalId", "reason"].includes(key)))
      return invalid("unexpected re-scope decline payload fields");
    return {
      ok: true,
      value: {
        ...common,
        intent: "decline_rescope",
        proposalId: command.payload.proposalId as string,
        reason: command.payload.reason as string,
      },
    };
  }
  if (command.intent === "work.dispute_send_back") {
    if (keys.some((key) => !["rulingId", "statement"].includes(key)))
      return invalid("unexpected dispute payload fields");
    return {
      ok: true,
      value: {
        ...common,
        intent: "dispute_send_back",
        rulingId: command.payload.rulingId as string,
        statement: command.payload.statement as string,
      },
    };
  }
  if (command.intent === "work.close_incomplete") {
    if (keys.some((key) => key !== "reason"))
      return invalid("unexpected close-incomplete payload fields");
    return {
      ok: true,
      value: { ...common, intent: "close_incomplete", reason: command.payload.reason as string },
    };
  }
  if (command.intent === "work.nudge") {
    if (keys.some((key) => !["roleAssignmentId", "note"].includes(key)))
      return invalid("unexpected nudge payload fields");
    return {
      ok: true,
      value: {
        ...common,
        intent: "nudge",
        roleAssignmentId: command.payload.roleAssignmentId as string,
        note: command.payload.note as string,
      },
    };
  }
  if (command.intent === "work.suppress_nudge") {
    if (keys.some((key) => key !== "disposition"))
      return invalid("unexpected suppression payload fields");
    return {
      ok: true,
      value: {
        ...common,
        intent: "suppress_nudge",
        disposition: command.payload.disposition as "snooze" | "dismiss",
      },
    };
  }
  if (command.intent === "work.withdraw_ruling") {
    if (keys.some((key) => key !== "rulingId"))
      return invalid("unexpected withdrawal payload fields");
    return {
      ok: true,
      value: { ...common, intent: "withdraw_ruling", rulingId: command.payload.rulingId as string },
    };
  }
  return {
    ok: false,
    code: "INTENT_UNSUPPORTED",
    issues: [`intent ${command.intent} is not a work intent`],
  };
}
