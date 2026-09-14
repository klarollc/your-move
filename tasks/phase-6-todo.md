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

- [ ] Task 2: Candidate A — architectural clarity.
  - Acceptance: twelve candidate-board deliverables; the sterile/diagrammatic risk addressed in writing.
  - Verify: board completeness, provenance entries, documented contrast intent.
  - Depends on: Task 1, 6-C.

- [ ] Task 3: Candidate B — human studio warmth.
  - Acceptance: as Task 2; visual-noise and false-anthropomorphism risk addressed.

- [ ] Task 4: Candidate C — miniature craft precision.
  - Acceptance: as Task 2; toy/diorama/game risk addressed.

- [ ] Task 5: Provenance and originality review.
  - Acceptance: every reference behind every candidate carries source, creator where known, licence basis, retrieval date, and the specific abstract quality referenced. An unsourced reference blocks its candidate.

- [ ] Task 6: Accessibility and contrast intent.
  - Acceptance: per candidate — semantic palette, amber reserved for attention and focus, contrast at canonical scale, reduced-motion translation, 1280×800 accommodation diagram.

- [ ] Task 7: Independent scored review.
  - Acceptance: fourteen rubric criteria scored 1–5 with written evidence, Product Designer and Visual QA Reviewer separately; disagreements recorded, never averaged.
  - Note: scores support discussion. They select nothing.

- [ ] Task 8: **Owner selection gate. Owner-run.** Select A, B, or C; reject all; or name a coherent reconciliation with its retained traits and base candidate.
  - Nothing below begins until this is recorded.

- [ ] Task 9: Golden states — default office at both viewports, active collaboration bound to a canonical event, manager escalation, blocked work, visual review with named artifact, reduced-motion equivalents.
  - Acceptance: each carries fixture/event sequence, scene descriptor, DOM-outline expectation, environment manifest, visible-state checklist, accessibility notes, owner approval record.

- [ ] Task 10: Promotion to Active and the Phase 6 evidence packet.
  - Acceptance: manifests promoted Candidate → Active, environments fixed, baselines reviewed.

- [ ] Owner Phase 6 gate: explicit promotion of one coherent visual system from Candidate to Active. **Phase 7 high-fidelity implementation remains unauthorized.**
