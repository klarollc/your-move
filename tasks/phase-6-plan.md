# Implementation plan: Phase 6 art-direction candidates and golden states

Status: **PROPOSED, NOT APPROVED.** Nothing in this plan is authorized. It requires three owner decisions recorded in `docs/evidence/phase-6/decision-request-2026-09-13-phase-6-parallel-start.md` before Task 1 begins.
Specification: `docs/visual-reference-production-brief-v0.1.md` (itself still _Proposed for owner approval_, unchanged since 2026-08-13)
Governing: MDD §18 D-21/D-22, §24 Phase 6, `.ui-craft/brief.md`, `.ui-craft/tokens.md`
Prior phase: `tasks/phase-4-plan.md`

## Outcome

Produce three original controlled-composition candidates against one identical canonical fixture, carry exactly one of them — or an owner-named coherent reconciliation — from Candidate to Active, and deliver the six named golden states that Phase 7 implements against. Phase 6 selects a visual system. It implements none of it.

## Why this plan exists now

MDD §24 orders Phase 6 after Phase 5. This plan proposes running it in parallel instead, on the owner's instruction of 2026-09-13. The argument is scheduling, not scope:

- Phase 6 has no code dependency on Phase 5. Its input is the approved graybox composition (`.ui-craft/spec.md`, accepted 2026-09-08) and the canonical default-office fixture, both of which exist now. Nothing in the candidate board or the review rubric reads a Phase 5 artifact.
- Phase 6 is the most owner-latency-bound phase in the plan: it terminates in a taste judgment only the owner can make, and the brief has already waited a month for a first approval.
- Phase 7 cannot start until Phase 6 closes, so every day Phase 6 waits is a day added to the end of the schedule, whereas Phase 5 delay costs only itself.

**The deviation is the owner's to authorize, not this plan's to assume.** Running 6 before 5 departs from an approved document. If it is approved, MDD §24 is amended to say so rather than left to contradict the record — the failure mode already recorded three times in this repository.

## Governing decisions this plan does not reopen

- The visual thesis, the three comparative emphases (A architectural clarity, B human studio warmth, C miniature craft precision), the controlled comparison frame, the twelve-item candidate board, the avatar contract, and the review rubric are the brief's and are taken as given.
- Candidates are original CuckCode compositions. No named living artist is imitated and no commercial product's distinctive identity is reproduced.
- Every asset stays Candidate until explicit owner approval and manifest promotion.
- Automated screenshot diffs detect change; they never approve taste.
- Agent-authored identity details remain Candidate pending safety, accessibility, art-system, asset, and manager review.

## Open decision that blocks Task 2

**The production medium for the three candidates is not settled by the brief.** The brief permits "generated or commissioned" assets and requires recorded provenance, but does not say which this project uses. The options differ in cost, provenance burden, and achievable fidelity, and the choice changes the shape of Tasks 2–4. It is recorded as Decision 6-C in the decision request.

## Task sequence

- **Task 1 — Freeze the comparison fixture.** Produce the single canonical default-office fixture every candidate renders: event sequence, scene descriptor, DOM-outline expectation, and the exact visible-state checklist from the brief's controlled comparison frame (no escalations, one current priority, connected runtime health, inspector closed, attention rail collapsed, six agents at their role work areas). Machine-checked, so drift between candidates is impossible rather than unlikely.
  - Verify: fixture test asserting all three candidate manifests name one identical fixture digest.

- **Task 2 — Candidate A, architectural clarity.** All twelve candidate-board deliverables against the frozen fixture, plus the named risk (sterile or diagrammatic) addressed in writing.
  - Verify: board completeness check, a provenance register entry per referenced source, contrast intent documented.

- **Task 3 — Candidate B, human studio warmth.** As Task 2; named risk is visual noise and false anthropomorphic sentiment.

- **Task 4 — Candidate C, miniature craft precision.** As Task 2; named risk is reading as toy, diorama, or game.

- **Task 5 — Provenance and originality review.** Source URL or file, creator where known, licence or usage basis, retrieval date, and the specific abstract quality referenced, for every reference behind all three candidates. An unsourced reference blocks its candidate.
  - Verify: register completeness test; licence metadata retained as for `roles/upstream/`.

- **Task 6 — Accessibility and contrast intent.** Documented per candidate: semantic palette, amber reserved for attention and focus, contrast ratios at canonical scale, reduced-motion translation, and the 1280×800 accommodation diagram.
  - Verify: contrast computation over each candidate's declared palette; no candidate advances with an undocumented state.

- **Task 7 — Scored review against the rubric.** All fourteen rubric criteria scored 1–5 with written evidence, by the Product Designer and the Visual QA Reviewer independently. Scores support discussion and determine nothing automatically.
  - Verify: both reviews exist, are separate artifacts, and disagreements are recorded rather than averaged.

- **Task 8 — Owner selection gate.** The owner selects A, B, or C; rejects all; or names a coherent reconciliation with its retained traits and base candidate. **Owner-run. This plan never selects.**

- **Task 9 — Golden states.** After selection only: the six named states from the brief — default office at both viewports, active collaboration bound to a canonical collaboration event, manager escalation, blocked work, visual review with named artifact, and reduced-motion equivalents — each with fixture and event sequence, scene descriptor, DOM-outline expectation, environment manifest, visible-state checklist, accessibility notes, and owner approval record.

- **Task 10 — Promotion to Active and the Phase 6 evidence packet.** Manifest promotion from Candidate to Active, environment manifests fixed, baselines reviewed. Phase 7 remains unauthorized.

## Dependency graph

```text
1 frozen comparison fixture
        |
   +----+----+----+
   |         |    |
   2 Cand A  3 B  4 C        (parallel; identical fixture)
   +----+----+----+
        |
5 provenance ---- 6 accessibility/contrast
        |
7 independent scored review
        |
8 OWNER selection gate   <-- stop
        |
9 golden states -> 10 promotion to Active + evidence packet
```

## Risks

| Risk                                                        | Impact | Mitigation                                                                   |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Candidates differ in fixture, not in art direction          | High   | Task 1 freezes one fixture digest; all three manifests must name it.         |
| Generated assets carry unclear provenance or licence        | High   | Task 5 blocks any candidate with an unsourced reference.                     |
| A scored rubric is mistaken for a selection                 | High   | Task 8 is owner-run; scores explicitly determine nothing.                    |
| Parallel Phase 6 is read as Phase 5 authorization           | High   | This plan authorizes no Phase 5 behavior and no Phase 7 implementation.      |
| Art review drifts into approving the graybox again          | Medium | Graybox behavior was accepted 2026-09-08; Phase 6 judges art direction only. |
| Agent-authored identity detail implies false workflow state | High   | Avatar contract; novel details stay Candidate pending five-way review.       |

## Stop conditions

Stop for: any Phase 7 implementation, any baseline promotion before Task 10, a new viewport or browser scope, a change to the three comparative emphases without owner approval, an unsourced reference, a candidate rendered against a different fixture, a selection made by anyone but the owner, or any attempt to treat a screenshot diff or a rubric score as owner approval.

## Approval gate

This plan authorizes nothing. It requires, recorded: **(6-A)** approval of `docs/visual-reference-production-brief-v0.1.md`; **(6-B)** authorization to run Phase 6 in parallel with Phase 5, together with the MDD §24 amendment that records it; and **(6-C)** the candidate production medium. With all three, Tasks 1–7 are authorized and the plan stops at the Task 8 owner gate.
