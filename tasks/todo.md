# Phase 1 Task Checklist

Status: **Owner-approved for Phase 1 implementation on 2026-08-13**
Plan: `tasks/plan.md`

For every behavioral task: record the focused command and expected RED failure before implementation, make the smallest GREEN change, refactor only while green, and append evidence under `docs/evidence/phase-1/`.

- [x] Task 1: Stable primitives and canonical serialization
  - Acceptance: prefixed IDs and UTC timestamps validate; stable JSON is byte-equivalent; no clock, random, or I/O leak.
  - Verify: focused unit tests, typecheck, source-boundary scan.
  - Files: contracts primitives test/source; domain canonical JSON test/source.
  - Dependencies: none.

- [x] Task 2: Versioned event envelope and canonical ordering
  - Acceptance: invalid or unsupported events are rejected; duplicates are idempotent or conflicting; permutation order is stable.
  - Verify: focused unit tests with malformed, duplicate, conflict, and permutation fixtures.
  - Files: contracts events test/source; domain ordering test/source.
  - Dependencies: Task 1.

- [x] Task 3: Work, evidence, and approval truth slice
  - Acceptance: transitions are enforced; verification gates completion; explicit manager events alone create version-bound approval.
  - Verify: focused unit tests plus truthfulness invariant cases.
  - Files: domain work model/reducer/test; fixture.
  - Dependencies: Tasks 1-2.

- [x] Checkpoint A: unit tests, format, lint, typecheck, and RED-GREEN evidence for Tasks 1-3.

- [x] Task 4: Agent, role-assignment, and qualification truth slice
  - Acceptance: one-role occupancy, six identities, non-waivable controls, truthful disconnected, stale, and capability-loss state.
  - Verify: focused unit tests and qualification matrix.
  - Files: contracts staffing test/source; domain staffing reducer/test.
  - Dependencies: Tasks 1-2.

- [x] Task 5: Knowledge lifecycle truth slice
  - Acceptance: provenance and lifecycle stay visible; provisional findings do not self-promote; unusable records do not appear current.
  - Verify: focused unit tests over promotion, rejection, conflict, staleness, and supersession.
  - Files: contracts knowledge test/source; domain knowledge reducer/test.
  - Dependencies: Tasks 1-2.

- [x] Task 6: Collaboration, handoff, and actionable error contracts
  - Acceptance: complete structured handoffs; actionable stable errors; shared human and agent command authority.
  - Verify: contract tests and reciprocal policy tests.
  - Files: collaboration and error contract tests/sources; domain policy test.
  - Dependencies: Tasks 1-2, with Task 4 types where required.

- [x] Checkpoint B: unit and contract tests, format, lint, typecheck, and paired-contract review.

- [x] Task 7: Canonical replay reducer and snapshot
  - Acceptance: byte-equivalent snapshot replay; no invented progress; immutable deterministic inputs and outputs.
  - Verify: focused replay property cases and snapshot hashes.
  - Files: project-state and replay tests/sources; shared fixture.
  - Dependencies: Tasks 2-6.

- [ ] Task 8: Manager attention and office scene descriptors
  - Acceptance: semantic map fidelity; no fabricated activity or collaboration; cited causes and freshness.
  - Verify: focused projector tests for every named canonical state.
  - Files: attention and scene projector tests/sources.
  - Dependencies: Task 7.

- [ ] Task 9: Accessible outline and reciprocal agent projection
  - Acceptance: human and agent semantic parity and stable accessible ordering without UI dependencies.
  - Verify: focused parity tests across success, conflict, blocked, and approval scenarios.
  - Files: outline and agent projector tests/sources; parity test.
  - Dependencies: Tasks 7-8.

- [ ] Task 10: Deterministic runtime simulator
  - Acceptance: ten approved scenarios emit valid deterministic event logs and exercise public replay and projector contracts.
  - Verify: contract tests, repeated byte comparison, and scenario coverage matrix.
  - Files: simulator and scenario tests/sources; package references if necessary.
  - Dependencies: Tasks 2 and 7-9.

- [ ] Checkpoint C: run `npm.cmd run verify`; capture environment, invariant matrix, RED-GREEN record, hashes, source-boundary scan, and commits.
- [ ] Owner Phase 1 gate: accept evidence or request corrections. Phase 2 remains unauthorized.
