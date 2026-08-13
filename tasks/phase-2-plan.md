# Implementation Plan: Phase 2 Persistence and Shared Project Library

Status: **Owner-approved for Phase 2 implementation on 2026-08-13**
Authority: `docs/master-design-document-v0.1.md`, D-10 through D-15 and D-26, plus `docs/implementation-plan-v0.1.md`
Phase boundary: Phase 2 only
Prior plan archive: `tasks/phase-1-plan.md`

## Objective

Persist Phase 1 canonical truth inside one manager-selected project root and make shared project knowledge reliably reusable by humans and agents. The same event log must rebuild query projections, search indexes, context packets, checkpoint state, and recovery evidence. Project boundaries, lifecycle rules, source provenance, omissions, conflicts, and stale state must remain explicit.

## Assumptions made explicit

1. Existing `better-sqlite3@13.0.3` is sufficient; Phase 2 adds no dependency or install script.
2. The canonical database path is `.cuckcode/state/cuckcode.sqlite`. Tests use isolated temporary project roots and never create live state in the CuckCode checkout.
3. Migration SQL is embedded, ordered, transactional, checksummed, and append-only. Applied migration checksums may never change.
4. Event payloads are stored as canonical JSON plus SHA-256. Identical event IDs/content are idempotent; conflicting content is rejected without modifying the existing event.
5. Canonical events and immutable history are retained indefinitely by default. Phase 2 implements no automatic deletion or compaction.
6. Query projections and FTS5 are disposable and rebuilt only from canonical records/events; rebuild output is compared to the live projection.
7. Files are content-addressed by SHA-256 beneath `.cuckcode/artifacts/` or `.cuckcode/evidence/`. Manifests store project-relative paths, media type, byte size, classification, and hash. Writes use temporary siblings plus atomic rename.
8. Source registration is explicit. Phase 2 does not automatically crawl the bound project root or ingest unselected files.
9. The provider-neutral context budget is deterministic UTF-8 bytes plus record count. Packets record estimated provider tokens as metadata only; exact tokenizer enforcement remains a Phase 3 adapter concern.
10. Access filtering happens before FTS retrieval or packet assembly. Unauthorized titles, snippets, and hit counts are not returned.
11. Ingestion rejects known secret-shaped content unless an explicit redacted representation is supplied. Hidden reasoning is never an accepted record type.
12. Portable profiles live outside the project-local `.cuckcode` tree in an injected profile root. Tests use two project roots plus canary secrets to prove isolation. No project lesson is promoted without an explicit sanitized manager-approved record.
13. Backups and exports are explicit operations, not scheduled jobs. A backup is a consistent SQLite copy; an export is a new directory containing a database copy, selected content-addressed files, and a checksummed manifest. Neither overwrites an existing destination.
14. Critical knowledge/control changes invalidate affected context packets immediately. Non-critical changes wait for the next recorded safe checkpoint. Phase 2 records delivery/acknowledgment state but does not notify a live provider.
15. The MDD includes an `approved` knowledge state omitted by the accepted Phase 1 contract. Task 1 corrects that discrepancy with a failing regression test before schema design.

## Architecture

```text
Phase 1 contracts/domain
        |
        v
packages/persistence
  project-room paths + migrations
  append-only event store
  rebuildable projections + FTS5
  content-addressed files/manifests
  profiles/notebooks + backups/exports
        |
        v
packages/application
  deterministic context packets
  affected-scope propagation/checkpoints
  context reuse + feedback delivery records
        |
        v
packages/testing
  two-project canaries + crash/migration/rebuild scenarios
```

Dependency rules:

- `persistence` may depend on contracts, domain, `better-sqlite3`, and Node filesystem/crypto APIs.
- `application` may depend on contracts and domain plus narrow persistence interfaces; it must not depend on React, PixiJS, provider APIs, or browser state.
- `domain` remains pure. Storage paths, SQLite rows, filesystem operations, environment state, and wall clocks stay outside it.
- Tests inject project roots, clocks, IDs, packet policies, and profile roots.
- Every mutating store operation is transactional or atomic and returns stable actionable errors.

## Commands

Focused loops:

```powershell
npm.cmd run test:unit -- --run <test-file>
npm.cmd run test:integration -- --run <test-file>
npm.cmd run test:contract -- --run <test-file>
```

Checkpoints and final gate:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:contract
npm.cmd run verify
```

## Dependency order

```text
1 lifecycle + persistence contracts
             |
2 project room + migrations
             |
3 canonical event store ---- 4 content-addressed files
             |                         |
5 rebuildable projections + FTS5 -----+
             |
6 deterministic context packets
       |                 |
7 notebook/profile     8 propagation/checkpoints
       \                 /
       9 reuse + feedback
             |
10 backup/export/integrity/recovery
             |
11 cross-project and shared-knowledge acceptance scenario
```

## Task sequence

### Task 1 - Reconcile lifecycle and define persistence contracts

Add the missing `approved` lifecycle state and define versioned row/manifest/context/checkpoint contracts without I/O.

Acceptance:

- A RED regression proves `approved` is absent before correction.
- `approved` remains distinct from `authoritative`, and agent-authored records cannot self-approve.
- Persistence-facing schemas reject absolute paths, unsupported versions, missing provenance, and hidden-reasoning record types.

Files: contracts/domain source and tests, maximum five. Estimated scope: medium.

### Task 2 - Project-room paths and transactional migrations

Create the confined `.cuckcode` layout and migration-managed database.

Acceptance:

- Canonical paths cannot escape through traversal, absolute paths, symlinks, or junctions.
- Fresh and stepwise upgrades reach the same schema/application/user version and migration checksums.
- A failed migration rolls back fully; changed historical checksums stop startup.

Files: persistence project-room/migration source and integration tests, package references if required. Estimated scope: medium.

### Task 3 - Append-only canonical event store

Persist validated Phase 1 events and canonical payload hashes transactionally.

Acceptance:

- Identical repeated events are idempotent; conflicting duplicate IDs are rejected.
- Batch append is atomic and canonical order is preserved on read.
- Invalid, cross-project, or malformed events never modify the store.

Files: event-store source/test plus persistence exports. Estimated scope: medium.

### Checkpoint A - Durable truth foundation

Run integration/unit suites, formatting, lint, typecheck, migration checksum audit, and RED-GREEN evidence for Tasks 1–3.

### Task 4 - Content-addressed artifacts and evidence

Store inspectable payloads and immutable manifests under the approved project-local directories.

Acceptance:

- Hash, size, media type, classification, stable ID, and relative path are verified on write and read.
- Identical bytes deduplicate; hash/path mismatch, missing content, and destination collision return stable errors.
- Interrupted temporary writes cannot create a valid manifest or replace existing content.

Files: content store/manifest source and integration tests. Estimated scope: medium.

### Task 5 - Rebuildable projections, knowledge repository, and FTS5

Persist query projections and searchable knowledge while keeping events/records canonical.

Acceptance:

- Knowledge provenance, lifecycle, conflicts, and supersession are queryable and auditable.
- Access filtering precedes FTS; stale, rejected, unauthorized, and superseded records cannot appear as current results.
- Dropping and rebuilding all projections/indexes from canonical records produces byte-equivalent query output.

Files: projection/knowledge store source and integration tests plus fixture. Estimated scope: medium.

### Task 6 - Deterministic context-packet assembler

Select mandatory foundation, current work, dependencies/events, role instructions, permitted sources, then provisional findings under a versioned policy.

Acceptance:

- Same policy plus snapshot produces byte-equivalent ordered packets.
- Budget truncation records every omitted ID/reason and never drops mandatory controls silently.
- Stale/conflicting material is labeled; rejected, superseded, and unauthorized titles/snippets never leak.

Files: application packet source/unit tests plus contracts if required. Estimated scope: medium.

### Checkpoint B - Shared library truth

Run unit/integration/contract suites, formatting, lint, typecheck, FTS access-leak tests, packet hash comparison, and rebuild proof.

### Task 7 - Personal notebook and portable-profile isolation

Implement separate versioned stores and explicit sanitized promotion.

Acceptance:

- Notebook history is inspectable, disableable, resettable without history loss, and unable to alter permissions or canonical facts.
- Project facts or work-critical findings are routed to provisional shared knowledge rather than notebook-only storage.
- Canary secrets, distinctive facts, names, excerpts, and paths cannot cross projects or enter portable core; future-only revocation preserves historical packets.

Files: profile/notebook store source and integration tests plus sanitizer policy. Estimated scope: medium.

### Task 8 - Knowledge propagation and critical invalidation

Record affected-scope notifications, packet invalidation, safe checkpoints, deltas, and acknowledgments.

Acceptance:

- Scope intersections route changes only to affected runs.
- Critical scope/safety/permission/cancellation changes pause before the next action until refreshed and acknowledged.
- Non-critical changes permit bounded output labeled with the old snapshot but block promotion/handoff until refresh; failure becomes explicit waiting/blocked state.

Files: application propagation source/unit tests plus contracts if required. Estimated scope: medium.

### Task 9 - Context reuse, anti-repetition, and feedback delivery

Add lookup/receipt records that help agents reuse valid context and receive attributable feedback.

Acceptance:

- Current permitted knowledge already supplied is discoverable without generating a redundant request.
- Reconnect reuses valid packet, qualification reference, and completed-work state while invalidated data remains blocked.
- Manager feedback/review findings are attributable, versioned, and delivered at the next safe checkpoint with recorded disposition.

Files: application reuse/feedback source and tests plus persistence receipt store. Estimated scope: medium.

### Task 10 - Backup, export, integrity, and interrupted-write recovery

Provide explicit consistent backup/export and recovery diagnostics.

Acceptance:

- Integrity checks cover SQLite plus content manifests/hashes.
- Backup/export never overwrite destinations and reproduce canonical/query state from the same snapshot.
- Crash/interruption tests prove atomic event/file operations and successful WAL recovery; corrupt or incomplete state fails visibly.

Files: recovery source/integration tests and crash helper. Estimated scope: medium.

### Task 11 - Cross-project shared-knowledge acceptance scenario

Run the scripted two-project, multi-agent scenario required by the MDD.

Acceptance:

- One agent contributes a sourced provisional finding, another retrieves it, a conflict surfaces, and both receive the accepted resolution after checkpoint refresh.
- Canary secrets and distinctive facts never cross project/profile boundaries.
- Migration, rebuild, restart, backup, export, and deterministic packet hashes remain reproducible through the scenario.

Files: testing scenario/contract test plus fixtures and evidence helpers. Estimated scope: medium.

### Checkpoint C - Phase 2 invariant gate

Run `npm.cmd run verify`, migration/crash/rebuild/project-isolation matrices, content and packet hashes, dependency audit, and source-boundary scans. Produce machine-readable evidence and stop for owner acceptance. Browser/axe checks remain regression evidence for the unchanged scaffold; no Phase 2 visual claim is permitted.

## Risks and mitigations

| Risk                                               | Impact | Mitigation                                                                                                                          |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| SQLite schema becomes a second source of truth     | High   | Canonical records are append-only; all query tables and FTS indexes must rebuild and compare.                                       |
| Filesystem escape through junctions or symlinks    | High   | Resolve existing ancestors and final targets before every read/write; test traversal and junction cases on Windows.                 |
| Context budgeting is mislabeled as provider tokens | High   | Budget deterministic UTF-8 bytes/records and expose estimates; defer exact tokenizer enforcement to Phase 3.                        |
| FTS leaks unauthorized titles or hit counts        | High   | Apply classification/project filters in the SQL query before rank/snippet generation.                                               |
| Secret scanners create false confidence            | High   | Reject known patterns, require explicit classification/redaction, and prove with canaries; never claim exhaustive secret detection. |
| Backup exists but cannot restore                   | High   | Restore into a fresh root and compare canonical/projection/content hashes in tests.                                                 |
| Profile portability leaks project identity         | High   | Physically separate roots, deny automatic promotion, sanitize via explicit diff, and test two-project canaries.                     |
| Critical invalidation arrives between actions      | High   | Store packet/run revision preconditions and reject the next action atomically when stale.                                           |

## Exclusions and stop conditions

Phase 2 does not include a live Codex/provider adapter, process supervision, Agency Agents import, HTTP/server routes, React/PixiJS UI, production visual work, embeddings/vector search, cloud sync, automatic source crawling, scheduled backups, deployment, or external effects.

Stop and request approval if implementation requires:

- a new dependency or install script;
- changing an approved authority, lifecycle, or isolation rule beyond the `approved` correction;
- weakening canonical append-only history or project confinement;
- an external tokenizer, embedding model, provider, network, registry, or service;
- automatic deletion/retention behavior;
- a Phase 3 or later capability;
- weakening or deleting a failing invariant.

## Approval gate

Owner approval of this plan and `tasks/todo.md` authorizes Tasks 1–11 only. Completion returns with Phase 2 evidence and does not authorize Phase 3.
