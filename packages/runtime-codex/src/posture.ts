/**
 * Requested, granted and declared posture (workflow-proof W1, spec §4; DF-043, DF-045, DF-046).
 *
 * Pure functions. Nothing here talks to the runtime: the granted posture is whatever `thread/start`
 * reported, passed in by the caller.
 */
import type {
  DeclaredCapabilities,
  PostureDifference,
  PostureRecord,
  RequestedPosture,
  SandboxPosture,
} from "@cuckcode/contracts";

import { FEATURE_POLICY, type FeatureRuling } from "./feature-policy.js";
import type { ExerciseThreadOptions } from "./role-exercise.js";

type Policy = Readonly<Record<string, FeatureRuling>>;

export type PostureComparison =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; differences: readonly [PostureDifference, ...PostureDifference[]] }>;

// The runtime reports sandbox types in camelCase; callers request them in kebab-case.
const GRANTED_TYPE_FOR_REQUEST: Readonly<Record<RequestedPosture["sandboxMode"], string>> = {
  "read-only": "readOnly",
  "workspace-write": "workspaceWrite",
};

/**
 * The posture `exerciseThreadStartParams` sends for these options. Approval policy is fixed at
 * `never` there ("must never vary by caller"), and network is never requested. A test pins this to
 * the real thread/start parameters so the two cannot drift apart.
 */
export function requestedPostureOf(options: ExerciseThreadOptions = {}): RequestedPosture {
  return {
    sandboxMode: options.sandbox ?? "read-only",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: options.windowsSandbox ?? null,
  };
}

/**
 * Compares what was requested with what the runtime granted. Any difference is a refusal that
 * names every differing field, in a fixed order: sandbox type, network, approval policy. A granted
 * sandbox type that is not the one requested never matches, whether broader, narrower or unknown.
 */
export function compareRequestedToGranted(
  requested: RequestedPosture,
  granted: SandboxPosture,
): PostureComparison {
  const differences: PostureDifference[] = [];
  const expectedType = GRANTED_TYPE_FOR_REQUEST[requested.sandboxMode];
  if (granted.type !== expectedType) {
    differences.push({ field: "sandbox.type", requested: expectedType, granted: granted.type });
  }
  if (granted.networkAccess !== requested.networkAccess) {
    differences.push({
      field: "sandbox.networkAccess",
      requested: requested.networkAccess,
      granted: granted.networkAccess,
    });
  }
  if (granted.approvalPolicy !== requested.approvalPolicy) {
    differences.push({
      field: "approvalPolicy",
      requested: requested.approvalPolicy,
      granted: granted.approvalPolicy,
    });
  }
  const [first, ...rest] = differences;
  return first === undefined ? { ok: true } : { ok: false, differences: [first, ...rest] };
}

/**
 * What the role could plausibly do, from the GRANTED posture and the feature policy. This is a
 * declaration of intent. It never says "yes": no run has observed the role.
 *
 * - run: the shell and unified-exec tools are how a role runs commands. "no" only when the policy
 *   disables both; "possible" when it keeps either; "unknown" when the policy does not rule on one
 *   of them and the other is not kept.
 * - read: reading a file goes through command execution, so it follows the shell tool. This is an
 *   inference from DF-045 and DF-046 that has not been tested by enabling the shell tool.
 * - write: "no" under a read-only sandbox, "possible" under workspace-write, "unknown" for any
 *   other sandbox type.
 */
export function declareCapabilities(
  granted: SandboxPosture,
  policy: Policy = FEATURE_POLICY,
): DeclaredCapabilities {
  const shell = policy.shell_tool;
  const exec = policy.unified_exec;
  const basis: string[] = [];

  let read: DeclaredCapabilities["read"];
  if (shell === "disable") {
    read = "no";
    basis.push(
      "read: shell_tool is disabled by the feature policy (reading is inferred to need it)",
    );
  } else if (shell === "keep") {
    read = "possible";
    basis.push("read: shell_tool is kept by the feature policy");
  } else {
    read = "unknown";
    basis.push("read: the feature policy does not rule on shell_tool");
  }

  let run: DeclaredCapabilities["run"];
  if (shell === "keep" || exec === "keep") {
    run = "possible";
    basis.push("run: the feature policy keeps shell_tool or unified_exec");
  } else if (shell === "disable" && exec === "disable") {
    run = "no";
    basis.push("run: shell_tool and unified_exec are both disabled by the feature policy");
  } else {
    run = "unknown";
    basis.push("run: the feature policy does not rule on shell_tool or unified_exec");
  }

  let write: DeclaredCapabilities["write"];
  if (granted.type === "readOnly") {
    write = "no";
    basis.push("write: the granted sandbox is readOnly");
  } else if (granted.type === "workspaceWrite") {
    write = "possible";
    basis.push("write: the granted sandbox is workspaceWrite");
  } else {
    write = "unknown";
    basis.push(`write: the granted sandbox type ${granted.type} is not recognised`);
  }

  return { kind: "declared", read, write, run, basis, observed: null };
}

/** Builds the full record. `declared` follows what was granted, never what was requested. */
export function buildPostureRecord(
  requested: RequestedPosture,
  granted: SandboxPosture,
  policy: Policy = FEATURE_POLICY,
): PostureRecord {
  const comparison = compareRequestedToGranted(requested, granted);
  return {
    schemaVersion: 1,
    requested,
    granted,
    declared: declareCapabilities(granted, policy),
    match: comparison.ok,
    differences: comparison.ok ? [] : comparison.differences,
  };
}
