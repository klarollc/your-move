# Phase 3 RED-GREEN-REFACTOR Log

## Task 1 - Provider-neutral runtime and trust contracts

Date: 2026-08-13

- RED: `npm.cmd exec vitest run -- --project contract packages/contracts/src/runtime.contract.test.ts` failed because `./runtime.js` did not exist.
- RED: `npm.cmd exec vitest run -- --project unit packages/domain/src/runtime-trust.unit.test.ts` failed because `./runtime-trust.js` did not exist.
- GREEN: both focused suites passed, 3 tests each.
- REFACTOR: formatted the six scoped source/test/export files; both focused suites remained green.
- Verification: `npm.cmd run typecheck` passed.
- Scope proven: required correlation, secret rejection, manager-only permission decisions, mandatory failure non-waiver, admission/activation separation, and reciprocal actionable facts.
## Task 2 - Pin Codex protocol 0.146.0

Date: 2026-08-13

- RED: `node --test scripts/protocol-codex.test.mjs` failed because `check-codex-protocol.mjs` did not exist.
- GREEN: the focused protocol suite passed 4 tests covering unchanged, wrong-version, drift/missing, and experimental-field cases.
- Generation: the verified local `codex-cli 0.146.0` generated 275 stable files without `--experimental`.
- Reproducible semantic bundle hash: `ad2276a8362863c4bcc4083ca33b4a300920419b4ef244689d84c7706f710197` using canonical JSON, relative paths, and per-file SHA-256 input.
- Planning inventory manifest hash retained separately: `605640fd4906e94a9d26a1dd2204cfcc51842771c0b9431c5945be3c62456a4f`; it used the planning inventory representation and is not substituted for the reproducible bundle hash.
- Refinement RED: the first real-bundle check proved stable schemas include definitions for `experimentalApi`; runtime must not enable it, while generation provenance must show no `--experimental` flag.
- Refinement RED: the first regeneration attempt exposed nondeterministic JSON object-key order; raw-byte hashes drifted despite semantic equality.
- REFACTOR: schema files are now canonicalized before hashing; experimental generation is rejected from manifest provenance, and stable schema definitions remain valid.
- Verification: `npm.cmd run protocol:codex:generate` reproduced 275 files at the semantic bundle hash; `npm.cmd run protocol:codex:check` passed.
## Task 3 - Deterministic fake and adapter conformance

Date: 2026-08-13

- RED: the focused contract suite failed because `runtime-fake.js` did not exist.
- GREEN: 5 contract tests passed for fragmented/coalesced framing, deterministic replay, duplicate/unknown responses, malformed/oversized lines, stderr isolation, and post-disconnect rejection.
- REFACTOR: formatted the three scoped fake/test/export files; focused tests remained green.
- Verification: `npm.cmd run typecheck` passed without Codex, authentication, network, wall-clock waits, or external effects.
## Checkpoint A - Contracts, protocol, and deterministic fake

Date: 2026-08-13

- `npm.cmd run protocol:codex:check`: PASS, 275 files at version 0.146.0.
- `npm.cmd run format:check`: PASS; generator-owned schemas are narrowly excluded and independently hash-checked.
- `npm.cmd run lint`: PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run test:runtime`: PASS, 2 files / 8 tests.
- `npm.cmd run test:unit`: PASS, 18 files / 50 tests.
- `npm.cmd run test:contract`: PASS, 6 files / 31 tests.
- Secret-value scan: PASS; no `sk-`-style value of 20 or more identifier characters in production package/script sources outside the generated protocol.
- Scope: machine/static evidence only; no browser or visual claim.
## Task 4 - Codex stdio supervisor and handshake

Date: 2026-08-13

- RED: the fake-child integration suite failed because `supervisor.js` did not exist.
- GREEN: 3 integration tests passed for fixed direct-spawn arguments, fragmented initialize response, initialized ordering, stderr redaction, distinct auth-required status, and bounded silent-handshake failure.
- Spawn contract: exact args `app-server --stdio --strict-config`, `shell: false`, pipe stdio, hidden Windows process.
- Protocol contract: stable initialize request contains client metadata and omits capabilities/`experimentalApi`; response must report 0.146.0 before readiness.
- REFACTOR: Node types were scoped to `runtime-codex`; exact-optional process state was made explicit.
- Verification: focused integration suite and `npm.cmd run typecheck` passed.
## Task 5 - Event normalization and correlation

Date: 2026-08-13

- RED: lifecycle-level correlation failed because thread/turn/item were globally required; the normalizer suite also failed because `normalizer.js` did not exist.
- GREEN: scoped correlation passed and 4 normalizer tests passed for lifecycle/project linkage, item categories, malformed/unsupported visibility, reported-only provider completion, and deterministic evidence hashes.
- Invariant: binding/run/request IDs are always required; thread/turn/item IDs are retained when their protocol level exists and are never fabricated.
- Invariant: provider prose and completion map only to `canonicalImpact: reported_only`; they cannot create manager approval or CuckCode completion.
- REFACTOR: provider-specific parsing is isolated in `runtime-codex`; normalized contracts flow through `@cuckcode/contracts`.
- Verification: focused contract/unit suites and `npm.cmd run typecheck` passed.
## Task 6 - Approval, cancellation, disconnect, and recovery

Date: 2026-08-13

- RED: the focused unit suite failed because `runtime-controls.js` did not exist.
- GREEN: 3 policy tests passed for exact single-use approval, replay/stale/timeout denial, disconnect/cancel action blocking, terminal cancel correlation, and complete recovery reconciliation.
- Invariant: missing, stale, expired, denied, mismatched, replayed, disconnected, or cancelled authority never permits a tool action.
- Invariant: binding, capability, permission, context, and event-cursor continuity must all match before actions unblock.
- REFACTOR: control behavior is an immutable pure domain reducer; the Codex adapter holds no manager authority.
- Verification: focused unit suite and `npm.cmd run typecheck` passed.
## Checkpoint B - Supervisor, normalization, and controls

Date: 2026-08-13

- Protocol drift: PASS, 275 files / Codex 0.146.0.
- Format, lint, and typecheck: PASS.
- Focused runtime: PASS, 8 contract + 3 integration + 7 unit tests.
- Full unit regression: PASS, 20 files / 57 tests.
- Full integration regression: PASS, 9 files / 26 tests.
- Full contract regression: PASS, 6 files / 31 tests.
- Scope: process/protocol/machine evidence only; no provider live run, browser, or visual claim.
## Task 7 - Binding persistence and identity continuity

Date: 2026-08-13

- RED: the migration test expected user version 2 / `002_runtime_trust`, and the trust-store suite failed because its module did not exist.
- GREEN: 10 focused integration tests passed across deterministic migrations, identity/binding history, provider-ID impersonation, credential rejection, staleness, and restart continuity.
- Migration: append-only `002_runtime_trust` adds agents, runtime bindings, provider identities, admissions, qualifications, scoped exceptions, and revocations without changing `001_initial`.
- Invariant: provider IDs can correlate only to an existing CuckCode-owned `agentId`; they cannot create or replace identity.
- Invariant: the latest material binding remains Candidate and prior-binding qualifications project as stale.
- Verification: focused integration suite and `npm.cmd run typecheck` passed.
## Task 8 - Controlled Agency Agents Candidate import

Date: 2026-08-13

- RED: the import suite failed because `check-agency-agents.mjs` did not exist.
- GREEN: 3 validator tests passed for exact six-role Candidate admission, provenance/hash/path drift, hidden instructions, and executable-overlay rejection.
- Upstream: `https://github.com/msitarzewski/agency-agents` at `ebe9c99acb5c96f9468de368d8bead775387d1a7`; exact six sources plus `divisions.json` and MIT `LICENSE` only.
- Separation: upstream bytes are immutable/reference-only; six CuckCode overlays hold normalized responsibilities, skills, deliverables, and authority disclosures.
- Quarantine: Implementation Engineer contains one upstream HTML-comment segment, SHA-256 `29b191b6eb376682ae2169694ea079c763e4a1da3902a30e9a4b68fbbf9cc3f4`; it is recorded and excluded from the normalized role. Any unrecorded hidden segment fails validation.
- Recovery: the initial CRLF-transformed failed import was moved intact to `.restore`; the importer now stages raw-LF content and validates before atomic copy.
- Verification: `npm.cmd run test:roles` and `npm.cmd run roles:agency-agents:check` passed; all roles remain Candidate and non-executable.
## Task 9 - Universal Candidate admission

Date: 2026-08-13

- RED: after correcting test syntax, the focused suite failed because `qualification.js` did not exist.
- GREEN: 7 tests passed for exact ten-check coverage, deterministic evidence hashes, manager/findings separation, and missing/failed/expired/revoked/stale rejection.
- Mandatory checks: handshake, identity, correlation, cancellation, permission denial/escalation, root/secret isolation, context disclosure, health/recovery, knowledge citation, and deterministic synthetic completion.
- Invariant: findings establish eligibility only; the manager separately admits, rejects, defers, or requests remediation.
- Invariant: universal admission can make a Candidate available but cannot activate a role.
- Verification: `npm.cmd run test:qualification` and `npm.cmd run typecheck` passed.
## Task 10 - Six role-specific qualification suites

Date: 2026-08-13

- RED: the six-fixture suite failed because `role-qualification.js` did not exist.
- GREEN: 9 tests passed: one deterministic defining-responsibility case per role plus independent-review, mandatory-failure, and advisory-exception controls.
- Suites: Delivery Lead dependency/scope; Product Designer art-direction/accessibility; Implementation Engineer RED-GREEN/scope; Test Engineer determinism/failure artifacts; Visual QA rendered comparison/evidence classes; Release Reviewer independent readiness/risk.
- Version binding: runtime binding, role contract, suite, and permission fingerprints all enter the evidence hash and advisory-exception scope.
- Invariant: universal admission is necessary but insufficient; independent review and a passing role suite establish only manager-activation eligibility.
- Invariant: mandatory failure cannot be waived; advisory exceptions require scope, residual risk, compensating control, owner, expiry, exact affected versions, and no parent exception.
- Verification: `npm.cmd run test:qualification`, lint, and typecheck passed.
