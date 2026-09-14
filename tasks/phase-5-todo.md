# Phase 5 checklist: controlled six-role acceptance project

Status: **PROPOSED, NOT APPROVED. No task below is authorized and nothing has been implemented.**
Plan: `tasks/phase-5-plan.md`
Input: the owner-approved charter from the Task 17 round
Governing: MDD §24 Phase 5, D-23 representative assignment, D-24 fixture isolation

Read each entry's own status line. Nothing here inherits authorization from any Phase 4 or Phase 6
approval.

## Blocking decisions

- [ ] **Phase 5 authorization.** `AGENTS.md` lists Phase 5 behaviour as unauthorized. An explicit
      owner ruling and an amendment to that document are required before Task 1.
- [ ] **Manager charter.** The Task 17 round ended at `phase: revision` with
      `implementationAllowed: false`. No charter exists until the owner approves one.
- [ ] **5-A — who implements.** Agents, human-driven, or hybrid. Changes the budget, the cost, the
      evidence provenance, and what the phase proves.
- [ ] **5-B — turn and cost budget.** Phase 5 has no D-25 cap. Set before the first provider call.
- [ ] **5-C — the ten evidence gaps** the agents named. Each is a place a passing test would prove
      nothing.
- [ ] **5-D — MDD §19/§20.** Waived in Phase 4 and still unmet. Inherit, repeat properly, or record
      the debt again.

## Tasks

- [ ] Task 1: Record the approved charter, versioned, with a disposition for each of the ten gaps.
  - Acceptance: no implementation may begin before this record exists.
  - Verify: charter record test; `implementationAllowed` cannot be true without it.

- [ ] Task 2: Freeze the acceptance contract as machine-checkable criteria.
  - Acceptance: every criterion carries its evidence class; no criterion without one.
  - Verify: criterion-to-evidence traceability matrix.

- [ ] Task 3: Product Designer surface contract, owner-accepted before implementation.
  - Acceptance: interaction and art-direction contract against the Active visual system.

- [ ] Task 4: RED evidence for every criterion.
  - Acceptance: each test fails for its stated reason first. A test that never failed for the right
    reason is not TDD evidence.

- [ ] Task 5: GREEN, then REFACTOR with behaviour held.

- [ ] Task 6: Test Engineer verification — deterministic browser and failure evidence, negative
      paths, and an explicit statement of what is not covered.

- [ ] Task 7: Visual QA capture at the approved viewports, annotated against the art-direction
      contract.
  - Note: diffs detect change. They never approve taste.

- [ ] Task 8: Shared-knowledge contribution, retrieval and conflict-resolution scenario passing.

- [ ] Task 9: Release Reviewer verdict — NEEDS WORK or eligible-for-owner-approval.
  - Acceptance: **the reviewer is not the implementer**, and a green suite alone is not a verdict.

- [ ] Task 10: **Owner acceptance. Owner-run.** Accept the fixture outcome or record bounded
      revisions. Atomically creates the D-24 review that Phase 8 closes.

- [ ] Phase 5 gate: all required evidence classes exist and remain distinct; the shared-knowledge
      scenario passes; manager approval references exact artifact and evidence versions; the owner
      explicitly accepts. **Phase 7 and any production reuse remain separately gated.**
