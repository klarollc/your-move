# Phase 4 checklist: Graybox office and collaborative kickoff

Status: **Owner-approved for deterministic Tasks 1–15 on 2026-08-13; Tasks 16–17 remain unauthorized**
Specification: `docs/phase-4-graybox-office-and-kickoff-spec-v0.1.md`
Plan: `tasks/phase-4-plan.md`
Composition: `.ui-craft/spec.md`

- [x] Owner approved Phase 4 specification, composition, plan, and this checklist for Tasks 1–15 only on 2026-08-13.

- [x] Task 1: Reconcile authority and freeze Phase 4 composition.
  - Acceptance: consistent phase definition; graybox cannot satisfy high-fidelity gates.
  - Verify: document/validator tests and source-boundary scan.

- [x] Task 2: Workspace read-model and intent contracts.
  - Acceptance: stable DOM/canvas twins, canonical cause/freshness, reciprocal commands, fail-closed validation.
  - Verify: focused contract/unit tests.

- [x] Task 3: Component and browser harness.
  - Acceptance: jsdom component project, semantic testing, deterministic fixtures/clocks, non-empty visual command.
  - Verify: intentional RED then component/Playwright harness GREEN.

- [x] Checkpoint A: contracts, harness, dependency/license, fixture-isolation, formatting, lint, typecheck, and RED–GREEN evidence.

- [x] Task 4: Loopback session, read model, and command boundary.
  - Acceptance: loopback/exact-origin/CSRF/session enforcement; stale recovery; no browser authority; production fixture rejection.
  - Verify: server integration/security matrix.

- [x] Task 5: Graybox spatial measurements and deterministic layout.
  - Acceptance: approved projection/grid/anchors/bounds/zoom/pan/cutaway/hit geometry at both viewports.
  - Verify: geometry hashes, controlled rendered trials, Product Designer/accessibility findings.

- [x] Task 6: PixiJS scene adapter and lifecycle.
  - Acceptance: immutable descriptor adapter, deterministic reconciliation, cleanup, context-loss fallback.
  - Verify: focused unit/component/browser probe.

- [x] Task 7: Camera, depth, occlusion, and hit testing.
  - Acceptance: fixed orientation, bounded controls, exact reset, deterministic cutaway and keyboard parity.
  - Verify: geometry/unit and two-viewport browser tests.

- [x] Task 8: React shell and equivalent Office outline.
  - Acceptance: approved persistent structures, semantic equivalence, truthful unhappy paths, visible focus.
  - Verify: component, axe, keyboard, and scaffold-replacement E2E.

- [x] Checkpoint B: foundational office behavior, two viewports, reduced motion, console/network, and full regressions.

- [x] Task 9: Shared selection, focus, and contextual inspector.
  - Acceptance: one selection model; complete truthfulness answers; deterministic resize; focus restoration.
  - Verify: component/E2E parity matrix.

- [x] Task 10: Attention rail and manager escalation actions.
  - Acceptance: derived order, direct office link, dismissal is not approval, exact receipts and agent disposition.
  - Verify: component/application/browser journey.

- [x] Task 11: Project Library and evidence/review surfaces.
  - Acceptance: lifecycle/permission isolation; evidence classes separate; completion distinct from approval.
  - Verify: component, access canary, and browser evidence journey.

- [x] Task 12: Failure, reconnect, and motion equivalence.
  - Acceptance: no false state degradation; canonical-first motion; no ambient loops; reduced-motion semantics.
  - Verify: deterministic motion/failure matrix and reduced-motion E2E.

- [x] Checkpoint C: complete graybox manager workspace and named capture matrix at both viewports.

- [x] Task 13: D-25 kickoff domain and command workflow.
  - Acceptance: equal briefing; six contributions; attributable disagreement; bounded revision; manager charter; no pre-charter work.
  - Verify: unit/contract/integration kickoff matrix.

- [x] Task 14: Kickoff UI and reciprocal parity. **Complete 2026-08-18; verified on Windows.**
  - Acceptance: manager-comprehensible workflow and equivalent agent records across success/failure/reconnect.
  - Verify: component, reciprocal contract, accessibility, and E2E journey.
  - Result: 8 panel + 31 shell component tests, 44 E2E and 18 axe across both viewports, all
    green. Evidence: `docs/evidence/phase-4/red-green-log.md`. Manual screen-reader walkthrough
    and the kickoff capture matrix remain for Task 15.

- [x] Task 15: Graybox visual, accessibility, and comprehension gate. **Complete 2026-09-08.**
      Comprehension study closed by owner waiver with T3/T5/T6 never performed; screen-reader
      walkthrough waived and never run. MDD §19 and §20 are **not met** — see
      `docs/evidence/phase-4/red-green-log.md`. Neither waiver is a pass.
  - Acceptance: both viewports; rendered manifests; clean console/network; axe/keyboard/screen-reader/zoom/reduced-motion; 4-of-5 comprehension; V0/V1 zero; V2 disposition; owner graybox acceptance.
  - Verify: `npm.cmd run verify`, all Phase 4 deterministic commands, manual evidence, and owner record.

- [x] Owner graybox gate: **accepted by owner 2026-09-08**, no corrections requested. No art
      promotion. Acceptance rests on complete automated evidence and partial human evidence.

## Separately gated live kickoff

The initial approval does not authorize the following tasks, except where a later owner approval is
recorded against one. **Corrected 2026-09-12** under Decision 0(a): this header previously made a
blanket claim that no task below was authorized, which stopped being true when the Task 16 packet
was approved on 2026-09-08 and Task 17 with it. Read each entry's own status line; Task 18 and the
Phase 4 gate below remain unauthorized.

- [x] Owner authorized **Task 16** on 2026-09-08, scoped to producing the preflight packet. That
      same approval authorized Task 17 (one bounded live kickoff), conditional on the packet's §7
      work existing. **Correction, 2026-09-12:** this line previously read "Task 16 only" and
      "Task 17 remains gated" — both misleading once the condition below was met. See the Task 17
      entry and Decision 0(a) in
      `docs/evidence/phase-4/live-kickoff/decision-packet-2026-09-12-composition-and-exercise.md`.

- [x] Task 16: Exact role promotion and live kickoff preflight. **Complete 2026-09-08.**
      Packet approved: `docs/evidence/phase-4/live-kickoff/task-16-preflight-packet.md`.
      Executable half built and tested, no provider calls made:
      `scripts/promote-roles.mjs` (all-or-nothing promotion, derived promoted set, explicit
      revoke), `packages/runtime-codex/src/kickoff-policy.ts` (exact spawn args, request
      allow-list, observed-effect stop, 13-turn D-25 budget), and
      `packages/domain/src/kickoff-preflight.ts` (six distinct identities, promotion join,
      qualification pass/freshness/version-compatibility, exception expiry, all failures
      reported together). 34 tests across the three, full verify green.
      **Not yet exercised against real bindings, because none exist** — that is Task 17.
  - Acceptance: six exact reviewed role versions, six qualified distinct identities, bounded permissions, shared briefing, max 13 turns, no tools/effects.
  - Verify: promotion/preflight matrix and owner decision record.

- [ ] Task 17: Bounded live kickoff and manager charter. **AUTHORIZED, not yet runnable.** Owner
      approval of the Task 16 packet on 2026-09-08 authorized Task 17 conditional on §7
      (machine-enforced preflight and promotion checks); `e994188` completed §7. Owner ruling
      2026-09-12, Decision 0(a) in
      `docs/evidence/phase-4/live-kickoff/decision-packet-2026-09-12-composition-and-exercise.md`
      §0, confirms the packet governs and the condition is met. **Correction, 2026-09-12:** this
      line previously read UNAUTHORIZED; amended under that ruling — see `AGENTS.md`. The run still
      cannot happen: role composition (17c-2b), the promotion CLI (17c-2), `collectHandshakeFacts`
      (17c-4), and the kickoff harness (17c-5) do not exist.
  - Acceptance: six contributions, one synthesis, six explicit revisions/affirmations, full attribution, no prohibited effect, manager disposition.
  - Verify: exact `CUCKCODE_LIVE_KICKOFF=1` supervised run and canonical evidence.

- [ ] Task 18: Phase 4 evidence and owner gate.
  - Acceptance: deterministic rerun, exact evidence binding, documented limits, charter record, no Phase 5 or high-fidelity claim.
  - Verify: final Phase 4 evidence packet.

- [ ] Owner Phase 4 gate: accept evidence or request corrections. Phase 5 and high-fidelity art remain unauthorized.
