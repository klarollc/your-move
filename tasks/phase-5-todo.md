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
  - [x] **Owner accepted fidelity 2026-09-14** after looking at the forty plates on the contact
        sheet: `docs/evidence/phase-5/c-19-owner-acceptance.json`. Whole-inventory acceptance, no
        exceptions. Per-state marks live in the viewer's browser and were not supplied, so none are
        claimed. Every plate was verified against its manifest digest before the ruling was filed.

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

- [x] Task 9: Release Reviewer verdict — **NEEDS WORK**, 11 of 21 criteria satisfied, zero
      overclaims, eight artifact versions cited. `docs/evidence/phase-5/task-9-outcome.md`
  - Acceptance: **the reviewer is not the implementer**, and a green suite alone is not a verdict.
  - Outstanding per the verdict: C-05, C-08, C-09, C-10, C-11, C-15, C-17, C-18, C-19, C-20.
  - Sharpest objections: a halved viewport is not 200% browser zoom; C-08 has no two-run
    byte-identical artifact; C-15 never establishes stored dates are ISO-8601 UTC; five journeys are
    not every journey.
  - Three passes were run. The first reported 4 of 21 and the third 11 of 21 on an unchanged
    implementation — the difference was entirely brief accuracy. **DF-015.**

- [x] Task 9 remediation: the seven ordinary-work items ruled on 2026-09-14
      (`docs/evidence/phase-5/decision-record-2026-09-14-task-9-remediation.md`), all built RED first.
  - **9-F** C-15: `storedDateViolations` checks every date a state persists, as stored not rendered.
  - **9-D** C-10: `surface-contract/focus-contract.json` declares all nine destinations and the tests
    read it; reload had no implementation at all and left focus on the document body.
  - **9-A** C-05: `parsePersistedState` refuses a corrupt payload by named reason and the component
    says so out loud; the storage scan now names every browser persistence API, not two.
  - **9-E** C-11: captures moved to the production bundle on 4174. Requests per journey fell from 95
    to 11, and the panel is now something a person can read.
  - **9-G** C-20: `surface-contract/journeys.json` enumerates nine journeys; a journey the contract
    names and the record does not now fails.
  - **9-B** C-08: two complete capture runs, 146 artifacts, zero differing. `npm run phase5:determinism`.
  - **9-C** C-09: real browser zoom via `setDeviceMetricsOverride`, and the test asserts the
    emulation took effect. The reflow check survives under its own name.

- [ ] C-19 owner look: contact sheet built, `npm run phase5:contact-sheet`.
  - Forty plates, twenty states paired at both D-07 viewports, each sitting beside the treatment the
    surface contract declared for it and beside the gap the Visual QA agent said it could not settle
    from an accessibility tree. Writes to the ignored `test-results/`; it is a **lens over committed
    evidence, not evidence**, and marking every state in it does not close C-19 — only an owner
    ruling does.
  - Every plate is verified against its manifest digest before it is embedded, so the sheet cannot
    show an image the record no longer describes. The element-scoped plates are declared and then
    cross-checked against the capture spec. Three mutants killed: a scoped plate missing from the
    declared list, a whole-card plate wrongly declared scoped, and a capture changed since the
    manifest.
  - The page's Copy button emits a verdict block carrying the digest of each plate looked at, and
    lists unmarked states as `not-looked-at` rather than omitting them.

- [x] **C-17 waived by the owner 2026-09-14**, amending Decision 5-D.
      `docs/evidence/phase-5/decision-record-2026-09-14-c-17-waiver.md`; overlay in
      `acceptance-contract-waivers.json`, recorded beside the frozen contract rather than into it.
  - **Waived is not met.** No human listener has ever heard this interface; every accessibility
    claim rests on axe scans and Playwright assertions. MDD §19's walkthrough is now unmet in two
    consecutive phases and Phase 8 inherits it. W5 and W6 from the Phase 4 waiver stay open.
  - What survives: the governance did not close the gate by itself. Three release-review passes ran
    against this build and all three refused to certify, each naming C-17 unmet. None reached for
    the axe results. The owner elected not to walk it — a different fact, and kept separate.
  - Every brief and verdict must report C-17 as **waived by owner**, never folded into a count.

- [x] **C-18 and charter gap 3 closed 2026-09-14.** Owner ruled the sidecar shape;
      `docs/evidence/phase-5/provenance/schema.json` and the append-only ledger
      `docs/evidence/provenance.jsonl`. `npm run phase5:provenance` runs inside `npm run verify`.
  - Gap 3 had been dispositioned as design work inside Task 2 and Task 2 closed without doing it,
    which is why C-18 sat blocked through three release reviews. **All ten gaps are now closed and
    all 21 criteria are `ready`** — assessable, which is not the same as met.
  - Why a sidecar: marking an accepted artifact superseded by editing it is the mutation behind
    D4-P-001 and D4-P-003. Appending mutates nothing, and the repo had already converged on this
    shape four times by hand.
  - 282 artifacts recorded with digest and producer, 6 supersession edges, five rules enforced.
    Corrections to a digest or an attribution are appends, so the earlier claim stays in the history.
  - **43 artifacts, almost all pre-Phase-5, are recorded `producerKind: unknown`** — no code in the
    tree writes them and no record says who did. Stated, not guessed. Whether that satisfies
    "every evidence artifact" is a release-review judgement and is deliberately not asserted.
  - Two findings while building it: `amendments.json` carries a `supersedes` field that does not
    mean supersession, and the P-3 guard caught its own schema citing a superseded pass on the
    first run. The fix was to name the field for what it holds, not to widen the exemption.

- [x] **C-19 closed 2026-09-14.** The human-visual-acceptance half exists for the first time.
      `docs/evidence/phase-5/decision-record-2026-09-14-c-19-fidelity-acceptance.md`
  - Visual QA pass 2 marked all twenty states `partial`, deferring every visual judgement to a human.
    This answers that deferral; it does not replace the rendered or static evidence beside it.
  - The recorder refuses to file a ruling about a plate that has drifted from the manifest, and the
    refusal was exercised before the record was written.
  - Whether C-19 is _satisfied_ against the whole of its assertion stays a release-review judgement.

- [x] **Release review refreshed 2026-09-14 — NEEDS WORK, 18 of 21**, up from 11. Pass 4,
      accepted on the first turn, zero overclaims. Ledger 13 of 60.
  - Verification was re-run first (pass 6: 16 full, 3 partial, 2 none, zero overclaims) because
    pass 4 predated the remediation and the brief said so in its own words.
  - Closed: C-08 (the two-run determinism record, which no earlier brief had mentioned), C-10, C-15,
    C-18, C-19, C-20, C-21.
  - **Outstanding: C-09, C-11, C-17.** Only C-17 needs a person, and it is waived.
    - C-09: reduced motion and 200% zoom are established for a subset, not for every inventory state
      at both viewports. Wants a per-state matrix with name, non-colour signature, content
      preservation and overflow under both conditions. Ordinary work, unruled.
    - C-11: the isolation records prove the defined journeys are clean, not that no destructive,
      deployment, credential or paid path exists anywhere reachable. Wants a static side-effect
      review paired with the behavioral records. Ordinary work, unruled.
    - C-17: reported as "waived by owner", and the reviewer added unprompted that **the waiver does
      not close the obligation**. The governance worked: a waiver was recorded, the brief carried it,
      and the independent reviewer still refused to count it satisfied.

- [x] **C-09 and C-11 closed 2026-09-14** by owner ruling after release review pass 4.
      `docs/evidence/phase-5/decision-record-2026-09-14-c-09-c-11.md`
  - **C-09:** all twenty contract states measured three times each — unconstrained, reduced motion,
    real 200% zoom — at both viewports, and the two constrained readings must **equal** the baseline.
    "Preserve" is a comparison, not a property; a test asking only "is the name non-empty under zoom"
    passes on a build that renamed everything. States read from the contract, per 9-G.
  - Three mutants. The first found a real weakness: the measurement read `textContent`, so a label
    hidden by a `max-width: 800px` rule — the width 200% zoom produces — survived. It now counts only
    rendered elements. One "mutant" turned out not to be one: the app's `!important` reduced-motion
    reset already defends against it, which is evidence about the app, not the test.
  - **C-11:** `npm run phase5:sideeffects` walks the import graph from three declared entry points
    and reads all **36 reachable first-party modules**, whether or not any journey executed them.
    Zero findings across network, credential, deployment, destructive and paid. External packages
    reached: `react`, `zod` — internals not walked, and the artifact says so.
  - Two silent failures caught before the artifact was believed, both producing a clean, passing,
    wrong result: the resolver rewrote `.js` to `.ts` and stopped, dropping the `.tsx` component out
    of its own graph; and the import pattern could not cross a newline, so an eighteen-line import
    block was invisible. Three modules, clean, twice, for different reasons.
  - Three mutants against the live tree: a `fetch` deep in the graph fires, a `document.cookie` in
    the component fires, and the same `fetch` in an **unreachable** module does not — the scope
    boundary working rather than a miss.
  - Determinism re-run: **148 artifacts, 0 differing.** `npm run phase5:sideeffects` is inside
    `npm run verify`.

- [x] **Release review pass 5, 2026-09-14 — NEEDS WORK, 20 of 21.** Only C-17 outstanding, and it
      is the waived one. Sixteen artifact versions cited, zero overclaims. Ledger 15 of 60.
  - _"The owner waiver records the unmet obligation but does not replace the required human
    screen-reader walkthrough. An open acceptance obligation blocks eligibility regardless of the
    green suite or the strength of the remaining evidence."_
  - The brief's new staleness line worked: verification pass 6 had marked C-09, C-11 and C-19
    partial, correctly, before those artifacts existed. The reviewer relied on _"later evidence that
    controls over pass-6's older readings"_ instead of deferring. Without it, DF-015 a fifth time.
  - The cross-check refused the first attempt — no criterion assessed, no artifact version named, no
    permitted verdict string. The second was clean.
  - **No technical work remains in Phase 5.** The distance to ELIGIBLE FOR OWNER APPROVAL is one
    human with a screen reader.

- [ ] Task 10: **Owner acceptance. Owner-run.** Accept the fixture outcome or record bounded
      revisions. Atomically creates the D-24 review that Phase 8 closes.

- [ ] Phase 5 gate: all required evidence classes exist and remain distinct; the shared-knowledge
      scenario passes; manager approval references exact artifact and evidence versions; the owner
      explicitly accepts. **Phase 7 and any production reuse remain separately gated.**
