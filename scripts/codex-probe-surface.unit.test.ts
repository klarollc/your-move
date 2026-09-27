import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { featureDisableConfig } from "@cuckcode/runtime-codex";

import {
  PROBE_MAX_LINE_BYTES,
  guardProbeRequests,
  redactProbeRecord,
  runCodexProbeSurface,
  type ProbeDependencies,
  type ProbeRuntime,
} from "./codex-probe-surface.js";

const apps = {
  name: "codex_apps",
  authStatus: "oAuth",
  runtimeStatus: "connected",
  tools: { github_search: {} },
  resources: [],
  resourceTemplates: [],
};

type Shape = {
  signedIn?: boolean;
  control?: unknown[];
  policy?: unknown[];
  failOn?: string;
  drift?: boolean;
};

function rehearsal(shape: Shape = {}) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const records: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  let threadStarts = 0;
  const runtime: ProbeRuntime = {
    async readAccountStatus() {
      return shape.signedIn === false
        ? { ok: false, code: "AUTH_REQUIRED" }
        : { ok: true, mode: "chatgpt" };
    },
    async request(method, params) {
      calls.push({ method, params });
      if (method === shape.failOn) throw new Error("PROCESS_EXITED");
      if (method === "thread/start") {
        threadStarts += 1;
        return { thread: { id: `thread_${threadStarts}` } };
      }
      if (method === "mcpServerStatus/list") {
        const data = threadStarts === 1 ? (shape.control ?? [apps]) : (shape.policy ?? []);
        return { data, nextCursor: null };
      }
      throw new Error(`unexpected ${method}`);
    },
    async close() {
      events.push("closed");
      return "docs/evidence/runtime/sessions/run-codex-probe-surface/log.jsonl";
    },
  };
  const deps: ProbeDependencies = {
    optIn: true,
    pin: "9.9.9",
    cwd: "C:/synthetic/probe",
    expected: { requestedModel: "gpt-5.6-sol", expectedReasoningEffort: "medium" },
    async checkDrift() {
      events.push("drift");
      if (shape.drift) throw new Error("CODEX_VERSION_MISMATCH: codex-cli 9.9.8");
    },
    async openRuntime() {
      events.push("opened");
      return runtime;
    },
    async writeRecord(record) {
      events.push("record");
      records.push(record);
      return "docs/evidence/runtime/probe/record.json";
    },
    now: () => "2026-09-26T16:00:00.000Z",
  };
  return { deps, calls, records, events };
}

describe("codex surface probe (F1.5, F1.6)", () => {
  it("refuses to start without the explicit opt-in, before touching anything", async () => {
    const probe = rehearsal();
    await expect(runCodexProbeSurface({ ...probe.deps, optIn: false })).rejects.toThrow(
      /LIVE_PROBE_EXPLICIT_OPT_IN_REQUIRED/u,
    );
    expect(probe.events).toEqual([]);
  });

  it("proves the policy: the control starts codex_apps, the policy session starts nothing", async () => {
    const probe = rehearsal();
    const outcome = await runCodexProbeSurface(probe.deps);

    expect(outcome).toEqual({
      ok: true,
      code: "PROBE_OK",
      recordPath: "docs/evidence/runtime/probe/record.json",
    });
    expect(probe.calls.map((call) => call.method)).toEqual([
      "thread/start",
      "mcpServerStatus/list",
      "thread/start",
      "mcpServerStatus/list",
    ]);
    const [control, , policy] = probe.calls;
    expect(control?.params.config).toEqual({ model_reasoning_effort: "medium" });
    expect(policy?.params.config).toEqual({
      model_reasoning_effort: "medium",
      features: featureDisableConfig(),
    });
    expect(probe.calls[1]?.params.threadId).toBe("thread_1");
    expect(probe.calls[3]?.params.threadId).toBe("thread_2");
    // The drift preflight runs first; the record is written after the log is closed, so it can
    // name the log.
    expect(probe.events).toEqual(["drift", "opened", "closed", "record"]);
    expect(probe.records[0]).toMatchObject({
      schema: "cuckcode.codex-probe-surface.v1",
      codexPin: "9.9.9",
      code: "PROBE_OK",
      turns: 0,
      authMode: "chatgpt",
      control: {
        servers: [{ name: "codex_apps", status: "connected", toolNames: ["github_search"] }],
      },
      policy: { servers: [], featuresDisabled: Object.keys(featureDisableConfig()).length },
      sessionLog: "docs/evidence/runtime/sessions/run-codex-probe-surface/log.jsonl",
    });
  });

  it("stops when the policy session still starts a server", async () => {
    const probe = rehearsal({ policy: [apps] });
    const outcome = await runCodexProbeSurface(probe.deps);
    expect(outcome).toMatchObject({ ok: false, code: "STOP_POLICY_SURFACE_PRESENT" });
    expect(probe.records[0]).toMatchObject({ code: "STOP_POLICY_SURFACE_PRESENT" });
  });

  it("stops when the control starts no codex_apps, because then the probe proves nothing", async () => {
    const probe = rehearsal({ control: [] });
    const outcome = await runCodexProbeSurface(probe.deps);
    expect(outcome).toMatchObject({ ok: false, code: "STOP_CONTROL_WITHOUT_APPS" });
  });

  it("records a refusal and starts no thread when the session is not signed in", async () => {
    const probe = rehearsal({ signedIn: false });
    const outcome = await runCodexProbeSurface(probe.deps);
    expect(outcome).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    expect(probe.calls).toEqual([]);
    expect(probe.events).toEqual(["drift", "opened", "closed", "record"]);
  });

  it("records drift and never opens a runtime", async () => {
    const probe = rehearsal({ drift: true });
    const outcome = await runCodexProbeSurface(probe.deps);
    expect(outcome).toMatchObject({ ok: false, code: "CODEX_DRIFT" });
    expect(probe.events).toEqual(["drift", "record"]);
    expect(probe.records[0]).toMatchObject({ code: "CODEX_DRIFT", sessionLog: null });
  });

  it("records a runtime failure mid-probe and still closes the session", async () => {
    const probe = rehearsal({ failOn: "mcpServerStatus/list" });
    const outcome = await runCodexProbeSurface(probe.deps);
    expect(outcome).toMatchObject({ ok: false, code: "PROBE_RUNTIME_FAILURE" });
    expect(probe.events).toEqual(["drift", "opened", "closed", "record"]);
    // A one-shot owner run must say where it stopped, not only that it did.
    expect(probe.records[0]).toMatchObject({
      step: "mcpServerStatus/list (control)",
      detail: "PROCESS_EXITED",
    });
  });

  it("can only send thread/start and mcpServerStatus/list; a turn never reaches the runtime", async () => {
    const probe = rehearsal();
    const reached: string[] = [];
    const guarded = guardProbeRequests({
      ...(await probe.deps.openRuntime()),
      async request(method) {
        reached.push(method);
        return {};
      },
    });
    await expect(guarded.request("turn/start", {})).rejects.toThrow(/PROBE_METHOD_REFUSED/u);
    await expect(guarded.request("thread/read", {})).rejects.toThrow(/PROBE_METHOD_REFUSED/u);
    await guarded.request("mcpServerStatus/list", {});
    expect(reached).toEqual(["mcpServerStatus/list"]);
  });
});

describe("the probe's message bound", () => {
  it("is raised above the supervisor default, and the live script uses it", () => {
    // The default stays 1 MiB for every other session: an oversized listing there fails closed.
    expect(PROBE_MAX_LINE_BYTES).toBeGreaterThan(1_048_576);
    const live = readFileSync(new URL("./run-codex-probe-surface.ts", import.meta.url), "utf8");
    expect(live).toContain("maxLineBytes: PROBE_MAX_LINE_BYTES");
  });
});

describe("redacting a held probe record (owner ruling 2026-09-27)", () => {
  const captured = {
    schema: "cuckcode.codex-probe-surface.v1",
    code: "PROBE_OK",
    turns: 0,
    control: {
      servers: [
        {
          name: "codex_apps",
          status: "connected",
          toolNames: ["github.search", "github.create_issue", "gmail.send", "hotline"],
        },
      ],
    },
    policy: { servers: [], featuresDisabled: 145 },
    sessionLog: "docs/evidence/runtime/sessions/run-codex-probe-surface/log.jsonl",
  };

  it("keeps each server's name, status and counts, and no connector or tool name", () => {
    const redacted = redactProbeRecord(captured);
    expect(redacted).toEqual({
      ...captured,
      control: {
        servers: [{ name: "codex_apps", status: "connected", toolCount: 4, connectorCount: 3 }],
      },
      policy: { servers: [], featuresDisabled: 145 },
      redaction: "tool-names-v1",
      redactedAfterCapture: true,
    });
    const text = JSON.stringify(redacted);
    for (const leaked of ["github", "gmail", "hotline", "search"]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("refuses a record that is already redacted or has no servers to redact", () => {
    expect(() => redactProbeRecord(redactProbeRecord(captured))).toThrow(/ALREADY_REDACTED/u);
    expect(() => redactProbeRecord({ code: "CODEX_DRIFT" })).toThrow(/NOTHING_TO_REDACT/u);
  });
});
