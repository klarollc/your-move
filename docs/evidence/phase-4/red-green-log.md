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

## Task 17 — The first live kickoff path (in progress)

Two of three parts are complete. **Nothing here has touched a provider.** 17c, the supervised live
run, has not happened, and no agent binding exists.

| Part | Unit | RED | Tests | Commit |
| --- | --- | --- | --- | --- |
| 17b | `packages/application/src/kickoff-run.ts` | 7 of 9 | 9 | `7364e6e` |
| 17a | `packages/runtime-codex/src/binding.ts` | 8 of 9, one invalid | 9 | this commit |
| 17c | supervised live run | — | — | not started |

Unit total moved 162 → 171 → 180. A full `npm run verify` was green on Windows after each part.

### One RED in 17a is not valid evidence

`binding.unit.test.ts` has nine tests. Eight failed against the deliberate stub. The ninth —
"rejects incomplete handshake facts rather than defaulting them" — passed, because the stub
returned `FACTS_INCOMPLETE`, which is exactly the code that test asserts. A test that passes
against a stub has proved nothing about the implementation that replaced it.

Recorded rather than papered over: eight tests carry RED evidence, one does not. The stub should
have returned a code no test asserts. That is the general rule and it was broken here.

### What 17b establishes

The orchestrator spends the turn budget before it can be exceeded, not after: the budget is
projected for the turn about to be taken, and `turnsUsed` increments even when the turn fails, so
a failing turn still costs. Observed-event policy is applied to what came back before the turn is
recorded, so a turn that produced an external effect never becomes part of the round. Silent roles
are derived from the roster minus those that responded, never accumulated, so the set cannot drift
from the roster it describes.

**A single failed contribution stops the whole run.** That follows the spec, and it is a real
design decision rather than a fallback: one flaky turn at role two ends the round and leaves four
roles silent, against a 13-turn budget that is not cheaply repeatable. The alternative — continue
and mark the gap — is defensible and would produce a round that says truthfully that five of six
roles contributed. **This is unresolved and the owner has not ruled on it. The cheapest moment to
decide is before the live run, not after it burns a budget.**

### What 17a establishes

The report is built from facts the runtime reported, never from what was requested. Model, auth
mode and protocol version are read back and compared; a difference stops the binding before a turn
is spent, because "which model produced this" has to be answerable for every record afterwards.

`toolIds: []` in a returned report means the session was observed to expose none. The
`TOOL_SURFACE_PRESENT` branch is what gives the empty list that meaning — without it, an empty
list is indistinguishable from nobody having looked. This is the same V0 truthfulness invariant the
office is held to, applied to a trust record: silence must not read as assent.

The material fingerprint covers the promoted contract digests as well as the session facts. A
binding must not survive a promotion change it was never approved against, and that correctness
lives in the relationship between two records that each look valid alone — the same join-checking
shape as Task 16's promoted set and qualification version check.

### Process failure worth recording

The 17a RED was requested and run 57 seconds before the implementation finished writing to disk.
The resulting output was a full stub RED presented as a post-implementation result, and it was
only distinguishable from a genuine failure by comparing file mtimes against the test start time.
Nothing in the loop makes a run's inputs attributable to a known state of the tree.


## Task 17b amendment — a failed contribution no longer ends the round

Owner ruling 2026-09-09, applied 2026-09-10. RED 6 of 11 against the original behaviour, then a
second RED of 4 after the first implementation was wrong. GREEN 12 of 12 and a full `npm run
verify` green on Windows. Unit total moved 180 → 183.

### What changed

A turn that fails is now that role's failure, not the round's. The run carries on and the result
carries a `failures` list of every turn that was spent and produced nothing usable, each naming its
kind, role, code and turn index.

`silentRoleIds` narrowed to mean what it says. Silence is a role that was never asked. A role that
was asked, cost a turn and produced nothing is a different fact, and reporting it as silent would
lose that the turn was spent. The V0 invariant is that silence must never read as assent; the
converse — that a failure must never read as silence — is the same invariant from the other side.

Three conditions still end the whole run, and this was decided explicitly rather than inherited:

- **The turn budget.** Unchanged.
- **An observed external effect.** Not a per-role failure. Seeing a `runtime.command`, `file`,
  `tool` or `artifact` event means the containment meant to prevent it did not hold, so further
  turns would be spent against a runtime already known to be uncontained.
- **A failed synthesis.** Revisions are revisions *of* the synthesis. Continuing without one would
  ask six roles to respond to a document that does not exist.

A failed turn still costs. `turnsUsed` increments whether or not the turn produced anything, so a
run that fails repeatedly cannot exceed its budget while appearing not to.

### The first implementation was wrong and the domain caught it

The initial implementation carried on past a failed contribution and then attempted synthesis over
five contributions. `recordKickoffSynthesis` refused it with `KICKOFF_SYNTHESIS_NOT_READY`.

The cause is not incidental. `recordKickoffContribution` sets `phase: "ready_for_synthesis"` only
when `Object.keys(contributions).length === activeRoleIds.length`. **D-25 defines a synthesis as
standing over every active role, and the domain enforces it.** A five-of-six round can never be
synthesised, by design.

This is the invariant working. The orchestrator tried to produce a synthesis over a discussion that
was missing a participant, and the domain stopped it. Had the domain been permissive, the round
would have produced a document that reads as a complete discussion with one role quietly absent —
exactly the substitution the V0 truthfulness clauses exist to prevent.

Two alternatives were rejected by the owner in favour of the third:

- Narrowing `activeRoleIds` to the roles that answered. Rejected: it rewrites the briefing
  mid-round, so any charter downstream would rest on a roster the manager never approved.
- Amending D-25 so a synthesis is legal over a quorum. Not rejected on merit — deferred, because it
  changes what a kickoff means and should not be decided to unblock a test.

### The resolution

Every role is asked. If fewer roles contributed than the roster holds, the run stops before
synthesis with `ROUND_UNDER_FILLED`, naming the count. `NO_CONTRIBUTIONS` remains the more specific
stop for a round where nothing came back at all.

The owner's ruling holds in the sense that motivated it: a failure at role three no longer silences
roles four through six, and the record names which role failed rather than leaving four roles
indistinguishable from roles that declined to speak. What it does not do is produce a synthesis
over an incomplete round, and it should not.

### Recorded honestly

The first design was mine and it was wrong. It was caught by a domain invariant rather than by
review, which is the second time in this task that a guard found something reading the
specification did not. Amending D-25 to permit a quorum synthesis remains open and unauthorised.


## Task 17c-1 and 17c-1b — two probes, no RED/GREEN

Run 2026-09-11. Neither is TDD evidence and neither is recorded as such. They are instruments: each
asserts only that a session came up, because a probe that asserts its own conclusion is not a probe.

**17c-1** answered whether the runtime reports the model (yes, at `thread/start`, alongside
`reasoningEffort`) and whether anything enumerates a tool surface (no). Cost one turn. It also
found, without looking for it, that every thread loads an instruction source from the owner's Codex
home — recorded as DF-010 — and that the approved model and effort are not what a default thread
gets.

**17c-1b** answered whether `CODEX_HOME` is honoured. It is: `initialize.codexHome` echoed the
controlled directory and `instructionSources` contained exactly the marker file, nothing outside
it. Cost zero model tokens, because `instructionSources` is reported at `thread/start` and no turn
was needed.

Full detail in `docs/evidence/phase-4/live-kickoff/probe-2026-09-11-codex-facts.md`.

## Task 17c-2a — the binding report says how the model was configured and what bounded it

Complete 2026-09-13. Three suites, RED against deliberate stubs, GREEN after, full `npm run verify`
green on Windows. Unit total moved 183 → 188; contract total moved 60 → 65.

- `packages/runtime-codex/src/binding.ts` — RED 3 of 14, 14 tests.
- `packages/contracts/src/runtime.ts` — RED 3 of the 5 new tests, 10 in the file.
- `packages/runtime-codex/src/supervisor.ts` — RED 1 of 5, 5 tests.

### The first contract RED was invalid and was thrown away

The first run of the contract block reported 2 failures where 4 were predicted. The two "refuses a
report that cannot say X" tests passed — but not because the schema enforced anything. The shared
fixture carried `toolIds: null`, which the stub's `z.array(id)` rejected, so **every** parse of
that object failed, including the two tests that were supposed to be exercising a different field.

They passed for a reason unrelated to what they assert. That is the same defect as Task 17a's stub
collision wearing different clothes: there, the stub returned a code a test expected; here, a
fixture depended on behaviour the stub did not yet have. Both produce a green tick that means
nothing.

The fixture was decoupled — base `toolIds: []`, valid before and after the change — and the block
re-run, giving 3 failures each on its own assertion. **Only the second RED is evidence.** The first
is recorded because a discarded run is part of what happened.

### What changed and why

**`reasoningEffort` is required and nullable.** DF-008 recorded that a binding report could not say
how the model was configured, and judged the impact nil because effort was constant. The probe
falsified that: the runtime reports effort, and its default (`high`) is not what the owner approved
(`medium`). Nullable rather than optional, because `null` is a statement that the runtime reported
nothing, while an absent field is a record that cannot say — which is the gap itself.

**`toolIds` is nullable, and the two empties are different.** `null` means this adapter does not
enumerate a tool surface. `[]` means one was enumerated and found empty. The Codex handshake names
no tool anywhere, so claiming `[]` would assert an observation nobody made — exactly what the
existing test "never reports an empty tool list it did not observe" was written to prevent. The
test was right and the type was not.

**`sandboxPosture` is new, and it is not a permission ceiling.** What `thread/start` reports is
`sandbox.type`, `networkAccess`, `approvalPolicy` and `multiAgentMode` — *bounds*, not exposures.
`permissionCeiling` means the opposite: capability beyond baseline. Populating the ceiling from the
posture would have refused every binding; leaving the ceiling empty with nothing else recorded
would have made an empty claim. Both are recorded, meaning different things.

**The fingerprint was thinner than it looked.** `materialFingerprint` covered adapter, agent, auth
mode, binding id, model, the two promoted digests, protocol version, role and user agent — and
neither `toolIds` nor `permissionCeiling`. Nothing exploited that, because a binding with a
non-empty surface is refused before a report exists, but the fingerprint was claiming to cover
material it did not. All four of surface, ceiling, effort and posture are now in it.

**The supervisor can be given an instruction environment.** `codexHome` sets `CODEX_HOME` on the
child. Unconfigured, no `env` is passed at all rather than a copy of this process's environment,
because a copy is a second version that can drift from the first.

### What `verify` caught that the focused runs could not

Five fixtures in `runtime-trust-store.integration.test.ts` and a type error in the new supervisor
test. Both are the class recorded after the `raisedAt` change: a contract change breaks constructors
elsewhere, and `tsc` is the only check that sees it.

The supervisor one is worth keeping. The test recorded spawn options as `{ env?: ProcessEnv }`, and
under `exactOptionalPropertyTypes` an absent key and a key set to `undefined` are different things —
so the type could not express "no env was passed", which is the fact the test exists to assert.
`{ env: ProcessEnv | undefined }` says it. That is the same distinction as `toolIds: null` versus a
missing field, enforced by the compiler rather than by anyone remembering it.

### What this does not establish

No binding has been built from a live handshake. `HandshakeFacts` is still populated by fixtures in
every test, and nothing yet collects it from a running session. The contract can now hold the truth;
nothing has yet put the truth in it.

---

## `composeRole` — a promoted role becomes an instruction (2026-09-12)

Authorized by the owner's decisions recorded in
`docs/evidence/phase-4/live-kickoff/decision-record-2026-09-12-roles-and-exercise.md`.

### RED

The first RED was `Cannot find module './role-composition.js'` — nine tests, none of them run.
That is a real first failure but a weak one: it establishes the import is wrong, not that the tests
would catch wrong behaviour. A stub returning `{ ok: true, text: "" }` was added to force the
failures to be behavioural, and six of nine then failed on assertions.

**Three passed against that stub, and that is the finding worth recording.** "Is deterministic"
passed because two empty strings are byte-identical. "Orders output by the schema" passed for the
same reason. "Emits nothing that did not come from the brief" passed because an empty composition
has no unaccounted lines. All three were true of a composer that emits nothing at all.

This is the shape the register already tracks — a guard that is exact inside a boundary nobody
examined — occurring in the tests written to enforce it. Each now asserts the mandate is present
before comparing, so none can pass against an empty composition. Verified by re-running against the
stub: three failures became six, then nine.

### GREEN

Nine tests pass. One failure on the way there was substantive rather than mechanical: with only the
first disclosure supplied, `find` reported the *second* missing while the test asserted on the
*third*. Fixed in the implementation rather than the test — `AUTHORITY_DISCLOSURES.filter` now names
every missing disclosure, matching `checkBindingPreconditions`, which already collects every failure
rather than returning the first.

`npm run typecheck`, `npm run lint --max-warnings 0`, `npm run format:check`, and the full unit
project (39 files, 197 tests) are green.

### Two deliberate departures from the approved proposal

**`composeRole` returns text, not text and a digest.** `2026-09-12-roles-as-competence-briefs.md` §5
said both. `@cuckcode/domain` has no `node:` imports and depends only on `@cuckcode/contracts`;
hashing belongs at the edge that already has a platform. Determinism is what the caller needs to
digest safely, and determinism is tested here.

**The function takes the brief and nothing else.** There is no parameter for upstream role text, so
"no upstream instruction leaks into a composed role" is a fact about what the function can see
rather than a check that could regress. This is the §8 rule applied as written: give the guard
nothing it can get wrong.

### What this does not establish

No role has been composed from a file on disk, none has been promoted, and no composed role has
been handed to a runtime. `composeRole` is pure and its input is a value; nothing yet reads
`roles/authored/`, and the six briefs do not exist as artifacts. No live turn has been run, so
whether a model actually treats a composed brief as its operating constraint remains untested — that
is what the exercise gate is for.

---

## The six authored roles become artifacts (2026-09-12)

`roles/authored/<id>.json` for each of the six roles D-16 fixes, holding the corrected briefs from
`docs/proposals/2026-09-12-roles-as-competence-briefs.md` §4. Checked by
`tests/roles/authored-roles.integration.test.ts`, which reads the real files and composes them.
`@cuckcode/domain` stays free of `node:` imports; the filesystem is the test's business, not the
composer's.

### This had no RED, and mutation testing was used instead

The artifacts were written before the test, so a first run passed trivially. A test that has never
failed is not evidence, so each assertion was checked by breaking an artifact and confirming the
suite caught it:

| Mutation | Result |
| --- | --- |
| Paraphrase one authority disclosure | 4 failed |
| Typo a field name (`mandat`) | 1 failed |
| Wrong `roleId` inside a correctly-named file | 2 failed |
| **Copy one role's substance under another's name** | **7 passed — not caught** |

### The fourth mutation found a defect in the test

"Gives each role a distinct composed instruction" collected whole composed texts into a `Set` and
asserted the size was six. Copying Delivery Lead's entire substance into `product-designer.json`
and changing only `roleId` produced texts differing by one line, so the set still held six entries
and the suite reported everything fine.

That is the six-anonymous-agents failure this whole line of work exists to prevent, and the test
written to catch it was blind to it. Any two roles counted as distinct as long as they had different
names — which is true by construction, since the filename supplies the name.

The check now strips the role name before comparing and names the colliding pair. Re-running the
same mutation fails it. The other three mutations were re-confirmed against the corrected suite, and
the artifacts were diffed against a pre-mutation backup to prove no residue was left behind.

This is the second time in one session that a test written to enforce a boundary had the defect it
was meant to catch — the first being three `composeRole` tests that passed against a composer
emitting an empty string. Both were found by asking what the test would do if the code were wrong,
rather than by reading it.

### What this does not establish

Nothing promotes these roles, no `roles/promotion-request.json` exists, and no composed role has
reached a runtime. The manifest still carries the six imported roles as `candidate` rather than
`superseded`. Whether a model treats a composed brief as its operating constraint is untested and
remains what the exercise gate is for.

## Task 17c-6 — Controlled-home credential provisioning and the six role exercises

Date: 2026-09-13

**Defect.** Every role exercise on 2026-09-13 stopped at `AUTH_REQUIRED`. The cause was not absent
authentication: `~/.codex/auth.json` existed and the 2026-09-11 facts probe completed a live turn on
it. `createControlledCodexHome` created an empty directory and passed it as `CODEX_HOME`, which
replaces the credential Codex reads along with the instruction sources it was built to replace. The
DF-010 fix isolated the credential by accident.

The existing test asserted `readdir(home.path)` equalled exactly `["AGENTS.md"]` — a guard that was
exact inside a boundary nobody examined, and that actively locked the defect in place. This is the
DF-010/DF-011 shape a fourth time, now in a test written in this repository.

- RED: five integration tests against `controlled-home.ts`; two failed for the expected reasons —
  no `auth.json` was provisioned, and an absent credential silently produced an unauthenticated
  home instead of failing.
- GREEN: `createControlledCodexHome` now takes an explicit `credentialSourcePath`, copies exactly
  that one file to `auth.json`, exposes `credentialPath`, and throws
  `RUNTIME_CREDENTIAL_UNAVAILABLE` after disposing the partial home when the copy fails. No
  `config.toml` and no inherited `AGENTS.md` is copied, so the DF-010 guarantee is unchanged and is
  now asserted directly rather than as a side effect of counting files.
- Mutation evidence, because reading the test is not enough:
  - delete the credential copy → 3 of 5 fail;
  - swallow the missing-credential error → 1 of 5 fails;
  - write a `config.toml` into the home → the instruction-isolation test fails.
  Each guard was restored and the suite returned to 5 passed.
- Vacuity check: the dispose test asserts the credential is readable *before* dispose, so it cannot
  pass against a home that never had one.

**The six bounded exercises.** `CUCKCODE_LIVE_ROLE_EXERCISE=1 npm run roles:exercise`, one text-only
turn per role, read-only sandbox, `approvalPolicy: never`, no tools, no external effect.

All six performed. Each binding was verified against the approved Task 16 packet rather than against
the request: five roles reported `gpt-5.6-luna` and `release-reviewer` reported `gpt-5.6-sol`, all at
`medium` on protocol `0.146.0`, each with a distinct binding fingerprint. Transcripts are under
`docs/evidence/phase-4/live-kickoff/role-exercises/`.

**The six transcripts are substantively distinct**, which is the claim Task 17c-2b said the run had
to support and the reason composition exists: each role states a different mandate and different
refusals — the Delivery Lead refuses to treat acknowledgement as approval, the Product Designer
refuses to approve its own art direction, the Test Engineer refuses self-validating assertions, the
Release Reviewer names its only two verdicts. Six anonymous agents agreeing would have proved
nothing; this did not happen.

**Limits.** This is exercise evidence, not kickoff evidence. No D-25 round ran, no role is promoted
(`roles:promotion:status` reports `{"promoted":[],"of":6}`), and owner transcript review remains
required before promotion. The credential is copied to a temporary directory for the life of each
session; `dispose` removed every home, and a post-run scan of `%TEMP%` found no `auth.json` and no
`cuckcode-role-*` residue. That cleanup is the only thing bounding the exposure, and Windows cleanup
has failed once before in this project (Task 12, attempt 1, `EPERM`).

## Phase 6 Task 1 — Freeze the comparison fixture

Date: 2026-09-13. Authorized by Decisions 6-A and 6-B, ruled the same day.

**What the task had to prevent.** Three candidates that differ in setup rather than in art direction.
A reviewer scoring three pictures cannot tell whether Candidate B looks calmer because of its
materials or because it quietly rendered one fewer agent. The brief states a controlled comparison
frame in prose; prose does not survive three separate production passes.

- RED: nine tests against a frame that did not exist. Four failed — no frozen artifact, and one
  genuine finding below.
- GREEN: `packages/testing/src/phase6-comparison-fixture.ts` builds the frame from canonical events
  and projects it through `replayProject`, `projectOfficeScene`, and `projectAccessibleOutline` —
  the same projectors the graybox uses, so the frame cannot drift from the product it describes.
  `docs/evidence/phase-6/comparison-fixture.json` is the frozen artifact.
  Digest: `13c33cefebf7b13f9d47479d4dc47da1e00022d763c34c5901f6ee1bb20815f4`.

**The frame.** Six distinct admitted agents, one per promoted role, all `connected`; six role
assignments; one current priority in `active`; no `waiting_input`, `blocked`, or `failed` subject;
declared view state of camera reset, inspector closed, attention rail collapsed, 1440×900 primary
with 1280×800 accommodation. `now` is pinned, because `projectOfficeScene` derives freshness from
the clock and an unpinned one would make the digest drift on its own — turning a drift failure into
noise nobody trusts.

**A test written wrong, and corrected rather than weakened.** The RED suite asserted exactly one
semantic-motion subject. The frame produces two: the active work item moves, and so does the agent
working it. The projector is right and the assertion was wrong. The tempting fix was to relax the
test to "at least one," which would have stopped it from noticing a second moving subject appearing
later. It now asserts one moving work item, one moving agent, that agent's exact id, and nothing
else — a stronger claim than the one that failed.

**Mutation evidence.**

- `viewState.inspector` closed → open: the frozen-digest test fails. Declared view state is inside
  the digest, not decoration beside it.
- active role implementation-engineer → test-engineer: the motion test and the digest test both
  fail.
- a candidate manifest planted on disk but absent from the registry: the manifest test fails. With
  zero candidates produced, that test would otherwise pass over an empty list — this is what makes
  it a guard rather than a formality, and the vacuity check this project keeps needing.

Each mutation was reverted and the suite returned to 9 passed; the full deterministic suite is 345
passed, 3 skipped.

**Limits.** This freezes the frame. It produces no art, scores nothing, and selects nothing. Tasks
2–4 add candidate manifests, each of which must name this digest; Task 8 selection remains owner-run.

## Phase 6 Tasks 2–4 — the three candidates

Date: 2026-09-13. Authorized by Decisions 6-A, 6-B and 6-C.

**Generated, not hand-built.** Three separately drawn offices would drift — a desk nudged, an agent
moved — and the drift would be invisible until a reviewer scored one candidate higher for a reason
that was not art. `scripts/phase6-candidate-geometry.ts` holds the camera, floor plan, zone
rectangles, agent placement, labels and props once; `scripts/phase6-candidate-styles.ts` holds three
*treatments* and cannot move anything. Identical layout is therefore a property of the build, not a
thing anyone has to check.

Artifacts per candidate, under `docs/evidence/phase-6/candidates/<id>/`: `board.html` with all twelve
board deliverables, `composition-1440x900.svg` and `composition-1280x800.svg` standalone, and
`manifest.json` naming the frozen digest. `candidates/comparison.html` puts all three on one page in
the brief's order, because choosing between three files means remembering the first while looking at
the third.

**Four defects found by looking, which is the only way they were going to be found.**

1. *Figures floated beside their desks and labels crossed other zones.* Placement put the figure in
   the aisle and the label a metre above the head, so "Implementation Engineer" sat over the Project
   Library. Figures now sit behind the desk in depth order and labels sit on a plate above the head.
2. *Zone labels were clipped* — "PROJECT LIBRARY" rendered as "ROJECT LIBRARY" — because the text was
   anchored at a corner and ran outside the diamond. Centred on the zone's top vertex instead.
3. *All three inline SVGs declared `<filter id="soft">`.* On `comparison.html` the duplicate ids meant
   B and C silently rendered with **A's** shadow blur — cross-contaminating the single treatment that
   most distinguishes the three emphases. Filter ids are now namespaced per candidate. This is the
   controlled-comparison failure the frame exists to prevent, arriving through the renderer rather
   than through the geometry.
4. *A prop encoded state.* The manager's board carried a "1 priority" caption while board item 9 of
   the same page states that props never encode state. The caption is removed; the rule stands.

**Contrast: a real failure and a wrong threshold, separately.** The first measurement scored every
pair against 4.5:1 and reported four failures per candidate. Two were real — zone labels at 3.4–4.5
— and two were measured against the wrong rule: the attention marker is a graphical object under
WCAG 2.2 SC 1.4.11, which requires 3:1, not the SC 1.4.3 text threshold. Correcting the threshold did
not clear it: the original accent was at 2.5–2.9 and failed 3:1 too. Both were fixed in the palettes
rather than waived, and the table now reports each pair's kind and its own threshold. All six pairs
pass in all three candidates.

**Verification.** Every composition was rendered in a browser and looked at; the DOM was queried to
confirm all three SVGs paint at 1178×736 with their own filters and with 157/196/198 shapes — the
shape-count difference being the declared prop-density difference, not an accident. Corrupting one
candidate's `fixtureDigest` fails the Task 1 guard, so the three manifests are now checked against
the frozen frame on every run rather than by inspection.

**Limits.** No generated raster was produced, so the 6-C hybrid is half-exercised; each manifest
records `generatedExploration: null` rather than implying coverage. Nothing is scored — Task 7 is a
separate task — and nothing is selected. Selection is the owner's at Task 8.

## Phase 6 Task 5 — provenance and originality review

Date: 2026-09-13.

- RED: eight checks against a register that did not exist; five failed on the missing file, three on
  unresolvable citations.
- GREEN: `scripts/phase6-provenance.ts` holds nine references, each with the brief's five required
  fields. The register is written from the same module the candidate manifests cite, so the review
  and the citations cannot drift apart. Manifests now carry `referenceId` pointers instead of
  restating the fields, which removes the second copy entirely.

**The result: no candidate is blocked, and the register is small on purpose.** Six references are
the project's own approved documents, one is in-tree geometry, one is WCAG 2.2, one pair is typeface
families named in a fallback stack. No image was traced, sampled, model-generated or copied; no
external asset is fetched at build time. Neither forbidden thing occurred — no named living artist
imitated, no commercial visual identity reproduced.

**Three gaps recorded rather than resolved.** No external architectural, material, ergonomic,
photographic or historical reference was consulted at all, although the brief permits them: clean
originality and thin research are the same fact here, and Task 7 will be scoring invention rather
than observation. The generated half of the 6-C hybrid is unexercised. Typeface embedding is
deferred to Phase 7 with a named trigger, since only Cascadia Mono (SIL OFL 1.1) would survive it.

**Two mutation-testing lessons, both about guards rather than about provenance.**

1. The typeface check originally matched licence prose with a regular expression. It failed on
   phrasing, not substance — "is embedded … or redistributed" versus "not embedded or
   redistributed" — and could not distinguish either from a real claim. Rewritten to read a
   structured `embedding` field. A guard that greps prose passes on whatever wording it is handed.
2. The first mutation run reported the "unsourced reference blocks its candidate" guard as
   surviving. It had not: prettier had wrapped the target string across two lines, the replacement
   never matched, and the run proved nothing. Re-applied against the built register, the guard fails
   with its intended message. **A mutation that does not apply is indistinguishable from a guard
   that does not work** — the green-run-proving-nothing failure, arriving inside the tooling built
   to catch it. Verify that the mutation landed before believing a survivor.

## Phase 6 Task 6 — accessibility and contrast intent

Date: 2026-09-13.

The contrast half of this task landed early, during Tasks 2–4. What remained was the acceptance
criterion that actually had teeth: **no candidate advances with an undocumented state.**

- RED: eight checks against a report that did not exist.
- GREEN: `scripts/phase6-accessibility.ts` documents all twenty canonical states — twelve
  `WorkState` values and eight `AgentPresence` values — each with cues that survive greyscale and a
  reduced-motion equivalent. `docs/evidence/phase-6/accessibility-report.json` measures them per
  candidate. The state lists are restated in the suite rather than imported, so a state added to the
  domain fails as undocumented instead of silently expanding both sides of the comparison at once.

**Treatments are shared by all three candidates, deliberately.** What a state means is canonical
truth; only its colour is art direction. A candidate that distinguished `blocked` from `failed` by a
cue another candidate lacked would be offering a different semantics, and the owner at Task 8 would
be choosing what the office can express rather than how it looks.

**A real accessibility failure, found by measuring rather than by asserting.** Nine of the twenty
state colours fell below the SC 1.4.11 non-text threshold of 3:1 against the floor, in all three
candidates — every `attention`, `greenery` and `figure` marker. Figures at 2.4:1 against the floor
means the office's own occupants were not reliably perceivable as objects. All three palettes were
corrected until the worst case across every surface a marker can sit on clears 3:1; nothing was
waived. The frozen fixture digest is unchanged, because the frame is state and the fix was colour.

**Mutation evidence.**

- Removing one state treatment (`agent:reviewing`) fails the coverage check.
- Giving `blocked` and `failed` identical non-colour cues fails the distinctness check. This is the
  guard that matters: the weaker version asserts every state *has* a cue, and two states can each
  have a cue while being identical once colour is removed — the same shape as the role-distinctness
  check this repository already recorded as blind to two roles differing only by name.
- The accommodation check counts rendered `<text>` nodes in both compositions rather than trusting
  the board's prose: 13 text nodes and 7 zone labels at both viewports, in all three candidates. A
  fit change that dropped a label would fail rather than be described as fine.

Verified in a browser at both approved viewports: 13 board sections, the Task 6 table rendering all
twenty rows, no horizontal overflow at 1280×800. No claim is made about any viewport outside the
approved D-07 matrix.

## Phase 6 Task 7 — scored review, run by the two promoted roles

Date: 2026-09-13. Owner authorized running the agents rather than producing the reviews by hand.

**Two live provider turns.** `product-designer` and `visual-qa-reviewer`, one bounded text-only turn
each: `gpt-5.6-luna` at `medium`, read-only sandbox, `approvalPolicy: never`, no tools, no external
effect, each isolated in a controlled Codex home carrying only its composed brief. Independent —
neither saw the other's output, and the runs did not share a thread. Both received the identical
packet, digest `d52648c7811f13a4…`.

- RED: two tests against `exerciseThreadStartParams`, which hard-coded the exercise prompt and had
  no way to pose a different bounded task. Both failed.
- GREEN: the task prompt and turn input are parameters, defaulting to the exercise's own. The
  sandbox, approval policy and effort remain fixed, because those are the parts that must never vary
  by caller.

**Both reviewers refused most of the rubric, which is the result.** Each returned 9 scores and 33
refusals across 3 candidates × 14 criteria. Every perceptual criterion — clarity, glance
readability, calmness, warmth, material coherence, reciprocal legibility, collaboration clarity —
was marked NOT-ASSESSABLE by both, in all three candidates, because a text-only turn cannot open an
image and they were told so. A review that had scored "warmth without toy-like character" from a
palette listing would have been the green run that proves nothing, produced by the machinery built
to prevent it.

**Four disagreements, recorded and not averaged** (`scored-review/disagreement-register.md`). The
sharpest: on inclusive agent expression the Product Designer scored 5 from the avatar specification
while the Visual QA Reviewer refused, holding that a specification is not rendered evidence. On this
project's own rule the reviewer is right, and the designer's 5 reads as "the contract is sound", not
"the avatars work". On feasibility the positions reverse — the designer refuses, the reviewer scores
and marks Candidate C down for its plinth and layered shadows. That is the **only** criterion on
which the three candidates separate at all.

**The honest conclusion: Task 7 cannot complete its purpose in a text-only turn.** The review is
real, independent and well-founded on the data it had, and it gives the owner no basis for choosing
between the candidates on how they look. Reporting it as though it narrowed the field would
misrepresent it.

**Mutation evidence.** Making both transcript digests identical fails the independence check;
dropping one reviewer fails two checks. Coverage is counted from the review body only, so the header
that explains the limit is not miscounted as a refusal.

## Phase 6 Task 8 — owner ruling and the clarity reconciliation

Date: 2026-09-13.

The owner viewed the rendered comparison and ruled: *"B is the strongest, but I agree that another
pass for clarity is warranted."*

**Recorded as a reconciliation, not a selection.** The brief's gate offers three outcomes and this is
the third. Recording it as "selected B" would have let Task 9 begin against an artifact the owner
had just said was not yet right.

**The three reviewed candidates are untouched.** The reconciliation is built into
`docs/evidence/phase-6/reconciliation/`, not over Candidate B, because rewriting B would leave the
Task 7 review pointing at something that no longer exists.

**Named traits, per the brief's requirement that a reconciliation say what it retains.** Retained
from B: warm palette, textiles, all sixteen props, practical lighting. Imported from A: a 0.7px edge
on solid faces (B drew none, and this is the largest single source of its softness), a contact shadow
tightened from blur 5 to 2.6, and a wider floor-zone value gap with a darker boundary stroke.
Deliberately **not** imported: A's prop restraint. The clarity problem is definition, not object
count, and subtracting props would subtract the warmth that made B strongest — a choice the owner can
overturn.

**Clarity and accessibility turned out to be the same adjustment, not competing ones.** Deepening the
floor for zone separation cost every graphical marker its 3:1, and the zone label its 4.5:1 — four
markers and one text role fell below threshold. All five were re-solved against the new floor rather
than inherited from B, because an inherited pass is a claim about a different palette. Seventeen
pairs measured, all pass.

Verified in a browser: both compositions render, with separate namespaced filters and **identical
shape counts of 196**, which is the machine-checkable form of the claim that the pass changed
treatment and nothing structural.

**Still open: the reconciled system is Candidate and unapproved.** Task 9 does not begin until the
owner approves it.
