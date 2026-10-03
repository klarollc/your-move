# Phase 5 fixture removal checklist

Status: **OWNER-APPROVED 2026-10-03.** Plan: `tasks/phase-5-fixture-removal-plan.md`.
Spec: `docs/proposals/2026-09-28-phase-5-fixture-removal.md`.

## Rules for every task

RED on an assertion before GREEN, never re-run after; one mutation per new guard, confirmed
applied; `verify` through the runner on a clean tree at the end of each task; evidence writes
owner-run; moved assertions listed (P-4). No file under `docs/evidence/phase-5` changes.

## Tasks

- [x] Task 1: Baseline (R-4).
  - Acceptance: the accepted C-11 module set and findings, and the four suites' pass counts at both
    viewports, recorded in this checklist from the accepted review and a `verify` log. No code
    change.
  - **Recorded 2026-10-03** (read-only; no code change).
    - **Accepted C-11 review** `docs/evidence/phase-5/side-effect-review.json`, last changed in
      `b0af24d`, SHA-256 `33f92e2d058ca0011855db3942f29efb7614379da602dd5dd8e443f7261a85f2`, matching the ledger's latest entry for it. Entry points:
      `apps/web/src/decision-notice.tsx`, `apps/web/src/decision-notice-capture.tsx`,
      `packages/domain/src/decision-notice.ts`. **37 modules**: the 3 Decision Notice files
      (`decision-notice-capture.tsx`, `decision-notice.tsx`, `decision-notice.ts`) and, through
      the `@cuckcode/domain` barrel, 34 modules of `packages/domain` and `packages/contracts`. External packages: `react`, `zod`. Non-code imports:
      `./decision-notice.css`, `./decision-notice-fixture.css`. Findings: none in any category
      (network, credential, deployment, destructive, paid).
    - **Suites**, from the clean `verify` at `23841ce` (`df029-t7-verify-1791012655`), per viewport
      (1440 / 1280): a11y 13 / 13; state matrix 1 / 1; isolation e2e 2 / 2; visual states 20 / 20;
      no failures.
    - **Moving tests**, same run: `decision-notice.unit.test.ts` 32;
      `decision-notice-capture.unit.test.ts` 2; `decision-notice.component.test.tsx` 31.
- [ ] Task 2: Production-isolation guard (R-3).
  - Acceptance: `scripts/fixture-isolation.test.mjs` inside `verify`; RED today on the assertion
    (production reaches `decision-notice` modules); a mutation that re-adds one import is caught.
  - **Built 2026-10-03; lands with Tasks 3-5 in `0eda082` (owner ruling: one change, one `verify`,
    since the guard cannot pass before the move).** `scripts/fixture-isolation.unit.test.ts`, a
    Vitest unit test rather than the planned `.mjs`, so it can reuse the C-11 walker; it runs in
    `test:unit`. Every workspace, `fixtures/` included, is mapped by manifest.
    - RED on the assertion, both entries: from `main.tsx`, the component, both harnesses and the
      model; from the domain index, the model. Its non-vacuity checks (nothing unreadable; more
      than five modules reached) passed first.
    - Mutations, after the move, each confirmed applied and killed: a relative import of the
      component from `main.tsx`; the fixture exported by package name from the domain index
      (caught from both entries, so the package name is followed, not treated as external).
- [ ] Task 3: Move the model and component into `fixtures/decision-notice` (R-1a, D-4).
  - Acceptance: `@cuckcode/domain` exports nothing Decision-Notice; `main.tsx` has no
    `decision-notice` route; the fixture builds and previews on its own; Task 2's guard GREEN; the
    moved unit and component tests pass unchanged; `tsc -b`, ESLint and Prettier cover the moved
    files. - **Built 2026-10-03 in `0eda082`.** `git mv`, names kept, into `src/model/` and `src/web/`
    (the model and the component share a base name). The fixture's own `index.html`, `src/main.tsx`
    (the same two surfaces at the same query strings) and `vite.config.ts`; it imports the office's
    one global stylesheet, a dependency from the fixture to the office only. `react` and `react-dom`
    declared; the lockfile changes by that workspace entry alone.
    - Moved tests unchanged in count: model 32, capture 2, component 31.
    - Moved assertion (P-4): the component test's C-08 source scan reads the component at its new
      path.
    - `scripts/css-scope.test.mjs` now also scans `fixtures/decision-notice/src/web`; a `body` rule
      added to a moved stylesheet is caught.
    - The office bundle shrank from 504 kB to 483 kB and contains no Decision Notice text.

- [ ] Task 4: The four browser suites against the fixture's own build (R-2, D-2).
  - Acceptance: a third `webServer` on 4175; the suites' assertions unchanged (P-4 lists only the
    `ORIGIN` line in each); pass counts equal Task 1's at both viewports.
  - **Built 2026-10-03 in `0eda082`.** `npm run preview:decision-notice`, a third `webServer`.
    - RED on the assertion before the change: `[data-capture-state="pending"]` not found, since
      4174 now serves only the office.
    - GREEN in the container, per viewport (1440 / 1280): a11y 13 / 13, state matrix 1 / 1,
      isolation 2 / 2, visual 20 / 20, equal to Task 1. A console 404 in the first container run
      did not recur; cause not established, and this `verify` decides.
    - P-4: the `ORIGIN` line in each suite; in the isolation spec also the three file paths its run
      record hashes, and its `servedFrom` wording. No assertion changed.
- [ ] Task 5: C-11 after the move (R-3, R-4 as corrected, D-1).
  - Acceptance: the accepted review is untouched and leaves the freshness check (the ledger guards
    its digest); the successor review at `docs/evidence/phase-5-fixture-removal/` is checked inside
    `verify`; a test shows its modules are a subset of the accepted modules under the declared
    mapping, no external package is added, and both have no findings (R-4 as corrected); owner-run
    provenance for the new artifact.
  - **Built 2026-10-03 in `0eda082`; successor written and recorded by the owner.** The entry
    points and the path map live in `scripts/phase5-side-effect-review.ts`, shared by the builder
    and `scripts/phase5-side-effect-successor.unit.test.ts`. The successor: 3 modules, external
    `react` only, no findings. `docs/evidence/phase-5` unchanged.
    - The R-4 test passed on its first run (it describes the code as moved) and is proved by
      mutation, each confirmed applied and killed by its own case: a workspace import (new
      external package); a new local module (outside the accepted set); a `fetch` in the model
      (a finding).
- [ ] Task 6: Phase 5 tool scripts (D-3).
  - Acceptance: their paths updated and a guard that every repository
    path they name exists, RED first against a deliberately wrong path.
- [ ] Task 7: Decision record and position record.
  - Acceptance: a new dated decision record marks the D-24 "what follows" item done, citing the
    commits; no accepted record edited; `position.json` moves the workstream to complete.
