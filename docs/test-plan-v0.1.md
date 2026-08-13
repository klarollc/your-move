# CuckCode test and quality plan v0.1

Status: **Phases 0–1 accepted 2026-08-13; activated for owner-approved Phase 2 implementation**
Applies to: all scaffold and implementation phases, including D-26 reciprocal usability  
Principle: passing automated checks is necessary but never substitutes for rendered, accessibility, or owner visual evidence.

## Test layers

| Layer | Tool | Primary proof | Forbidden substitution |
| --- | --- | --- | --- |
| Unit | Vitest | pure reducers, policies, projectors, context assembly | mocks proving their own setup |
| Component | Vitest + React Testing Library + user-event | manager-visible DOM behavior and accessibility semantics | component internals or class selectors |
| Integration | Vitest | SQLite, migrations, stores, adapter boundaries, recovery | live provider as only test path |
| Contract | Vitest fixtures | simulator and Codex adapter conformance | streamed prose interpreted as lifecycle truth |
| Browser | Playwright Chromium | complete manager journeys at approved viewports | build success or DOM-only snapshots |
| Automated a11y | axe-core through Playwright | automatically detectable violations | claim of full WCAG conformance |
| Visual | Playwright screenshots | change detection in named golden states | aesthetic approval by pixel threshold |
| Manual a11y | keyboard + screen reader | operability, focus, announcements, comprehension | axe result |
| Human visual | owner review | fidelity to approved art direction | agent or reviewer approval |
| Reciprocal contract | Vitest + simulator + Playwright | human/agent semantic parity, structured collaboration, and recovery | one participant journey standing in for the other |

## RED–GREEN–REFACTOR evidence

Every behavioral task records:

1. test ID and acceptance criterion;
2. focused command;
3. intended RED output proving missing behavior;
4. minimal GREEN change and passing focused output;
5. refactor summary and affected-suite output;
6. final relevant full-suite result;
7. artifacts, environment manifest, and exact commit once Git exists.

A test that passes before the behavior is implemented does not satisfy RED. Documentation and static art changes instead require artifact-specific validation.

## Mandatory invariant suites

### Canonical truth

- deterministic replay and scene projection;
- idempotent duplicate handling;
- stale/out-of-order/conflicting event behavior;
- completion, approval, review, and activity truthfulness;
- injected clocks, IDs, and animation policy.

### Security and authority

- canonical project-root confinement, including junction/traversal cases;
- deny-by-default network, credentials, messaging, deployment, spending, and destructive operations;
- exact approval scope, expiry, decline, timeout, and disconnect behavior;
- secret redaction and unauthorized knowledge-title/snippet isolation;
- non-waivable trust gates at UI, domain, and persistence boundaries.

### Knowledge and identity

- source hashes, provenance, promotion, rejection, contesting, staleness, and supersession;
- deterministic context packets and explicit omissions;
- safe-checkpoint refresh and critical invalidation;
- project notebook versus portable profile isolation using canary secrets;
- stable identity/runtime binding changes and session-ID impersonation prevention.

### Staffing and qualification

- one active role per identity and six-identity roster;
- reviewer independence and prior-involvement conflicts;
- candidate admission and two-stage qualification;
- role preferences, declines, replacement, handoffs, and capability revalidation;
- advisory exception scope/expiry without relabeling mandatory failures.

### Collaborative kickoff

- equal shared briefing;
- one attributable contribution from every active role;
- disagreement preservation and one revision round;
- manager charter approval before active implementation.

### D-24 production review

- automatic review creation on owner acceptance;
- project calendar/timezone calculation;
- five-business-day reminder, due-date escalation, and closure blocking;
- immutable fixture evidence and no direct production import;
- valid dispositions and defer semantics.

### Reciprocal usability and collaboration

- human UI actions and agent API actions resolve through the same canonical commands, policies, and evidence;
- every human-visible status has a machine-readable equivalent and every agent-actionable critical state has a human-legible projection;
- context omission, truncation, staleness, and conflict are explicitly reported;
- no redundant request is emitted for current information already available in the permitted Project Library view;
- stable error codes include retry safety, required action or authority, and affected canonical IDs;
- handoffs preserve decisions, open questions, uncertainty, artifacts, evidence, and next responsibility;
- feedback and review findings reach the affected agent at the next safe checkpoint;
- agent proposals, questions, declines, disagreements, and improvement suggestions remain attributable and receive dispositions;
- reconnect and refresh reuse valid qualification, context, and completed-work state;
- collaboration cannot bypass project permissions, audit, knowledge promotion, or reviewer independence.

Reciprocal-usability test fixtures record human steps, agent messages, canonical events, and resulting projections together. A feature fails when either participant must infer missing critical state or repeat avoidable work.
## Browser acceptance matrix

Run current pinned Chromium on Windows at:

- 1440×900, device scale factor 1;
- 1280×800, device scale factor 1.

For each critical journey retain:

- trace on first retry/failure;
- screenshot at named state boundaries;
- console errors and warnings;
- failed requests and unexpected network attempts;
- environment manifest and fixture IDs.

Initial named journeys:

1. connect candidate, qualify, admit, and staff;
2. collaboratively choose and approve the project goal;
3. assign and observe work through handoffs;
4. resolve permission and knowledge escalations;
5. recover from disconnect and stale context;
6. review tests, visuals, and independent release conclusion;
7. accept the fixture and create the production-suitability review.

## Accessibility gate

- zero unreviewed axe violations in every acceptance state;
- critical journeys complete with keyboard alone;
- visible focus and logical order through canvas-adjacent DOM controls;
- office outline exposes equivalent people, states, relationships, and actions;
- screen-reader walkthrough records browser, screen reader, version, operator, and findings;
- 200% zoom remains usable within the desktop scope;
- reduced motion removes travel/parallax/ambient motion while preserving state and focus;
- color is never the sole state indicator.

Automated scans are partial evidence. Manual findings remain open until resolved, accepted with an owner and expiry, or declared blocking.

## Visual QA gate

- visual tests use deterministic fixtures, fixed fonts, no network content, injected time, and disabled ambient randomness;
- baseline generation and comparison occur in the same pinned Windows/Chromium environment;
- dynamic regions may be masked only with a written justification proving they carry no acceptance meaning;
- baseline changes require annotated before/after evidence, Product Designer findings, Visual QA findings, and owner approval;
- graybox screenshots cannot satisfy high-fidelity acceptance;
- every promoted asset and baseline has provenance and Active status.

## Failure policy

No retries hide a deterministic product defect. Quarantine requires an owner, reproduced cause, affected coverage, expiry, and replacement protection. Flaky visual or browser tests block promotion until the environment or product cause is isolated.

## Proposed command contract

These commands become executable only after scaffold approval:

```powershell
npm.cmd ci
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:contract
npm.cmd run test:e2e
npm.cmd run test:a11y
npm.cmd run test:visual
npm.cmd run build
npm.cmd run verify
```

`verify` must fail if any required machine-readable gate fails. Human visual and manual accessibility approvals remain separate signed evidence and cannot be synthesized into an exit code.
