# Specification: the Phase 5 Decision Notice fixture leaves the production bundle

**Status: APPROVED 2026-09-28, R-1 to R-4 as recommended.** A plan and checklist follow before implementation. Follow-on to the D-24 disposition
(`docs/evidence/phase-5/decision-record-2026-09-27-d24-disposition.md`: `reuse_concepts_only`, and
the fixture's presence in production packages ruled an unruled deviation). **Not authorized before
Phase 7-O is accepted**: it touches `apps/web/src`. Needs its own plan and checklist after approval.

Author: agent.

## 1. What is in production today

| Piece | Where | Reached by |
| --- | --- | --- |
| Domain model | `packages/domain/src/decision-notice.ts`, re-exported from `packages/domain/src/index.ts` | anything importing `@cuckcode/domain` |
| Component, styles | `apps/web/src/decision-notice.tsx`, `decision-notice.css` | the two routes below |
| Fixture harness | `apps/web/src/decision-notice-fixture.tsx`, `-fixture.css`, `decision-notice-capture.tsx` | `?surface=decision-notice` and `?surface=decision-notice-capture` in `apps/web/src/main.tsx` |
| Tests | `decision-notice.component.test.tsx`, `decision-notice-capture.unit.test.ts` (web); four browser suites (`tests/accessibility/phase-5-decision-notice-a11y.spec.ts`, `-state-matrix.spec.ts`, `tests/e2e/phase-5-decision-notice-isolation.spec.ts`, `tests/visual/phase-5-decision-notice-states.spec.ts`) | `verify` |
| C-11 static check | `scripts/build-phase5-side-effect-review.ts` walks the import graph from three entry points: the component, the capture harness and the domain model | `npm run phase5:sideeffects`, inside `verify` |

`fixtures/decision-notice` already exists as a workspace (`@cuckcode/decision-notice-fixture`) and
is empty (`export {}`).

## 2. Accepted evidence that must not move

The accepted fixture is immutable evidence: commit `7995618`, five pinned blobs, and the 195-artifact
evidence set by `setDigest`. Nothing under `docs/evidence/phase-5` is edited. The C-11 review and
the browser matrices describe the fixture **as accepted**, not as it will live afterwards.

## 3. Decisions

- **R-1, move or retire.** (a) **Recommended: move** the domain model, component, styles and
  harness into `fixtures/decision-notice`, which gains a small Vite entry of its own served only by
  the test web server. The concepts D-24 kept stay runnable and the four browser suites keep
  exercising them. (b) Retire: delete the code and the suites; the accepted evidence remains the
  only record. Cheaper, but the "reuse concepts" disposition then has nothing runnable behind it.
- **R-2, the four browser suites (if R-1a).** They move with the fixture and load its own entry;
  their assertions do not change. Each moved file is listed under P-4. Their captures still write
  per-run output; committed Phase 5 evidence is only rewritten by an owner-run regeneration, which
  this work does not need.
- **R-3, C-11 after the move.** The static check's three entry points move to the fixture
  workspace. **Recommended:** the check keeps running inside `verify` over the new paths, and a new
  assertion proves the production entry (`apps/web/src/main.tsx`) no longer reaches any fixture
  module: the deviation D-24 named becomes a failing test if it returns.
- **R-4, DF-023.** Accepted Phase 5 evidence goes stale whenever production packages grow (DF-023,
  ruled open). Moving the fixture out is the change most likely to disturb it. **Recommended:**
  before the move, record the current `phase5:sideeffects` result; after, show the fixture-reachable
  module set is unchanged apart from paths.

## 4. Acceptance

1. `@cuckcode/domain` exports nothing Decision-Notice; `apps/web/src/main.tsx` has no
   `decision-notice` route; the production build contains no fixture module (asserted, R-3).
2. The four browser suites pass against the fixture's own entry, unchanged in assertion (R-1a).
3. `verify` green; no committed evidence edited.
4. The D-24 record's "what follows" item is marked done by a dated line in a new decision record,
   not by editing the accepted one.

## 5. Out of scope

Closing the Phase 5 fixture initiative (a separate owner act); any change to the Decision Notice's
behaviour; Phase 8's formal close.
