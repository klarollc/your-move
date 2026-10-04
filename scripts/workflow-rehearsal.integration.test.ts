import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  REHEARSAL_SCENARIO_IDS,
  renderRehearsal,
  runRehearsal,
  type RehearsalResult,
} from "./workflow-rehearsal-core.js";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cuckcode-rehearsal-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const byId = (results: readonly RehearsalResult[], id: string): RehearsalResult => {
  const found = results.find((r) => r.id === id);
  if (!found) throw new Error(`missing scenario ${id}`);
  return found;
};

describe("workflow rehearsal against a fake runtime (W10)", () => {
  it("runs every planned scenario and every check passes", async () => {
    const results = await runRehearsal(dir);
    expect(results.map((r) => r.id)).toEqual([...REHEARSAL_SCENARIO_IDS]);
    for (const result of results) {
      const failed = result.checks.filter((c) => !c.ok);
      expect(failed, `${result.id}: ${JSON.stringify(failed)}`).toEqual([]);
      expect(result.checks.length, result.id).toBeGreaterThan(0);
      expect(result.replayIssues, result.id).toEqual([]);
    }
  });

  it("blocks before turn 1 when a needed file is unreadable and not inlined, and runs no turn", async () => {
    const r = byId(await runRehearsal(dir), "blocked-before-turn-1");
    expect(r.outcome).toBe("blocked_before_turn");
    expect(r.turnsRun).toBe(0);
    expect(r.finalState).toBe("blocked");
    expect(r.runtimeTurnCalls).toBe(0);
  });

  it("records a partial turn record as failed evidence, never as clean", async () => {
    const r = byId(await runRehearsal(dir), "partial-record-and-unsupported-claim");
    expect(r.evidence.filter((e) => e.kind === "turn-record").map((e) => e.result)).toEqual([
      "failed",
      "passed",
    ]);
  });

  it("refuses a done claim with no verified evidence and leaves the item active", async () => {
    const r = byId(await runRehearsal(dir), "partial-record-and-unsupported-claim");
    expect(r.outcome).toBe("claim_unsupported");
    expect(r.finalState).toBe("active");
    expect(r.evidence.find((e) => e.kind === "done-claim")).toMatchObject({
      result: "failed",
      trust: "reported",
    });
  });

  it("turns the seeded ambiguity into a question for the manager, not a failure", async () => {
    const r = byId(await runRehearsal(dir), "clarification-path");
    expect(r.outcome).toBe("role_blocked");
    expect(r.finalState).toBe("blocked");
    expect(r.condition).toMatchObject({
      reasonCode: "awaiting_clarification",
      waitingOn: { kind: "manager" },
      requestedAction: { kind: "answer_question" },
    });
  });

  it("hard-stops when the stream and the worktree disagree", async () => {
    const r = byId(await runRehearsal(dir), "hard-stop-stream-worktree-disagree");
    expect(r.outcome).toBe("hard_stop");
    expect(r.finalState).toBe("blocked");
  });

  it("records a failed posture and blocks when the granted sandbox differs from the request", async () => {
    const r = byId(await runRehearsal(dir), "posture-mismatch");
    expect(r.outcome).toBe("blocked_before_turn");
    expect(r.postures).toHaveLength(1);
    expect(r.postures[0]?.match).toBe(false);
    expect(r.runtimeTurnCalls).toBe(0);
  });

  it("halts and records the reason at the turn cap and on a runtime failure", async () => {
    const results = await runRehearsal(dir);
    expect(byId(results, "turn-cap").outcome).toBe("turn_cap");
    expect(byId(results, "runtime-failure").outcome).toBe("runtime_failure");
    for (const id of ["turn-cap", "runtime-failure"]) {
      const r = byId(results, id);
      expect(r.finalState).toBe("blocked");
      expect(r.evidence.map((e) => e.kind)).toContain("run-halt");
    }
  });

  it("supports a done claim only through owner-recorded verified evidence, then allows a review request", async () => {
    const r = byId(await runRehearsal(dir), "owner-evidence-after-claim");
    expect(r.ownerEvidence).toEqual([
      { result: "failed", doneSupported: false },
      { result: "passed", doneSupported: true },
    ]);
    // F-1, resolved by W5h: a review is refused until the evidence supports the claim, then taken.
    expect(r.reviewRequests).toEqual([
      { ok: false, code: "DONE_NOT_SUPPORTED" },
      { ok: false, code: "DONE_NOT_SUPPORTED" },
      { ok: true },
    ]);
    expect(r.finalState).toBe("review_requested");
    expect(r.findings.join(" ")).toContain("F-1 (resolved by W5h)");
  });

  it("renders a deterministic transcript with no temp paths", async () => {
    const first = renderRehearsal(await runRehearsal(dir));
    const second = renderRehearsal(await runRehearsal(dir));
    expect(first).toBe(second);
    expect(first).toContain("# Workflow rehearsal");
    for (const id of REHEARSAL_SCENARIO_IDS) expect(first).toContain(id);
    expect(first).not.toContain(dir);
    expect(first).not.toMatch(/cuckcode-rehearsal/u);
  });
});
