# Phase 2 invariant matrix

Implementation commit: `04af121`
Definitive gate: `npm.cmd run verify` passed on 2026-08-13.

| Invariant | Evidence | Result |
| --- | --- | --- |
| Lifecycle and authority | Contract/unit tests reject agent self-approval and support distinct authoritative, approved, provisional, contested, stale, rejected, and superseded states. | Pass |
| Project confinement | Relative-path tests reject traversal, absolute paths, and an existing Windows junction resolving outside the project root. | Pass |
| Migration integrity | Fresh schema has application ID `CUCK`, user version 1, SHA-256 migration checksum; failed migration rolls back; changed historical checksum stops startup and releases SQLite. | Pass |
| Canonical events | Atomic append, canonical SHA-256, ordered read, identical-id idempotency, conflicting-id and cross-project rejection. | Pass |
| Content integrity | Content-addressed artifact/evidence files deduplicate and visibly fail on tampering, missing content, or stable-ID collision. | Pass |
| FTS isolation and rebuild | Project/classification/authorization/lifecycle filters exclude inaccessible or non-current material; rebuild output hash equals pre-rebuild output. | Pass |
| Context packets | Stable ordering and UTF-8 byte budgets produce repeatable packet hashes and explicit omissions/errors without unauthorized or rejected leakage. | Pass |
| Notebook/profile isolation | Project facts route to provisional shared knowledge; portable promotion requires explicit manager approval and rejects configured canaries and Windows paths. | Pass |
| Propagation | Both affected agent runs pause before action on a critical conflict and refresh at the accepted safe checkpoint. | Pass |
| Reuse and feedback | Snapshot-bound packet receipts support current-context and reconnect reuse; feedback is attributable, versioned, and delivered once at checkpoint. | Pass |
| Backup/export/recovery | No-overwrite SQLite snapshots plus verified content restore successfully; backup/export DB hashes match; tampering fails visibly. | Pass |
| Crash/WAL recovery | Interrupted writer exits before commit, leaves zero rows, and reopens with SQLite integrity `ok`. | Pass |
| Cross-project isolation | Alpha and Beta canaries do not cross in either direction in two fresh deterministic scenario executions. | Pass |
| Dependency and source boundaries | `npm audit` reports zero vulnerabilities; no forbidden domain/application or provider/UI persistence matches. | Pass |
| Browser regression boundary | Existing scaffold: 4 Chromium e2e and 2 axe tests pass at 1440 and 1280 widths. No Phase 2 visual claim. | Pass |
