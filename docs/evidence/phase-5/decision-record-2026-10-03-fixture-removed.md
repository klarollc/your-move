# Decision record: the Phase 5 fixture has left the production bundle

Date: 2026-10-03. Follows `decision-record-2026-09-27-d24-disposition.md`, which is not edited.

## The item this closes

The D-24 record's first "what follows" item: the fixture leaves the production packages and
bundle, the re-export and the two routes, under its own specification, plan and tasks, moving or
retiring the four Phase 5 browser suites. **Done, 2026-10-03.**

- Specification: `docs/proposals/2026-09-28-phase-5-fixture-removal.md` (approved 2026-09-28).
- Plan and checklist: `tasks/phase-5-fixture-removal-plan.md`,
  `tasks/phase-5-fixture-removal-todo.md` (approved 2026-10-03; D-1 to D-4).

## What changed

- The Decision Notice model, component, harnesses, styles and their tests moved, names kept, into
  the `fixtures/decision-notice` workspace (`0eda082`). `@cuckcode/domain` exports none of it, and
  `apps/web/src/main.tsx` has no `decision-notice` route. The office bundle no longer contains it.
- `scripts/fixture-isolation.unit.test.ts`, inside `verify`, fails if the production entry or the
  domain index reaches the fixture again. The deviation D-24 named is now a failing test.
- The four browser suites were moved, not retired: they load the fixture's own production build on
  port 4175, with assertions unchanged, and pass with the same counts as before at both viewports.
- C-11: the accepted `side-effect-review.json` in this folder is unchanged and guarded by the
  provenance ledger. Its successor, `docs/evidence/phase-5-fixture-removal/side-effect-review.json`
  (written by the owner), is checked inside `verify` and held by a test to a subset of the accepted
  modules, with no new external package and no finding (`0ad5e3d`).
- Phase 5 tool scripts name the moved files, and a test keeps their paths real (`0716eb8`).

No accepted Phase 5 evidence was edited.

## What this does not do

It does not close the Phase 5 fixture initiative; that remains a separate owner act. It changes no
Decision Notice behaviour.
