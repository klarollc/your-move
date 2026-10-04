# Workflow-proof spec — v1.0 APPROVED (2026-10-03)

**Status: APPROVED by the owner 2026-10-03. This approves the spec only. It authorizes no implementation, no live run, and no spend; the plan and then the tasks need their own approvals (AGENTS.md).**

Governance order: spec → plan → tasks, each approved separately (AGENTS.md). This document is the spec only. Facts were read from the repo on 2026-10-03 (read-only). Items marked **[inferred]** or **[unverified]** were not tested. Items marked **[OWNER]** need a ruling.

Supersedes the project-side draft v0.1. Changes from v0.1: rulings applied; §6 rests on a read of the application layer. Changes from v0.2: turn-budget unit and Surface B scope ruled. Changes from v0.3: attempts per surface ruled and the spec approved; §11 closed.

## 0. Owner rulings recorded 2026-10-03

1. **Read access: R-1 approved as recommended.** Declare capabilities from policy and inline the files the role needs in the work contract. No sandbox or feature-policy change.
2. **Proof task: the candidate in §5 is confirmed.**
3. **Turn budget: 10 turns per attempt, up to 10 attempts per surface** (owner rulings 2026-10-03). Ceiling 100 turns per surface, 200 across both. A ceiling, not a target: owner review between attempts, no auto-retry.
4. **Surface B scope: P-1 to P-4 approved as proposed** (§6). Approval is of scope only; sizing and task breakdown come in the plan.
5. **Market-research clause dropped** from the decision rule (§10).
6. **Location: `docs/proposals/`.** This file.

## 1. Question this proof answers

Can a manager direct one bounded task to a live agent and know, from evidence rather than the agent's claim, what the agent could do, what it did, and whether it is done?

Pass requires all of: (a) the agent comes online through a defined launch path with its actual capabilities shown, (b) assignment happens from a surface rather than a script, (c) the completion record is complete or says it is partial, (d) acceptance rests on inspectable evidence. A failed proof is a valid result and is recorded as DF entries.

This spec does not test the office metaphor. It builds the workflow so that two surfaces can be tested on top of it (§6).

## 2. Baseline (what is known)

- A Codex launch path exists: `scripts/run-tracer-attempt.ts` and the role-exercise scripts, using `packages/runtime-codex`, pinned `@openai/codex` 0.157.1, owner-launched on Windows. Session logs show agents starting, receiving messages, and returning agent messages and completed items.
- The launch path reads the sandbox posture back from `thread/start` and refuses on a mismatch. That check caught DF-043 (requested `workspace-write`, runtime reported `readOnly` with no cause). `windows.sandbox = unelevated` produced `workspaceWrite` in probes. Whether edits actually succeed under it is **[unverified]**.
- The office and web app have no dependency on `runtime-codex`. Only scripts bring agents online (DF-042: assignment is off-office).
- Passes 6–9 of the C-17 review refresh failed on the first turn. DF-025 is marked fixed (attempt records, turn runner, one retry), but HANDOFF states the cause stays unknown.
- DF-044: `turn/completed` omitted a streamed `fileChange`; a control built on it was blind. DF-045: a role declared done while unable to ground its work. DF-046: the scoped-edit posture leaves no way to read; the likely cause is `shell_tool`/`unified_exec` disabled by `feature-policy.ts` **[inferred, untested]**.
- Only Codex is supported. The runtime boundary is deliberately undefined (decided 2026-09-08).
- Work state in the domain: events `work.created`, `work.assigned`, `work.transitioned`, `work.released` exist in `packages/contracts/src/events.ts`; `reduceWorkTruth` in `packages/domain/src/work-truth.ts` reduces them; `validateWorkAssignmentPayload` exists in contracts. Work states: draft, ready, assigned, active, review_requested, verified, completed, waiting_input, blocked, failed, paused, cancelled.
- In the application layer, command modules exist for attention (approve, decline, defer, cancel, redirect), kickoff, and open questions. **No command creates or assigns a work item.** Producers of `work.created` and `work.assigned` found in the tree are tests, the simulator, and web fixtures. This is the code-level form of DF-042.

## 3. Scope and exclusions

In scope: one launch path with a capability readback, a surface-agnostic workflow API (create and assign a work item, show posture, show events and diff, accept, redirect, stop), deterministic control tests, one live run per surface.

Out of scope: Phase 7 art and rendering, the Claude adapter, a second vendor, multi-agent teams, MDD amendments, market research, and any change to the Phase 7 Task 6/7 gates.

## 4. Section A — Bring-online path (first workstream)

Three layers are reported separately and never merged:

1. **Requested posture:** sandbox mode, approval policy, network, model, feature set.
2. **Granted posture:** read back from `thread/start`. Any difference from requested is a refusal that names the field; it is never a silent downgrade.
3. **Observed capability:** what the role can read, write, and run. This is the layer DF-043 and DF-046 show is missing. "No commands" and "no way to read" are different postures.

Preflight (all must pass before any turn): drift check green (no provider call), clean linked disposable worktree, granted equals requested, capability declaration complete. If the role cannot read what it must change and the contract has not inlined it, the run stops before turn 1.

**Ruled (R-1):** capabilities are derived from the granted posture plus `feature-policy.ts` (declared, costing no turns), and the files the role needs are inlined in the work contract as a context packet. The sandbox and feature policy are unchanged. Consequence stated plainly: the declaration reports the policy's intent, not what the runtime does. The role may still be unable to act on inlined content, and the first live turn is the first test of that. Enabling a read path (R-2) and a one-turn read probe remain unauthorized and need their own ruling and budget.

Role self-report: at task start the role states what it can and cannot see or do. `blocked` and "cannot verify" are structured end states alongside `done`. The self-report is advisory; the readback is authoritative.

## 5. Section B — Bounded work contract for the proof task (D-26 fields)

**Confirmed task:** in a disposable scratch repo, implement one small function so one pre-written test passes. The contract seeds one deliberate ambiguity so the clarify/blocker path is exercised. This is not the DF-007 test; the tracer remains a separate study.

- **Outcome:** the named function behaves per the test; nothing else changed.
- **Exclusions:** no other files, no new dependencies, no commands, no network, no changes outside the scratch worktree.
- **Acceptance criteria:** the test is green when run by the owner between turns; the diff touches only the named files; every claimed change appears in the event stream and in `git status`.
- **Dependencies:** pinned Codex, a linked clean scratch worktree, an owner-started runner.
- **Evidence obligations:** RED then GREEN, owner-run; per-turn item types, file changes, and `git status`; a hashed transcript; a requested/granted/declared posture record.
- **Permission ceiling:** the granted posture as in §4, read back and refused on mismatch. No secrets, no network, no push, no promotion.
- **Stop conditions:** posture mismatch; any effect outside the ceiling; event stream and worktree disagree; the role reports blocked; turn cap; any unanticipated failure. On stop: halt, record, escalate.
- **Definition of done:** owner acceptance through the surface under test, based on evidence shown there, not on the role's claim.
- **Turn budget:** 10 turns per attempt, up to 10 attempts per surface (owner rulings). Separate from the tracer allowance. Ceiling 100 turns per surface.

## 6. Section C — One workflow core, two surfaces

### What exists and what does not
Exists: work events, reducer, assignment payload validator, office read model, attention commands (which already cover approve, decline, defer, cancel, redirect), and a web app that depends only on application, contracts, domain, and ui-system.
Does not exist: a command to create a work item from a contract, a command to assign it, a bridge from runner output to work events, and a canonical place for the posture record.

### Surface B scope (P-1 to P-4 approved 2026-10-03)
**P-1. Shared work commands in `packages/application`.** Add `createWorkItem` (from a D-26 contract) and `assignWorkItem`, following the shape of `executeAttentionCommand` (revision check, receipt, correlation id). Both surfaces call these; neither holds workflow logic. This also closes DF-042's code-level gap for both surfaces.

**P-2. Runner-to-canonical bridge.** The launch script emits, per turn, canonical records from the complete event stream: posture (requested, granted, declared), item types, file changes, and a flag when the turn record is partial. Work transitions are driven from these, not from the role's `TRACER_RESULT` line.

**P-3. Surface B = a plain list view in `apps/web`, reachable by a separate route.** One row per work item: assignee, state, requested/granted/declared posture side by side, last event, diff and check results, evidence link, and actions (accept, redirect, stop via the existing attention commands, plus create and assign via P-1). It reads `projectOfficeReadModel`. It must not import the office canvas, scene adapter, or isometric primitives. A boundary test enforces that, so the comparison against the office stays fair.

**P-4. Surface A (office) gets only what the proof needs:** a create/assign affordance calling P-1, and the same posture side-by-side display. No visual work. Phase 7 and Task 6/7 stay as they are.

Why this shape: it is the smallest change that makes both surfaces operate on identical canonical state. It reuses the existing command pattern and read model rather than inventing new ones. Alternatives I rejected: a separate app (duplicates build tooling and invites drift), and a CLI-only Surface B (it cannot be compared in a comprehension gate because there is no visual surface to read).

Risks: the read model may not carry posture or evidence fields without extension **[unverified]**; the web app currently runs on fixtures, so a live-fed view needs a data path **[unverified]**, and loopback session behaviour was not read; `UI work` is under the owner's UI-priority preference, so P-3 and P-4 compete with Task 6/7 for attention.

Size is not estimated here. The plan will break P-1 to P-4 into tasks after this spec is approved.

## 7. Section D — Control invariants (deterministic tests, RED–GREEN–REFACTOR)

Each is first written against a deliberate stub so the first failure is an assertion.

1. Granted ≠ requested → launch refused, naming the field.
2. The role cannot read a file the contract requires and it is not inlined → blocked before turn 1, never "done".
3. A streamed `fileChange` absent from `turn/completed` is still counted; the control reads the complete stream.
4. A partial event record is displayed as partial.
5. "Done" requires inspectable artifacts and a verified check; the role's claim alone is rejected.
6. Event replay, worktree diff, and displayed status must agree; a mismatch is a hard stop.
7. Both surfaces render identical posture, status, and evidence for the same canonical state.
8. Surface B imports nothing from the office canvas, scene adapter, or isometric primitives.

Rehearse against a fake runtime before any live turn (HANDOFF lesson; `kickoff-rehearsal.integration.test.ts` is the pattern).

## 8. Section E — Live runs

One manager (the owner), one agent, one disposable worktree per surface, the same task contract for each, no secrets, no network. Capture the assignment, posture record, event stream, diff, checks, blocker handling, manager action, and final disposition. A mismatch, an untracked change, or an unsupported completion claim is a hard stop. The owner reviews between attempts; no auto-retry.

## 9. Section F — Comprehension gate

MDD §20 applies as written (verified text, lines ~1273–1300):

- single operator; cold run after a gap of at least three days from the last substantive interface work; a run inside that window is void;
- six of six is met; five of six is met with a named finding; four or fewer does not pass;
- a criterion passes only if correct and not answered from memory of building the interface;
- each task is recorded performed or not performed; unperformed is never a failure, and a run with any unperformed criterion is incomplete, not a score.

The 2026-10-02 run's 1/6 should be re-read against the last two rules before it is cited as a score. This spec does not re-adjudicate it. The gate runs on both surfaces with a new protocol and key.

## 10. Decision rule

- Workflow safe and truthful, office fails comprehension, simple surface passes: pivot the primary surface; keep the workflow.
- The office still fails after one focused revision: stop investing in the office-first thesis.
- The workflow cannot be made safe and truthful: the runtime path is the problem, not the interface; fix or replace it before any surface decision.
- The earlier recommendation's market-research clause is dropped (owner ruling 2026-10-03; CuckCode is a personal tool, n=1).

## 11. Open items

None. Rulings 1 to 6 and spec approval are recorded in §0 and the status line.

## 12. Not done

No code, tests, live runs, or repo changes beyond adding this file. The working tree already carries uncommitted changes (dogfood register, turn runner, tracer scripts); this file is untracked and uncommitted. DF-046's severity and D-26 clause remain owner-pending.
