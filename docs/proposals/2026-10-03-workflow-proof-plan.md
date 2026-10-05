# Workflow-proof plan — v0.3 APPROVED (2026-10-04)

**Status: amended and approved by the owner 2026-10-04. Surface B is primary; W7 is top priority and authorized now without the Task 6 gate. W8 is shelved. W0–W6 and W9–W11 stand as built; no live run, promotion, push or external effect is authorized.**
Implements `docs/proposals/2026-10-03-workflow-proof-spec.md` v1.1. The owner's 2026-10-04 ruling approves the Surface B amendment and `tasks/workflow-proof-w7-todo.md`.

Facts were read from the repo on 2026-10-03 (read-only). **[unverified]** marks anything not read or tested. **[OWNER]** marks a ruling needed.

## 1. Ground truth this plan builds on

- Domain has work events and a reducer. Application has attention, kickoff, and open-question commands, but **no create or assign work command**.
- The web shell renders from fixtures. The loopback server (`apps/server/src/loopback-session.ts`) is seeded with a `readModel` and an `eventHistory` option and validates commands; it has no live ingestion path. A runner-fed view therefore needs a data path (task W5).
- The office read model **refuses** auxiliary records that supply state, a condition, a blocker, an approval, evidence, attention, or a requested action; auxiliary records may supply runtime binding and permissions only. Posture must fit that channel or the read model needs a ruled extension (W6).
- The tracer runner (`scripts/run-tracer-attempt.ts`) already reads posture back and judges turns with `judgeTracerTurn`. `mergeTurnItems` exists in `scripts/tracer-guards.ts`. The working tree has **uncommitted** changes to `turn-runner.ts`, `turn-runner.unit.test.ts`, `run-tracer-attempt.ts`, `tracer-guards.ts`, its test, and the dogfood register. I have not read those diffs. Whether they already address DF-044 is **[unverified]**; W0 settles it.

## 2. Entry conditions and branch **[OWNER]**

1. **Task 6 gate.** The spec said Task 6's owner gate comes first. Tasks W1 to W5 touch no UI. Do they start now, or after Task 6 is resolved? W6 to W9 touch the web app and should wait either way.
2. **Isolation.** Proposed: branch `workflow-proof` in worktree `.worktrees/workflow-proof` (the `codex-currency` precedent), so Phase 7 keeps the main working copy. Needs your approval before creation.
3. **Clean base.** The existing uncommitted changes must be committed, stashed, or ruled out of scope by you before the branch is cut. I will not touch them.

## 3. Test discipline (applies to every task)

RED–GREEN–REFACTOR per AGENTS.md. Each new function or parameter lands as a deliberate stub first, so the first failure is an assertion, not a parse error. The agent session cannot run `tsc`, so **the owner runs the focused test (RED, then GREEN) and a full `npm run verify` after any contract change**. Builds, unit tests, DOM snapshots and state probes are not visual proof: W7 and W8 need a directly exercised viewport check, recorded with severities per MDD 1133–1140. Contract changes require a full verify and a provenance check (`phase5:provenance`).

## 4. Tasks

Each task: scope, tests that must fail first, files likely touched, done-when. Sizes are not estimated. Dependencies are listed.

**W0. Baseline read (read-only, no code).**
Read the uncommitted diffs; list what each changes; map which of DF-043 to DF-046 they touch; confirm whether `mergeTurnItems` already makes the turn judge read the complete stream. Read `work.created` payload handling in `work-truth.ts` and `events.ts`, and the persistence package's event append path. Output: a short findings note and corrected assumptions for W1 to W5.
Done when: the owner has read the note. Gate: owner.

**W1. Posture record: requested, granted, declared (spec §4, invariant 1).**
A contract type holding the three layers, plus a pure function that compares requested to granted and returns a refusal naming the first differing field, and a pure function that derives declared read/write/run capability from the granted posture and `FEATURE_POLICY`.
RED first: granted ≠ requested yields refusal naming the field; declared capability for the tracer posture reports "write: yes, read: no, run: no" (the DF-046 state) and for a read-capable posture reports read: yes.
Touches (likely): `packages/contracts` (type), `packages/runtime-codex` (derive, uses `feature-policy.ts`), reuse `checkObservedPosture`. Contract change → full verify.
Depends on W0.

**W2. Complete turn accounting (DF-044; invariants 3 and 4).**
A turn summary built from the full notification stream (`item/started`, `item/completed`) rather than `turn/completed` alone, carrying a `partial` flag when the sources disagree.
RED first: a fixture with a streamed `fileChange` absent from `turn/completed` is counted; a record missing a streamed item is marked partial.
Touches (likely): `packages/runtime-codex/src/turn-runner.ts` and its test, `scripts/tracer-guards.ts`. Overlaps the uncommitted work; scope is set after W0.
Depends on W0.

**W3. Work contract and commands (P-1).**
`createWorkItem` from a D-26 contract (outcome, exclusions, acceptance criteria, dependencies, evidence obligations, permission ceiling, stop conditions, definition of done) and `assignWorkItem`. Follow the `executeAttentionCommand` shape (revision check, freshness, receipt, correlation id) and the `validateWorkAssignmentPayload` style.
RED first: an incomplete contract is refused naming the missing field; a stale revision is refused; assigning a work item that does not exist is refused; a valid create then assign reduces to state `assigned` through `reduceWorkTruth`.
Touches (likely): `packages/contracts` (a contract payload and its validator), `packages/application` (two command modules, `index.ts` export), tests. Contract change → full verify. Whether `work.created` can carry the D-26 fields without a schema change is **[unverified]** (W0).
Depends on W0.

**W4. Completion gate (invariants 2, 5, 6).**
Pure rules: a role that cannot read a required file that is not inlined yields `blocked` before turn 1; `done` requires inspectable artifacts and a verified check, not the role's claim; replay, worktree diff, and displayed status must agree, and a mismatch is a hard stop.
RED first: each rule against a stub that returns the permissive answer.
Touches (likely): `packages/domain` or `packages/application` (rules), runtime-codex (preflight hook). Depends on W1, W2, W3.

**W5. Runner-to-canonical bridge and data path (P-2).**
The runner emits canonical records per turn (posture, item types, file changes, partial flag) and work transitions driven by W4, not by `TRACER_RESULT`. Data path **[OWNER]**: write an append-only event log (JSONL) that the loopback server reads into its existing `eventHistory` option. This reuses what the server already accepts and adds no network surface. Alternative: a push endpoint on the server (more moving parts, a new attack surface; not recommended).
RED first: replaying the log reproduces the same reduced state as the in-memory run; a truncated log is reported partial.
Touches (likely): `scripts/run-tracer-attempt.ts` or a successor script, `apps/server` (read side). Depends on W2, W3, W4.

**W6. Read-model support for posture and evidence.**
Surface posture and evidence for a work item through the existing read model. The read model refuses state-bearing auxiliary records, so this is either (a) posture enters as runtime binding/permissions auxiliary, which fits the stated channel but may not carry three layers, or (b) a ruled extension to the read model. **[OWNER]** ruling after W0/W1 show what fits.
RED first: posture layers appear side by side in the projection; a record trying to supply state is still refused.
Touches (likely): `packages/application/src/office-read-model.ts`. Depends on W1, W5.

**W7. Surface B: primary list view (P-3).**
The default route in `apps/web` is Surface B. One row per work item shows assignee, state, posture
history, recent activity, diff/check/evidence details, and actions. Create, assign, record evidence,
and request review use `/api/commands` → `toWorkCommand` → `executeWorkCommand`; state is replayed
from the single event log with `replayProject` and projected through W6. An assigned row can start
the existing runner through a loopback endpoint whose worktree, model, reasoning effort, context
paths, and opt-in are server-owned configuration. The browser can send only a work item id. The
server blocks log reads and writes while the runner owns the log lock. No live run is started for
W7 implementation or verification.

RED first: no office/isometric imports; partial records are called partial; create, assign, evidence,
and review all use the shared command route; execute rejects invalid authorization, an unassigned
item, a duplicate start, or unavailable runner configuration. An injected fake runner verifies the
lock handoff and busy-state guards without opening a provider session.
Viewport, console/network, keyboard, and reduced-motion checks required (§3). Depends on W3/W6, not
the Task 6 gate.

**W8. Surface A: office affordance — shelved by owner 2026-10-04.** Preserve the approved W8
proposal and history. No further office-surface work until the owner reopens it. This does not remove
or rewrite the office implementation.

**W9. Parity test (invariant 7).**
For one canonical state, both surfaces show identical posture, status, and evidence values. Depends on W7, W8.

**W10. Fake-runtime rehearsal.**
Run the whole loop against a fake runtime before any live turn, following `kickoff-rehearsal.integration.test.ts`: create, assign, blocked-before-turn-1, partial record, done-without-evidence refused, clarification path with the seeded ambiguity. Depends on W1 to W9. **Gate: owner reviews rehearsal output before live runs.**

## 5. Live runs and gate (separate approvals)

**W11. Scratch repo and contract.** Build the disposable scratch repo (one function, one pre-written test, one seeded ambiguity) and the confirmed task's D-26 contract. Owner approves the contract text.

**W12. Live run from Surface B [OWNER].** A qualifying real work session is create → assign →
execute → evidence → review, all driven from Surface B. Assignment must happen there. Same bounded
contract, one disposable worktree, no secrets, no network. 10 turns per attempt, up to 10 attempts
(ceiling 100 turns). Owner review between attempts; no auto-retry. Hard stops per spec §8. Each
attempt records posture, event stream, diff, checks, blocker handling, manager action, and
disposition. W7's execute affordance is tested with a fake runner only; this separately gated owner
run remains unperformed. Keep the adopted stop rule: stop after two consecutive attempts fail for the
same recorded reason.

**W13. Comprehension gate.** MDD §20 as written, targeting Surface B. Carry over the existing
proposal, answer key, and evaluator plan; change only the target surface. Cold run after at least
three days since the last substantive Surface B work; performed/not-performed recorded per task;
6/6 met, 5/6 met with a finding, 4 or fewer fails; incomplete runs are not scored. The prior office
run is not a Surface B result.

**W14. Decision.** Apply spec §10. Record DF entries for every friction encountered. Update HANDOFF and the position record.

## 6. Dependencies at a glance

W0 → W1, W2, W3 → W4 → W5 → W6 → W7 → W9; W8 remains shelved; W1–W9 → W10 → (owner gate) → W11 → W12 → W13 → W14.
W7 does not wait on the Task 6 office gate. W12 remains owner-run and separately gated.

## 7. Risks

- **Uncommitted overlap.** W2 may duplicate or conflict with the uncommitted turn-runner work. W0 comes first for that reason.
- **Read-model constraint.** The read model's fail-closed auxiliary rule may force a read-model change that touches Phase 7-O contracts, which means a full verify and provenance impact.
- **Data path.** The server has no live ingestion. The file-log approach is the smallest change but makes the view refresh-based; confirm that is acceptable for a comprehension run.
- **R-1 limit.** Declared capability reports policy intent. A role can still fail to act on inlined content; the first live turn is the first test.
- **Budget size.** 200 turns across both surfaces is large relative to the 10-turn tracer. The stop rule in W12 is there to keep the ceiling from becoming the default.
- **Runner handoff.** Surface B releases and reacquires the single-writer lock around a trusted child
  runner. Failure to acquire or reacquire remains visible and fail-closed; raw runner output is not
  returned to the browser.
- **Environment.** The agent session cannot run `tsc` or the Windows toolchain; every RED/GREEN and verify run is owner-run, which sets the pace.

## 8. Not in this plan

Phase 7 rendering, the Claude adapter, second vendor, multi-agent teams, enabling a read path (R-2), a one-turn read probe, or market research.

## 9. Decisions requested

1. Approve the plan, or amend it.
2. Entry condition 1: do W1 to W5 start before the Task 6 gate resolves?
3. Branch and worktree: approve `workflow-proof` in `.worktrees/workflow-proof`, and say what happens to the existing uncommitted changes.
4. Data path (W5): file log, or a different approach.
5. The W12 stop rule: adopt, amend, or drop.
