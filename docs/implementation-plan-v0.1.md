# CuckCode phased implementation plan v0.1

Status: **Phases 0–3 owner-accepted 2026-08-13; Phase 4 Tasks 1–15 owner-approved 2026-08-13; Tasks 16–17 and Phases 5–8 remain unapproved**
Source of truth: `docs/master-design-document-v0.1.md`, owner-approved 2026-08-12 and amended by D-26 on 2026-08-13
Scope: planning only; this document does not authorize scaffolding, dependency installation, role import, runtime connection, or production implementation.

## Outcome

Deliver a local-first desktop Chromium application in which one human manager can staff, observe, communicate with, and orchestrate six runtime-backed agents through a truthful isometric office. The first acceptance run must prove shared knowledge, reciprocal human/agent usability, bounded permissions, TDD, independent review, strict visual QA, and explicit owner approval.

## Delivery rules

- Every behavior follows RED–GREEN–REFACTOR with recorded failure evidence.
- Canonical events and pure projectors precede scene animation.
- The deterministic simulator precedes a live Codex adapter.
- Graybox interaction and accessibility precede high-fidelity art.
- No phase passes on build or state checks alone when rendered or human evidence is required.
- Only the owner may approve scope, visual direction, production reuse, or final acceptance.
- Changes outside the phase's named files, permissions, or dependencies stop for approval.
- Every feature defines paired human and agent journeys over the same canonical objects and evidence.
- Human simplicity may not shift avoidable ambiguity, repetition, context reconstruction, or recovery work onto agents.
- Agent automation may not make work opaque, uncontrollable, or unverifiable to the manager.

## Phase 0 — Reproducible scaffold

Deliverables:

- Git repository and narrow `.gitignore` approved before initialization;
- npm workspaces and exact lockfile;
- `apps/web`, `apps/server`, `packages/domain`, `packages/contracts`, `packages/testing`, and `fixtures/decision-notice` boundaries;
- formatting, linting, type checking, unit, integration, browser, accessibility, build, and visual scripts;
- environment manifest containing Node, npm, OS, Chromium, fonts, timezone, and dependency pins;
- CI-ready commands that run locally first.

Gate:

- clean install from lockfile;
- every proposed command exists and returns the expected empty/scaffold result;
- dependency/license/native-module review complete;
- no runtime or product behavior claimed.

Stop conditions:

- unsupported Node/package peer range;
- native SQLite build failure;
- unapproved repository policy;
- any install script or dependency requiring authority beyond the project root.

## Phase 1 — Pure contracts and deterministic truth

Build in this order:

1. Stable IDs, schemas, clocks, and event envelope.
2. Append-only event semantics and deterministic ordering/idempotency.
3. Work, agent, role, qualification, knowledge, approval, and evidence state machines.
4. Pure projectors for manager attention, office scene descriptors, and accessible office outline.
5. Deterministic runtime simulator covering success and failure paths.
6. Paired human/agent projections, actionable error envelopes, and structured collaboration/handoff contracts.

Gate:

- invariant tests pass from replayed fixtures;
- identical logs yield byte-equivalent canonical snapshots and ordered scene descriptors;
- duplicate, stale, malformed, and out-of-order events cannot invent progress;
- no React, PixiJS, Node I/O, provider API, or wall clock enters the pure domain package.

## Phase 2 — Persistence and shared Project Library

Deliverables:

- migration-managed project-local SQLite database;
- canonical event store and rebuildable projections;
- content-addressed artifact/evidence manifests under `.cuckcode/`;
- knowledge records, lifecycle states, provenance, conflict/supersession handling, and FTS5 index;
- deterministic context-packet assembler;
- personal notebook and portable-profile isolation;
- checkpoint propagation and critical invalidation behavior;
- context reuse, omission disclosure, anti-repetition lookup, and agent feedback delivery;
- backup, integrity check, export, and interrupted-write recovery.

Gate:

- crash/interruption and migration tests pass;
- a canary secret and distinctive project fact cannot cross project boundaries;
- context packets reproduce from the same policy and snapshot;
- stale, rejected, unauthorized, and superseded records are handled exactly as specified;
- SQLite projections and indexes rebuild from canonical records.

## Phase 3 — Runtime adapter and trust onboarding

Deliverables:

- provider-neutral adapter interface;
- Codex App Server stdio adapter behind that interface;
- process supervision, normalized lifecycle events, cancellation, disconnect/recovery, and bounded approval requests;
- stable CuckCode identity plus versioned runtime bindings;
- universal candidate qualification and six role-specific qualification suites;
- manager admission, staffing, handoffs, declines, conflicts, and non-waivable gates.

Gate:

- simulator contract suite passes before live execution;
- one explicitly supervised local Codex contract run completes with no network or external side effect;
- identity/runtime changes are disclosed and capability loss blocks incompatible roles;
- no candidate can be assigned before admission and role qualification.

Stop conditions:

- undocumented or experimental provider API becomes required;
- adapter cannot preserve event correlation or cancellation;
- sandbox, permission, identity, or secret-isolation invariant fails.

## Phase 4 — Graybox office and collaborative kickoff

Deliverables:

- React accessible shell and PixiJS graybox scene;
- fixed three-quarter isometric camera, bounded pan/zoom, reset view;
- six distinct agents, functional zones, reception/onboarding, and Project Library;
- slim project bar, collapsible attention rail, contextual inspector;
- equivalent keyboard/screen-reader office outline;
- structured D-25 kickoff and manager-approved initial charter;
- machine-readable collaboration objects matching the office's visible proposals, questions, handoffs, conflicts, and resolutions;
- reduced-motion semantic equivalence.

Gate:

- desktop Chromium journeys pass at 1440×900 and 1280×800;
- keyboard-only and screen-reader walkthroughs complete;
- no semantic animation occurs without canonical state;
- parity tests prove that human and agent projections expose equivalent actionable state;
- five-person comprehension study meets the MDD threshold;
- owner approves graybox behavior only, not high-fidelity art.

## Phase 5 — Controlled six-role acceptance project

The admitted team runs the structured kickoff. Decision Notice is the seed candidate and rigor floor; the manager approves the final bounded goal before implementation.

Required run:

1. Shared briefing and attributable proposals.
2. Delivery Lead synthesis, disagreement register, one revision round, manager charter approval.
3. Product Designer contract and owner acceptance of the surface specification.
4. Implementation Engineer records RED, GREEN, and REFACTOR evidence.
5. Test Engineer produces deterministic browser and failure evidence.
6. Visual QA Reviewer captures and annotates current-build evidence.
7. Release Reviewer independently returns NEEDS WORK or owner-approval eligibility.
8. Owner accepts, redirects, or rejects.

Gate:

- all required evidence classes exist and remain distinct;
- shared knowledge contribution/retrieval/conflict-resolution scenario passes;
- manager approval references exact artifact and evidence versions;
- owner explicitly accepts the fixture outcome.

## Phase 6 — Art-direction candidates and golden states

Deliverables:

- three original, controlled-composition CuckCode candidates;
- owner selection or documented coherent reconciliation;
- approved tokens and reference board;
- golden states for default office, collaboration, escalation, blocked work, visual review, and reduced-motion equivalents;
- fixed environment manifests and reviewed screenshot baselines.

Gate:

- source/provenance review complete;
- accessibility and contrast intent documented;
- Product Designer and Visual QA findings resolved or accepted;
- explicit owner approval promotes references from Candidate to Active.

## Phase 7 — High-fidelity implementation

Deliverables:

- approved materials, lighting, avatars, props, typography, motion, and attention cues;
- agent-authored identity details within the approved art system;
- golden-state visual regression suite;
- performance budget and reduced-motion verification.

Gate:

- behavioral, accessibility, and rendered evidence pass in the pinned environment;
- visual discrepancies are resolved or explicitly accepted;
- owner approves current-build visuals at both viewports.

## Phase 8 — Production-suitability disposition

Fixture acceptance atomically creates the D-24 review. Within 10 business days it must record `promote_candidate`, `reuse_concepts_only`, `do_not_promote`, or an owner-approved `defer_until` disposition. The parent initiative cannot close without that record.

Any production reuse begins a separate architecture review and TDD scope. Fixture code is never copied directly into production.

## Approval status

Phases 0 through 3 were accepted by the owner on 2026-08-13. Phase 4 is defined by `docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md`, `.ui-craft/spec.md`, `tasks/phase-4-plan.md`, and `tasks/phase-4-todo.md`. The owner approved deterministic Tasks 1–15 on 2026-08-13. Live role promotion/kickoff, Phase 5, and high-fidelity art remain separately gated.
