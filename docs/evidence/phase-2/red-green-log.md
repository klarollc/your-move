# Phase 2 RED-GREEN-REFACTOR log

## Task 1 - Lifecycle and persistence contracts
- RED: 5 contract tests failed because `approved` and `parsePersistenceRecord` were absent.
- GREEN: 5 passed after adding manager-controlled `approved` and validated versioned persistence records.
- Regression: the prior six-state test failed at Checkpoint A and was corrected to the MDD seven-state contract.

## Task 2 - Project room and migrations
- RED: module absent.
- First GREEN attempt: 4 passed; failed-migration cleanup exposed an open Windows SQLite handle.
- Correction: failure closes the database; 5 integration tests passed.
- Type refactor: explicit `ProjectStore` return type made declaration generation stable.

## Task 3 - Append-only event store
- RED: module absent.
- GREEN: 3 integration tests passed for canonical order, idempotency, conflict rejection, and atomic cross-project rejection.

## Checkpoint A
- Format and lint passed; typecheck passed after the explicit store type.
- Unit: 15 files, 42 tests. Contract: 3 files, 22 tests. Integration: 3 files, 10 tests.
## Tasks 4-6 and Checkpoint B
- Task 4 RED: content store absent. GREEN: 3 tests for deduplication, tamper detection, and stable-ID collision. A partial refactor failed twice (stale helper calls, then missing import) before the focused suite returned green; both failures are retained as evidence.
- Task 5 RED: knowledge store absent. GREEN: 2 FTS5 tests prove access/lifecycle filtering and byte-equivalent rebuild output.
- Task 6 RED: context assembler absent. GREEN: 2 tests prove deterministic priority, explicit omissions, mandatory overflow, and no unauthorized/rejected leakage.
- Checkpoint B typecheck rejected Node `Buffer` in the application layer and widened fixture literals. Replaced it with `TextEncoder` and typed records.
- Final Checkpoint B: typecheck passed; unit 16 files/44 tests; contract 3 files/22 tests; integration 5 files/15 tests. Format and lint had passed before the type correction.
## Tasks 7-9
- Task 7 RED: profile store absent. GREEN: 2 integration tests prove project notebook controls, provisional shared-fact routing, separate portable-profile storage, explicit revocation history, and rejection of forbidden project facts and local paths.
- Task 8 RED: propagation module absent. GREEN: 3 unit tests prove affected-work routing, critical pause/invalidation, non-critical stale labeling, checkpoint refresh, and explicit waiting state on refresh failure.
- Task 9 RED: receipt store absent. GREEN: 2 integration tests prove current-context lookup, snapshot-bound reconnect reuse, and once-only attributable versioned feedback delivery at a safe checkpoint.
- Refactor gate: exact-optional typecheck rejected explicit undefined cleanup fields in refreshed runs. The implementation now omits stale optional fields structurally.
- Combined gate: typecheck passed; unit 17 files/47 tests; integration 7 files/19 tests.
## Task 10 - Recovery and integrity
- RED: recovery module absent.
- GREEN: 2 focused integration tests prove synchronous SQLite snapshotting, verified project-content copying, atomic no-overwrite publication, restored database/content equivalence, deterministic manifest structure, and visible content corruption.
- Full persistence gate: 8 integration files/21 tests, including the existing crash/WAL recovery proof. Format, lint, and typecheck passed.
- Boundary: portable profiles are not included because they are explicitly stored outside project truth.
## Task 11 - Cross-project shared-knowledge acceptance
- RED: shared-knowledge scenario module absent.
- GREEN: one contract test executes the two-project scenario twice from fresh roots and requires byte-equivalent path-independent results.
- The scenario proves provisional contribution, contested review, manager-approved resolution, critical pre-action pause, safe-checkpoint refresh, context receipt, FTS rebuild, restart, backup/export database equivalence, project canary isolation, and deterministic packet/schema/query hashes.
- Task gate: format, lint, and typecheck passed; unit 17 files/47 tests; integration 8 files/21 tests; contract 4 files/23 tests.