# Phase 1 evidence report

Status: **Implementation and machine gate complete; owner acceptance pending**

## Delivered

- Validated stable IDs, UTC timestamps, injected clocks and IDs, and canonical JSON.
- Versioned event envelopes with deterministic ordering, duplicate idempotency, conflict quarantine, and structured malformed-event issues.
- Pure work, evidence, approval, staffing, qualification, and knowledge lifecycle truth reducers.
- Structured reciprocal collaboration commands, complete handoffs, actionable errors, and shared authority enforcement.
- One canonical replay snapshot with deterministic issue registers.
- Pure manager-attention, office-scene, accessible-outline, and agent-actionable projectors.
- Ten deterministic runtime-simulator scenarios covering the approved success and failure paths.

## Machine gate

Final `npm.cmd run verify` passed on 2026-08-13 against implementation commit `69ac58ccae419a5735fddb9c840a855edc8a2d1f`:

- scaffold: 2 passed;
- formatting: passed;
- lint: passed with zero warnings;
- type checking: passed;
- unit: 15 files, 42 tests passed;
- integration: 1 file, 2 tests passed;
- contract: 2 files, 17 tests passed;
- production build: passed;
- Chromium regression: 4 passed across 1440 x 900 and 1280 x 800;
- axe regression: 2 passed;
- visual command: executable with no Phase 1 baseline, as required;
- dependency audit: zero known vulnerabilities and zero unreviewed install scripts.

## Determinism proof

- Normal snapshot SHA-256: `a87566774cc87b19d0a01a6500f0fd96cf7b222a7c5ee11bf311e8c0f28f5679`.
- Reversed-input normal snapshot SHA-256: `a87566774cc87b19d0a01a6500f0fd96cf7b222a7c5ee11bf311e8c0f28f5679`.
- Normal scene-descriptor SHA-256: `9baa9c02eb57cc8f4cd1c42f68ad49d7e790b93e2b13bc7f03d41cf98a537f87`.
- Human and agent actionable-record parity: true.
- Ten individual scenario hashes are retained in `determinism-hashes.json`.

## TDD and boundary evidence

Every behavioral task has its expected RED failure, minimum GREEN result, refactor or checkpoint result, and encountered harness defect recorded in `red-green-log.md`. Source scans found no `Date.now`, randomness, provider or network call, Node process API, React, PixiJS, DOM, window, or canvas dependency in the Phase 1 boundary.

No persistence behavior, SQLite event store, context-packet retrieval, live runtime, Agency Agents import, server endpoint, production UI, visual baseline, deployment, or external effect was implemented.

The full gate's Chromium and axe tests cover the unchanged Phase 0 scaffold. Phase 1 changed no rendered UI, so this report makes no Phase 1 visual, keyboard, screen-reader, or art-direction claim.

## Owner gate

The owner may accept Phase 1 or request corrections. Acceptance authorizes no Phase 2 work by itself.