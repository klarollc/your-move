# Phase 3 Task Checklist

Status: **Owner-approved for Phase 3 implementation on 2026-08-13**
Specification: `docs/phase-3-runtime-and-onboarding-spec-v0.1.md`
Plan: `tasks/plan.md`
Prior checklist: `tasks/phase-2-todo.md`

- [x] Task 1: Provider-neutral runtime and trust contracts
  - Acceptance: correlation/secrets/permission/qualification invariants and reciprocal projections.
  - Verify: focused unit/contract and typecheck.
  - Dependencies: none.

- [x] Task 2: Pin Codex protocol `0.146.0`
  - Acceptance: stable schemas, provenance/hash manifest, drift/wrong-version rejection.
  - Verify: `npm.cmd run protocol:codex:check`.
  - Dependencies: Task 1.

- [x] Task 3: Deterministic fake and adapter conformance
  - Acceptance: deterministic framing/correlation/lifecycle/approval/cancel/disconnect/malformed coverage without Codex.
  - Verify: `npm.cmd run test:runtime`.
  - Dependencies: Tasks 1-2.

- [x] Checkpoint A: runtime/contracts, format, lint, typecheck, schema/source scans, Tasks 1-3 evidence.

- [x] Task 4: Codex stdio supervisor and handshake
  - Acceptance: direct fixed spawn, bounded JSONL, strict handshake, redacted stderr, cleanup, auth distinction.
  - Verify: fake-child integration and runtime suite.
  - Dependencies: Tasks 1-3.

- [x] Task 5: Event normalization and correlation
  - Acceptance: supported event correlations/freshness; provider completion remains evidence only.
  - Verify: fixture contracts and replay hashes.
  - Dependencies: Tasks 1-4.

- [ ] Task 6: Approval, cancellation, disconnect, recovery
  - Acceptance: deny-by-default single-use decisions, exact cancel, action prevention, reconciled resume.
  - Verify: focused domain/application and fake-process integration.
  - Dependencies: Tasks 1-5.

- [ ] Checkpoint B: supervisor/normalization/control and full static/behavior gates, Tasks 4-6 evidence.

- [ ] Task 7: Binding persistence and identity continuity
  - Acceptance: versioned history, impersonation prevention, stale qualification, recovery provenance, no credentials.
  - Verify: migration/integration/canary/recovery.
  - Dependencies: Tasks 1, 5-6.

- [ ] Task 8: Controlled six-role Agency Agents Candidate import
  - Acceptance: pinned allowlist/MIT/provenance/hash, upstream-overlay separation, non-executable Candidate.
  - Verify: `npm.cmd run roles:agency-agents:check` and contracts.
  - Dependencies: Tasks 1 and 7.

- [ ] Task 9: Universal Candidate admission
  - Acceptance: deterministic mandatory evidence and manager disposition; no failed/expired/stale availability.
  - Verify: `npm.cmd run test:qualification` and isolation matrices.
  - Dependencies: Tasks 1-8.

- [ ] Task 10: Six role-specific qualification suites
  - Acceptance: role responsibility, exact versions, independent review, manager activation, exception rules.
  - Verify: six focused slices and deterministic full suite.
  - Dependencies: Tasks 8-9.

- [ ] Task 11: Staffing voice and manager-final truth
  - Acceptance: complete offer, agent voice, manager-final decision, vacancy/conflict/dual-role invariants.
  - Verify: domain/application/persistence tests.
  - Dependencies: Tasks 7, 9-10.

- [ ] Checkpoint C: qualification/import/binding/isolation/recovery/reciprocal matrices, Tasks 7-11 evidence.

- [ ] Task 12: Supervised local Codex contract run
  - Acceptance: opt-in exact version/handshake/auth/binding/bounded turn/events/shutdown; no task external effect.
  - Verify: `$env:CUCKCODE_LIVE_CODEX='1'; npm.cmd run test:live:codex`.
  - Dependencies: Tasks 1-11 and Checkpoint C.

- [ ] Task 13: Phase 3 invariant and evidence gate
  - Acceptance: machine matrices/hashes/audits/live evidence/limits; no visual or Phase 4 claim.
  - Verify: `npm.cmd run verify` plus all Phase 3 commands.
  - Dependencies: Tasks 1-12.

- [ ] Owner Phase 3 gate: accept evidence or request corrections. Phase 4 remains unauthorized.
