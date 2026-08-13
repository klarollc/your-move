# Phase 2 Task Checklist

Status: **Owner-approved for Phase 2 implementation on 2026-08-13**
Plan: `tasks/plan.md`
Prior checklist: `tasks/phase-1-todo.md`

Every behavioral task records focused RED, minimal GREEN, refactor/checkpoint verification, exact files, and commit evidence under `docs/evidence/phase-2/`.

- [ ] Task 1: Reconcile lifecycle and define persistence contracts
  - Acceptance: `approved` regression/correction; distinct authority; version/path/provenance/hidden-reasoning validation.
  - Verify: focused unit/contract tests and typecheck.
  - Dependencies: none.

- [ ] Task 2: Project-room paths and transactional migrations
  - Acceptance: traversal/junction confinement; deterministic fresh/upgrade schema; rollback/checksum enforcement.
  - Verify: focused integration tests using isolated temporary roots.
  - Dependencies: Task 1.

- [ ] Task 3: Append-only canonical event store
  - Acceptance: idempotent identical events; conflicting IDs rejected; atomic ordered batches; no cross-project writes.
  - Verify: focused integration tests and canonical hash comparisons.
  - Dependencies: Tasks 1–2.

- [ ] Checkpoint A: unit/integration, format, lint, typecheck, migration audit, and Tasks 1–3 RED-GREEN evidence.

- [ ] Task 4: Content-addressed artifacts and evidence
  - Acceptance: verified manifests; deduplication; visible mismatch/missing/collision errors; interruption safety.
  - Verify: focused filesystem integration tests.
  - Dependencies: Task 2.

- [ ] Task 5: Rebuildable projections, knowledge repository, and FTS5
  - Acceptance: lifecycle/provenance/conflicts queryable; access-first search; byte-equivalent rebuild.
  - Verify: focused SQLite integration and access-leak tests.
  - Dependencies: Tasks 1–3.

- [ ] Task 6: Deterministic context-packet assembler
  - Acceptance: stable ordering/hashes; explicit omissions; conflict/stale labels; no unauthorized/rejected/superseded leak.
  - Verify: focused unit/contract tests across packet policies and budgets.
  - Dependencies: Tasks 1, 3, and 5.

- [ ] Checkpoint B: unit/integration/contract, format, lint, typecheck, FTS isolation, packet hashes, and rebuild proof.

- [ ] Task 7: Personal notebook and portable-profile isolation
  - Acceptance: versioned manager controls; forbidden fact routing; two-project canary isolation; sanitized explicit promotion/revocation.
  - Verify: focused integration tests using separate project/profile roots.
  - Dependencies: Tasks 1–2 and 5–6.

- [ ] Task 8: Knowledge propagation and critical invalidation
  - Acceptance: affected routing; pre-action critical pause; labeled non-critical stale output; explicit refresh failure.
  - Verify: focused state-machine unit and contract tests.
  - Dependencies: Tasks 1, 3, and 6.

- [ ] Task 9: Context reuse, anti-repetition, and feedback delivery
  - Acceptance: permitted-context lookup; safe reconnect reuse; versioned attributable feedback at checkpoints.
  - Verify: focused unit/integration tests and redundant-request regression.
  - Dependencies: Tasks 6–8.

- [ ] Task 10: Backup, export, integrity, and interrupted-write recovery
  - Acceptance: database/content integrity; no-overwrite consistent exports; crash/WAL recovery; visible corruption.
  - Verify: focused integration tests, crash helper, and fresh-root restore comparison.
  - Dependencies: Tasks 2–5 and 7.

- [ ] Task 11: Cross-project shared-knowledge acceptance scenario
  - Acceptance: contribute/retrieve/conflict/resolve/refresh flow; canary isolation; reproducible migration/rebuild/restart/backup/export/packet hashes.
  - Verify: contract scenario plus integration evidence matrix.
  - Dependencies: Tasks 1–10.

- [ ] Checkpoint C: run `npm.cmd run verify`; capture migration/crash/rebuild/isolation matrices, hashes, audit, source-boundary scan, and commits.
- [ ] Owner Phase 2 gate: accept evidence or request corrections. Phase 3 remains unauthorized.
