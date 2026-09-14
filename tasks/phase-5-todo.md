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

- [x] Task 4: RED evidence recorded **2026-09-14**; `docs/evidence/phase-5/red-evidence.json`.
  - Acceptance: each test fails for its stated reason first. A test that never failed for the right
    reason is not TDD evidence.
  - Result: **17 assertions, 17 failed for the declared reason, 0 for another, 0 that did not fail,
    0 criteria without a test.** The expected reason is `NOT_IMPLEMENTED`, declared before the run.
  - The pure core in `packages/domain/src/decision-notice.ts` exists with real types so tests fail on
    missing **behaviour** rather than a missing import — a suite that cannot resolve a module has not
    tested anything, and recording that as RED would be recording a typo.
  - The traceability guard joins criteria to tests: every ready criterion carrying behavioral
    evidence has a test named for it. 17 required, 17 present.
  - **The tree is red by design until Task 5.** `npm run verify` fails; exactly 17 failures, all in
    `decision-notice.unit.test.ts`, with 412 other tests passing.

- [x] Task 5: GREEN and REFACTOR. **First pass 2026-09-14 delivered the pure core only and was
      marked complete prematurely; completed 2026-09-14 in a later session with the component.**
      `docs/evidence/phase-5/green-evidence.md` records the first pass.
  - **Completion pass:** the Decision Notice component
    (`apps/web/src/decision-notice.tsx`, 571 lines), its fixture surface, 6 component tests covering
    twelve criteria, and 5 further core tests. Suite **489 passing, 3 skipped**, up from 429.
  - Every branch the Test Engineer's Task 6 pass named is now exercised: `stale-event`,
    `out-of-order-event`, the defer success path, and deferred → overdue. A successful deferral is
    tested. **C-08 now has a real static scan** asserting the component source cannot reach `Date`,
    `Math.random`, timers, `requestAnimationFrame`, `fetch`, `localStorage` or `sessionStorage`.
  - Verified on pickup rather than taken on trust: all twenty surface-contract states are represented
    in the component, and the fixture is clean under the same scan the component passes.
  - [ ] **Not yet re-assessed by the Test Engineer.** Task 6's verdict of 2 full / 13 partial /
        6 none predates all of this and is now stale.
  - All seventeen criteria-named tests pass on the first implementation pass; the tree is green
    again at **429 passing, 3 skipped**. Refactor extracted deferral validation with behaviour held.
  - Three mutations killed: undo erasing the action it reverses, every refusal collapsing to one
    code, and two statuses sharing a signature.
  - **Near-miss recorded:** re-running the RED capture after GREEN overwrote the RED evidence with a
    passing run. Recovered from the commit; the script now refuses to overwrite a recorded RED phase.

- [x] Task 6: Verification pass **authored by the promoted `test-engineer` agent, 2026-09-14**;
      `docs/evidence/phase-5/verification/verification.json`.
  - Accepted on the first turn, **2 of 60 spent**, and its coverage claims were cross-checked against
    what exists: **zero overclaims.** It did not mark a single criterion covered that nothing
    exercises.
  - **Verdict: 2 full, 13 partial, 6 none, of 21.** The honest reading is that Task 5 delivered the
    pure core only, and most of the contract is unverified until a component exists.
  - It found real gaps in our own tests, not only the missing component: C-08 has no static scan
    proving ambient time, randomness and timers are _unreachable_; C-04 never exercises a successful
    deferral; C-06 does not establish exact pre-event state preservation across all four rejection
    classes.
  - **Closes charter gap 8** with a six-step isolation procedure, a pass condition, and what a
    deliberate failure must produce. C-20 unblocks: **20 criteria ready, 1 blocked** on gap 3.
  - Its `notCovered` statement is the artifact the charter asked for, and it is blunt: the rendered
    component, keyboard and pointer semantics, storage reload, reduced motion, zoom, network and
    console cleanliness, provenance, and screen-reader use are all unverified.

- [x] Task 7: Visual QA capture at the approved viewports, annotated against the art-direction
      contract. **Verdict: NEEDS WORK.** `docs/evidence/phase-5/task-7-outcome.md`
  - Note: diffs detect change. They never approve taste.
  - 40 cells captured, every image byte-distinct; the isolation procedure runs end to end and its
    step 7 proves the detector fires on an injected forbidden request.
  - **All four findings ruled by the owner 2026-09-14 and implemented RED first**
    (`docs/evidence/phase-5/decision-record-2026-09-14-task-7-findings.md`): the over-length reason
    is rejected rather than truncated with a live count; `disabled` is renamed in the build; two
    contract names are amended by overlay; controls are disabled rather than removed; and the surface
    now owns every sentence a person hears. All twenty states reachable, fidelity check clean.
  - Sixteen of twenty states were returned `cannot-tell-without-seeing`. C-19 still needs the owner.
  - The NEEDS WORK verdict stands as the record of the build on the day it was annotated.

- [x] Task 8: Shared-knowledge contribution, retrieval and conflict-resolution scenario passing.
      `docs/evidence/phase-5/task-8-outcome.md`
  - Built from a disagreement that actually happened: the two Test Engineer passes reached different
    conclusions about C-06, C-12, C-14 and C-20, and the script discovers which rather than being
    told. Sources are digested, so a scenario built from superseded inputs fails.
  - `packages/domain/src/knowledge-retrieval.ts` is new — the contribution half of MDD §15 existed;
    retrieval and conflict surfacing did not. Seven mutants, all killed.
  - **Promotion alone never settles a dispute**, a synthesis never competes as a claim, and stale is
    returned labelled rather than withheld. Only rejected and superseded are withheld, both reported.
  - `npm run test:knowledge` is part of `npm run verify`. No agent turns spent; ledger stays 4 of 60.

- [ ] Task 9: Release Reviewer verdict — NEEDS WORK or eligible-for-owner-approval.
  - Acceptance: **the reviewer is not the implementer**, and a green suite alone is not a verdict.

- [ ] Task 10: **Owner acceptance. Owner-run.** Accept the fixture outcome or record bounded
      revisions. Atomically creates the D-24 review that Phase 8 closes.

- [ ] Phase 5 gate: all required evidence classes exist and remain distinct; the shared-knowledge
      scenario passes; manager approval references exact artifact and evidence versions; the owner
      explicitly accepts. **Phase 7 and any production reuse remain separately gated.**
