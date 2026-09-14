# Phase 6 checklist: art-direction candidates and golden states

Status: **Owner-approved 2026-09-13 for Tasks 1-7 only.** Decisions 6-A, 6-B and 6-C are ruled. Task 8 selection, Tasks 9-10, and the Phase 6 gate remain owner-run or unauthorized.
Specification: `docs/visual-reference-production-brief-v0.1.md` — **owner-approved as written 2026-09-13**
Plan: `tasks/phase-6-plan.md`
Decision request: `docs/evidence/phase-6/decision-request-2026-09-13-phase-6-parallel-start.md`

Read each entry's own status line. Nothing here inherits authorization from the Phase 4 approvals.

## Blocking decisions

- [x] **6-A** — Owner approved the brief **as written** on 2026-09-13, no changes requested.
- [x] **6-B** — Owner authorized parallel Phase 6 on 2026-09-13. MDD §24 and its approval status were amended the same day.
- [x] **6-C** — Owner ruled **(iv) hybrid** on 2026-09-13: generated raster for mood, material and avatar exploration, marked non-implementable; in-repo vector for the fixture-accurate composition.

## Tasks

- [x] Task 1: Freeze the comparison fixture. **Complete 2026-09-13.**
  - Acceptance: one canonical default-office fixture, matching the brief's controlled comparison frame exactly; all three candidates render it and nothing else.
  - Verify: fixture-digest test across all three candidate manifests.
  - Result: `packages/testing/src/phase6-comparison-fixture.ts` builds the frame from canonical
    events through the graybox projectors; `docs/evidence/phase-6/comparison-fixture.json` is frozen
    at digest `13c33cefebf7b13f9d47479d4dc47da1e00022d763c34c5901f6ee1bb20815f4`. Nine tests,
    three mutations killed, including the check that an unregistered candidate manifest fails rather
    than passing over an empty list. Regenerate deliberately with `npm run phase6:fixture:freeze`.
    Evidence: `docs/evidence/phase-4/red-green-log.md`.

- [x] Task 2: Candidate A — architectural clarity. **Complete 2026-09-13.**
  - Acceptance: twelve candidate-board deliverables; the sterile/diagrammatic risk addressed in writing.
  - Verify: board completeness, provenance entries, documented contrast intent.
  - Depends on: Task 1, 6-C.
  - Result, all three candidates: generated from one shared geometry module so identical layout is a
    property of the build, not an inspection. Each has `board.html` (twelve items), standalone
    compositions at both viewports, and a `manifest.json` pinned to the frozen digest;
    `candidates/comparison.html` puts all three on one page. Every composition was rendered and
    looked at, which is how four defects were found — floating figures, clipped zone labels,
    duplicate SVG filter ids that made B and C inherit A's shadow, and a prop that encoded state.
    Contrast now measures text at 4.5:1 and the graphical marker at 3:1; palettes were corrected, not
    waived, and all six pairs pass in all three. **Half the 6-C hybrid is unexercised** — no
    generated raster was produced, recorded as `generatedExploration: null` rather than implied.
    Evidence: `docs/evidence/phase-4/red-green-log.md`. Rebuild: `npm run phase6:candidates:build`.

- [x] Task 3: Candidate B — human studio warmth. **Complete 2026-09-13.**
  - Acceptance: as Task 2; visual-noise and false-anthropomorphism risk addressed.

- [x] Task 4: Candidate C — miniature craft precision. **Complete 2026-09-13.**
  - Acceptance: as Task 2; toy/diorama/game risk addressed.

- [x] Task 5: Provenance and originality review. **Complete 2026-09-13.**
  - Acceptance: every reference behind every candidate carries source, creator where known, licence basis, retrieval date, and the specific abstract quality referenced. An unsourced reference blocks its candidate.
  - Result: nine references, all five fields each, all three candidates covered.
    `docs/evidence/phase-6/provenance-register.json` is generated from the same module the manifests
    cite, so review and citation cannot disagree; `docs/evidence/phase-6/provenance-review.md` is the
    narrative. Eight machine checks, mutation-tested. **No candidate is blocked.** Three gaps are
    open and recorded, none blocking: no external visual reference was consulted at all, the
    generated half of the 6-C hybrid is unexercised, and typeface embedding is deferred to Phase 7
    with a named trigger — Cascadia Mono under SIL OFL 1.1 is the only named face that would survive
    an embedding review. Evidence: `docs/evidence/phase-4/red-green-log.md`.

- [x] Task 6: Accessibility and contrast intent. **Complete 2026-09-13.**
  - Acceptance: per candidate — semantic palette, amber reserved for attention and focus, contrast at canonical scale, reduced-motion translation, 1280×800 accommodation diagram.
  - Result: all twenty canonical states documented with greyscale-surviving cues and reduced-motion
    equivalents, shared across candidates because meaning is canonical and only colour is art.
    `docs/evidence/phase-6/accessibility-report.json`; a Task 6 section now renders in each board.
    **Nine of twenty state colours failed the SC 1.4.11 3:1 non-text threshold** against the floor in
    all three candidates — including the figures themselves — and all three palettes were corrected
    rather than waived. Eight machine checks, three mutations killed, including a distinctness guard
    that catches two states being identical once colour is removed. The 1280×800 claim is measured by
    counting rendered text in both compositions, not asserted. Frozen digest unchanged.
    Evidence: `docs/evidence/phase-4/red-green-log.md`. Rebuild: `npm run phase6:a11y:build`.

- [x] Task 7: Independent scored review. **Complete 2026-09-13, run by the two promoted agents.**
  - Acceptance: fourteen rubric criteria scored 1–5 with written evidence, Product Designer and Visual QA Reviewer separately; disagreements recorded, never averaged.
  - Note: scores support discussion. They select nothing.
  - Result: two live bounded text-only turns, independent, both bound to the approved model and
    effort. Each returned 9 scores and 33 refusals across 3 candidates × 14 criteria. **Both refused
    every perceptual criterion**, because a text-only turn cannot see the compositions and they were
    told so. Four disagreements recorded in `scored-review/disagreement-register.md`, not averaged.
    **Task 7 cannot complete its purpose in a text-only turn**: the review gives no basis for
    choosing between candidates on how they look, and Task 8 rests entirely on the owner viewing
    them. Evidence: `docs/evidence/phase-4/red-green-log.md`.

- [x] Task 8: **Owner ruled 2026-09-13.** Not a clean selection: _"B is the strongest, but I agree
      that another pass for clarity is warranted."_ Recorded as the gate's third outcome — a coherent
      reconciliation on base Candidate B, in
      `docs/evidence/phase-6/decision-record-2026-09-13-task-8-selection.md`.
  - The ruling rests on the owner viewing the rendered comparison, which is the evidence class Task
    7's agent reviewers correctly refused to substitute for.
  - **The reconciliation is built and proposed, not approved.** Base B with three clarity traits
    named and imported from A — a 0.7px edge on solid faces, a tightened contact shadow, and wider
    floor-zone separation. Prop density deliberately not reduced. Thirteen fields changed; shape
    count is identical to B, so nothing structural moved. All seventeen measured contrast pairs pass
    after marker and label colours were re-solved against the darker floor.
    `docs/evidence/phase-6/reconciliation/` — see `before-after.html`.
  - [ ] **Owner approval of the reconciled system is still required before Task 9 begins.**

- [x] Task 9: Golden states. **Produced 2026-09-13 in the approved reconciliation.**
  - Acceptance: each carries fixture/event sequence, scene descriptor, DOM-outline expectation, environment manifest, visible-state checklist, accessibility notes, owner approval record.
  - Result: five canonical fixtures, ten captures, all distinct at both viewports, in
    `docs/evidence/phase-6/golden-states/` — see `index.html`. Zero animation constructs, which is
    what makes the reduced-motion equivalents real rather than asserted. Ten machine checks, two
    mutations killed.
  - Found while building: **Task 6 had documented 20 of 22 states** — collaboration kinds are a third
    family and both carry motion; now closed. **Fake activity** — nothing propagates a work
    transition to the holding agent, so the first blocked fixture animated an agent beside stopped
    work. **Two states rendered identically** — the collaboration drew nothing. A Task 6 cue that
    would have required fake proximity was corrected.
  - [ ] **Owner approval of each golden state is still outstanding.** All five carry
        `ownerApproval: null` and a guard asserts it.

- [ ] Task 10: Promotion to Active and the Phase 6 evidence packet.
  - Acceptance: manifests promoted Candidate → Active, environments fixed, baselines reviewed.

- [ ] Owner Phase 6 gate: explicit promotion of one coherent visual system from Candidate to Active. **Phase 7 high-fidelity implementation remains unauthorized.**
