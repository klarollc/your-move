# Phase 6 evidence packet — art-direction candidates and golden states

Status: **Tasks 1–9 complete. Task 10 promotion is built, every precondition holds, and it awaits the owner's execution.**
Specification: `docs/visual-reference-production-brief-v0.1.md`, owner-approved as written 2026-09-13
Plan and checklist: `tasks/phase-6-plan.md`, `tasks/phase-6-todo.md`
Run: 2026-09-13, in parallel with Phase 5 under Decision 6-B

## What Phase 6 was for

Select one coherent visual system from three original candidates, and produce the golden states
Phase 7 implements against. Phase 6 selects. It implements nothing.

## What exists

| Task | Outcome | Evidence |
| --- | --- | --- |
| 1 Freeze the frame | One canonical default-office fixture, digest `13c33cef…815f4` | `comparison-fixture.json` |
| 2–4 Three candidates | Twelve board deliverables each, generated from one shared geometry module | `candidates/`, `candidates/comparison.html` |
| 5 Provenance | Nine references, five required fields each, both forbidden conditions false | `provenance-register.json`, `provenance-review.md` |
| 6 Accessibility | All 22 canonical states documented with greyscale-surviving cues | `accessibility-report.json` |
| 7 Scored review | Two promoted agents, independent, live bounded turns | `scored-review/`, `disagreement-register.md` |
| 8 Owner selection | Reconciliation on base B with three named clarity traits from A | `decision-record-…task-8-selection.md`, `reconciliation/` |
| 9 Golden states | Five states, ten captures, all distinct at both viewports | `golden-states/`, `golden-states/index.html` |
| 10 Promotion | Built, eight preconditions all satisfied, **owner-run** | `scripts/promote-phase6-visual-system.ts` |

385 tests pass across the repository. Typecheck, lint and format are clean.

## What this phase actually proves

**The three candidates differed in art direction and in nothing else.** Geometry, agent placement,
labels and canonical state came from one module shared byte-for-byte; the styles could not move a
desk. That is a property of the build rather than a claim anyone had to verify.

**Accessibility was measured, not asserted, and it failed twice before it passed.** Nine of twenty
state colours fell below the SC 1.4.11 threshold against the floor — the figures themselves at
2.4:1 — and the clarity pass in Task 8 broke four markers again. Both were fixed in the palettes.
Nothing was waived.

**Reduced-motion equivalence is real.** Every capture contains zero animation constructs, so there is
no motion to remove. Rendering each frame twice and comparing would have proved nothing.

**The selection rests on the owner looking.** Task 7's two agent reviewers refused every perceptual
criterion, correctly, because a text-only turn cannot see a composition. The Task 8 ruling and the
Task 9 approval both followed direct visual inspection.

## What this phase does not prove, stated plainly

1. **No external visual reference informed any candidate.** The brief permits architectural,
   material, ergonomic, photographic and historical references; none was consulted. The candidates
   are original because nothing outside the repository informed them, which is not the same as being
   well researched. Open.
2. **The generated half of the approved hybrid medium was never produced.** Decision 6-C approved a
   hybrid; only the in-repo vector half exists. Recorded as `generatedExploration: null` rather than
   implied. Open.
3. **Four of six named typefaces cannot be embedded.** They are referenced by family name and
   resolved from the viewer's system, so no licence is exercised today. Phase 7 embedding is the
   named trigger; only Cascadia Mono under SIL OFL 1.1 would survive it. Deferred.
4. **Task 7 could not complete its purpose.** Nine scores and thirty-three refusals per reviewer. The
   review confirms provenance and accessibility and gives no basis for choosing on appearance.
5. **Nothing here is a visual regression baseline in the running product.** The captures are
   deterministic SVG from a build script, not screenshots of the application. Phase 7 produces the
   rendered baselines.

## Defects found during Phase 6, all fixed

| Finding | Shape |
| --- | --- |
| Contrast scored against one threshold | SC 1.4.11 graphical objects need 3:1, not the 4.5:1 text rule — and the accent failed 3:1 too |
| Duplicate SVG filter ids | B and C silently inherited A's shadow on the comparison page |
| A prop encoded state | The manager's board captioned "1 priority" on a page whose own rule forbids it |
| Task 6 covered 20 of 22 states | Collaboration kinds are a third family, both carrying motion |
| Fake activity | No work transition propagates to the holding agent; a blocked fixture animated its agent |
| Two golden states identical | The collaboration state drew nothing with its participants |
| A cue requiring fake proximity | "Participants co-located at the shared surface" — the state never moves them |
| A dead regex branch | A literal backspace in the animation check |

Every one was found by measuring or by looking, not by a passing build. Six of the eight are the
register's recurring shape: a guard exact inside a boundary nobody examined.

## The Task 10 gate

Eight preconditions, each recomputed from the artifacts on disk rather than trusted from a summary,
all-or-nothing. All eight are satisfied. The promotion refuses to execute without
`CUCKCODE_OWNER_PROMOTION=1`, because the Phase 6 gate is worded as *explicit owner promotion* and an
agent promoting on the owner's behalf would convert an approval into an action the owner never took.

```
CUCKCODE_OWNER_PROMOTION=1 npm run phase6:promote
```

On execution it writes `visual-system-promotion.json`: the Active system, the frozen frame digest,
every golden-state digest, and the capture baselines. Candidates A and C remain Candidate and are not
revoked.

## After promotion

Phase 6's gate closes. **Phase 7 high-fidelity implementation remains unauthorized** and requires its
own specification, plan and owner approval. The three open items above carry forward; none is closed
by promotion.
