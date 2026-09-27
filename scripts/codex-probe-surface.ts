import type { ObservedMcpServer } from "@cuckcode/contracts";
import {
  enumerateMcpServers,
  exerciseThreadStartParams,
  featureDisableConfig,
} from "@cuckcode/runtime-codex";

/**
 * F1.5, F1.6: the proof that the feature policy removes the tool surface a signed-in Codex starts.
 *
 * One signed-in session, two threads: a control started without the policy, then one started with
 * it, each followed by `mcpServerStatus/list`. No turn is ever started, so nothing is billed and no
 * ledger is touched. The probe passes only when the control shows `codex_apps` (so the comparison
 * means something) and the policy thread shows no server at all (the refusal every session applies
 * from now on). Either failing is a stop for a ruling, not something to work around.
 */
export type ProbeRuntime = {
  readAccountStatus: () => Promise<
    { ok: true; mode: "chatgpt" | "api_key_managed" } | { ok: false; code: "AUTH_REQUIRED" }
  >;
  request: (
    method: string,
    params: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<unknown>;
  /** Stops the runtime and closes its session log; returns the log's repository path. */
  close: () => Promise<string | null>;
};
export type ProbeDependencies = {
  optIn: boolean;
  pin: string;
  cwd: string;
  expected: { requestedModel: string; expectedReasoningEffort: string };
  checkDrift: () => Promise<void>;
  openRuntime: () => Promise<ProbeRuntime>;
  writeRecord: (record: Record<string, unknown>) => Promise<string>;
  now: () => string;
};

/**
 * The probe's per-message bound. On 2026-09-27 the signed-in control's codex_apps listing exceeded
 * the supervisor's 1 MiB default and the probe stopped with LINE_TOO_LARGE. Only the probe raises
 * it, because only the probe asks for a listing without the policy; every other session keeps the
 * default, where an oversized listing fails closed before any binding.
 */
export const PROBE_MAX_LINE_BYTES = 64 * 1_048_576;

/** The only two methods the probe may send. A turn is not among them, by construction. */
const PROBE_METHODS: ReadonlySet<string> = new Set(["thread/start", "mcpServerStatus/list"]);
const APPS_SERVER = "codex_apps";

/** Wraps a supervisor, its session log and its controlled home as one runtime for the probe. */
export function probeRuntime(
  supervisor: {
    readAccountStatus: ProbeRuntime["readAccountStatus"];
    request: (
      method: string,
      params: Record<string, unknown>,
      timeoutMs?: number,
    ) => Promise<unknown>;
    stop: () => Promise<void>;
  },
  closeLog: () => Promise<string | null>,
  dispose: () => Promise<void>,
): ProbeRuntime {
  return {
    readAccountStatus: () => supervisor.readAccountStatus(),
    request: (method, params, timeoutMs) => supervisor.request(method, params, timeoutMs),
    close: async () => {
      try {
        await supervisor.stop();
        return await closeLog();
      } finally {
        await dispose();
      }
    },
  };
}

export function guardProbeRequests(runtime: ProbeRuntime): ProbeRuntime {
  return {
    ...runtime,
    request: async (method, params, timeoutMs) => {
      if (!PROBE_METHODS.has(method)) throw new Error(`PROBE_METHOD_REFUSED: ${method}`);
      return await runtime.request(method, params, timeoutMs);
    },
  };
}

export async function runCodexProbeSurface(
  deps: ProbeDependencies,
): Promise<{ ok: boolean; code: string; recordPath: string | null }> {
  if (!deps.optIn) throw new Error("LIVE_PROBE_EXPLICIT_OPT_IN_REQUIRED");
  const startedAt = deps.now();
  const base = {
    schema: "cuckcode.codex-probe-surface.v1",
    status: "A surface probe. No turn was started; it approves nothing.",
    codexPin: deps.pin,
    requestedModel: deps.expected.requestedModel,
    startedAt,
    turns: 0,
  };
  const finish = async (
    code: string,
    fields: Record<string, unknown>,
  ): Promise<{ ok: boolean; code: string; recordPath: string | null }> => {
    const recordPath = await deps.writeRecord({ ...base, endedAt: deps.now(), code, ...fields });
    return { ok: code === "PROBE_OK", code, recordPath };
  };

  try {
    await deps.checkDrift();
  } catch (cause) {
    return await finish("CODEX_DRIFT", { detail: message(cause), sessionLog: null });
  }

  const runtime = await deps.openRuntime();
  const guarded = guardProbeRequests(runtime);
  // Where the probe is, so a failure records the step it stopped at, not only that it stopped.
  const progress = { step: "account/read" };
  let result: { code: string; fields: Record<string, unknown> };
  try {
    result = await probe(guarded, deps, progress);
  } catch (cause) {
    result = {
      code: "PROBE_RUNTIME_FAILURE",
      fields: { step: progress.step, detail: message(cause) },
    };
  }
  const sessionLog = await runtime.close();
  return await finish(result.code, { ...result.fields, sessionLog });
}

async function probe(
  runtime: ProbeRuntime,
  deps: ProbeDependencies,
  progress: { step: string },
): Promise<{ code: string; fields: Record<string, unknown> }> {
  const auth = await runtime.readAccountStatus();
  if (!auth.ok) {
    return { code: "AUTH_REQUIRED", fields: { detail: "the probe needs a signed-in session" } };
  }
  const policyParams = exerciseThreadStartParams(deps.cwd, {
    requestedModel: deps.expected.requestedModel,
    expectedReasoningEffort: deps.expected.expectedReasoningEffort,
    expectedAuthMode: auth.mode,
    protocolVersion: deps.pin,
    promotedContentSha256: "surface-probe",
  });
  // The control is the same thread/start with the policy's features table removed and nothing
  // else changed, so any difference in what starts is the policy's doing.
  const controlConfig = { ...(policyParams.config as Record<string, unknown>) };
  delete controlConfig.features;
  const controlParams = { ...policyParams, config: controlConfig };

  const control = await startAndList(runtime, controlParams, "control", progress);
  const policy = await startAndList(runtime, policyParams, "policy", progress);
  const fields = {
    authMode: auth.mode,
    control: { servers: control },
    policy: { servers: policy, featuresDisabled: Object.keys(featureDisableConfig()).length },
  };
  if (policy.length > 0) return { code: "STOP_POLICY_SURFACE_PRESENT", fields };
  if (!control.some((server) => server.name === APPS_SERVER)) {
    return { code: "STOP_CONTROL_WITHOUT_APPS", fields };
  }
  return { code: "PROBE_OK", fields };
}

async function startAndList(
  runtime: ProbeRuntime,
  params: Record<string, unknown>,
  side: "control" | "policy",
  progress: { step: string },
): Promise<ObservedMcpServer[]> {
  progress.step = `thread/start (${side})`;
  const started = await runtime.request("thread/start", params, 30_000);
  const thread = (started as { thread?: { id?: unknown } } | null)?.thread?.id;
  progress.step = `mcpServerStatus/list (${side})`;
  return await enumerateMcpServers(runtime, typeof thread === "string" ? thread : null);
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Owner ruling 2026-09-27: a committed probe record keeps what proves the policy (each server's
 * name and status, and how many tools and connectors it carried) but no connector or tool name,
 * because the control's codex_apps catalog lists which apps the account has connected. Applied to
 * a held capture; the original stays outside the repository.
 */
export function redactProbeRecord(record: Record<string, unknown>): Record<string, unknown> {
  if (record.redaction !== undefined) throw new Error("PROBE_RECORD_ALREADY_REDACTED");
  const sides = ["control", "policy"].filter((side) => isObject(record[side]));
  if (sides.length === 0) throw new Error("PROBE_RECORD_NOTHING_TO_REDACT");
  const redacted: Record<string, unknown> = { ...record };
  for (const side of sides) {
    const value = record[side] as Record<string, unknown>;
    const servers = value.servers as ObservedMcpServer[];
    redacted[side] = {
      ...value,
      servers: servers.map((server) => ({
        name: server.name,
        status: server.status,
        toolCount: server.toolNames.length,
        // A connector is the part of a tool name before its first dot; a name without one is its
        // own connector.
        connectorCount: new Set(server.toolNames.map((name) => name.split(".", 1)[0])).size,
      })),
    };
  }
  return { ...redacted, redaction: "tool-names-v1", redactedAfterCapture: true };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
