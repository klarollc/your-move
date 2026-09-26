# Implementation plan: Phase 7-O Operability

Status: **OWNER-APPROVED 2026-09-25, with P-1 to P-5 as recommended.** Written under the approval
of `docs/phase-7-o-operability-spec-v0.2.md`
(`docs/evidence/phase-7-o/decision-record-2026-09-25-spec-approval.md`). The owner approved the plan
in session. No task is authorized until `tasks/phase-7-o-todo.md` is also approved.
Specification: `docs/phase-7-o-operability-spec-v0.2.md`, **owner-approved 2026-09-25**.
Governing: MDD §§2, 18, 20, 24 (Phase 7-O); `AGENTS.md`; Active visual system
`reconciliation-b-clarity`.
Prerequisite: the agent command runner (`tasks/agent-runner-plan.md`) is complete (W-3). **Met
2026-09-25** (DF-022).

## Outcome

The default office, and every named office state, is a canonical event log replayed into one office
read model. The rail, outline, scene and inspector all render from that model. Selecting the Test
Engineer in the default office shows the same blocker the rail shows: its reason, who it is waiting
on, the requested action with its attribution, and the evidence behind it. No field in the
inspector is a literal.

## Decisions this plan needs before tasks are written

### P-1: the Phase 6 frozen digests will change (blocking)

`phase6ComparisonFixtureDigest()` hashes `snapshot.work`, `snapshot.staffing` and the scene. The
five golden states in `scripts/phase6-golden-states.ts` hash the same shapes. Spec §3.1 (an
assignment relation on work) and §3.3 (presence provenance on staffing, and non-null agent
`causeEventId` in the scene) change all three. The owner-promoted frozen digest
`13c33cef…` in `docs/evidence/phase-6/comparison-fixture.json`, and the golden-state digests, would
then fail their "matches the frozen digest" tests. Committed evidence must not be rewritten
(D4-P-001/003).

**Recommendation: a successor digest with a reduction proof.**

- Add a `v2` digest recorded in a new successor file beside the frozen one. Never edit the frozen
  one.
- Keep a `v1` digest function that hashes the **same projection with the §3 additions removed**.
  A test asserts that `v1` still equals `13c33cef…` and each golden state's frozen digest.
- That proves the only difference between v1 and v2 is the approved §3 additions. Nothing the
  owner accepted in Phase 6 moved.
- The rendered SVG captures are expected **not** to change, because the renderer does not draw
  cause or provenance. The plan checks this by comparing digests in memory, as was done for
  `build-phase6-golden-states.ts` on 2026-09-14.

Alternative: exclude the new fields from the digest input. Rejected, because the digest would then
stop covering fields the Phase 7 implementation depends on.

### P-2: how the new `condition` requirement is versioned

Spec §3.2 leaves the mechanism to the plan.

**Recommendation: a per-kind payload version.** `work.transitioned` gains `payloadVersion: 2`.
Version-2 payloads require `condition` when `toState` is `blocked`, `waiting_input` or
`review_requested`. Version-1 payloads (no field) keep today's shape and replay unchanged. The
envelope `schemaVersion` stays `1`.

This is the smallest change: the envelope, persistence and simulator are untouched. A bump of
`schemaVersion` to 2 would touch every event producer and the persistence layer for one field.

### P-3: where the named office fixtures live

**Recommendation: `apps/web/src/office-fixtures/`**, one module per state, each exporting only
`ProjectEvent[]` and its declared comprehension purpose.

`apps/web` must not depend on `@cuckcode/testing`, which would put test code in the production
bundle. The fixtures are data, and the R-3 guard permits event logs while forbidding projection
output. Where a state matches a Phase 6 golden state (blocked work, manager escalation), its log
reuses the same event sequence plus the §3 facts, and a test asserts the overlap so the two cannot
silently diverge.

### P-4: which existing assertions change

These existing tests assert fixture-revision literals that are likely to change when the default
office becomes a replayed log. Which ones actually change is established at Task 6, not assumed:

- `tests/e2e/phase-4-kickoff.spec.ts`
- `tests/visual/phase-4-checkpoint-c-matrix.spec.ts`
- `tests/visual/phase-4-kickoff-matrix.spec.ts`

The literals are `Canonical workspace revision 42 is current` and similar. The receipt text
`revision 42 → 43` in the attention e2e and component tests also derives from the fixed fixture
revision.

**Recommendation:** treat each change the way decision 7-C's `aria-disabled` amendment was treated.

- List every moved assertion in the task's evidence, with its old and new expectation and the
  reason.
- Never delete an assertion without a replacement of equal or greater strength.
- Visual baselines that change are captured through `tests/support/evidence-output.ts` under
  `CUCKCODE_REGENERATE_EVIDENCE=1`, **owner-run**, with before and after, and a V-severity
  disposition. They are never regenerated to make a failure pass.

### P-5: shell states that are not canonical

`OfficeShellState` has sixteen values. Several are runtime or UI conditions with no event
expression: `loading`, `canvas-loss`, `rate-limit`, `restart`, `budget-limit`.

**Recommendation:** these stay shell states, layered over a canonical log. The read model's
freshness and issues reflect them (for example, `offline` forces `unavailable`). The fixture log
under them supplies the entity facts. Only states about work and agent truth get their own logs:
`permission-denied`, `missing-artifact`, `test-failure`, `reviewer-disagreement`, `conflict`,
`partial`, `stale`, and the default.

## Task sequence

Each task is RED → GREEN → REFACTOR. The RED is an assertion failure against a deliberate stub,
recorded before GREEN and never re-run afterwards. Every task ends with a full `verify` through the
runner on the owner's machine, reported with the command and commit.

1. **Contracts: new event kinds and the transition condition.**
   - `work.assigned` and `work.released` with payload validation.
   - `work.transitioned` `payloadVersion: 2` with the `condition` schema (`reasonCode` closed set,
     `summary`, `waitingOn`, `requestedAction`).
   - Contract tests cover every refusal, including version-2 attention states without `condition`
     and `waitingOn.kind` naming a record without an `id`.
   - Version-1 fixtures across the repo still parse. That is asserted, not assumed.
2. **Domain: assignment relation and retained condition.**
   - Work truth records the active assignment (`roleAssignmentId`, `eventId`) and the current
     condition.
   - Replay issues for an unknown work item, an inactive role assignment, a double assignment, and
     work orphaned by `role.released`.
   - **Includes P-1.** The v2 digest, the v1 reduction proof, and the successor records land in this
     task, because this is the task that changes the digests. `verify` must be green at the end of
     it.
3. **Domain: presence provenance and freshness.**
   - Staffing retains `eventId` and `occurredAt` per agent.
   - `projectOfficeScene` emits them.
   - A missing or unparseable timestamp gives `unavailable`, not `delayed`. This is a behavior change
     to an existing function, so its RED is an assertion against today's `delayed`.
   - `projectManagerAttention` carries the condition and the assignment relation.
4. **Application: the office read model.** New `packages/application/src/office-read-model.ts`,
   alongside `kickoff-read-model.ts`:
   - `projectOfficeReadModel(snapshot, now, auxiliary)`;
   - the auxiliary-record restriction from spec §4, enforced by type and by a refusing test;
   - conflict detection between rail and entity;
   - any replay issue blocks "current".

   Tests:
   - two-snapshot sensitivity (spec §8, criterion 1);
   - cross-surface agreement at the model level (criterion 2);
   - the eight adversarial classes (criterion 3).

5. **Fixture logs (P-3, P-5).**
   - The default office and the canonical named states become event logs.
   - The overlap tests with the Phase 6 golden states.
   - **The decision-sufficiency test (criterion 4).** RED is expected to be real here: today's
     default has no conditions, and the test must fail for that reason before the logs are written.
6. **Web: render from the model.**
   - `office-canvas.tsx` replays the selected log and projects once.
   - `office-shell.tsx` renders rail, outline, scene cue and inspector from the model, with
     attribution on condition text and the precise absence wording from spec §6.
   - `officeShellEntities` keeps IDs, labels and layout only.
   - Component tests first. The Test Engineer contradiction is the named RED.
   - Assertions moved under P-4.
7. **Structural guard (R-3).** A `scripts/*.test.mjs` test fails on any non-test `apps/web` source
   that constructs `ManagerAttentionItem`, read-model entity or inspector records as literals. The
   type names are read from the packages' exports, not hand-copied. The guard runs in `verify`, and
   a deliberate violation is recorded as killed.
8. **Evidence Library at item and version.** New `initialEvidence: { evidenceId, version }`. An
   unresolvable reference shows `Evidence link unavailable` with the ID and never substitutes
   another record. Component and e2e coverage.
9. **Browser evidence (criterion 6).**
   - Chromium at 1440×900 and 1280×800 for every state the spec lists.
   - Console, network, keyboard, pointer, focus return, zoom, reduced motion and non-colour meaning
     are exercised and recorded as performed or not performed.
   - Visual baselines follow P-4.
   - V0/V1 findings go to the owner for disposition.
10. **Comprehension preparation (criterion 7).**
    - Align the six task URLs and the answer key to the accepted UI, then commit them.
    - Record the key's SHA-256 in the run preamble.
    - The owner starts the three-day interval from that commit.
11. **Owner-run cold comprehension run.** All six tasks, performed marks recorded at the time,
    scored under MDD §20.
12. **Owner acceptance of Phase 7-O**, or bounded revisions.

## Out of scope

Phase 7 high-fidelity art and the `.ui-craft` token reconciliation noted in the 2026-09-23 readiness
plan. Also out: live provider calls, the Phase 5 Decision Notice fixture, C-1 F3/F4/F6, and the
`phase-7-o` provenance producer rule (a separate one-line task, if wanted).

## Risks

- **The largest is P-1.** If the reduction proof fails, the §3 changes altered something the owner
  accepted in Phase 6. Work stops for a ruling; the frozen digest is never edited.
- **Scope creep in the condition vocabulary.** `reasonCode` is a closed set. Adding a code later is
  a contract change needing a test, not a free-text escape.
- **The comprehension run is the only instrument for F-3**, and it is the last task. Criterion 4
  exists so that the likely failure (empty detail) is found at Task 5 rather than at Task 11.
