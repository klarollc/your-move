/**
 * The completion gate (workflow-proof W4, spec §7 invariants 2, 5 and 6).
 *
 * Three pure rules. None of them talks to a runtime, a filesystem or a clock.
 *
 * - `checkReadiness` (invariant 2): before turn 1, a role that cannot read a file it needs, and
 *   whose contract has not inlined it, is blocked rather than allowed to proceed and claim done.
 * - `judgeDoneClaim` (invariant 5): "done" is supported only by evidence the system verified, one
 *   kind per contract obligation. The role's own report (trust "reported" or "inferred") is not
 *   evidence of its own completion.
 * - `reconcileRecords` (invariant 6): the replayed status, the change paths the event stream
 *   showed, the change paths the worktree shows, and the status a surface displays must agree. Any
 *   disagreement is a hard stop, never a warning.
 *
 * Limit, stated plainly: evidence carries a kind, a version and a result, not an artifact digest,
 * so "inspectable" here means "recorded by a verified event", not "hash-checked".
 */
import {
  parseProjectEvent,
  type PostureDifference,
  type PostureRecord,
  type WorkContract,
} from "@cuckcode/contracts";

import { reduceWorkTruth } from "./work-truth.js";

const normalizePath = (path: string): string => path.replaceAll("\\", "/").replace(/^(\.\/)+/, "");

// Condition summaries are capped at 280 characters by the transition payload contract.
const clamp = (text: string): string => (text.length <= 280 ? text : `${text.slice(0, 277)}...`);

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export type ReadinessCondition = Readonly<{
  reasonCode: "awaiting_evidence";
  summary: string;
  waitingOn: Readonly<{ kind: "manager" }>;
  requestedAction: Readonly<{ kind: "provide_evidence"; summary: string }>;
}>;

export type ReadinessResult =
  | Readonly<{ ok: true; uninlined: readonly string[]; readBasis: string }>
  | Readonly<{
      ok: false;
      code: "POSTURE_MISMATCH" | "CEILING_EXCEEDED" | "BLOCKED_CANNOT_READ";
      differences?: readonly PostureDifference[];
      missingPaths?: readonly string[];
      condition?: ReadinessCondition;
    }>;

const SANDBOX_RANK: Readonly<Record<string, number>> = { "read-only": 0, "workspace-write": 1 };

export function checkReadiness(
  input: Readonly<{
    contract: WorkContract;
    posture: PostureRecord;
    neededPaths: readonly string[];
  }>,
): ReadinessResult {
  const { contract, posture } = input;
  if (!posture.match) {
    return { ok: false, code: "POSTURE_MISMATCH", differences: posture.differences };
  }
  const ceiling = contract.permissionCeiling;
  if (
    (SANDBOX_RANK[posture.requested.sandboxMode] ?? Infinity) >
      (SANDBOX_RANK[ceiling.sandboxMode] ?? -1) ||
    posture.requested.networkAccess !== ceiling.networkAccess
  ) {
    return { ok: false, code: "CEILING_EXCEEDED" };
  }
  const inlined = new Set(contract.contextRefs.map((ref) => normalizePath(ref.path)));
  const uninlined = unique(input.neededPaths.map(normalizePath)).filter(
    (path) => !inlined.has(path),
  );
  if (uninlined.length === 0) {
    return { ok: true, uninlined: [], readBasis: "every needed file is inlined in the contract" };
  }
  if (posture.declared.read === "possible") {
    return {
      ok: true,
      uninlined,
      readBasis:
        "read is possible by declaration only (policy intent, not observed); the first turn is its test",
    };
  }
  return {
    ok: false,
    code: "BLOCKED_CANNOT_READ",
    missingPaths: uninlined,
    condition: {
      reasonCode: "awaiting_evidence",
      summary: clamp(
        `The role's declared read capability is "${posture.declared.read}", and ${uninlined.join(", ")} is not inlined in the contract.`,
      ),
      waitingOn: { kind: "manager" },
      requestedAction: {
        kind: "provide_evidence",
        summary: "Inline the missing files in the work contract, or rule on enabling a read path.",
      },
    },
  };
}

export type DoneJudgement =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: "WORK_ITEM_NOT_FOUND" | "CONTRACT_MISSING" | "DONE_UNSUPPORTED";
      missingKinds: readonly string[];
      failedKinds: readonly string[];
      unverifiedKinds: readonly string[];
    }>;

const none = { missingKinds: [], failedKinds: [], unverifiedKinds: [] } as const;

/** Positions of parseable events by id: the order the log gave them, which is replay order. */
function eventIndex(log: readonly unknown[]): Map<string, { position: number; trust: string }> {
  const index = new Map<string, { position: number; trust: string }>();
  log.forEach((candidate, position) => {
    const parsed = parseProjectEvent(candidate);
    if (parsed.ok) index.set(parsed.value.eventId, { position, trust: parsed.value.trust });
  });
  return index;
}

export function judgeDoneClaim(
  input: Readonly<{ log: readonly unknown[]; workItemId: string }>,
): DoneJudgement {
  const state = reduceWorkTruth(input.log);
  const item = state.workItems[input.workItemId];
  if (!item) return { ok: false, code: "WORK_ITEM_NOT_FOUND", ...none };
  if (!item.contract) return { ok: false, code: "CONTRACT_MISSING", ...none };
  const index = eventIndex(input.log);
  const missingKinds: string[] = [];
  const failedKinds: string[] = [];
  const unverifiedKinds: string[] = [];
  for (const { kind } of item.contract.evidenceObligations) {
    const records = Object.values(state.evidence)
      .filter((record) => record.workItemId === input.workItemId && record.kind === kind)
      .map((record) => ({ record, at: index.get(record.eventId) }));
    const verified = records
      .filter((entry) => entry.at?.trust === "verified")
      .sort((a, b) => (a.at?.position ?? 0) - (b.at?.position ?? 0));
    const latest = verified[verified.length - 1];
    if (latest === undefined) {
      (records.length > 0 ? unverifiedKinds : missingKinds).push(kind);
    } else if (latest.record.result !== "passed") {
      failedKinds.push(kind);
    }
  }
  if (missingKinds.length + failedKinds.length + unverifiedKinds.length === 0) return { ok: true };
  return { ok: false, code: "DONE_UNSUPPORTED", missingKinds, failedKinds, unverifiedKinds };
}

export type RecordMismatch = Readonly<{
  kind:
    | "WORK_ITEM_NOT_FOUND"
    | "REPLAY_ISSUE"
    | "STATUS_MISMATCH"
    | "UNCLAIMED_CHANGE"
    | "CLAIMED_NOT_PRESENT";
  detail: string;
  path?: string;
}>;

export type ReconciliationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; hardStop: true; mismatches: readonly RecordMismatch[] }>;

export function reconcileRecords(
  input: Readonly<{
    log: readonly unknown[];
    workItemId: string;
    displayedState: string;
    streamedPaths: readonly string[];
    worktreePaths: readonly string[];
  }>,
): ReconciliationResult {
  const state = reduceWorkTruth(input.log);
  const item = state.workItems[input.workItemId];
  const mismatches: RecordMismatch[] = [];
  if (!item) {
    mismatches.push({
      kind: "WORK_ITEM_NOT_FOUND",
      detail: `${input.workItemId} is not in the replayed log`,
    });
  } else if (item.state !== input.displayedState) {
    mismatches.push({
      kind: "STATUS_MISMATCH",
      detail: `replay says ${item.state}, the surface displays ${input.displayedState}`,
    });
  }
  for (const found of state.issues.filter((entry) => entry.workItemId === input.workItemId)) {
    mismatches.push({ kind: "REPLAY_ISSUE", detail: `${found.code}: ${found.message}` });
  }
  const streamed = new Set(input.streamedPaths.map(normalizePath));
  const worktree = new Set(input.worktreePaths.map(normalizePath));
  for (const path of [...worktree].filter((entry) => !streamed.has(entry)).sort()) {
    mismatches.push({
      kind: "UNCLAIMED_CHANGE",
      path,
      detail: `${path} changed in the worktree but the event stream never showed it`,
    });
  }
  for (const path of [...streamed].filter((entry) => !worktree.has(entry)).sort()) {
    mismatches.push({
      kind: "CLAIMED_NOT_PRESENT",
      path,
      detail: `${path} was reported changed in the event stream but the worktree does not show it`,
    });
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, hardStop: true, mismatches };
}
