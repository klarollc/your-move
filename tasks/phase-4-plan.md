# Implementation plan: Phase 4 graybox office and collaborative kickoff

Status: **Owner-approved for Phase 4 Tasks 1–15 on 2026-08-13**
Specification: `docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md`
Composition: `.ui-craft/spec.md`
Prior phase: `tasks/plan.md`

## Outcome

Deliver a truthful, accessible graybox office over the accepted canonical runtime and knowledge system, prove its full manager and agent collaboration paths with deterministic fixtures, pass strict rendered/accessibility/comprehension gates, then stop for separate authorization before promoting six role contracts and running the bounded live kickoff that produces the Phase 5 charter.

## Governing decisions

- Phase 4 follows the newer approved phased sequence: graybox office and collaborative kickoff.
- High-fidelity art, final tokens/assets, golden references, and aesthetic baseline promotion remain excluded.
- Existing React 19.2.8, PixiJS 8.19.0, Fastify 5.11.3, WebSocket, Zod, Vitest, React Testing Library, jsdom, Playwright, and axe dependencies are sufficient. No new dependency is planned.
- Vanilla CSS with temporary non-promotable graybox custom properties is the styling approach.
- Deterministic fixtures prove behavior; live Codex is not part of normal verification.
- Actual role execution requires a separate owner gate after exact contract review and graybox acceptance.

## Dependency graph

```text
1 authority/spec alignment
          |
2 UI/read-model contracts ---- 3 component/browser harness
          |                              |
4 loopback session/API ------------------+
          |
5 spatial measurements -> 6 Pixi bridge -> 7 camera/depth/hit testing
          |                                      |
8 DOM shell/outline <----------------------------+
          |
9 selection/inspector -> 10 attention/escalations -> 11 Library/evidence
          |                                              |
12 failure/reconnect/motion equivalence -----------------+
          |
13 kickoff domain/API -> 14 kickoff UI/reciprocal parity
          |
15 browser/a11y/rendered/comprehension evidence
          |
Graybox owner gate
          |
16 exact role promotion + live kickoff preflight (separate approval)
          |
17 bounded live kickoff + manager charter
          |
18 Phase 4 evidence and owner gate
```

## Commands

Focused loops:

```powershell
npm.cmd run test:ui-contract
npm.cmd run test:component -- --run <test-file>
npm.cmd run test:unit -- --run <test-file>
npm.cmd run test:integration -- --run <test-file>
npm.cmd run test:graybox
npm.cmd run test:kickoff
```

Checkpoints:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:component
npm.cmd run test:integration
npm.cmd run test:contract
npm.cmd run test:e2e
npm.cmd run test:a11y
npm.cmd run test:visual
npm.cmd run build
npm.cmd run verify
```

Live kickoff is absent from `verify` and requires its later gate:

```powershell
$env:CUCKCODE_LIVE_KICKOFF = '1'
npm.cmd run kickoff:live
```

## Task sequence

### Task 1 — Reconcile authority and freeze Phase 4 composition

Record the owner-confirmed phase sequence, approve the two surface sections in `.ui-craft/spec.md`, and prevent graybox artifacts from satisfying high-fidelity gates.

Acceptance:

- Master and phased documents identify Phase 4 consistently.
- Specification names included/excluded evidence and both internal owner gates.
- Tests/validators reject graybox assets or captures marked Active/high-fidelity.

Files: planning/design contracts and focused validator test, maximum five. Scope: small.

### Task 2 — Workspace read-model and intent contracts

Define versioned transport-neutral read models for project bar, office descriptors, outline, attention, inspector, evidence, kickoff, selection/focus, camera, freshness, and actionable failures.

Acceptance:

- All canvas subjects have stable DOM twins and canonical cause/freshness fields.
- Manager and agent actions resolve through shared command types and receipts.
- Invalid, secret-bearing, cross-project, stale-revision, or provider-authored manager decisions reject.

Files: contracts/domain source/tests, maximum five. Scope: medium.

### Task 3 — Component and browser harness

Add a jsdom Vitest component project, explicit component script, deterministic animation/test clocks, and Phase 4 Playwright fixture helpers.

Acceptance:

- A deliberate failing component test proves the harness before GREEN.
- UI tests use roles/names and `user-event`, not component internals or CSS selectors.
- Visual command fails when no named Phase 4 visual tests exist; it no longer passes empty coverage.

Files: Vitest/Playwright/package configuration and harness tests, maximum five. Scope: small/medium.

### Checkpoint A — Contracts and harness

Run contract/component/scaffold regression, formatting, lint, typecheck, dependency/license audit, fixture isolation, and Tasks 1–3 RED–GREEN evidence.

### Task 4 — Loopback session, read model, and command boundary

Extend the existing Fastify server with ephemeral session bootstrap, exact-origin/CSRF protection, versioned read model, typed command receipts, and event delivery.

Acceptance:

- Loopback-only bind, unknown origin/client rejection, mutation token enforcement, no tokens in URLs/storage/logs.
- Browser cannot directly access Codex, SQLite, arbitrary paths, or canonical reducers.
- Reconnect resumes from persisted revision; stale commands fail with actionable recovery.
- Test fixture mode is impossible in production mode and cannot reach real project state.

Files: server boundary/integration tests plus shared contracts, sliced to maximum five per commit. Scope: medium/large.

### Task 5 — Graybox spatial measurements and deterministic layout

Use controlled layout trials to select projection grid, elevation, office bounds, zone footprints, agent anchors, overlay resize behavior, discrete zoom stops, pan clamps, cutaway thresholds, and minimum hit regions.

Acceptance:

- Same descriptor/viewport produces byte-equivalent geometry.
- Canonical reset shows every required zone and six roles at 1440×900 and 1280×800.
- Measurements are documented as graybox layout decisions, not final art tokens.
- Product Designer and accessibility review sign off before renderer work.

Files: layout policy/tests, `.ui-craft` decision record, rendered trial evidence. Scope: medium.

### Task 6 — PixiJS scene adapter and lifecycle

Build the isolated PixiJS WebGL adapter that consumes immutable scene descriptors and emits typed intents.

Acceptance:

- Domain/contracts do not import PixiJS; React does not mutate display objects.
- Lifecycle covers mount/update/unmount/context loss/resize and cleans every listener/ticker/resource.
- Depth order, entity IDs, visibility, and descriptor-to-node reconciliation are deterministic.
- Canvas loss retains a usable DOM Office outline and explicit recovery.

Files: web scene adapter/tests and narrow UI-system exports, maximum five. Scope: medium.

### Task 7 — Camera, depth, occlusion, and hit testing

Implement fixed orientation, bounded pan/zoom, canonical reset, deterministic cutaway, coordinate mapping, and selection hit regions.

Acceptance:

- No rotation/orbit/perspective switching or empty-world exploration.
- Reset reproduces exact transform and preserves selection.
- Zoom/pan keep critical actions recoverable; occlusion cannot conceal selected/attention-critical content.
- Keyboard controls match pointer results and require no precision dragging.

Files: camera/geometry source/tests and browser probe. Scope: medium.

### Task 8 — React shell and equivalent Office outline

Replace the Phase 0 scaffold with the project bar, workspace landmarks, skip link, Office outline, live region, and canvas host.

Acceptance:

- Outline exposes all people, zones, states, relationships, and actions in logical order.
- Canvas is never the sole semantic interface; controls use native elements and visible focus.
- Loading, empty, partial, error, stale, offline, and canvas-loss states preserve manager actions and causes.
- Persistent chrome remains within the approved three-structure limit.

Files: web shell/components/styles/tests, split by component with maximum five per commit. Scope: medium/large.

### Checkpoint B — Foundational office

Run geometry, Pixi lifecycle, camera, component, keyboard, axe, both viewport smoke, console/network, reduced-motion, and full regression suites. Capture graybox layout evidence only.

### Task 9 — Shared selection, focus, and contextual inspector

Synchronize canvas/outline/attention selection and implement the on-demand inspector.

Acceptance:

- Every entry path selects the same entity and gives a direct spatial return path.
- Inspector answers state, cause, updated time, freshness, work, blocker, evidence, runtime, permissions, and technical trail.
- Escape/close restores focus; selected/attention content remains visible after deterministic scene resize.
- No provider prose or canvas state becomes canonical truth.

Files: bridge/inspector/tests and read-model mapping. Scope: medium.

### Task 10 — Attention rail and manager escalation actions

Implement the derived rail and exact approve/decline/defer/cancel/redirect flows needed by the graybox journeys.

Acceptance:

- Queue order comes only from canonical attention projection and locates its office target.
- Empty rail collapses; dismissal is not approval; stale/timeout/disconnect denies.
- Plain language and exact technical scope/correlation are both reachable.
- Focus, errors, receipts, and agent-visible disposition are attributable and versioned.

Files: rail/forms/tests and application command handlers. Scope: medium.

### Task 11 — Project Library and evidence/review surfaces

Implement the quiet spatial Library, review station, delivery area, and focused evidence view.

Acceptance:

- Authoritative/approved/provisional/contested/stale/superseded/rejected remain distinct.
- Unauthorized titles/snippets, hidden reasoning, and secrets cannot reach the browser.
- Test, visual, and release evidence remain separate; complete is not approved.
- Every focused evidence view keeps its originating office entity identifiable and reachable.

Files: Library/evidence components, mappings, tests. Scope: medium.

### Task 12 — Failure, reconnect, and motion equivalence

Implement truthful failure/recovery projections and deterministic semantic motion/reduced-motion translation.

Acceptance:

- Disconnect, stale state, rate/budget limit, permission denial, missing artifact, test failure, reviewer disagreement, conflict, restart, cancellation, and canvas loss cannot degrade to idle/active/complete.
- Canonical state updates before animation; one explanatory scene transition leads at a time.
- No ambient loop; no arbitrary screenshot sleeps; animation checkpoints use injected clocks.
- Reduced motion removes travel/camera interpolation and preserves meaning through placement, labels, focus, and announcements.

Files: motion/failure policy, UI integration, tests. Scope: medium.

### Checkpoint C — Complete graybox manager workspace

Run full unit/component/integration/contract/build/browser/axe suites plus named captures for default, selection, attention, blocked/offline, review, completed-unapproved, reconnect, keyboard focus, and reduced motion at both viewports.

### Task 13 — D-25 kickoff domain and command workflow

Implement shared briefing, contribution, synthesis, disagreement, single revision, manager disposition, and versioned charter as canonical objects.

Acceptance:

- Equal briefing version and one initial contribution per six active roles.
- Attribution, disagreement, uncertainty, evidence needs, and minority objections cannot be overwritten.
- One revision maximum per role; silence does not affirm.
- No active implementation before manager-approved complete charter.
- Redirect/reject preserves evidence and opens no unbounded loop.

Files: contracts/domain/application/persistence tests and sources, sliced to maximum five per commit. Scope: large, incremental.

### Task 14 — Kickoff UI and reciprocal parity

Anchor the kickoff at the collaboration table and manager desk with accessible inspector forms and agent-equivalent records.

Acceptance:

- Manager sees briefing, six entries, synthesis, disagreement register, revision state, and exact decision impact without reading transcripts.
- Agents receive the same scope, constraints, permissions, conflicts, evidence, and disposition in machine-readable form.
- Manager edit/redirection uses explicit diffs; agent questions/declines remain attributable.
- Keyboard, screen reader, 200% zoom, reduced motion, error, disconnect, and stale-revision paths pass.

Files: kickoff components/read-model/tests and E2E fixture. Scope: medium/large.

### Task 15 — Graybox visual, accessibility, and comprehension gate

Produce the strict current-build Phase 4 evidence packet.

Acceptance:

- Both approved viewports cover every named state and critical journey with manifests, screenshots, and failure traces.
- Console errors/warnings, failed requests, and non-loopback attempts are empty or explicitly blocking.
- Zero unreviewed axe violations; keyboard, focus, reduced motion, 200% zoom, and recorded screen-reader walkthrough pass.
- Five representative non-technical evaluators complete the approved study; at least four satisfy every MDD comprehension criterion.
- V0/V1 are zero; each V2 has owner disposition; graybox capture is never labeled high fidelity.
- Owner explicitly accepts graybox behavior and composition before any live kickoff.

Files: browser/a11y/visual/study tests, fixtures, evidence manifests, reports. Scope: large evidence pass.

## Separate approval boundary: Tasks 16–17

Approval of this plan does not authorize Tasks 16–17. After Task 15, present exact evidence and request a second owner decision.

### Task 16 — Exact role promotion and live kickoff preflight

Prepare a decision packet containing the six immutable upstream sources, normalized contracts, overlays, permissions, current bindings, admission/qualification evidence, role offers/acceptances, reviewer conflicts, shared briefing, fixture root, Codex version, model, and maximum 13-turn budget.

Acceptance:

- Owner explicitly promotes only the six reviewed contract versions for this kickoff or requests correction.
- Six distinct agent IDs have current compatible admission/qualification/assignment evidence.
- Text-only/no-tool/no-external-effect policy is machine enforced.
- Any drift or failed precondition blocks without partial promotion.

Files: promotion/preflight tests and evidence packet only until approval. Scope: medium.

### Task 17 — Bounded live kickoff and manager charter

Run the owner-authorized D-25 kickoff once, preserve all attributable records, and present the charter decision.

Acceptance:

- At most 13 correlated text-only turns: six contributions, one synthesis, six explicit revisions/affirmations.
- No tool, connector, file, shell, search, image, deployment, messaging, or other task external effect.
- Disconnect/malformed/stale/correlation failure stops without fabricated contribution or consensus.
- Manager reviews the complete record and selects/edits/redirects/rejects.
- Approval creates the exact versioned charter but does not activate Phase 5 work.

Files: opt-in harness, canonical kickoff evidence, charter record. Scope: supervised evidence pass.

### Task 18 — Phase 4 evidence and owner gate

Run deterministic verification again, bind graybox and live-kickoff evidence to exact commits/fixtures, document limits, and stop.

Acceptance:

- Evidence classes remain distinct: static, behavioral, rendered, manual accessibility, comprehension, owner graybox acceptance, live collaboration, manager charter.
- No high-fidelity, production, deployment, or Phase 5 claim.
- Owner accepts Phase 4 or records bounded corrections.

Files: Phase 4 evidence and checklist only. Scope: medium.

## Risks and mitigations

| Risk                                                 | Impact | Mitigation                                                                 |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Office becomes a dashboard with scenery              | High   | Composition spec, persistent-chrome limit, comprehension gate.             |
| Canvas becomes semantic source                       | High   | Immutable descriptors, DOM twin, parity tests, typed intents.              |
| Graybox drifts into unapproved art                   | High   | Non-promotable token/asset status and validator.                           |
| Spatial crowding hides roles/actions                 | High   | Measured two-viewport layout gate before renderer.                         |
| Motion fabricates activity                           | High   | Canonical-first plans, injected clocks, no ambient loops.                  |
| DOM/canvas focus diverges                            | High   | One stable selection bridge and cross-entry component/E2E tests.           |
| Fixture API reaches real state                       | High   | Test-only bootstrap, production-mode rejection, isolated roots/canaries.   |
| UI bypasses trust/approval policy                    | High   | Shared command path, revision preconditions, exact receipts.               |
| Simulated kickoff is mistaken for real collaboration | High   | Deterministic workflow proof separated from separately gated live kickoff. |
| Role promotion grants hidden authority               | High   | Exact-version decision packet, narrow kickoff scope, no tools/effects.     |
| Comprehension study becomes subjective theater       | Medium | Fixed tasks/scoring, individual pass criteria, retain failures.            |
| Screenshot diff is called visual approval            | High   | Evidence labels and explicit owner graybox gate; no art promotion.         |

## Stop conditions

Stop for a new dependency/install script, final art/token/asset, baseline promotion, phase-number change, new viewport/browser/device scope, unreviewed role/source/overlay change, executable role promotion before Task 16 approval, more than 13 live turns, tool or external-effect permission, non-loopback transport, multiple managers, weakened canonical authority, failed security/accessibility invariant, or attempt to substitute automated evidence for owner acceptance.

## Approval gate

Owner approval of this plan, the Phase 4 specification, `.ui-craft/spec.md`, and `tasks/phase-4-todo.md` authorizes Tasks 1–15 only. Task 15 returns a graybox evidence packet and requests separate approval for Tasks 16–17. Task 18 and Phase 4 closure follow only after the live kickoff and manager charter. Phase 5 and high-fidelity art remain unauthorized.
