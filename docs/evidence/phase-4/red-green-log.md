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
