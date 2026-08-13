# Phase 4 specification: Graybox office and collaborative kickoff

Version: 0.1
Status: Proposed for owner approval
Date: 2026-08-13
Authority: `docs/master-design-document-v0.1.md`, D-02, D-04 through D-09, D-11 through D-26; `docs/implementation-plan-v0.1.md`

## Reconciled phase definition

The owner confirmed on 2026-08-13 that the newer phased implementation sequence controls phase numbering:

- Phase 4 is the deterministic graybox office and collaborative kickoff.
- High-fidelity art direction remains blocked and belongs to later separately approved phases.
- Phase 4 rendered evidence proves composition, interaction, truthful state, and accessibility only. It cannot promote final tokens, assets, or visual baselines.

## Objective

Turn the accepted Phase 1–3 contracts into the first truthful office interface. One manager can understand and operate a six-role project through a bounded isometric 2.5D graybox scene, an equivalent DOM Office outline, a slim project bar, a derived attention rail, and an on-demand inspector. The same canonical collaboration objects support the structured D-25 kickoff for both human and agent participants.

Phase 4 ends only after:

1. deterministic simulator journeys pass at both approved desktop viewports;
2. keyboard, reduced-motion, zoom, automated accessibility, and screen-reader evidence is recorded;
3. a five-person comprehension study meets the approved threshold;
4. the owner accepts graybox behavior and composition;
5. the owner separately authorizes the reviewed role-contract promotion and bounded live kickoff;
6. the six admitted agents complete the D-25 kickoff and the manager records the versioned initial charter.

## Craft read

**Craft Read:** *isometric office workspace for non-technical managers and participating agents, product language, neutral graybox with non-promotable functional cues, variance 5, signature bet: every spatial state has a synchronized inspectable DOM twin.*

Planning knobs:

- CRAFT_LEVEL: 7 for interaction/composition; art fidelity intentionally excluded.
- MOTION_INTENSITY: 3; only state-explanatory travel and immediate feedback, with no ambient loops.
- VISUAL_DENSITY: 4; office-first, sparse persistent chrome.
- DESIGN_VARIANCE: 5; distinctive spatial composition without experimental navigation.
- Animation implementation: PixiJS deterministic tweens plus CSS transitions. No new Motion, GSAP, or Three.js dependency.
- Styling: vanilla CSS and CSS custom properties, matching the current unstyled stack. Temporary graybox tokens are explicitly non-promotable.

## Scope

### Included

- React DOM shell and PixiJS v8 WebGL graybox renderer.
- Fixed three-quarter isometric projection, authored office bounds, deterministic depth ordering, bounded pan/zoom, and Reset view.
- Manager desk, six-role team area, collaboration table, Project Library, review station, delivery area, and bounded reception/onboarding.
- Six distinct stable agent identities and role labels; graybox silhouettes only.
- Slim project bar, collapsible manager-attention rail, contextual inspector, focused evidence view, dialogs/forms, live-region announcements.
- Equivalent keyboard and screen-reader Office outline with synchronized selection, focus, state, relationships, and actions.
- Deterministic scene bridge: immutable scene descriptors in, typed selection/navigation intents out.
- Simulator-driven normal, waiting, blocked, failure, disconnect, recovery, collaboration, review, delivery, and completed-but-unapproved states.
- D-25 shared briefing, six attributable role contributions, Delivery Lead synthesis with disagreement register, one revision per role, and manager selection/revision/redirection/rejection.
- Machine-readable human/agent parity for proposals, questions, disagreements, handoffs, dispositions, charter, errors, and evidence links.
- Reduced-motion semantic equivalence and deterministic animation checkpoints.
- Strict graybox browser, accessibility, rendered, comprehension, and owner-behavior evidence.
- A separately gated, text-only live kickoff after graybox acceptance and exact role-contract approval.

### Excluded

- High-fidelity palette, materials, lighting, textures, props, avatar art, personal accessories, final typography, or Active visual tokens.
- Art-direction candidates, reference-board selection, golden-state promotion, or aesthetic screenshot baselines.
- Agent-authored visual identity assets beyond showing that the eventual identity contract has a reserved semantic location.
- Mobile, tablet, touch-only, Firefox, WebKit/Safari, high-DPI hardware, responsive acceptance, free camera, rotation, or 3D navigation.
- Phase 5 feature implementation, production-suitability review, deployment, publishing, external messaging, destructive actions, or task-level network tools.
- More than one human manager or any simulated multi-manager authority.

## Architecture

```text
canonical events + stores + runtime trust
                 |
          application commands
                 |
       loopback session/API boundary
                 |
      immutable workspace read model
          /                    \
React DOM shell              PixiJS scene
outline/rail/inspector       graybox projection
          \                    /
        stable entity IDs + typed intents
                 |
        same canonical command path
```

Rules:

- React and PixiJS never calculate workflow truth.
- The browser never owns provider credentials, arbitrary filesystem authority, approval truth, or canonical event reduction.
- The scene consumes versioned immutable descriptors and emits only typed intents.
- DOM and canvas selection/focus share stable IDs; neither silently owns a separate selection model.
- Every state-changing manager action traverses the same command validation and canonical event path exposed to agent actions.
- Ordinary verification uses deterministic simulator fixtures. Live Codex is an explicit owner-authorized gate only.

## Loopback and test boundary

- Extend the existing Fastify server using already pinned dependencies; add no dependency or install script without approval.
- Bind loopback only. Use an ephemeral authenticated session, exact allowed origin, and a request-bound anti-CSRF value for mutations.
- Use the existing WebSocket dependency only for versioned read-model/event delivery; commands remain request/response with stable receipts.
- Vite proxies local API/event paths during development and Playwright. Direct browser-to-Codex remains prohibited.
- Deterministic fixture mode is test-only, visibly labeled, unavailable in a production-mode build, and cannot mutate real project state.
- Restart/reconnect restores from persisted canonical state and current runtime health rather than browser memory.

## Composition contract

The office occupies the application below a slim project bar. At canonical reset, both viewports show all required zones, all six role locations, any active attention marker, and the Reset view control. The attention rail and inspector use one deterministic scene-resize rule rather than floating over critical content.

The 1440×900 viewport is the primary graybox composition. The 1280×800 viewport uses the same office, projection, orientation, and information hierarchy with bounded fit adjustment; it does not hide roles or manager actions. Exact grid, camera elevation, zoom stops, pan clamps, cutaway thresholds, and hit geometry are selected through measured graybox trials and recorded before renderer implementation.

Temporary graybox presentation:

- neutral values, outlines, hatching, labels, silhouette changes, and icons carry state;
- no value is promoted into `.ui-craft/tokens.md` as an Active art token;
- status uses text plus at least one non-color cue;
- amber direction may be annotated but exact amber is not selected in this phase;
- cards are limited to inspector content that is genuinely a peer collection; the main workspace is spatial, not a card dashboard.

## Interaction contract

- Pointer selection, keyboard outline selection, and attention-item location resolve to the same selected entity.
- Opening the inspector describes state, cause, freshness, outcome, dependency/blocker, evidence, runtime binding, permission facts, and event trail.
- Escape closes the topmost non-destructive overlay and restores focus to its trigger.
- Reset view restores exact camera transform without clearing selection.
- No precision dragging is required. Camera controls have keyboard equivalents and visible focus.
- Dismissal never approves. Complete remains distinct from approved.
- Offline, stale, partial, error, conflict, empty, and loading states expose a cause and recovery path without false activity.

## Motion contract

- Canonical state updates before any animation begins.
- Semantic travel is allowed only for assignment, handoff, collaboration entry/exit, escalation, review, and delivery transitions.
- One scene-level explanatory transition may lead at a time; later transitions queue visually while state remains current.
- Use injected animation clocks, authored paths, named checkpoints, and transform/opacity only.
- No ambient loop ships in Phase 4.
- Reduced motion removes travel, camera interpolation, parallax, and loops; it uses immediate placement, persistent labels, focus movement, concise live-region announcements, and permitted short opacity feedback.
- Pausing scene animation never pauses runtime work.

## Collaborative kickoff contract

The deterministic workflow and UI are implemented and proven before live execution:

1. Shared briefing freezes one versioned seed, constraints, evidence floor, timebox, knowledge snapshot, and manager non-negotiables for all six roles.
2. Each active role submits exactly one attributable proposal or critique with goal, value, risk, dependencies, acceptance criteria, and evidence needs.
3. Delivery Lead creates one synthesis preserving every disagreement and unresolved evidence gap.
4. Each role may affirm, amend, or challenge once. Silence is not agreement.
5. Manager selects, edits, redirects, or rejects. Selection creates the versioned charter; rejection/redirection creates a newly bounded round.
6. No implementation work may enter active before charter approval.

Live kickoff gate:

- Roles remain Candidate/non-executable until the owner reviews the exact normalized contracts and overlays and explicitly promotes only those six versions for the kickoff.
- All six agent identities must have current admission, exact role qualification, accepted role offers, compatible permissions, and no reviewer conflict.
- Maximum provider budget: 13 text-only turns: six role contributions, one Delivery Lead synthesis, and six optional role revisions. An unused optional revision is recorded as an explicit affirmation, not inferred from silence.
- No tools, connectors, shell, file changes, browser search, image generation, deployment, messaging, spending beyond inherent Codex usage, or external side effects.
- Every turn receives the same canonical snapshot plus its bounded role contract. Outputs are untrusted proposals until validated into collaboration records.
- Manager charter approval is a separate canonical event after reviewing the full record.
- Any failed admission, stale qualification, malformed contribution, provider/version drift, permission request, disconnect, or correlation failure stops the live kickoff without manufacturing consensus or a charter.

## Test strategy

Every behavior uses RED–GREEN–REFACTOR with recorded commands and failure evidence.

### Unit and contract

- scene-layout geometry, depth keys, camera clamps, reset transform, hit regions, cutaway policy;
- workspace read-model schema and DOM/canvas entity parity;
- selection/focus bridge and deterministic motion plans;
- kickoff round limits, attribution, disagreement preservation, charter preconditions, and no pre-charter activation;
- loopback command envelopes, stable errors, session/CSRF/origin policy;
- graybox asset/baseline status prevents promotion as high fidelity.

### Component

- React Testing Library with `user-event` and semantic queries;
- project bar, attention rail, inspector, Office outline, forms, dialogs, errors, announcements, focus restoration, and reduced motion;
- Vitest gains a dedicated jsdom component project so browser components are not mislabeled as Node unit tests.

### Integration

- Fastify loopback session, WebSocket read-model stream, command receipts, reconnect, stale revision rejection, project isolation;
- deterministic simulator to canonical store to read model to browser projection;
- Pixi adapter lifecycle and context-loss/error fallback without importing Pixi into the domain.

### Browser and rendered

- Pinned Chromium at 1440×900 and 1280×800, device scale factor 1;
- named journeys for default office, selection/inspector, collaboration, escalation, blocked/offline, review evidence, completed-unapproved delivery, kickoff, reconnect, reduced motion, keyboard focus, and 200% zoom;
- current-build screenshots, traces on failure, clean console, failed-request inventory, and proof of no non-loopback request;
- visual comparisons enforce stable graybox composition only. They are not art-direction approval.

### Accessibility and comprehension

- zero unreviewed axe violations in each acceptance state;
- keyboard-only critical journeys and logical focus return;
- screen-reader walkthrough of the Office outline and manager controls, recording product/version/operator/findings;
- state understood without color and without motion;
- five representative non-technical evaluators, no more than a short orientation, with at least four meeting every MDD comprehension criterion;
- failed or ambiguous study results return to design; they are not averaged into a pass.

## Evidence classes and gates

### Checkpoint A — UI contracts and local transport

Pass contracts, component harness, session/origin/CSRF, fixture isolation, and source-boundary tests.

### Checkpoint B — Truthful graybox workspace

Pass deterministic scene, camera, DOM/canvas parity, selection, inspector, attention, Library, failure, reconnect, and reduced-motion suites.

### Checkpoint C — Kickoff workflow

Pass six-role fixture, reciprocal collaboration, disagreement, revision, manager disposition, charter, and pre-charter execution prevention.

### Graybox acceptance gate

Pass full machine verification, both viewport journeys, rendered capture matrix, keyboard, axe, screen reader, zoom, reduced motion, clean console/network, five-person comprehension study, V0/V1 cleared, V2 owner-disposed, and explicit owner acceptance of graybox behavior/composition.

### Live kickoff gate

After graybox acceptance, stop for separate owner approval of exact role promotion, six agent bindings, provider-turn ceiling, and fixture manifest. Execute once, retain all attributable outputs and failures, then stop for manager charter decision.

### Phase 4 owner gate

Phase 4 completes only when the owner accepts the graybox evidence and records the kickoff charter. This does not authorize Phase 5 implementation or high-fidelity art.

## Commands proposed

```powershell
npm.cmd run test:ui-contract
npm.cmd run test:component
npm.cmd run test:graybox
npm.cmd run test:kickoff
npm.cmd run test:e2e
npm.cmd run test:a11y
npm.cmd run test:visual
npm.cmd run capture:graybox
npm.cmd run verify
```

Explicit supervised live kickoff, unavailable until its separate owner gate:

```powershell
$env:CUCKCODE_LIVE_KICKOFF = '1'
npm.cmd run kickoff:live
```

## Stop conditions

Stop for owner direction if implementation requires a new dependency/install script, final art token or asset, visual baseline promotion, role source/overlay/version change, executable role promotion before its gate, more than 13 live turns, provider/tool/external-effect expansion, arbitrary filesystem access, non-loopback transport, mobile/cross-browser scope, multiple human managers, altered canonical authority, or weakened/failing invariant.

## Approval requested

Approval of this specification, `tasks/phase-4-plan.md`, `.ui-craft/spec.md`, and `tasks/phase-4-todo.md` authorizes deterministic Tasks 1–15 through the graybox acceptance packet. It does not authorize the separately gated role promotion/live kickoff, Phase 5 execution, high-fidelity art, visual baseline promotion, deployment, or external effects.
