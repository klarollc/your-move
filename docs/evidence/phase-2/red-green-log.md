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