import { parseUtcTimestamp } from "./primitives.js";
import {
  boundedWorkContractSchema,
  validateWorkCreatedPayload,
} from "./work-contract.js";
import type { WorkPayloadResult } from "./work-payloads.js";
import { validateEvidenceRecordedPayload } from "./work-payloads.js";

export type EvidenceVersionRef = Readonly<{ evidenceId: string; version: number }>;
export type WorkRulingDecision = "accept" | "accept_with_exception" | "send_back" | "defer";

export type WorkRulingRecordedPayload = Readonly<{
  workItemId: string;
  rulingId: string;
  decision: WorkRulingDecision;
  sourceWorkRevision: number;
  evidenceVersions: readonly EvidenceVersionRef[];
  reason?: string;
  note?: string;
  resurfaceAt?: string;
}>;

export type WorkTurnsGrantedPayload = Readonly<{
  workItemId: string;
  turnsGranted: number;
  budgetRevision: number;
}>;

export type WorkRescopedPayload = Readonly<{
  workItemId: string;
  expectedContractRevision: number;
  contractRevision: number;
  contract: ReturnType<typeof boundedWorkContractSchema.parse>;
}>;

export type WorkClosedIncompletePayload = Readonly<{
  workItemId: string;
  fromRevision: number;
  reason: string;
}>;

export type WorkNudgedPayload = Readonly<{
  workItemId: string;
  roleAssignmentId: string;
  note: string;
}>;

export type WorkNudgeSuppressedPayload = Readonly<{
  workItemId: string;
  disposition: "snooze" | "dismiss";
  until: string;
}>;

export type RulingWithdrawnPayload = Readonly<{
  workItemId: string;
  rulingId: string;
  evidenceVersions: readonly EvidenceVersionRef[];
}>;

const WORK_ID = /^work_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ASSIGNMENT_ID = /^role-assignment_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RULING_ID = /^ruling_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EVIDENCE_ID = /^evidence_[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_TEXT = 280;
const decisions: readonly WorkRulingDecision[] = ["accept", "accept_with_exception", "send_back", "defer"];

export function validateWorkTurnsGrantedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkTurnsGrantedPayload> {
  const issues = fields(payload, ["workItemId", "turnsGranted", "budgetRevision"]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (!positiveInteger(payload.turnsGranted)) issues.push("turnsGranted must be a positive integer");
  if (!positiveInteger(payload.budgetRevision)) {
    issues.push("budgetRevision must be a positive integer");
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      turnsGranted: payload.turnsGranted as number,
      budgetRevision: payload.budgetRevision as number,
    },
  };
}

export function validateWorkRescopedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkRescopedPayload> {
  const issues = fields(payload, [
    "workItemId",
    "expectedContractRevision",
    "contractRevision",
    "contract",
  ]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (!positiveInteger(payload.expectedContractRevision)) {
    issues.push("expectedContractRevision must be a positive integer");
  }
  if (
    !positiveInteger(payload.contractRevision) ||
    payload.contractRevision !== Number(payload.expectedContractRevision) + 1
  ) {
    issues.push("contractRevision must be expectedContractRevision + 1");
  }
  const contract = boundedWorkContractSchema.safeParse(payload.contract);
  if (!contract.success) {
    for (const issue of contract.error.issues) {
      issues.push(`contract.${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }
  if (issues.length > 0 || !contract.success) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      expectedContractRevision: payload.expectedContractRevision as number,
      contractRevision: payload.contractRevision as number,
      contract: contract.data,
    },
  };
}

export function validateWorkClosedIncompletePayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkClosedIncompletePayload> {
  const issues = fields(payload, ["workItemId", "fromRevision", "reason"]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (!nonNegativeInteger(payload.fromRevision)) issues.push("fromRevision must be non-negative");
  if (!text(payload.reason)) issues.push("reason must be non-empty");
  else if ((payload.reason as string).length > MAX_TEXT) issues.push("reason exceeds 280 characters");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      fromRevision: payload.fromRevision as number,
      reason: payload.reason as string,
    },
  };
}

export function validateWorkRulingRecordedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkRulingRecordedPayload> {
  const issues = fields(payload, [
    "workItemId",
    "rulingId",
    "decision",
    "sourceWorkRevision",
    "evidenceVersions",
    "reason",
    "note",
    "resurfaceAt",
  ]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (!matches(payload.rulingId, RULING_ID)) issues.push("rulingId is missing or malformed");
  if (!includes(decisions, payload.decision)) issues.push("decision is not supported");
  if (!nonNegativeInteger(payload.sourceWorkRevision)) {
    issues.push("sourceWorkRevision must be non-negative");
  }
  const versions = evidenceVersionList(payload.evidenceVersions, issues);
  if (payload.reason !== undefined) {
    if (!text(payload.reason)) issues.push("reason must be non-empty when present");
    else if ((payload.reason as string).length > MAX_TEXT) issues.push("reason exceeds 280 characters");
  }
  if (payload.note !== undefined) {
    if (typeof payload.note !== "string") issues.push("note must be a string when present");
    else if (payload.note.length > MAX_TEXT) issues.push("note exceeds 280 characters");
  }
  const decision = payload.decision;
  const needsReason =
    decision === "accept_with_exception" || decision === "send_back" || decision === "defer";
  if (needsReason && !text(payload.reason)) {
    issues.push(`${String(decision)} requires a reason`);
  }
  if (decision === "defer") {
    if (!utcTimestamp(payload.resurfaceAt)) issues.push("defer requires a UTC resurfaceAt");
  } else if (payload.resurfaceAt !== undefined) {
    issues.push("resurfaceAt is only valid for defer");
  }
  if (issues.length > 0 || !versions || !includes(decisions, decision)) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      rulingId: payload.rulingId as string,
      decision,
      sourceWorkRevision: payload.sourceWorkRevision as number,
      evidenceVersions: versions,
      ...(typeof payload.reason === "string" ? { reason: payload.reason } : {}),
      ...(typeof payload.note === "string" ? { note: payload.note } : {}),
      ...(typeof payload.resurfaceAt === "string" ? { resurfaceAt: payload.resurfaceAt } : {}),
    },
  };
}

export function validateWorkNudgedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkNudgedPayload> {
  const issues = fields(payload, ["workItemId", "roleAssignmentId", "note"]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (!matches(payload.roleAssignmentId, ASSIGNMENT_ID)) {
    issues.push("roleAssignmentId is missing or malformed");
  }
  if (!text(payload.note)) issues.push("note must be non-empty");
  else if ((payload.note as string).length > MAX_TEXT) issues.push("note exceeds 280 characters");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      roleAssignmentId: payload.roleAssignmentId as string,
      note: payload.note as string,
    },
  };
}

export function validateWorkNudgeSuppressedPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<WorkNudgeSuppressedPayload> {
  const issues = fields(payload, ["workItemId", "disposition", "until"]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (payload.disposition !== "snooze" && payload.disposition !== "dismiss") {
    issues.push("disposition must be snooze or dismiss");
  }
  if (!utcTimestamp(payload.until)) issues.push("until must be an absolute UTC timestamp");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      disposition: payload.disposition as "snooze" | "dismiss",
      until: payload.until as string,
    },
  };
}

export function validateRulingWithdrawnPayload(
  payload: Record<string, unknown>,
): WorkPayloadResult<RulingWithdrawnPayload> {
  const issues = fields(payload, ["workItemId", "rulingId", "evidenceVersions"]);
  if (!matches(payload.workItemId, WORK_ID)) issues.push("workItemId is missing or malformed");
  if (!matches(payload.rulingId, RULING_ID)) issues.push("rulingId is missing or malformed");
  const versions = evidenceVersionList(payload.evidenceVersions, issues);
  if (issues.length > 0 || !versions) return { ok: false, issues };
  return {
    ok: true,
    value: {
      workItemId: payload.workItemId as string,
      rulingId: payload.rulingId as string,
      evidenceVersions: versions,
    },
  };
}

/** Validate the event-specific contracts without tightening historical event payloads. */
export function validateWorkflowCoreEventPayload(
  kind: string,
  payload: Record<string, unknown>,
): WorkPayloadResult<Record<string, unknown>> {
  const checked =
    kind === "work.turns_granted"
      ? validateWorkTurnsGrantedPayload(payload)
      : kind === "work.rescoped"
        ? validateWorkRescopedPayload(payload)
        : kind === "work.closed_incomplete"
          ? validateWorkClosedIncompletePayload(payload)
          : kind === "work.ruling_recorded"
            ? validateWorkRulingRecordedPayload(payload)
            : kind === "work.nudged"
              ? validateWorkNudgedPayload(payload)
              : kind === "work.nudge_suppressed"
                ? validateWorkNudgeSuppressedPayload(payload)
                : kind === "ruling.withdrawn"
                  ? validateRulingWithdrawnPayload(payload)
                  : kind === "evidence.recorded"
                    ? validateEvidenceRecordedPayload(payload)
                    : kind === "work.created" && payload.payloadVersion === 3
                      ? validateWorkCreatedPayload(payload)
                      : undefined;
  if (!checked) return { ok: true, value: payload };
  return checked.ok
    ? { ok: true, value: checked.value as Record<string, unknown> }
    : checked;
}

function evidenceVersionList(
  value: unknown,
  issues: string[],
): EvidenceVersionRef[] | undefined {
  if (!Array.isArray(value)) {
    issues.push("evidenceVersions must be an array");
    return undefined;
  }
  const result: EvidenceVersionRef[] = [];
  for (const [index, raw] of value.entries()) {
    if (!isRecord(raw)) {
      issues.push(`evidenceVersions.${String(index)} must be an object`);
      continue;
    }
    const extra = Object.keys(raw).filter((key) => key !== "evidenceId" && key !== "version");
    if (extra.length > 0) {
      issues.push(`evidenceVersions.${String(index)} has unexpected fields: ${extra.sort().join(", ")}`);
    }
    if (!matches(raw.evidenceId, EVIDENCE_ID)) {
      issues.push(`evidenceVersions.${String(index)}.evidenceId is malformed`);
    }
    if (!positiveInteger(raw.version)) {
      issues.push(`evidenceVersions.${String(index)}.version must be a positive integer`);
    }
    if (matches(raw.evidenceId, EVIDENCE_ID) && positiveInteger(raw.version)) {
      result.push({ evidenceId: raw.evidenceId, version: raw.version });
    }
  }
  const ids = result.map(({ evidenceId }) => evidenceId);
  if (new Set(ids).size !== ids.length) issues.push("evidenceVersions must not repeat an evidenceId");
  if (ids.some((id, index) => index > 0 && ids[index - 1]! > id)) {
    issues.push("evidenceVersions must be sorted by evidenceId");
  }
  return result.length === value.length ? result : undefined;
}

function fields(payload: Record<string, unknown>, allowed: readonly string[]): string[] {
  const extra = Object.keys(payload).filter((key) => !allowed.includes(key));
  return extra.length > 0 ? [`unexpected fields: ${extra.sort().join(", ")}`] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function utcTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.endsWith("Z") && parseUtcTimestamp(value).ok;
}
