# Implementation Plan: Phase 1 Pure Contracts and Deterministic Truth

Status: **Owner-accepted on 2026-08-13**
Authority: `docs/master-design-document-v0.1.md`, D-01 through D-26, and `docs/implementation-plan-v0.1.md`
Phase boundary: Phase 1 only

## Objective

Create the provider-neutral, I/O-free truth layer that all future human and agent interfaces will share. Given the same validated event set, CuckCode must produce byte-equivalent canonical state, ordered office descriptors, an accessible outline, manager-attention items, and agent-facing collaboration state. Failures, uncertainty, approvals, and evidence must remain explicit; malformed, duplicate, stale, and out-of-order input must never fabricate progress.

## Assumptions made explicit

1. Existing exact dependencies are sufficient; Phase 1 adds no packages or install scripts.
2. Stable IDs are opaque, validated strings with named prefixes. Tests inject deterministic ID factories; Phase 1 does not generate random production IDs.
3. Timestamps are RFC 3339 strings normalized to UTC. Freshness calculations receive an explicit `now`; no domain code reads the wall clock.
4. Replay order is canonical and independent of input array order: `occurredAt`, then `receivedAt`, then `eventId`. Equal or incompatible entity revisions create inspectable conflicts rather than silently overwriting state.
5. Event payloads are discriminated and versioned. Unknown event kinds and unsupported schema versions are rejected into structured replay issues, not coerced into state.
6. Canonical byte equivalence uses an explicit stable JSON serializer with recursively sorted object keys and preserved array order.
7. Phase 1 models role templates and assignments but does not import Agency Agents content.
8. Phase 1 uses in-memory fixtures only. SQLite persistence remains Phase 2.
9. Projectors return semantic descriptors and coordinates or zone intent only; no React, PixiJS, CSS, animation engine, DOM, or browser work enters this phase.
10. Approval remains an explicit manager event associated with artifact and evidence versions; it is never inferred from completion.

## Architecture

```text
packages/contracts
  stable IDs + Zod schemas + event/error/work/handoff contracts
                |
                v
packages/domain
  canonical ordering -> replay reducer -> immutable canonical snapshot
                |                         |
                v                         v
  manager attention projector      office + accessible-outline projectors
                |
                v
  paired human/agent actionable projections

packages/testing
  deterministic clocks/IDs + replay fixtures + runtime simulator scenarios
```

Dependency rules:

- `contracts` may depend only on Zod and platform-neutral TypeScript.
- `domain` may depend on `contracts`; it must not depend on testing, application, persistence, runtime, web, Node APIs, or browser APIs.
- `testing` may depend on contracts and domain to emit deterministic scenarios.
- `application` remains a shell in Phase 1; no I/O orchestration is required yet.
- All projectors consume canonical state or explicit state transitions. They never consume provider prose.

## Commands

Focused loop:

```powershell
npm.cmd run test:unit -- --run <test-file>
npm.cmd run test:contract -- --run <test-file>
```

Checkpoint and final gates:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:contract
npm.cmd run verify
```

## Dependency order

```text
1 primitives + stable JSON
        |
2 event schema + ordering
   |         |          |
3 work   4 staffing   5 knowledge
   \         |         /
      6 collaboration
             |
       7 replay snapshot
          /        \
  8 attention/scene  9 outline/agent parity
          \        /
          10 simulator
```

## Task sequence

### Task 1 - Stable primitives and canonical serialization

Define prefixed IDs, injected clock and ID interfaces, UTC timestamp parsing, immutable value helpers, and stable JSON serialization.

Acceptance:

- Invalid prefixes, empty IDs, and invalid timestamps return stable structured errors.
- Canonical serialization is byte-identical for semantically identical objects with different key insertion orders.
- No random, wall-clock, Node, browser, or I/O API is reachable from these primitives.

Files: contracts primitive module/test; domain canonical JSON module/test. Estimated scope: medium, four files.

### Task 2 - Versioned event envelope and canonical ordering

Define discriminated versioned events, validation results, canonical ordering, duplicate handling, and structured replay issues.

Acceptance:

- Malformed and unsupported events cannot enter canonical state.
- Duplicate `eventId` values are idempotent when identical and conflicts when content differs.
- Permutations of the same valid event set produce identical canonical order and issue order.

Files: contracts event module/test; domain event-order module/test. Estimated scope: medium, four files.

### Task 3 - Work, evidence, and approval truth slice

Implement work-item transitions plus evidence and explicit manager approval state.

Acceptance:

- Invalid transitions are retained as issues and do not mutate accepted state.
- Completion requires named verification evidence; completion never creates approval.
- Approval references exact artifact and evidence versions and only an explicit manager event can create it.

Files: domain work model/reducer/test plus fixture file. Estimated scope: medium, four files.

### Checkpoint A - Truth foundation

Run unit tests, formatting, lint, and type checking. Record RED and GREEN evidence for Tasks 1-3. Stop if replay cannot remain pure and deterministic.

### Task 4 - Agent, role-assignment, and qualification truth slice

Implement stable agent identity, presence, one-role occupancy, declared capabilities, qualification results, advisory exceptions, and non-waivable failures.

Acceptance:

- One identity cannot hold conflicting active project roles; six-role templates require six identities.
- Mandatory identity, safety, adapter, permission, and capability failures cannot be waived.
- Disconnect, stale health, and capability loss cannot project as active or qualified.

Files: contracts staffing module/test; domain staffing reducer/test. Estimated scope: medium, four files.

### Task 5 - Knowledge lifecycle truth slice

Implement sourced knowledge records and lifecycle transitions needed by canonical truth, without persistence or context-packet assembly.

Acceptance:

- Provenance, status, conflicts, staleness, rejection, and supersession remain inspectable.
- Provisional agent findings cannot silently become authoritative.
- Unauthorized, stale, rejected, and superseded records cannot masquerade as current approved truth.

Files: contracts knowledge module/test; domain knowledge reducer/test. Estimated scope: medium, four files.

### Task 6 - Collaboration, handoff, and actionable error contracts

Define shared commands and structured proposals, questions, declines, disagreements, feedback, handoffs, and recovery errors.

Acceptance:

- Handoffs retain decisions, open questions, uncertainty, artifacts, evidence, and next responsibility.
- Stable errors include cause category, retry safety, required action or authority, and affected canonical IDs.
- Human and agent command shapes resolve to the same canonical command contract; neither gains extra authority.

Files: contracts collaboration and error modules/tests; domain policy test. Estimated scope: medium, five files.

### Checkpoint B - Reciprocal truth

Run unit and contract suites plus formatting, lint, and type checking. Review the paired human/agent contract before projector implementation.

### Task 7 - Canonical replay reducer and snapshot

Compose the slices into one immutable project snapshot with deterministic conflict and issue registers.

Acceptance:

- Replaying any permutation of an equivalent event set yields byte-equivalent snapshots.
- Duplicate, stale, conflicting, and out-of-order events cannot invent progress.
- Replaying an already reduced event set is deterministic and does not mutate inputs.

Files: domain project-state/replay modules and tests; shared fixture. Estimated scope: medium, five files.

### Task 8 - Manager attention and office scene descriptors

Project canonical state into ordered attention items and semantic office descriptors.

Acceptance:

- Active, waiting, blocked, reviewing, completed, disconnected, handoff, and collaboration descriptors follow the MDD semantic map.
- No active animation descriptor exists without canonical active state; no collaboration scene exists without its event.
- Every descriptor cites canonical cause, update time, and freshness or uncertainty status.

Files: domain attention and scene projector modules/tests. Estimated scope: medium, four files.

### Task 9 - Accessible outline and reciprocal agent projection

Project the same snapshot into an ordered non-spatial office outline and agent-actionable state.

Acceptance:

- Human and agent projections expose equivalent identity, status, scope, constraints, decisions, conflicts, and evidence links.
- Every critical agent-actionable state is human-legible; every human-visible status has a machine-readable equivalent.
- Ordering is stable and does not rely on color, motion, provider output, or UI implementation.

Files: domain outline and agent projector modules/tests plus parity test. Estimated scope: medium, five files.

### Task 10 - Deterministic runtime simulator

Add deterministic scenarios for normal completion, manager question and response, permission denial, dependency wait, test failure and revision, disconnect and recovery, stale or out-of-order input, cancellation, and reviewer disagreement.

Acceptance:

- Each named scenario emits schema-valid events using injected IDs and time.
- Repeated scenario generation is byte-identical.
- Simulator success and failure fixtures exercise the same replay and projector contracts; it does not call a provider or perform I/O.

Files: testing simulator and scenario modules/tests; package references if needed. Estimated scope: medium, five files.

### Checkpoint C - Phase 1 invariant gate

Run focused suites and then `npm.cmd run verify`. Produce a machine-readable environment record, RED-GREEN log, invariant matrix, byte-equivalence hashes, and exact commit references. No rendered or visual acceptance is claimed because Phase 1 changes no UI.

## Risks and mitigations

| Risk                              | Impact | Mitigation                                                                                                |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Event names harden too early      | High   | Version every event and validate discriminated payloads; keep provider translation outside domain.        |
| Ordering hides conflicting truth  | High   | Preserve deterministic conflict records instead of last-write-wins mutation.                              |
| State slices drift apart          | High   | Compose through one replay reducer and cross-slice invariant fixtures.                                    |
| Human simplicity burdens agents   | High   | Require projection parity and structured error or handoff tests before gate.                              |
| Simulator becomes a second domain | Medium | Simulator emits public contracts only; replay remains the sole truth engine.                              |
| Overlarge files or tests          | Medium | Stop and split any task that exceeds five files or one focused session.                                   |
| Phase 2 behavior leaks inward     | High   | Ban I/O, SQLite, runtime APIs, React, PixiJS, wall clocks, and randomness by dependency and source scans. |

## Exclusions and stop conditions

Phase 1 does not include persistence, migrations, context-packet retrieval, runtime connection, Agency Agents import, server endpoints, React or PixiJS UI, browser interaction, visual baselines, deployment, or external effects.

Stop and request approval if implementation needs:

- a new dependency or install script;
- a change to an approved MDD state or authority rule;
- I/O or environment access in contracts, domain, or testing;
- a Phase 2 or later capability;
- more than five files for one task after reasonable splitting;
- weakening or deleting a failing invariant.

## Approval gate

Owner approval of this plan and `tasks/todo.md` authorizes Tasks 1-10 only. Completion returns to the owner with Phase 1 evidence and does not authorize Phase 2.
