# Phase 5 checklist: controlled six-role acceptance project

Status: **Owner-authorized 2026-09-14.** Charter approved with the ten gaps blocking; Decisions 5-A, 5-B, 5-C and 5-D ruled. Tasks 1-9 are authorized; Task 10 is owner-run. Nothing has been implemented.
Plan: `tasks/phase-5-plan.md`
Input: the owner-approved charter from the Task 17 round
Governing: MDD §24 Phase 5, D-23 representative assignment, D-24 fixture isolation

Read each entry's own status line. Nothing here inherits authorization from any Phase 4 or Phase 6
approval.

## Blocking decisions

- [x] **Phase 5 authorized 2026-09-14**; `AGENTS.md` amended the same day.
- [x] **Manager charter approved 2026-09-14** with the ten gaps as blocking conditions:
      `docs/evidence/phase-5/approved-charter-v1.md`.
- [x] **5-A — hybrid.** Agents own design, review and verdict; implementation is driven
      conventionally. A recorded departure from the literal MDD §24 run: Phase 5 will not prove the
      agents can write code, and the packet must say so.
- [x] **5-B — 60 turns.** The run stops at the budget and reports what was reached.
- [x] **5-C — all ten dispositioned** in the charter. Four were owner rulings; six are answered from
      already-approved documents and are marked as such rather than as fresh rulings.
- [x] **5-D — repeat the gate properly.** One screen reader, one walkthrough genuinely performed.

## Tasks

- [ ] Task 1: Record the approved charter, versioned, with a disposition for each of the ten gaps.
  - Acceptance: no implementation may begin before this record exists.
  - Verify: charter record test; `implementationAllowed` cannot be true without it.

- [x] Task 2: Acceptance contract frozen **2026-09-14**;
      `docs/evidence/phase-5/acceptance-contract.json`.
  - Acceptance: every criterion carries its evidence class; no criterion without one.
  - Verify: criterion-to-evidence traceability matrix.
  - Result: **21 criteria, 18 ready, 3 blocked** on the gaps dispositioned as work rather than
    answers (3 provenance, 7 art direction, 8 isolation procedure). All eleven MDD contract bullets
    covered; the bullets are read from the MDD at build time rather than copied, so the completeness
    check cannot verify a copy against itself. Ten machine checks, three mutations killed: dropping a
    bullet's coverage, letting an art-direction criterion be satisfied by rendered evidence alone,
    and marking a gap-blocked criterion ready. Rebuild: `npm run phase5:contract:build`.
  - Satisfies the Test Engineer's charter amendment: the matrix is the criterion-to-test traceability
    record, and no criterion exists without a named evidence class.

- [x] Task 3: Surface contract **authored by the promoted `product-designer` agent, 2026-09-14**;
      `docs/evidence/phase-5/surface-contract/surface-contract.json`.
  - Acceptance: interaction and art-direction contract against the Active visual system.
  - Result: accepted on the **first turn, 1 of 60 spent**, zero shortfalls. Six required sections and
    all twenty required states, each with a text label, an icon and a disclosure — three channels, so
    nothing depends on colour. It independently enforced the reserved-accent rule, stating severity
    "must never use the reserved amber accent". The required states are derived from the Task 2
    criteria rather than hand-listed, so the checklist cannot drift from the contract it checks.
  - **Closes charter gap 7**, which unblocks C-19: 19 criteria ready, 2 still blocked on gaps 3 and 8.
  - [ ] **Owner acceptance of fidelity is still outstanding.** The record is Candidate; only the owner
        accepts art direction, and C-19 requires current-build captures that do not exist yet.

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
