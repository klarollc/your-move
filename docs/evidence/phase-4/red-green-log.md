# Phase 4 RED–GREEN–REFACTOR log

## Task 1 — Authority and graybox evidence boundary

Date: 2026-08-13

- Approval: owner authorized deterministic Phase 4 Tasks 1–15. Tasks 16–17, live kickoff, executable role promotion, high-fidelity art, Phase 5, deployment, and external effects remain unauthorized.
- Documentation: governing boundary and planning statuses were updated; D-27 reconciles Phase 4 as graybox office and collaborative kickoff, with art direction retained in later phases.
- RED: `node --test scripts/graybox-evidence.test.mjs` failed with `ERR_MODULE_NOT_FOUND` because the graybox evidence validator did not exist.
- GREEN: 3 tests passed. Candidate Phase 4 graybox evidence is accepted; Active, high-fidelity, golden-state, art-direction-approved, malformed, wrong-phase, extra-field, and secret-bearing claims are rejected.
- REFACTOR: formatting applied; the focused test remained green.
- Verification: focused Node test, ESLint, TypeScript, and `git diff --check` passed.
- Invariant: graybox rendered evidence can prove composition and interaction only. It cannot promote an asset, token, baseline, golden state, or art direction.
## Task 2 — Workspace read model and intent contracts

Date: 2026-08-13

- RED: focused Vitest contract failed because `workspace.js` did not exist.
- GREEN: 4 contract tests passed for stable DOM/canvas twins, canonical cause/freshness, cross-entity attention integrity, current-revision commands, and fail-closed stale/cross-project/secret/authority cases.
- Refinement: the first GREEN attempt returned a generic invalid-command code for provider-authored manager authority; validation order was corrected and the stable `WORKSPACE_AUTHORITY_INVALID` result passed.
- Verification: focused contract, ESLint, TypeScript, and diff checks passed.
- Invariant: canvas and DOM are equal projections of one versioned workspace read model; manager-only authority cannot be supplied by a provider or stale browser state.
## Task 3 — Component and rendered harness

Date: 2026-08-13

- RED: dedicated jsdom `test:component` failed because the accessible harness component did not exist.
- GREEN: React Testing Library and `user-event` drove a named native disclosure and verified its accessible expanded/status state.
- Rendered harness: `test:visual` now requires matching tests and ran 2 current-build Chromium captures across 1440×900 and 1280×800; no approved aesthetic baseline was created.
- Gate integration: `test:ui-contract` and `test:component` now run inside ordinary `verify`.
- Verification: 3 graybox boundary tests, 4 workspace contracts, 1 component test, 2 rendered harness tests, ESLint, and TypeScript passed.
- Invariant: zero visual matches can no longer report success, and browser components are tested in jsdom rather than mislabeled as Node unit tests.
## Checkpoint A — Contracts and harness

Date: 2026-08-13

- Result: PASS.
- Protocol: 4 tests; 275 Codex 0.146.0 schema files validated.
- Roles: 3 tests; 6 pinned Agency Agents roles remain Candidate/non-executable.
- Qualification: 2 files / 16 tests.
- UI boundary: 3 graybox evidence tests and 4 workspace contracts.
- Static gates: formatting, ESLint, TypeScript, and production build passed.
- Regression: 23 files / 79 unit tests; 1 component test; 11 files / 31 integration tests plus the guarded live test skipped by design; 7 files / 35 contract tests.
- Browser: 4 scaffold journeys, 2 automated accessibility scans, and 2 non-baseline rendered harness captures passed across Chromium 1440×900 and 1280×800.
- Scope label: rendered harness evidence only; no graybox office, manual accessibility, comprehension, or art-direction claim.

## Task 4 — Loopback session, read model, command, and event boundary

Date: 2026-08-13

- Dependency approval: owner authorized `@types/ws` as a development-only typing dependency; version `8.18.1` is pinned exactly and the package audit reports zero vulnerabilities.
- RED 1: the focused integration suite failed with `ERR_MODULE_NOT_FOUND` because the loopback session boundary did not exist.
- GREEN 1: exact-origin session bootstrap, memory-only session/CSRF mutation checks, authenticated read-model access, typed command receipts, stale-revision recovery, cross-project denial, and production fixture rejection passed.
- RED 2: reconnect coverage failed because `injectWS` and the authenticated event route did not exist.
- GREEN 2: authenticated WebSocket replay resumes strictly after `sinceRevision`; unknown sessions reject; a non-loopback host cannot construct the server.
- Security boundary: the server binds by contract only to `127.0.0.1`, accepts one exact origin, keeps session and CSRF values out of URLs, disables Fastify logging, and imports no Codex client, SQLite access, filesystem/path API, browser storage, or canonical reducer.
- Verification: focused Task 4 integration 7/7; full integration 37 passed with one guarded live test skipped; formatting, ESLint, TypeScript, build, and dependency audit passed.
- Full repository gate: `npm.cmd run verify` passed with 79 unit, 1 component, 37 integration, 35 contract, 4 browser, 2 automated accessibility, and 2 rendered harness tests; protocol, role, qualification, UI-boundary, formatting, lint, typecheck, and build gates also passed.
- Evidence boundary: browser and rendered results remain scaffold/harness evidence. They do not prove the later graybox office, manual accessibility, comprehension, or art-direction gates.


## Task 5 — Graybox spatial measurements and deterministic layout

Date: 2026-08-13

- RED 1: focused unit coverage failed with `ERR_MODULE_NOT_FOUND` because the office layout policy did not exist.
- GREEN 1: 6 tests passed for the 2:1 projection, seven authored regions, six role anchors, both approved viewports, both-overlay resize, discrete fit zoom, pan policy, cutaway policy, 44px hit regions, and byte-equivalent serialization.
- RED 2: the rendered layout-trial browser test failed because the web surface did not exist.
- GREEN 2: the neutral SVG current-build trial passed at 1440×900 and 1280×800 with both overlays, clean console/network assertions, and named screenshots.
- RED 3: canonical-reset coverage failed because the trial hard-coded both overlays open.
- GREEN 3: URL-controlled deterministic fixtures now render canonical reset and both-overlay compositions, producing four passing captures.
- Visual refinement: direct screenshot inspection found V1-T5-001, a collision between the team-zone label and central role anchors. Labels moved to the upper interior zone edge; four rendered tests and four focused axe scans passed after recapture.
- Product Designer graybox sign-off: PASS for renderer work; seven regions and six roles remain legible, the office remains primary, and no V0/V1 layout discrepancy remains.
- Accessibility sign-off: PASS for renderer work; zero axe violations in four state/viewport scans, native keyboard-first Reset view, visible focus, semantic role list, reduced motion, and 44px interaction floor.
- Verification: focused layout unit 6/6; focused rendered 4/4; focused accessibility 4/4; existing E2E 4/4; full axe 6/6; formatting, ESLint, TypeScript, build, console/network, manifest validation, and diff checks passed.
- Evidence boundary: measurements and captures are graybox Candidate evidence only. Manual screen reader, 200% zoom, comprehension, owner graybox acceptance, high fidelity, and art direction are not claimed.

## Task 6 — PixiJS scene adapter and lifecycle

Date: 2026-08-13

- RED 1: focused unit coverage failed with `ERR_MODULE_NOT_FOUND` because the office scene adapter did not exist.
- GREEN 1: 3 unit tests passed for immutable descriptor reconciliation, deterministic depth/entity ordering, stale-node removal, resize, context-loss signaling, and complete clear/destroy cleanup.
- RED 2: a Strict Mode lifecycle test proved that unmount during asynchronous Pixi initialization leaked the renderer.
- GREEN 2: the adapter now tracks idle/mounting/mounted state, defers teardown until initialization settles, suppresses the ready signal for cancelled mounts, and passes 4 focused lifecycle tests.
- RED 3: the focused Playwright probe found no Pixi canvas because the surface did not exist.
- GREEN 3: real PixiJS 8.19.0 WebGL mounts one canvas, consumes immutable graybox descriptors, reconciles exact `zone_team,agent_a,agent_b` depth order, resizes to the host, emits typed `scene.entity.select` intents, and fully releases its canvas, listeners, scene nodes, and renderer.
- RED 4: tightened browser acceptance found no typed selection result and no explicit context-loss recovery action.
- GREEN 4: pointer selection emits a typed entity intent; canvas loss exposes the equivalent DOM Office outline and Retry canvas performs a complete destroy/remount recovery before explicit release.
- Lifecycle refinement: React Strict Mode double-mount and asynchronous cancellation are covered; React supplies descriptors and callbacks but never mutates Pixi display objects.
- Visual QA: direct 1280 ready/fallback capture inspection found V1-T6-001, where the fallback action created an unintended full-width second header row. The four-column header correction passed recapture at 1440×900 and 1280×800; direct reinspection cleared the defect.
- Boundary: source scans found no PixiJS or React imports in `packages/domain` or `packages/contracts`. The web project alone enables `skipLibCheck` because PixiJS 8.19.0 `@webgpu/types` declarations conflict with the installed TypeScript DOM declarations; strict application checking remains enabled and passed.
- Verification: focused lifecycle unit 4/4; focused Pixi browser 4/4 across both approved viewports; formatting, ESLint, TypeScript, production build, pure-boundary scan, and diff checks passed.
- Evidence boundary: captures are temporary current-build graybox QA outputs only. They do not prove Task 7 camera behavior, Task 8 shell parity, Checkpoint B, high fidelity, art direction, or owner graybox acceptance.

## Task 7 — Camera, depth, occlusion, and hit testing

Date: 2026-08-13

- RED 1: focused unit coverage failed with `ERR_MODULE_NOT_FOUND` because the office camera/geometry module did not exist.
- GREEN 1: 6 tests passed for byte-exact canonical reset with selection preservation, discrete zoom policy, recoverable pan clamps, reversible coordinate mapping, deterministic isometric depth/tie order, visible topmost hit testing, and authored selected/attention cutaways.
- Test refinement: the first zoom assertion incorrectly assumed the 1280 canonical stop was below `1.0`; it was changed to require the next authored stop, correctly accepting `1.125 → 1.25`.
- RED 2: the adapter transform test failed because `setCamera` did not exist.
- GREEN 2: a validated immutable scene-transform contract now drives the Pixi container scale/translation; 4 adapter lifecycle tests, TypeScript, and ESLint passed.
- RED 3: focused Playwright coverage found no camera state, transformed agent coordinate, or fixed-orientation metadata.
- GREEN 3: native 44px zoom, pan, and exact reset controls drive the real Pixi scene. Transformed pointer selection resolves `agent_a`; pointer click and keyboard Enter produce byte-equivalent camera states; reset retains the selected intent; zoom clamps to `0.625…1.25`; pan clamps to the recoverable edge; no rotation/orbit/perspective control or draggable dependency exists.
- Lifecycle refinement: the first browser GREEN attempt exposed camera publication before async Pixi mount completion under React Strict Mode. The adapter ref is now published only after mount resolves, while closure cleanup still cancels in-flight initialization.
- Regression refinement: the combined Task 6/7 run exposed two stale test assumptions—hard-coded pre-camera hit coordinates and Zoom in changing the already-maximal 1440 canonical view. Tests now consume the projected agent coordinate and use Zoom out for parity at both viewports.
- Visual QA: direct 1280 canonical recapture inspection confirmed separated camera controls and DOM outline, visible agent centers, and office-primary composition. The Task 6 fallback header correction remained intact; no V0/V1 Task 7 discrepancy remained after inspection.
- Accessibility: 4 focused axe scans passed across ready/fallback states at 1440×900 and 1280×800. Controls are native buttons with visible focus and no precision drag requirement. Manual screen reader and 200% zoom remain Task 15 gates.
- Verification: camera unit 6/6; adapter lifecycle 4/4; combined Task 6/7 browser 8/8; camera axe 4/4; formatting, ESLint, TypeScript, production build, and diff checks passed.
- Evidence boundary: this proves the bounded graybox camera probe only. It does not prove the Task 8 persistent shell/DOM parity, Checkpoint B, manual accessibility, high fidelity, art direction, or owner graybox acceptance.
## Task 8 — React shell and equivalent Office outline

Date: 2026-08-13

- RED 1: focused component coverage failed because the semantic Office shell did not exist.
- GREEN 1: 8 component tests passed for exactly three persistent structures, skip-link focus, seven zones, six people, 13 stable DOM/canvas twins, state/relationship/action semantics, a polite live region, and truthful loading/empty/partial/error/stale/offline/canvas-loss causes and recoveries.
- Harness refinement: the first state-matrix run retained prior renders because this component project does not auto-clean between parameterized tests. Explicit Testing Library cleanup fixed the harness; no product behavior changed.
- RED 2: focused browser coverage found the Phase 0 scaffold still on the default route and no state fixtures or canvas-loss recovery.
- GREEN 2: the default route is now the graybox office workspace. A 13-entity Pixi scene and equivalent Office outline share stable IDs; keyboard Tab reaches the skip link first; Enter focuses the outline; real `webglcontextlost` removes the canvas, preserves causes/actions/outline, and Retry canvas remounts WebGL.
- Unhappy paths: deterministic query fixtures cover loading, empty, partial, error, stale, offline, and canvas-loss while preserving Reset view and outline actions. Component coverage proves the full lattice; browser coverage proves offline and actual context loss/recovery.
- Persistent chrome: project bar, office scene, and Office outline are the only three persistent structures. No inspector, metric panel, card dashboard, or dense status sidebar was introduced.
- Test migration: three obsolete Phase 0 browser tests now assert the current title, workspace, equivalent outline, reduced-motion stability, axe compliance, and non-baseline current-build capture. They no longer overwrite Phase 0 screenshot evidence.
- Browser-noise boundary: Chromium emits an exact WebGL driver performance warning containing `GPU stall due to ReadPixels`; the Task 8 failure collector excludes only that driver message. All application warnings/errors, request failures, and non-loopback requests remain failures.
- Visual QA: direct 1280 current-build inspection passed for office-primary composition, visible six-role/team geometry, separated project bar, and internally scrollable outline/actions. Automated 1440 capture passed, but the local forwarding viewer rejected two resized copies; direct 1440 visual inspection is not claimed.
- Verification: Task 8 component 8/8; focused shell E2E 4/4 across both viewports; migrated current-office browser checks 8/8; TypeScript, ESLint, formatting, build, and diff checks passed.
- Evidence boundary: the default office is a neutral graybox and does not prove Task 9 shared selection/inspector, later attention/Library/motion work, manual accessibility, comprehension, high fidelity, art direction, or owner graybox acceptance.

## Checkpoint B — Foundational office

Date: 2026-08-13

- Result: PASS.
- Full repository gate: `npm.cmd run verify` passed.
- Protocol: 4 tests and 275 exact Codex 0.146.0 schemas; roles: 3 tests and 6 pinned Candidate/non-executable Agency Agents roles; qualification: 16 tests.
- Static/UI boundary: graybox evidence 3/3; workspace contracts 4/4; formatting, ESLint, TypeScript, production build, scaffold contract, and dependency boundaries passed.
- Behavior: 26 unit files / 95 tests; 2 component files / 9 tests; 12 integration files / 38 tests plus one guarded live test skipped; 7 contract files / 35 tests.
- Browser: 16 E2E, 10 axe, and 6 rendered current-build tests passed across Chromium 1440×900 and 1280×800, including reduced motion, clean application console/request inventory, real context-loss recovery, camera parity, and semantic outline access.
- Evidence-integrity refinement: full verify revealed Task 8's unscoped global button padding changed all four Task 5 screenshot bytes. Shell button/focus rules were scoped to `.office-shell`; the four Task 5 captures were rerun and returned exactly to their registered SHA-256 values, while 8 focused shell component/E2E/axe/visual checks remained green.
- Evidence boundary: Checkpoint B proves deterministic foundational graybox behavior only. Manual screen reader, 200% zoom, comprehension study, Tasks 9–15, owner graybox acceptance, high fidelity, and art direction remain open.
## Task 9 — Shared selection, focus, and contextual inspector

Date: 2026-08-13

- RED 1: the focused component test selected the Implementation Engineer but found no selected entity ID or inspector.
- GREEN 1: 9 component tests passed. Outline selection opens one contextual inspector keyed by the stable canvas/DOM entity ID; the inspector includes state, cause, update, freshness, current work, blocker, evidence, runtime binding, permissions, and technical trail; Escape closes it and restores trigger focus.
- RED 2: the browser parity test proved outline selection/320px resize/focus restoration already worked, while the production canvas exposed no transformed hit coordinate or selection callback.
- GREEN 2: Pixi typed intents now update the same `OfficeWorkspace` selection consumed by the outline and inspector. The production host publishes the deterministic transformed Implementation Engineer center; canvas and outline open the same inspector and update the same scene selected ID.
- State refinement: controlled canvas selection initially opened the correct inspector but left the live region at `Workspace current`. Controlled selection changes now announce the selected canonical entity through the shared state seam.
- Resize/focus: opening the inspector reduces scene/outline width by exactly 320 CSS pixels at both viewports; ResizeObserver recomputes the camera; closing restores the prior width and outline trigger focus. Canvas selection has no fabricated DOM trigger to restore.
- Visual QA: direct 1280 current-build inspection passed for office-primary composition, contextual inspector hierarchy, complete truth fields, and reachable outline actions; no V0/V1 Task 9 discrepancy remained. Captures remain non-baseline test outputs.
- Verification: component 9/9; selection/inspector E2E 4/4 across 1440×900 and 1280×800; default-office axe 2/2; formatting, ESLint, TypeScript, and diff checks passed.
- Evidence boundary: Task 9 does not prove attention actions, evidence surfaces, motion/failure equivalence, manual accessibility, comprehension, high fidelity, art direction, or owner graybox acceptance.

## Task 10 — Attention rail and manager escalation actions

Date: 2026-08-13

- RED 1: the focused application suite failed to import the absent attention command handler.
- GREEN 1: 9 application tests passed for approve, decline, defer, cancel, and redirect receipts; current-revision and manager authority checks; target correlation; required defer/redirect scope; and fail-closed stale, timeout, and disconnect behavior.
- RED 2: 4 focused component tests failed because the shell exposed no manager-attention trigger, rail, canonical order, locate action, dismissal distinction, receipt, or stale/offline denial.
- GREEN 2: 14 focused component tests passed. The rail consumes its supplied canonical projection without re-sorting or becoming a second task store, collapses when empty, locates the same stable office entity, preserves topmost Escape behavior and trigger focus, and separates local dismissal from canonical disposition.
- RED 3: both 1280x800 browser journeys timed out waiting for the absent production attention projection.
- GREEN 3: 4 focused browser journeys passed across 1440x900 and 1280x800. The production fixture now traverses the shared application handler, resizes the office by exactly 280 CSS pixels, locates the target, keeps the inspector topmost, restores focus, rejects stale disposition, and exposes an exact attributable agent-visible revision 42-to-43 receipt.
- Visual QA refinement: direct current-build inspection at both viewports found the exact receipt identifier overflowing the 280px rail. The receipt now wraps within its bounded container, a browser geometry assertion prevents horizontal recurrence, and recaptured scene, receipt, controls, and Office outline segments passed direct inspection. The office remains primary and all critical content stays reachable.
- Broader regression: production build and TypeScript passed; all 15 component tests, 24 E2E tests, 10 automated axe scans, and 6 rendered visual tests passed across both viewports.
- Evidence boundary: Task 10 proves graybox attention interaction, attribution, layout, and fail-closed behavior only. It does not prove Task 11 Library/evidence surfaces, later motion/manual accessibility/comprehension gates, high fidelity, art direction, or owner graybox acceptance.
## Task 11 — Project Library and evidence/review surfaces

Date: 2026-08-13

- RED 1: the focused application suite failed to import the absent browser-safe evidence projector.
- GREEN 1: 3 application tests passed. Authoritative, approved, provisional, contested, stale, superseded, and rejected remain seven deterministic lifecycle values; unauthorized records are omitted; sensitive title/snippet/summary content is withheld; hidden reasoning is never projected; and test, visual, and release evidence remain separate.
- RED 2: 2 focused Library component tests failed because no Library or focused-evidence surface existed.
- GREEN 2: 2 Library tests and 16 shell tests passed. The quiet Library exposes seven lifecycle rows and three evidence lanes, labels complete-but-unapproved explicitly, opens focused evidence, retains stable revision/origin IDs, locates the origin in the shared office selection, and restores focus to the initiating evidence control.
- RED 3: both 1280x800 browser journeys timed out because the production office had no safe Library projection.
- GREEN 3: 4 focused browser journeys passed across 1440x900 and 1280x800. The Project Library, review station, and delivery area are stable spatial origins; the 420px Library resize preserves the office; visual evidence opens directly from the review station; and origin changes fall back to the Office outline when the original inspector action no longer exists.
- Security boundary: only the already projected `BrowserLibraryProjection` enters the web fixture. Raw unauthorized titles/snippets, secrets, hidden reasoning, filesystem paths, and credentials are absent from the browser surface and fixture bundle; application tests separately prove their removal before projection.
- Visual QA: direct current-build inspection at both viewports passed for Library hierarchy, all seven explicit lifecycle labels, evidence-lane separation, complete-not-approved wording, preserved office scene, and reachable spatial outline origins. Separate overview and origin-return captures prevent evidence scrolling from hiding either proof. These are graybox interaction/layout captures, not art approval.
- Broader regression: production build and TypeScript passed; 28 unit files / 107 tests, 3 component files / 19 tests, 28 E2E tests, 12 axe scans, and 6 rendered visual tests passed.
- Evidence boundary: Task 11 does not prove Task 12 failure/motion equivalence, manual accessibility, comprehension, high fidelity, art direction, or owner graybox acceptance.
## Task 12 — Failure, reconnect, and motion equivalence

Date: 2026-08-13

- RED 1: the focused unit suite failed to import the absent semantic-motion planner.
- GREEN 1: 3 motion unit tests passed. Canonical revision is applied before presentation; one transition leads while later transitions queue deterministically; only authored semantic travel is allowed; checkpoints are named; transform/opacity are the only animated properties; loops are false; reduced motion uses immediate placement; and pausing motion never pauses runtime work.
- RED 2: 11 component checks failed because rate/budget limits, permission denial, missing artifact, test failure, reviewer disagreement, event conflict, restart, cancellation, and semantic motion cues were not represented.
- GREEN 2: 27 shell component tests passed. Every failure state now exposes a plain-language cause, non-idle runtime label, recovery action, stable outline state, and live-region semantics; the motion cue exposes canonical revision, checkpoint, presentation, queue length, loop state, and runtime independence without becoming a persistent dashboard structure.
- RED 3: the focused browser suite found new failure query states falling back to ready and no production motion fixture.
- GREEN 3: 6 browser journeys passed across 1440x900 and 1280x800. Eleven failure/recovery states remain explicit, standard motion runs one 480ms non-looping transform/opacity explanation at a named checkpoint, and reduced motion exposes the same revision, destination, queue, and announcement with zero animations.
- Visual QA refinement: the first reduced-motion capture named revision 43 but omitted the destination. The persistent label now reads `Handoff recorded at Review station · revision 43`; both viewport captures and direct inspection passed. The cue remains subordinate to the office and does not fabricate activity.
- Broader regression: production build and TypeScript passed; 29 unit files / 110 tests, 3 component files / 30 tests, 34 E2E tests, 12 axe scans, and 6 rendered visual tests passed.
- Evidence boundary: Task 12 proves graybox state/motion semantic equivalence and deterministic browser checkpoints only. It does not prove Checkpoint C, manual accessibility, comprehension, high fidelity, art direction, or owner graybox acceptance.
## Checkpoint C — Complete graybox manager workspace

Date: 2026-08-13

- Result: PASS.
- Full repository gate: `npm.cmd run verify` passed after one isolated formatter-only correction in the Task 10 application handler.
- Static/contracts: exact Codex 0.146.0 protocol 4 tests / 275 schemas; Agency Agents 3 tests / 6 Candidate non-executable roles; qualification 16; graybox evidence 3; workspace contract 4; scaffold 2; formatting, ESLint, TypeScript, and production build passed.
- Behavior: 29 unit files / 110 tests; 3 component files / 30 tests; 12 integration files / 38 tests plus one guarded live test skipped; 7 contract files / 35 tests.
- Browser: 34 E2E, 12 axe, and 6 rendered regression tests passed across Chromium 1440x900 and 1280x800. A separate 6-case named capture supplement passed for permission-blocked, offline, reconnect, and keyboard focus at both viewports.
- Capture matrix: default, selection, attention, permission-blocked/offline, review, complete-not-approved, reconnect, keyboard focus, and reduced-motion outputs now exist at both approved viewports. Captures remain ephemeral current-build evidence and are not promoted visual baselines.
- Evidence boundary: Checkpoint C proves the complete deterministic graybox manager workspace through Task 12. It does not authorize live kickoff, promote Candidate roles, prove manual accessibility/comprehension, or approve high-fidelity art direction.
## Task 13 — D-25 kickoff domain and command workflow

Date: 2026-08-13

- RED 1: 3 contract checks failed to import the absent kickoff contract. GREEN: 3 passed for one versioned equal briefing, exactly six unique active roles, secret rejection, attributable complete contribution fields, and exact briefing-version binding.
- RED 2: 4 domain checks failed to import the absent kickoff aggregate. GREEN: 4 passed for six initial entries, complete synthesis inclusion, preserved disagreement/evidence gaps, one revision per role, silence remaining absent, complete manager charter requirements, pre-charter execution denial, and single-round redirect/reject preservation.
- RED 3: 2 persistence checks failed to import the absent kickoff store. GREEN: 2 integration tests passed for immutable attributable record persistence, restart recovery, conflict rejection, dissent preservation, manager disposition, and project isolation through migration 003.
- RED 4: 2 application checks failed to import the absent command handler. GREEN: 2 passed for exact revisioned receipts, attribution, manager/agent authority, stale denial, and implementationAllowed remaining false before charter.
- Verification: kickoff contract 3/3; domain/application unit 6/6; persistence integration 2/2; formatting, ESLint, and TypeScript passed after removing one unused type-only runtime value.
- Evidence boundary: Task 13 proves deterministic canonical kickoff mechanics only. It does not execute Candidate roles, call a provider, approve a live kickoff, prove Task 14 UI/parity, or select a real initial charter.## Task 14 — Kickoff UI and reciprocal parity

Date: 2026-08-18

Phase 4 resumed here after the interstitial open-question work stream. The first slice of this
task, `packages/application/src/kickoff-read-model.ts`, had landed in commit `bd184b3` before the
pause and was not re-done.

- RED 1: the focused component suite failed to import the absent `./kickoff-panel.js`.
- GREEN 1: 8 component tests passed. The shared briefing version is stated rather than implied;
  all six roles are named and every entry is attributed to both a role and an agent; an
  attributed disagreement is preserved rather than merged; an unanswered role renders as
  "No response recorded" and is asserted **not** to match /agreed|affirmed/; an incomplete round
  names the missing roles instead of inferring consensus; the decision impact states plainly that
  no work is authorised before a charter; the manager edit diff shows before and after; and a
  further test asserts the **absence** of any transcript surface — no `role="log"`, no text
  matching /transcript/i.
- RED 2: 4 new shell tests failed while the existing 27 continued to pass, isolating the wiring.
- GREEN 2: 31 shell tests passed. The kickoff opens from exactly its two approved anchors, the
  collaboration table and the manager desk; a test asserts the review station does **not** offer
  it, so the anchoring is enforced rather than incidental; focus returns to the trigger on close;
  and the Office outline is asserted present **while the kickoff is open**, which is the MDD rule
  that opening a surface cannot hide the office, expressed as a test rather than a principle.
- RED 3: 10 browser journeys and 6 axe scans failed across both viewports because no kickoff
  fixture existed. The existing 34 E2E and 12 axe tests continued to pass.
- GREEN 3: 44 E2E and 18 axe tests passed across chromium-1440x900 and chromium-1280x800.
  Coverage: clean console, no failed requests, and no non-loopback requests on the primary
  journey; the office outline and Pixi canvas remain present with `data-kickoff-open="true"`;
  attribution, dissent, and unanswered roles survive into the real build; keyboard-only open and
  close with focus restored to the trigger; the kickoff stays truthful while the runtime is
  offline; reduced motion preserves meaning with zero animations; and axe reports no violations
  for an incomplete round, a synthesised round with dissent, or at 200% zoom.
- Static gates: Prettier, ESLint at `--max-warnings 0`, `tsc -b` across every package, and the
  production Vite build all clean.

### Design decisions recorded

- **Two spatial anchors only.** `kickoffAnchors` is `zone_collaboration` and `zone_manager`,
  matching the composition in `.ui-craft/spec.md`. A negative test keeps the set closed.
- **Scoped stylesheet.** `kickoff-panel.css` declares nothing outside `.kickoff-panel` — no
  `:root`, no bare element selectors, no universal selector — with a comment naming D4-V2-001.
  That defect exists because two surface stylesheets each declared global rules; this is not a
  third.
- **Fixtures are built by running the real reducers** over a real briefing rather than by
  hand-writing the projected shape, so a change to the kickoff aggregate changes the fixture
  instead of letting it drift into fiction. The fixture carries a comment stating that these are
  graybox records: no role promoted, no provider called, no charter approved.

### Two test corrections during GREEN

Both were wrong selectors in newly written tests, not weakened assertions. The entity inspector
is `role="complementary"`, not `region`; and zone triggers read `Locate <label>` while person
triggers read `Inspect <label>`. The implementation was not adjusted in either case.

### Evidence boundary and a named weakness

Task 14 proves the deterministic graybox kickoff surface and its browser and automated
accessibility behavior. It does **not** prove the recorded screen-reader walkthrough, the
comprehension study, high fidelity, art direction, or owner graybox acceptance; those are Task 15.
No kickoff state was added to the Checkpoint C capture matrix, which Task 15 must address.

**Named weakness in the offline assertion.** The offline journey asserts that the decision impact
still reads "No work is authorised yet". That property holds today, but it would also hold if the
panel never rendered an authorised state under any condition, because no fixture approves a
charter. The assertion guards the right property and is not vacuous, but it does not yet prove
that a *degraded runtime specifically* cannot promote a kickoff to authorised. Closing that
requires a chartered fixture to contrast against, which belongs to the separately gated live
kickoff rather than to Task 14. Recorded so this is not later read as stronger evidence than it is.

## Task 15 — Comprehension study

Run 2026-09-08 at 1280x800, build `d260594`, gap 18 days from the last commit touching interface
source and 20 from the last behavioural one. Full sheet: `comprehension/run-2026-09-08.md`.

**Closed by owner waiver on 2026-09-08 with three of six criteria never run.**

| Criterion | Outcome |
| --- | --- |
| T1 assignment and state | pass |
| T2 attention | pass |
| T3 waiting versus blocked | waived — not performed, no evidence |
| T4 completed versus approved | pass by owner disposition |
| T5 evidence and next action | waived — not performed, no evidence |
| T6 truthfulness | waived — not performed, no evidence |

Three criteria exercised, three waived. No criterion was flagged as answered from memory of
building the interface, so the two clean passes are uncontaminated.

**This is not a comprehension pass and must not be cited as one.** The MDD §20 criteria are not
met; the owner exercised his authority to close the item without meeting them. T5 and T6 guard
the V0 truthfulness properties — silence must never read as assent, and nothing may imply
progress that is not happening — and both remain unexamined by a human reader, asserted only by
automated tests.

Two write-ups of this run were produced and retracted before the facts were established: the
first scored three unperformed tasks as interface failures, the second scored two. Both were
corrected by asking the operator what he had actually opened. The instrument could not
distinguish an unattempted task from a failed one, because "no idea" and a genuine "cannot tell"
went into the same field. A per-task opened/did-not-open mark is required before any future run.

Still outstanding for Task 15: the screen-reader walkthrough and the owner graybox gate.

## Task 15 — Screen-reader walkthrough

**Waived by owner on 2026-09-08. Never run.** No screen reader was attached to this interface at
any point. `comprehension/screen-reader-walkthrough.md` retains the seven-step script, marked
waived.

MDD §19 requires a recorded manual walkthrough. That requirement is **not met**. Automated axe
scans are evidence but not certification, and the walkthrough is the part axe cannot perform —
notably W5 (an unanswered kickoff role announced as anything resembling agreement, V0) and W6
(anything announced implying work is progressing while degraded, V0).

Combined effect with the comprehension waiver recorded above: the V0 truthfulness properties —
silence must never read as assent, and nothing may imply progress that is not happening — now
have **no human verification of any kind**, visual or auditory. They rest entirely on automated
assertions over deterministic fixtures. This is a known and accepted position, not an oversight.

Task 15 now has one item left: the owner graybox gate.

## Task 15 — Owner graybox gate

**Accepted by the owner on 2026-09-08.** Behavior and composition accepted; no corrections
requested.

The acceptance rests on:

- automated evidence — the 22-test capture matrix, clean console and network, zero axe
  violations, and keyboard, focus, reduced-motion and 200%-zoom coverage, all previously green;
- both D4-V2 defects fixed rather than disposed;
- three of six comprehension criteria, two passing clean and one passing by owner disposition.

It does **not** rest on any human verification of the truthfulness properties. The comprehension
study was closed by waiver with T3, T5 and T6 never performed, and the screen-reader walkthrough
was waived and never run. No record exists of `?state=permission-denied`, `?state=offline`,
`?kickoff=revision` or `?kickoff=round` being reviewed during this gate.

Stating that plainly is the point of recording it. The gate is closed on owner authority over an
evidence base that is complete on the automated side and partial on the human side.

**Task 15 is complete. Phase 4 Tasks 1–15 are done.** Tasks 16–18 — role promotion, live kickoff,
and the final gate — remain unauthorized and require explicit owner approval before any work
begins.

## Correctness fix — kickoff-store canonical serialization

Found while reviewing open items, fixed 2026-09-08. Not a Phase 4 task; recorded here because
this is the active log.

`storeKickoffRecord` used raw `JSON.stringify` for conflict detection while `event-store` and
`open-question-store` both used `stableStringify`. Two records with identical values in a
different key order were therefore reported as `KICKOFF_RECORD_CONFLICT` instead of being
idempotent.

**RED, on the owner's Windows machine:** `treats key order as insignificant when detecting record
conflicts` failed with `expected [Function] to not throw an error but 'Error:
KICKOFF_RECORD_CONFLICT' was thrown`. Three of four tests in the file passed, including the new
`orders array elements significantly, unlike object keys` guard — that one is a guard against
over-canonicalising, not RED evidence, and passed both before and after.

**GREEN:** 4/4 after switching to `stableStringify`. Full `npm run verify` green on Windows:
toolchain 10, protocol 4, roles 3, qualification 16, scaffold 2, ui-contract 3+2+2+4, unit 133,
component 42, integration 47 (1 skipped: live Codex), contract 55, build, e2e 46, a11y 18,
visual 22.

### Migration decision — none, and why

This changes a persistence canonicalization format. Rows written before it hold raw-JSON
`canonical_json`, so re-storing such a record would compare a `stableStringify` result against a
raw-JSON string and could report the very conflict this fixes.

No migration is written, on the following evidence rather than on assumption:

- No `.sqlite` file exists anywhere in the repository or in any reachable path. The store writes
  to `<projectRoot>/.cuckcode/state/cuckcode.sqlite`, and no such file was found.
- Every existing `kickoff_records` row is created by tests in `mkdtempSync` temp directories and
  does not survive the run.
- No live kickoff has ever executed and no charter record exists.
- `event-store` and `open-question-store` were never affected; only `kickoff_records` used raw
  serialization.

If a project database is later found predating 2026-09-08 with kickoff records in it, this
decision is wrong for that database and a migration reserialising `kickoff_records.canonical_json`
is required. `schema_migrations` and `user_version = 4` provide the mechanism. Recorded so the
absence of a migration is a decision on record rather than an omission.

## Task 16 — Exact role promotion and live kickoff preflight

Complete 2026-09-08. The decision packet is owner-approved; this records the executable half.
**No provider call was made and nothing is promoted.**

Three units, each RED against deliberate stubs before implementation, each GREEN after, and a full
`npm run verify` green on Windows at each step. Unit total moved 137 → 151 → 162.

| Unit | RED | Tests |
| --- | --- | --- |
| `scripts/promote-roles.mjs` | 9 of 9 | 9 |
| `packages/runtime-codex/src/kickoff-policy.ts` | 8 of 14 | 14 |
| `packages/domain/src/kickoff-preflight.ts` | 9 of 11 | 11 |

The tests that passed before and after are guards against over-correction — that allowed methods
stay allowed, that a qualification exactly at the age limit is not stale, that an under-filled
round is legal — and are recorded as guards rather than as RED evidence.

### The three properties that carry the acceptance

**Promotion is all-or-nothing, and the promoted set is derived rather than stored.**
`promotedRoleIds` recomputes from the manifest on every call, so a role stops counting the moment
its digests no longer match what was approved. A contract version that changed after promotion was
never the version the owner promoted, and nothing has to remember to revoke it. That property is
what makes promote-until-revoked safe rather than merely convenient.

**The text-only policy watches what came back, not what was configured.** Any observed
`runtime.command`, `runtime.file`, `runtime.tool` or `runtime.artifact` stops the run, because
seeing one means the configuration meant to prevent it did not. Spawn arguments compare as an exact
sequence rather than a set, since a set comparison accepts a reordering and position is how an
unexpected flag takes effect.

**Compatibility is checked in the join, not in either record.** A binding qualified against a
contract version other than the promoted one is refused. Both records look correct alone; only
their relationship is wrong. Same shape as the derived promoted set.

### Reuse rather than restatement

Each unit asserts against the definition it guards rather than a copy: the policy imports
`CODEX_ARGS` and `ALLOWED_REQUEST_METHODS` from the supervisor, the preflight delegates roster
checking to `validateSixRoleRoster` in contracts, and `contractVersionOf` formats the version
string in one place. A guard carrying its own copy of what it guards is the C-1 F2 defect: the two
drift and the test keeps passing while proving nothing.

### What this does not establish

The mechanisms are built and unit-tested. **None has run against a real binding, because no agent
bindings exist.** Task 17 is where they are first exercised, and a green unit suite is not evidence
that the live path works.

One test was tightened after failing: `planRevocation` returns `NOT_PROMOTED` with the offending
`roleId`, matching the other failure shapes, where the test had asserted the bare object. The
assertion is stronger than written, not weaker.
