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
