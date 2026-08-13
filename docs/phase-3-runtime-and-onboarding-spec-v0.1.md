# Phase 3 Specification: Runtime Adapter and Trust Onboarding

Version: 0.1
Status: **Owner-approved for Phase 3 implementation on 2026-08-13**
Date: 2026-08-13
Authority: `docs/master-design-document-v0.1.md`, especially D-03, D-06, and D-15 through D-20

## Assumptions requiring approval

1. Pin Codex CLI/App Server `0.146.0`; reject a different version until schemas and evidence are regenerated and reviewed.
2. Launch `codex.exe app-server --stdio --strict-config` directly. WebSocket, sockets, daemon/proxy, remote hosts, and experimental API capabilities are excluded.
3. Use existing Codex-managed authentication. Read normalized account status only; never accept, display, log, or persist credential values. Missing authentication blocks onboarding and directs the manager to Codex login.
4. A live Codex run inherently uses OpenAI service traffic. The live gate allows only that provider traffic; agent network tools, connectors, messaging, publishing, deployment, destructive actions, paid third-party services, and writes outside a synthetic root remain denied.
5. Record the configurable model per binding/run. No model alias is permanent identity or capability evidence.
6. Pin Agency Agents to `ebe9c99acb5c96f9468de368d8bead775387d1a7`; import only six approved roles, registry metadata, and MIT license. Source and overlays remain Candidate and non-executable.
7. Phase 3 adds no production UI. Reciprocal usability is proven through structured manager decisions, agent-visible contracts, actionable errors, and equivalent projections.
8. Live tests are explicit opt-in and supervised; normal `npm.cmd run verify` remains deterministic and provider-independent.

## Objective

Connect one local Codex runtime without allowing provider state to become project truth. A runtime enters as Candidate, discloses its exact binding and limits, passes universal admission and a version-bound role qualification, receives a manager decision, and only then becomes eligible for one role. The manager can deny, cancel, defer, or recover interactions; the agent receives the same effective role, context, permission, qualification, and decision facts in structured form.

Success requires provider-neutral conformance, exact stdio correlation, deny-by-default permissions, stable CuckCode identity, deterministic admission/qualification, controlled role provenance, both-party actionable records, and one supervised live contract run. Provider completion never creates CuckCode verification, completion, qualification, assignment, or approval.

## Approved baseline

- Codex: `codex-cli 0.146.0`.
- Stable App Server JSON Schemas generated without `--experimental`.
- Planning inventory: 275 files; bundle-manifest SHA-256 `605640fd4906e94a9d26a1dd2204cfcc51842771c0b9431c5945be3c62456a4f`.
- Transport: local stdio JSONL; mandatory `initialize` then `initialized`.
- Agency Agents: `https://github.com/msitarzewski/agency-agents`, revision `ebe9c99acb5c96f9468de368d8bead775387d1a7`, MIT.

## Architecture

```text
CuckCode application/domain
        |
provider-neutral RuntimeAdapter
        |-- deterministic fake transport/simulator
        +-- CodexAdapter
              |-- version/schema preflight
              |-- stdio process supervisor
              |-- JSONL request correlation
              |-- stable protocol decoder
              +-- normalized events/approvals/recovery
```

- `contracts`: provider-neutral runtime, identity, approval, admission, qualification, staffing schemas.
- `domain`: pure reducers/policies; no Node I/O or Codex types.
- `runtime-codex`: generated protocol, stdio, Codex validation/normalization.
- `application`: adapter orchestration, context, permissions, checkpoints.
- `persistence`: binding/admission/qualification projections and canonical normalized events.
- `testing`: fakes, deterministic fixtures, six role scenarios, opt-in live harness.

## Provider-neutral contract

Every adapter declares support or absence for connect/initialize/auth status/health/disconnect; runtime/model/capability/tool/permission/context discovery; run start/resume/inspect/input/cancel; normalized lifecycle/message/command/file/tool/artifact/usage/approval/error events; correlation/freshness; effective permissions; and recovery eligibility.

Adapter output is untrusted `reported` evidence until canonical validation. No adapter method directly mutates approval, assignment, qualification, or completion.

## Codex process and protocol

- Resolve and launch `codex.exe` directly without a shell using fixed args `app-server`, `--stdio`, `--strict-config`.
- Capture bounded UTF-8 JSONL stdout; keep redacted stderr separate.
- Send one initialize request with CuckCode client metadata, validate its response, then send initialized before any other method.
- Never set `experimentalApi`; reject experimental-only fields/methods.
- Reject unknown, duplicate, late, or mismatched responses; enforce line, pending-request, handshake, request, freshness, and shutdown bounds.
- Malformed JSON/schema, stdout closure, exit, or timeout stops tool actions and emits explicit failure/disconnect.
- Cancellation targets the exact active thread/turn and waits for terminal evidence; process termination is a fallback, not successful-cancellation evidence.
- Provider IDs are non-authoritative correlations inside a versioned runtime binding.

## Authentication and secrets

Read account status after initialization and accept existing Codex-managed ChatGPT or API-key login state without retrieving values. Auth absence/expiry/account/provider change invalidates the binding and blocks admission/resume. Log only normalized auth mode/provider requirements and redacted errors. No credential value may enter events, SQLite, evidence, traces, fixtures, snapshots, or profiles. `account/login/start` is excluded.

## Permission and approval bridge

Each request binds a CuckCode request ID, runtime binding, provider request/thread/turn/item IDs, exact redacted operation/resource, purpose, risk, requested duration, effective ceiling, expiry, manager decision, delivery, and acknowledgment.

Default authority is project-root read/write only. Extra roots, runtime tool network, credentials, messaging, publishing, deployment, destructive actions, and spending are denied. Timeout, disconnect, cancellation, stale/malformed request, or missing decision equals denial. Decisions are single-use and exact-correlation only. Provider approval is not manager approval.

## Stable identity and bindings

`agentId` is CuckCode-owned. Each binding versions adapter/protocol, provider/account mode without secrets, model/material config fingerprint, tools/capabilities/claims, permission ceiling, context/output limits, non-authoritative provider correlations, and lifecycle timestamps. Material adapter/schema/provider/account/model/instruction/tool/capability/permission changes create a new Candidate binding and stale incompatible qualifications. Cosmetic identity changes do not.

## Controlled Agency Agents import

Allowlist:

- Delivery Lead: `project-management/project-manager-senior.md`;
- Product Designer: `design/design-ui-designer.md`;
- Implementation Engineer: `engineering/engineering-senior-developer.md`;
- Test Engineer: `testing/testing-test-automation-engineer.md`;
- Visual QA Reviewer: `testing/testing-evidence-collector.md`;
- Release Reviewer: `testing/testing-reality-checker.md`.

Fetch only pinned allowlisted paths; verify SHA-256 and MIT notice; keep upstream text immutable and separate from overlays; normalize IDs, responsibilities, skills, deliverables, and provenance; reject hidden instructions, unsupported structure, path escape, duplicate IDs, or missing provenance; mark imports Candidate. Overlays narrow scope and disclose TDD/evidence/permission changes. Promotion to executable/Active is excluded.
## Candidate admission and qualification

Lifecycle: `candidate -> qualifying -> available -> assigned`, with explicit deferred, rejected, failed, stale/retry, blocked, and unassigned paths.

Universal mandatory checks: protocol handshake, identity, event correlation, cancellation, permission denial/escalation, project-root/secret isolation, context disclosure, health/recovery, knowledge citation, and deterministic synthetic completion. Passing grants availability only.

Six role suites bind agent, runtime-binding, role-contract, suite, and permission-ceiling versions. Each tests its defining D-19 responsibility in an isolated synthetic root. A separate qualified reviewer records evidence; the manager activates/rejects. Mandatory failure cannot be waived. Advisory exceptions require scope, evidence, residual risk, compensating control, owner, expiry/review trigger, and affected versions; they cannot chain or relabel mandatory failures.

## Reciprocal collaboration

The manager receives plain-language decisions with technical detail on demand. The Candidate receives identity/binding facts, role/overlay diff, synthetic scope, effective permissions/prohibitions, qualification criteria/evidence, manager questions/decisions/reasons, and remediation/decline paths. Candidates may accept, rank preferences, request reassignment, or decline with categorized rationale. They cannot self-admit, self-qualify, self-assign, broaden permissions, choose replacements, or rewrite manager evidence.

## Commands

```powershell
npm.cmd run protocol:codex:generate
npm.cmd run protocol:codex:check
npm.cmd run roles:agency-agents:check
npm.cmd run test:runtime
npm.cmd run test:qualification
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
```

Explicit supervised live gate:

```powershell
$env:CUCKCODE_LIVE_CODEX = '1'
npm.cmd run test:live:codex
```

## Code style

Decode provider-specific values once and normalize immediately. Prefer exhaustive unions and explicit results for expected runtime failures.

```ts
type AdapterResult<T> =
  | { ok: true; value: T; correlation: RuntimeCorrelation }
  | { ok: false; issue: RuntimeIssue; retryable: boolean };

interface RuntimeAdapter {
  connect(input: ConnectRequest): Promise<AdapterResult<RuntimeBindingReport>>;
  cancel(input: CancelRequest): Promise<AdapterResult<CancelReceipt>>;
  disconnect(): Promise<void>;
}
```

No provider event may be cast directly into `ProjectEvent`; validation and normalization are explicit and tested.

## Testing strategy

- Unit: binding, permission, admission, qualification, exception, staffing, normalization policies.
- Contract: one suite unchanged against fake and Codex fixture transports.
- Integration: fake child process, JSONL fragmentation/coalescing, stderr, timeouts, malformed data, exit races, cancellation, recovery, SQLite migration, role validation.
- Qualification: deterministic universal and six role suites with equivalent rerun/evidence hashes.
- Live: one supervised authenticated `0.146.0` stdio run in a temporary root, with agent network tools/external effects denied.
- Security: secret canaries, junction/path escape, approval replay, identity impersonation, stale decisions, ID collision, output limits, redaction.
- Regression: Phase 0-2 unit/integration/contract/build/browser/axe remain green; browser results cover only unchanged scaffold.

Every behavior records RED, GREEN, REFACTOR, commands, and commit in `docs/evidence/phase-3/red-green-log.md`.

## Project structure

```text
packages/contracts/src/runtime*.ts
packages/domain/src/runtime*.ts
packages/application/src/runtime*.ts
packages/runtime-codex/protocol/0.146.0/
packages/runtime-codex/src/
packages/persistence/src/
packages/testing/src/
roles/upstream/agency-agents/<commit>/
roles/overlays/
roles/schemas/
fixtures/qualification/
scripts/
docs/evidence/phase-3/
```

## Boundaries

Always:

- validate provider/upstream input;
- preserve correlation, provenance, versions, and evidence;
- deny on ambiguity, timeout, disconnect, or stale state;
- use deterministic fakes before live execution;
- disclose capabilities/limits to manager and Candidate;
- stop tool actions after critical invalidation.

Ask first:

- Codex version/schema change;
- new dependency/install script;
- different Agency Agents commit/path/license/overlay;
- experimental App Server API;
- credential collection/login implementation;
- new network/tool/external-effect permission;
- live execution beyond the one bounded gate.

Never:

- expose secrets or hidden reasoning;
- use provider prose as canonical state when structured evidence exists;
- treat provider completion as CuckCode completion/approval;
- execute Candidate role content;
- waive mandatory controls;
- allow browser-to-Codex or non-local App Server exposure;
- silently reuse approvals/bindings;
- begin production UI, kickoff, art fidelity, deployment, or Phase 4.

## Success criteria

- Exact-version schemas reproduce or visibly fail.
- Fake and Codex fixture transports pass one provider-neutral contract suite.
- Runtime events preserve correlations and replay deterministically.
- Approvals are bounded, deny-by-default, non-replayable, redacted.
- Cancellation prevents later tool action and has terminal evidence.
- Disconnect/recovery never implies false continuity.
- New/material bindings enter Candidate and invalidate incompatible qualifications.
- Universal and six role suites are deterministic, version-bound, independently reviewed, manager-decided.
- Agency content is immutable, attributable, Candidate, non-executable.
- One supervised live local run passes with only inherent OpenAI service traffic and no task-level external side effect.
- Existing gates remain green; evidence classes remain distinct.

## Open questions

No product question blocks approval. The assumptions above are proposed implementation decisions. Owner corrections must be incorporated before implementation.
