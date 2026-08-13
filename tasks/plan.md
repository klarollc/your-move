# Implementation Plan: Phase 3 Runtime Adapter and Trust Onboarding

Status: **Owner-approved for Phase 3 implementation on 2026-08-13**
Specification: `docs/phase-3-runtime-and-onboarding-spec-v0.1.md`
Prior plan: `tasks/phase-2-plan.md`

## Outcome

Implement a provider-neutral runtime boundary and pinned Codex stdio adapter, then prove identity, bounded permissions, Candidate admission, controlled six-role source import, universal and role qualification, staffing voice, and one supervised live run. Phase 3 creates no production UI and executes no Candidate role content.

## Architecture decisions

- Pin Codex `0.146.0`; stable generated schemas only; fail on drift.
- Launch local `codex.exe` directly over stdio JSONL, no shell/remote transport.
- Use existing managed authentication; store no credentials; implement no login.
- Normalize provider data as reported evidence before canonical validation.
- Bind identity/qualification to runtime, role, suite, and permission versions.
- Import six allowlisted Agency Agents sources at `ebe9c99acb5c96f9468de368d8bead775387d1a7`, retaining MIT attribution and Candidate status.
- Keep normal gates deterministic; live execution separate and opt-in.

## Dependency graph

```text
1 contracts -> 2 protocol -> 3 fake conformance
                          -> 4 supervisor -> 5 normalization -> 6 controls
                                                            -> 7 bindings
                                                            -> 8 role import
                                                            -> 9 admission
                                                            -> 10 role suites
                                                            -> 11 staffing
                                                            -> 12 live run
                                                            -> 13 evidence
```

## Commands

```powershell
npm.cmd run protocol:codex:generate
npm.cmd run protocol:codex:check
npm.cmd run roles:agency-agents:check
npm.cmd run test:runtime
npm.cmd run test:qualification
npm.cmd run test:live:codex
npm.cmd run verify
```

## Tasks

### Task 1 - Provider-neutral runtime and trust contracts

Define adapter results, correlations, capabilities, permissions, bindings, admission, qualification, exceptions, staffing responses, and actionable issues.

Acceptance:

- Reject missing correlation, secret-bearing records, ambiguous scope, and provider-authored approval.
- Mandatory failures are non-waivable; universal admission cannot activate a role.
- Manager/Candidate projections expose equivalent actionable facts.

Files: contracts/domain source/tests, maximum five. Scope: medium.

### Task 2 - Pin Codex protocol `0.146.0`

Generate stable schemas and provenance; add deterministic drift checks.

Acceptance:

- Record executable/version/command/file hashes without experimental fields.
- Wrong version, edited/missing schema, or experimental method fails visibly.
- Generated provider files stay isolated and are not manually edited.

Files: protocol snapshot, manifest, script/test, commands. Scope: medium.

### Task 3 - Deterministic fake and conformance suite

Build injected duplex transport and provider-neutral fixtures for framing, correlation, lifecycle, approvals, cancellation, disconnect, and malformed input.

Acceptance:

- Same schedule produces byte-equivalent normalized results.
- Duplicate/late/unknown response, oversized line, invalid schema, stderr cannot invent progress.
- Runs without Codex, auth, provider traffic, wall clocks, or external effects.

Files: testing fake/suite and runtime interfaces. Scope: medium.

### Checkpoint A

Run contract/runtime, format, lint, typecheck, schema drift, source scan, and Tasks 1-3 evidence.

### Task 4 - Codex stdio supervisor and handshake

Implement direct executable discovery/spawn, bounded JSONL, initialize/initialized, tracking, stderr redaction, shutdown.

Acceptance:

- Fake child proves args, ordering, timeouts, bounds, fragmentation, exit, cleanup.
- No shell, WebSocket, experimental capability, credential, or arbitrary command.
- Version/schema mismatch and auth-required are distinct failures.

Files: runtime-codex source/integration tests, maximum five. Scope: medium.

### Task 5 - Event normalization and correlation

Map stable thread/turn/item, message, command, file, tool, usage, approval, and error messages.

Acceptance:

- Retain binding/project/work/role/provider correlations and freshness.
- Provider completion remains evidence only.
- Unsupported/malformed events are visible; prose cannot override structured state.

Files: normalizer/tests and narrow contracts. Scope: medium.

### Task 6 - Approval, cancellation, disconnect, recovery

Implement deny-by-default decision delivery, exact cancellation, stale rejection, disconnect, reconciled resume.

Acceptance:

- Timeout/denial/disconnect/cancel/stale/malformed all deny; no replay.
- Critical change prevents the next tool action until refresh/acknowledgment.
- Resume requires binding/capability/permission/context/event reconciliation.

Files: application/domain controls and integration tests. Scope: medium.

### Checkpoint B

Run supervisor/normalization/control gates and full static/behavior suites with Tasks 4-6 evidence.

### Task 7 - Binding persistence and identity continuity

Add append-only migration/projection for identity, bindings, capabilities, permissions, admission, qualification, exceptions, revocation.

Acceptance:

- Provider IDs cannot impersonate `agentId` or overwrite history.
- Material deltas create Candidate and stale incompatible qualifications/assignments.
- Restart/backup preserve provenance; credentials never persist.

Files: persistence migration/store/tests and narrow policy. Scope: medium.

### Task 8 - Controlled Agency Agents Candidate import

Fetch pinned allowlisted roles/registry/license, verify provenance, normalize, and apply disclosed overlays.

Acceptance:

- Only six approved paths plus metadata/license enter with MIT notice.
- Commit/path/hash/license/ID/hidden-instruction/structure failures reject.
- Roles remain immutable upstream + separate overlays, Candidate/non-executable.

Files: import script/schema/tests plus generated sources; split source snapshots into small commits. Scope: medium slices.

### Task 9 - Universal Candidate admission

Implement deterministic isolated mandatory checks and manager disposition.

Acceptance:

- Every check has inspectable evidence and stable rerun hashes.
- Failed/missing/expired/revoked/stale Candidate cannot become available.
- Manager admit/reject/defer/remediate remains distinct from findings.

Files: fixtures/harness/tests and narrow policy. Scope: medium.

### Task 10 - Six role qualification suites

Create one deterministic D-19 suite per Candidate role.

Acceptance:

- Each tests defining responsibility, artifacts, prohibited shortcuts, rubric, exact versions.
- Independent review and manager activation stay separate; universal admission is insufficient.
- Mandatory failure blocks; advisory exception is scoped, visible, expiring, non-chainable.

Files: six small fixture/suite slices plus shared harness, each maximum five. Scope: six small/medium slices.

### Task 11 - Staffing voice and manager-final truth

Implement complete role offers, preferences, reassignment requests, categorized declines, and manager decisions.

Acceptance:

- Candidate sees contract/overlay, outcome, constraints, evidence, permissions, workload/conflicts.
- Non-acceptance is auditable and role remains vacant.
- No self-assignment/replacement/permission override/dual role/reviewer conflict.

Files: domain/application/persistence tests and policy. Scope: medium.

### Checkpoint C

Run qualification/import/binding/isolation/recovery/reciprocal matrices and Tasks 7-11 evidence.

### Task 12 - Supervised live Codex contract run

Run one authenticated local exact-version process in a synthetic root after deterministic gates.

Acceptance:

- Requires exact `CUCKCODE_LIVE_CODEX=1`; otherwise skips without claiming coverage.
- Proves version/handshake/auth/binding/bounded turn/events/cancel-or-complete/shutdown.
- Only provider service traffic; no agent network, connectors, extra roots, secrets, external effects.

Files: live harness/test and evidence helper only. Scope: small/medium.

### Task 13 - Phase 3 evidence gate

Run verify plus runtime/qualification/import/live/audit/scans and capture machine evidence.

Acceptance:

- Matrices cover correlation, drift, permissions, cancel/reconnect, identity, qualification, canaries, role provenance, hashes.
- Browser/axe labeled unchanged-scaffold regression; no visual claim.
- Owner report names limits and stops before Phase 4.

Files: Phase 3 evidence/checklist only. Scope: medium.

## Risks and mitigations

| Risk                       | Impact | Mitigation                                                          |
| -------------------------- | ------ | ------------------------------------------------------------------- |
| Protocol drift             | High   | Exact version/schema pin, fail-closed startup, requalification.     |
| Provider becomes truth     | High   | Reported-evidence normalization and completion/approval invariants. |
| Credential leakage         | High   | Managed auth only, redaction/canaries, no login.                    |
| Wrong approval correlation | High   | Full correlation, single-use decisions, stale rejection.            |
| Process races              | High   | Deterministic schedules, terminal receipts, reconciliation.         |
| Unreviewed role execution  | High   | Pinned allowlist, upstream/overlay split, Candidate-only.           |
| Qualification theater      | High   | Observable synthetic tasks, artifacts, independent review.          |
| Live test contaminates CI  | Medium | Separate explicit opt-in; fake is logic proof.                      |

## Stop conditions

Stop for a different Codex/schema, experimental/non-stdio API, CuckCode login/credentials, new dependency/install script, different Agency source/license, executable role promotion, added authority/external effects, production UI/kickoff/art/deployment/Phase 4, or weakened invariant.

## Approval gate

Approval of this plan and `tasks/todo.md` authorizes Tasks 1-13, the pinned Candidate-only Agency import, and one supervised local live run. It does not authorize Phase 4, UI, role promotion, deployment, or external effects.
