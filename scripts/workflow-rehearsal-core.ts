/**
 * Fake-runtime rehearsal of the whole workflow loop (workflow-proof W10).
 *
 * Runs `runWorkflowAttempt` over a real file log with an injected fake runtime, one scenario per
 * log, using the same command path (`executeWorkCommand`), the same log writer (`appendEventLog`)
 * and the same evidence recorder (`recordWorkEvidence`) the live run uses. No Codex process, no
 * network, no real clock. The result is data and a deterministic markdown transcript the owner
 * reviews before any live run (W10 gate). It proves the loop's decisions, not the live runner's
 * wiring: `run-workflow-attempt.ts` is first exercised live.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { executeWorkCommand } from "@cuckcode/application";
import type { PostureRecord } from "@cuckcode/contracts";
import { replayProject } from "@cuckcode/domain";

import { appendEventLog, readEventLog } from "../apps/server/src/event-log.js";
import { recordWorkEvidence } from "./record-work-evidence-core.js";
import { requestWorkReview } from "./request-work-review-core.js";
import { runWorkflowAttempt, type AttemptDeps, type AttemptResult } from "./workflow-attempt.js";

const T0 = "2026-10-04T10:00:00.000Z";
const T1 = "2026-10-04T11:00:00.000Z";
const T2 = "2026-10-04T12:00:00.000Z";
const PROJECT = "project_rehearsal";
const WORK = "work_slug";
const MANAGER = { actorType: "manager" as const, actorId: "manager_nate" };

export const REHEARSAL_SCENARIO_IDS = [
  "partial-record-and-unsupported-claim",
  "blocked-before-turn-1",
  "posture-mismatch",
  "clarification-path",
  "hard-stop-stream-worktree-disagree",
  "turn-cap",
  "runtime-failure",
  "owner-evidence-after-claim",
  "second-attempt-same-item",
] as const;

export type RehearsalCheck = Readonly<{ name: string; ok: boolean; detail: string }>;
type EvidenceRow = Readonly<{ kind: string; result: string; trust: string; source: string }>;
type EventRow = Readonly<{
  n: number;
  kind: string;
  source: string;
  trust: string;
  detail: string;
}>;

export type RehearsalResult = Readonly<{
  id: string;
  title: string;
  outcome: AttemptResult["outcome"];
  turnsRun: number;
  notes: readonly string[];
  finalState: string;
  condition: Readonly<Record<string, unknown>> | null;
  postures: readonly PostureRecord[];
  evidence: readonly EvidenceRow[];
  events: readonly EventRow[];
  replayIssues: readonly unknown[];
  runtimeTurnCalls: number;
  ownerEvidence: readonly Readonly<{ result: string; doneSupported: boolean }>[];
  /** The owner's review requests, in order: refused until the evidence supports the claim. */
  reviewRequests: readonly Readonly<{ ok: boolean; code?: string }>[];
  findings: readonly string[];
  checks: readonly RehearsalCheck[];
}>;

const contract = {
  outcome: "Implement slugify so the pre-written test passes",
  exclusions: ["do not edit the test"],
  acceptanceCriteria: ["the pre-written test passes"],
  dependencies: [],
  evidenceObligations: [
    { kind: "test-run", description: "the pre-written test, run by the owner" },
  ],
  permissionCeiling: {
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "never",
    networkAccess: false as const,
    windowsSandbox: "unelevated" as const,
  },
  stopConditions: ["turn cap", "the role reports blocked"],
  definitionOfDone: "owner acceptance",
  contextRefs: [{ path: "src/slugify.ts", sha256: "a".repeat(64) }],
};

const envelope = (eventId: string, kind: string, payload: Record<string, unknown>) => ({
  schemaVersion: 1,
  eventId,
  projectId: PROJECT,
  kind,
  occurredAt: T0,
  receivedAt: T0,
  source: "system",
  trust: "verified",
  payload,
});

function seedLog(): unknown[] {
  let log: unknown[] = [
    envelope("event_seed1", "agent.registered", {
      agentId: "agent_engineer",
      capabilities: ["engineer"],
      health: "connected",
    }),
    envelope("event_seed2", "role.assigned", {
      roleAssignmentId: "role-assignment_engineer",
      roleId: "engineer",
      agentId: "agent_engineer",
      requiredCapabilities: ["engineer"],
    }),
  ];
  const base = { projectId: PROJECT, actor: MANAGER, workItemId: WORK };
  const created = executeWorkCommand({
    log,
    currentRevision: log.length,
    now: T0,
    command: {
      ...base,
      commandId: "seed-c1",
      expectedRevision: log.length,
      intent: "create",
      contract,
    },
  });
  if (!created.ok) throw new Error(`rehearsal seed: ${created.code}`);
  log = [...log, ...created.events];
  const assigned = executeWorkCommand({
    log,
    currentRevision: log.length,
    now: T0,
    command: {
      ...base,
      commandId: "seed-c2",
      expectedRevision: log.length,
      intent: "assign",
      roleAssignmentId: "role-assignment_engineer",
    },
  });
  if (!assigned.ok) throw new Error(`rehearsal seed: ${assigned.code}`);
  return [...log, ...assigned.events];
}

const posture = (match = true): PostureRecord =>
  ({
    schemaVersion: 1,
    requested: {
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccess: false,
      windowsSandbox: "unelevated",
    },
    granted: {
      type: match ? "workspaceWrite" : "readOnly",
      networkAccess: false,
      approvalPolicy: "never",
      multiAgentMode: "explicitRequestOnly",
    },
    declared: {
      kind: "declared",
      read: "no",
      write: match ? "possible" : "no",
      run: "no",
      basis: ["the feature policy disables shell_tool and unified_exec"],
      observed: null,
    },
    match,
    differences: match
      ? []
      : [{ field: "sandbox.type", requested: "workspaceWrite", granted: "readOnly" }],
  }) as unknown as PostureRecord;

type Turn = Awaited<ReturnType<AttemptDeps["runTurn"]>>;
const turn = (
  number: number,
  over: Partial<Turn["summary"]> & { claimDone?: boolean; claimBlocked?: string } = {},
): Turn => {
  const { claimDone, claimBlocked, ...summary } = over;
  return {
    summary: {
      number,
      itemTypes: ["agentMessage", "fileChange"],
      streamedPaths: ["src/slugify.ts"],
      worktreePaths: ["src/slugify.ts"],
      partial: false,
      partialReasons: [],
      ...summary,
    },
    claimDone: claimDone ?? false,
    ...(claimBlocked !== undefined ? { claimBlocked } : {}),
  };
};

type Spec = Readonly<{
  id: (typeof REHEARSAL_SCENARIO_IDS)[number];
  title: string;
  posture?: PostureRecord;
  neededPaths?: readonly string[];
  maxTurns?: number;
  attempts?: number;
  turns: (number: number, attempt: number) => Turn;
}>;

const SPECS: readonly Spec[] = [
  {
    id: "partial-record-and-unsupported-claim",
    title: "Turn 1 has a partial record; turn 2 claims done with no evidence",
    turns: (n) =>
      n === 1
        ? turn(1, { partial: true, partialReasons: ["an item started and never completed"] })
        : turn(2, { claimDone: true }),
  },
  {
    id: "blocked-before-turn-1",
    title: "A needed file is unreadable and not inlined, so no turn is spent",
    neededPaths: ["src/slugify.ts", "src/other.ts"],
    turns: (n) => turn(n),
  },
  {
    id: "posture-mismatch",
    title: "The runtime granted a read-only sandbox where workspace-write was requested",
    posture: posture(false),
    turns: (n) => turn(n),
  },
  {
    id: "clarification-path",
    title: "The role meets the seeded ambiguity and asks instead of guessing",
    turns: (n) => turn(n, { claimBlocked: "Should the separator be a hyphen or an underscore?" }),
  },
  {
    id: "hard-stop-stream-worktree-disagree",
    title: "The worktree shows a change the event stream never reported",
    turns: (n) =>
      turn(n, {
        streamedPaths: ["src/slugify.ts"],
        worktreePaths: ["src/slugify.ts", "src/stray.ts"],
      }),
  },
  {
    id: "turn-cap",
    title: "The role never claims done or blocked and the cap is reached",
    maxTurns: 2,
    turns: (n) => turn(n),
  },
  {
    id: "runtime-failure",
    title: "The runtime fails during turn 2",
    turns: (n) => {
      if (n === 2) throw new Error("the runtime closed the stream during turn 2");
      return turn(n);
    },
  },
  {
    id: "owner-evidence-after-claim",
    title: "After an unsupported claim the owner records failing, then passing, test evidence",
    turns: (n) => turn(n, { claimDone: true }),
  },
  {
    id: "second-attempt-same-item",
    title: "A second attempt on an item that already ran is refused",
    attempts: 2,
    turns: (n) => turn(n, { claimDone: true }),
  },
];

const eventRows = (events: readonly unknown[]): EventRow[] =>
  events.map((raw, index) => {
    const e = raw as {
      kind: string;
      source: string;
      trust: string;
      payload: Record<string, unknown>;
    };
    let detail = "";
    if (e.kind === "evidence.recorded")
      detail = `${String(e.payload.kind)} ${String(e.payload.result)}`;
    else if (e.kind === "posture.recorded") {
      const p = e.payload.posture as PostureRecord;
      detail = `granted ${p.granted.type}, match ${String(p.match)}`;
    } else if (e.kind === "work.transitioned") detail = `to ${String(e.payload.toState)}`;
    return { n: index + 1, kind: e.kind, source: e.source, trust: e.trust, detail };
  });

async function runSpec(dir: string, spec: Spec): Promise<RehearsalResult> {
  const path = join(dir, `${spec.id}.jsonl`);
  const initial = seedLog();
  await writeFile(path, initial.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");

  let runtimeTurnCalls = 0;
  const deps = (attempt: number): AttemptDeps => ({
    readLog: async () => {
      const log = await readEventLog(path);
      return { events: log.events, revision: log.revision };
    },
    append: async (events, expected) => await appendEventLog(path, events, expected),
    startSession: async () => ({
      posture: spec.posture ?? posture(),
      close: async () => undefined,
    }),
    runTurn: async (n) => {
      runtimeTurnCalls += 1;
      return spec.turns(n, attempt);
    },
    now: () => T1,
  });
  const run = async (attempt: number): Promise<AttemptResult> =>
    await runWorkflowAttempt({
      deps: deps(attempt),
      projectId: PROJECT,
      workItemId: WORK,
      runId: `run${String(attempt)}`,
      neededPaths: spec.neededPaths ?? ["src/slugify.ts"],
      maxTurns: spec.maxTurns ?? 5,
    });

  let result = await run(1);
  for (let attempt = 2; attempt <= (spec.attempts ?? 1); attempt += 1) result = await run(attempt);

  const ownerEvidence: { result: string; doneSupported: boolean }[] = [];
  const reviewRequests: { ok: boolean; code?: string }[] = [];
  const askForReview = async (now: string): Promise<void> => {
    const asked = await requestWorkReview({
      logPath: path,
      workItemId: WORK,
      actorId: MANAGER.actorId,
      now,
    });
    reviewRequests.push(asked.ok ? { ok: true } : { ok: false, code: asked.code });
  };
  if (spec.id === "owner-evidence-after-claim") {
    await askForReview(T1);
    const output = join(dir, "test-output.txt");
    const steps = [
      { result: "failed" as const, now: T1, text: "RED: slugify is not defined\n" },
      { result: "passed" as const, now: T2, text: "GREEN: 1 test passed\n" },
    ];
    for (const step of steps) {
      await writeFile(output, step.text, "utf8");
      const recorded = await recordWorkEvidence({
        logPath: path,
        workItemId: WORK,
        kind: "test-run",
        result: step.result,
        outputPath: output,
        actorId: MANAGER.actorId,
        now: step.now,
      });
      if (!recorded.ok) throw new Error(`rehearsal evidence: ${recorded.code}`);
      ownerEvidence.push({ result: step.result, doneSupported: recorded.doneSupported });
      await askForReview(step.now);
    }
  }

  const log = await readEventLog(path);
  const snapshot = replayProject(log.events);
  const item = snapshot.work.workItems[WORK];
  const evidence: EvidenceRow[] = log.events
    .map(
      (raw) =>
        raw as { kind: string; source: string; trust: string; payload: Record<string, unknown> },
    )
    .filter((e) => e.kind === "evidence.recorded")
    .map((e) => ({
      kind: String(e.payload.kind),
      result: String(e.payload.result),
      trust: e.trust,
      source: e.source,
    }));
  const findings: string[] = [];
  if (spec.id === "owner-evidence-after-claim") {
    findings.push(
      "F-1 (resolved by W5h): the role cannot run the checks, so its claim always precedes the owner's evidence and an `active` item had no way to reach review. `request_review` closes it: refused until the role has claimed done and the evidence supports the claim. It does not check that the evidence was produced from the final worktree; that stays the owner's responsibility.",
    );
  }
  if (spec.id === "second-attempt-same-item") {
    findings.push(
      "F-2: preflight requires an `assigned` item, so each attempt needs its own work item. The live runner opens a Codex session before this check; it should refuse earlier.",
    );
  }
  const base = {
    id: spec.id,
    title: spec.title,
    outcome: result.outcome,
    turnsRun: result.turnsRun,
    notes: result.notes,
    finalState: item?.state ?? "missing",
    condition: (item?.condition as Record<string, unknown> | null | undefined) ?? null,
    postures: (snapshot.work.postures?.[WORK] ?? []).map((entry) => entry.posture),
    evidence,
    events: eventRows(log.events),
    replayIssues: snapshot.work.issues,
    runtimeTurnCalls,
    ownerEvidence,
    reviewRequests,
    findings,
  };
  return { ...base, checks: checksFor(base) };
}

type Base = Omit<RehearsalResult, "checks">;
const check = (name: string, ok: boolean, detail: string): RehearsalCheck => ({ name, ok, detail });

function checksFor(r: Base): RehearsalCheck[] {
  const kinds = r.evidence.map((e) => e.kind);
  const out: RehearsalCheck[] = [
    check(
      "the log replays with no reducer issues",
      r.replayIssues.length === 0,
      `${String(r.replayIssues.length)} issues`,
    ),
    check(
      "one posture is recorded per attempt",
      r.postures.length === 1,
      `${String(r.postures.length)} recorded`,
    ),
  ];
  switch (r.id) {
    case "partial-record-and-unsupported-claim":
      out.push(
        check("outcome is claim_unsupported", r.outcome === "claim_unsupported", r.outcome),
        check("the item stays active", r.finalState === "active", r.finalState),
        check(
          "turn 1 is recorded as failed (partial), turn 2 as passed",
          JSON.stringify(
            r.evidence.filter((e) => e.kind === "turn-record").map((e) => e.result),
          ) === '["failed","passed"]',
          kinds.join(","),
        ),
        check(
          "the claim is recorded as reported, failed",
          r.evidence.some(
            (e) => e.kind === "done-claim" && e.result === "failed" && e.trust === "reported",
          ),
          kinds.join(","),
        ),
      );
      break;
    case "blocked-before-turn-1":
      out.push(
        check("outcome is blocked_before_turn", r.outcome === "blocked_before_turn", r.outcome),
        check("no runtime turn was spent", r.runtimeTurnCalls === 0, String(r.runtimeTurnCalls)),
        check("the item is blocked", r.finalState === "blocked", r.finalState),
        check(
          "the condition names the missing file",
          JSON.stringify(r.condition).includes("src/other.ts"),
          JSON.stringify(r.condition),
        ),
      );
      break;
    case "posture-mismatch":
      out.push(
        check("outcome is blocked_before_turn", r.outcome === "blocked_before_turn", r.outcome),
        check(
          "the mismatch is recorded",
          r.postures[0]?.match === false,
          String(r.postures[0]?.match),
        ),
        check("no runtime turn was spent", r.runtimeTurnCalls === 0, String(r.runtimeTurnCalls)),
      );
      break;
    case "clarification-path":
      out.push(
        check("outcome is role_blocked", r.outcome === "role_blocked", r.outcome),
        check(
          "the item is blocked on a question to the manager",
          JSON.stringify(r.condition).includes("awaiting_clarification") &&
            JSON.stringify(r.condition).includes("answer_question"),
          JSON.stringify(r.condition),
        ),
      );
      break;
    case "hard-stop-stream-worktree-disagree":
      out.push(
        check("outcome is hard_stop", r.outcome === "hard_stop", r.outcome),
        check("the item is blocked", r.finalState === "blocked", r.finalState),
        check(
          "the stray path is named",
          r.notes.join(" ").includes("src/stray.ts"),
          r.notes.join(" "),
        ),
      );
      break;
    case "turn-cap":
      out.push(
        check(
          "outcome is turn_cap after exactly the cap",
          r.outcome === "turn_cap" && r.turnsRun === 2,
          `${r.outcome} ${String(r.turnsRun)}`,
        ),
        check(
          "a run-halt is recorded and the item is blocked",
          kinds.includes("run-halt") && r.finalState === "blocked",
          kinds.join(","),
        ),
      );
      break;
    case "runtime-failure":
      out.push(
        check("outcome is runtime_failure", r.outcome === "runtime_failure", r.outcome),
        check(
          "a run-halt is recorded and the item is blocked",
          kinds.includes("run-halt") && r.finalState === "blocked",
          kinds.join(","),
        ),
      );
      break;
    case "owner-evidence-after-claim":
      out.push(
        check(
          "the claim was unsupported before any evidence",
          r.outcome === "claim_unsupported",
          r.outcome,
        ),
        check(
          "failing evidence does not support the claim; passing evidence does",
          JSON.stringify(r.ownerEvidence) ===
            '[{"result":"failed","doneSupported":false},{"result":"passed","doneSupported":true}]',
          JSON.stringify(r.ownerEvidence),
        ),
        check(
          "the review request is refused until the evidence supports the claim, then accepted",
          JSON.stringify(r.reviewRequests) ===
            '[{"ok":false,"code":"DONE_NOT_SUPPORTED"},{"ok":false,"code":"DONE_NOT_SUPPORTED"},{"ok":true}]' &&
            r.finalState === "review_requested",
          `${JSON.stringify(r.reviewRequests)} ${r.finalState}`,
        ),
        check(
          "owner evidence is verified, from the manager",
          r.evidence
            .filter((e) => e.kind === "test-run")
            .every((e) => e.trust === "verified" && e.source === "manager"),
          JSON.stringify(r.evidence.filter((e) => e.kind === "test-run")),
        ),
      );
      break;
    case "second-attempt-same-item":
      out.push(
        check("the second attempt is rejected", r.outcome === "rejected", r.outcome),
        check(
          "the rejection says the item is not assigned",
          r.notes.join(" ").toLowerCase().includes("assigned"),
          r.notes.join(" "),
        ),
      );
      break;
  }
  return out;
}

export async function runRehearsal(dir: string): Promise<RehearsalResult[]> {
  await mkdir(dir, { recursive: true });
  const results: RehearsalResult[] = [];
  for (const spec of SPECS) results.push(await runSpec(dir, spec));
  return results;
}

/** A deterministic markdown transcript: no clock, no temp paths. */
export function renderRehearsal(results: readonly RehearsalResult[]): string {
  const lines: string[] = [
    "# Workflow rehearsal (W10, fake runtime)",
    "",
    "Generated by `npm run workflow:rehearsal` from deterministic fake-runtime inputs. This is the accepted W10 transcript; review any regenerated diff before replacing it. It rehearses the loop's decisions against a fake runtime; it does not exercise `run-workflow-attempt.ts` or a live Codex process.",
    "",
    `Scenarios: ${String(results.length)}. Checks failed: ${String(results.flatMap((r) => r.checks).filter((c) => !c.ok).length)}.`,
    "",
  ];
  for (const r of results) {
    lines.push(`## ${r.id}`, "", r.title, "");
    lines.push(
      `- Outcome: \`${r.outcome}\` after ${String(r.turnsRun)} turn(s); runtime turn calls: ${String(r.runtimeTurnCalls)}`,
    );
    lines.push(`- Final state: \`${r.finalState}\``);
    if (r.condition) lines.push(`- Condition: \`${JSON.stringify(r.condition)}\``);
    for (const note of r.notes) lines.push(`- Note: ${note}`);
    for (const finding of r.findings) lines.push(`- **Finding** ${finding}`);
    lines.push("", "| # | Event | Source | Trust | Detail |", "|---|---|---|---|---|");
    for (const e of r.events)
      lines.push(`| ${String(e.n)} | ${e.kind} | ${e.source} | ${e.trust} | ${e.detail} |`);
    lines.push("", "Checks:");
    for (const c of r.checks)
      lines.push(`- [${c.ok ? "x" : " "}] ${c.name}${c.ok ? "" : ` (${c.detail})`}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
