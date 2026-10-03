# Implementation plan: the Phase 5 Decision Notice fixture leaves the production bundle

Status: **OWNER-APPROVED 2026-10-03, D-1 to D-4 as recommended** (D-1 as narrowed below). Written under the approved specification
`docs/proposals/2026-09-28-phase-5-fixture-removal.md` (R-1 to R-4 as recommended: move, suites
move with it, C-11 keeps running, DF-023 checked before and after). Authorized to plan now that
Phase 7-O is accepted (7-O:12). Checklist: `tasks/phase-5-fixture-removal-todo.md`, approved
separately.

## Outcome

Nothing Decision-Notice is reachable from the production office: `@cuckcode/domain` exports none
of it, `apps/web/src/main.tsx` has no `decision-notice` route, and a test fails if either returns.
The Decision Notice still runs, from its own workspace and its own production build, and the four
Phase 5 browser suites still exercise it with unchanged assertions. No committed evidence under
`docs/evidence/phase-5` changes.

## What the code says that the specification did not

1. **The C-11 check cannot keep running unchanged without editing accepted evidence (D-1).**
   `phase5:sideeffects` runs inside `verify` in check mode: it rebuilds the review and compares it
   byte for byte with the committed `docs/evidence/phase-5/side-effect-review.json`, which lists
   every reachable module by path. Moving the modules changes the paths, so the check fails until
   that file is rewritten. The specification both keeps the check (R-3) and forbids editing the
   file (§2, acceptance 3). This plan cannot satisfy both; D-1 asks for a ruling.
2. **Six more scripts name the moved paths (D-3).** Beyond the C-11 builder:
   `run-phase5-verification.ts`, `phase5-release-brief.ts`, `phase5-verification-brief.ts`,
   `build-phase5-red-evidence.ts`, `phase5-contact-sheet.ts`, and the side-effect review's own unit
   test (whose paths are sample strings, not file reads). None runs inside `verify`, so nothing
   would notice the first five breaking.
3. **The suites depend on the production bundle (D-2).** Decision 9-E puts the Phase 5 captures on
   the production build (port 4174) because C-11 needs an auditable network panel; the dev server
   issues about ninety-five module requests per journey. A fixture entry served by a dev server
   would change what the isolation and visual suites observe.

## Where the change lands

| Layer                                       | Now                                                                                                  | After                                                                                                                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain model and its unit test              | `packages/domain/src/decision-notice{,.unit.test}.ts`, re-exported by `packages/domain/src/index.ts` | `fixtures/decision-notice/src/`; the re-export removed                                                                                                                                               |
| Component, harness, styles, their tests     | `apps/web/src/decision-notice{,-fixture,-capture}.tsx`, two CSS files, two tests                     | `fixtures/decision-notice/src/`, importing the model locally                                                                                                                                         |
| Routes                                      | `?surface=decision-notice` and `?surface=decision-notice-capture` in `apps/web/src/main.tsx`         | removed; the fixture's own `index.html` and `main.tsx` serve the same two surfaces at the same query strings                                                                                         |
| Build and serving                           | none                                                                                                 | `fixtures/decision-notice/vite.config.ts`; `build` and `preview` scripts; a third Playwright `webServer` serving its production build on **4175** (D-2)                                              |
| Browser suites (P-4, moved assertions none) | four suites at `ORIGIN = 4174`                                                                       | the same suites with `ORIGIN = 4175`; the assertions do not change                                                                                                                                   |
| C-11                                        | entry points under `apps/web` and `packages/domain`                                                  | per D-1                                                                                                                                                                                              |
| Guard                                       | none                                                                                                 | `scripts/fixture-isolation.test.mjs`: the module graph from `apps/web/src/main.tsx` and from `packages/domain/src/index.ts` reaches no `fixtures/` module and no file named `decision-notice*` (R-3) |
| Phase 5 tool scripts                        | old paths                                                                                            | per D-3                                                                                                                                                                                              |
| Decision record                             | none                                                                                                 | `docs/evidence/phase-5/decision-record-<date>-fixture-removed.md`, a new file marking the D-24 "what follows" item done (acceptance 4)                                                               |

## Decisions this plan needs

- **D-1, C-11 and the accepted evidence. Owner ruling 2026-10-03: (a), kept lean.** The accepted
  `docs/evidence/phase-5/side-effect-review.json` is not touched and leaves the `verify` freshness
  check; the provenance ledger already fails `verify` if its digest moves, so no new guard is
  added. The builder writes a successor review over the moved entry points to
  `docs/evidence/phase-5-fixture-removal/side-effect-review.json` (new folder, so the accepted
  Phase 5 set is not disturbed; owner-run provenance) and checks it inside `verify` as before.
  One test states R-4 as corrected below. Rejected: (b) regenerating the accepted file, which
  edits accepted evidence; (c) dropping C-11 from `verify`, which contradicts R-3.
  - **R-4 corrected.** The accepted review covers 37 modules: the five Decision Notice files and,
    through the `@cuckcode/domain` barrel, all of `packages/domain` and `packages/contracts`. After
    the move the component imports its model directly, so the reachable set shrinks to the
    fixture's own files. "Unchanged apart from paths" would fail on day one. The test asserts
    instead that the successor's modules are a subset of the accepted modules under the declared
    path mapping, that no external package is added, and that both reviews have no findings.
  - **Why this is the lean option.** Today the 37-module review goes stale whenever `domain` or
    `contracts` gains a file (DF-023); it has five recorded digests. The successor covers only the
    fixture's files, which the product's growth does not touch, so that churn stops. The cost is
    one small evidence file, one ledger entry and one test.
- **D-2, the fixture's server.** A production build of the fixture's own entry, served by
  `vite preview` on **4175** as a third Playwright `webServer`, so 9-E holds: the suites observe a
  production bundle, now one that contains only the fixture. Note: another project on this machine
  has used 4174 today; any held port stops `verify` at e2e start, as on 2026-10-02. The port is a
  constant in one place.
- **D-3, the Phase 5 tool scripts.** **Recommended:** update their paths in the same task as the
  move, and add a guard that every repository path a `scripts/phase5-*.ts` or
  `scripts/*phase5*.ts` file names as a string literal exists. The scripts are tools, not evidence;
  what they produced earlier stays as recorded. Alternative: leave them pointing at old paths and
  record them as retired with the initiative.
- **D-4, file names.** Keep the existing file names inside the fixture workspace, so every path
  maps one to one and D-1's mapping is a directory prefix change only.

## Order

Test first throughout; RED on an assertion, one mutation per new guard, `verify` through the
runner on a clean tree at the end of each task.

1. **Baseline (R-4).** Record the accepted review's module set, external packages and findings
   (read-only), and the four suites' pass counts at both viewports. No code change.
2. **Guard first.** The fixture-isolation test, RED today: production reaches the Decision Notice.
3. **Move the model and component** into the workspace, with its Vite entry, build, preview, and
   TypeScript and lint coverage; remove the domain re-export and the two routes. The guard goes
   GREEN; component and unit tests move unchanged.
4. **Suites.** Third `webServer`; the four suites point at 4175; pass counts match step 1.
5. **C-11 per D-1**, with the R-4 subset test.
6. **Tool scripts per D-3.**
7. **Decision record** (acceptance 4), and the position record. Closing the Phase 5 fixture
   initiative stays a separate owner act.

## Risks

- **DF-023.** Phase 5 evidence goes stale when production packages grow; this change shrinks
  them. Under D-1 the accepted digests never move, and the successor review stops the churn. `phase5:provenance` runs inside
  `verify` and will report any accepted artifact that changes.
- **The visual suite's per-run manifest records the requested URLs**, which will name different
  chunk files. That output is per run and not committed; no owner regeneration is needed unless
  the owner wants fresh Phase 5 captures, which this work does not.
- **TypeScript settings.** The fixture's `tsconfig.json` has no JSX or DOM settings today; moving a
  `.tsx` component in needs them, mirrored from `apps/web`.
