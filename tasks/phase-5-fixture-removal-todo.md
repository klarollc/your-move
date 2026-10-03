# Phase 5 fixture removal checklist

Status: **OWNER-APPROVED 2026-10-03.** Plan: `tasks/phase-5-fixture-removal-plan.md`.
Spec: `docs/proposals/2026-09-28-phase-5-fixture-removal.md`.

## Rules for every task

RED on an assertion before GREEN, never re-run after; one mutation per new guard, confirmed
applied; `verify` through the runner on a clean tree at the end of each task; evidence writes
owner-run; moved assertions listed (P-4). No file under `docs/evidence/phase-5` changes.

## Tasks

- [ ] Task 1: Baseline (R-4).
  - Acceptance: the accepted C-11 module set and findings, and the four suites' pass counts at both
    viewports, recorded in this checklist from the accepted review and a `verify` log. No code
    change.
- [ ] Task 2: Production-isolation guard (R-3).
  - Acceptance: `scripts/fixture-isolation.test.mjs` inside `verify`; RED today on the assertion
    (production reaches `decision-notice` modules); a mutation that re-adds one import is caught.
- [ ] Task 3: Move the model and component into `fixtures/decision-notice` (R-1a, D-4).
  - Acceptance: `@cuckcode/domain` exports nothing Decision-Notice; `main.tsx` has no
    `decision-notice` route; the fixture builds and previews on its own; Task 2's guard GREEN; the
    moved unit and component tests pass unchanged; `tsc -b`, ESLint and Prettier cover the moved
    files.
- [ ] Task 4: The four browser suites against the fixture's own build (R-2, D-2).
  - Acceptance: a third `webServer` on 4175; the suites' assertions unchanged (P-4 lists only the
    `ORIGIN` line in each); pass counts equal Task 1's at both viewports.
- [ ] Task 5: C-11 after the move (R-3, R-4 as corrected, D-1).
  - Acceptance: the accepted review is untouched and leaves the freshness check (the ledger guards
    its digest); the successor review at `docs/evidence/phase-5-fixture-removal/` is checked inside
    `verify`; a test shows its modules are a subset of the accepted modules under the declared
    mapping, no external package is added, and both have no findings (R-4 as corrected); owner-run
    provenance for the new artifact.
- [ ] Task 6: Phase 5 tool scripts (D-3).
  - Acceptance: their paths updated and a guard that every repository
    path they name exists, RED first against a deliberately wrong path.
- [ ] Task 7: Decision record and position record.
  - Acceptance: a new dated decision record marks the D-24 "what follows" item done, citing the
    commits; no accepted record edited; `position.json` moves the workstream to complete.
