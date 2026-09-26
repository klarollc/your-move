# Phase 7-O checklist: Operability

Status: **OWNER-APPROVED 2026-09-25.** Tasks 1–10 are authorized in order; 9's captures, 11 and 12
are owner-run.
Plan: `tasks/phase-7-o-plan.md`, **owner-approved 2026-09-25**, P-1 to P-5 as recommended.
Specification: `docs/phase-7-o-operability-spec-v0.2.md`, **owner-approved 2026-09-25**.

## Rules for every task

- **RED before GREEN.** The RED is an assertion failure against a deliberate stub, recorded under
  the task before GREEN and never re-run afterwards. A test that cannot fail against its stub is
  named as such, not claimed as RED.
- **Mutations.** Each new guard gets at least one deliberate mutation, confirmed applied before its
  result is read.
- **Gate.** Every task ends with `verify` requested through the agent command runner on a clean
  tree, reported with the commit and the stage counts. A dirty-tree run is not the gate.
- **Evidence writes are owner-run.** Anything under `docs/evidence` needs
  `npm run phase5:provenance:write` by the owner before it is committed.
- Moved or deleted assertions are listed in the task's result with old and new expectations
  (P-4).

## Tasks

- [x] Task 1: Contracts — `work.assigned`, `work.released`, and the version-2 transition
      condition (spec §3.1–3.2, P-2).
  - Acceptance: both new kinds validate `workItemId` and `roleAssignmentId`; `work.transitioned`
    with `payloadVersion: 2` requires `condition` for `blocked`, `waiting_input` and
    `review_requested`; `reasonCode` is a closed set; `waitingOn.id` is required when the kind names
    a record; version-1 payloads parse unchanged; the envelope `schemaVersion` stays 1.
  - Verify: contract tests for every refusal, plus a test that replays every event fixture in the
    repo and asserts none newly fails.

  - Result, 2026-09-25: `packages/contracts/src/work-payloads.ts` and `work.assigned` /
    `work.released` in `eventKinds`. RED through the runner: contract 9 of 12 new tests failed on
    assertions; the three acceptance tests (complete v2 condition, valid assignment, manager or
    external without an id) pass against the permissive stub and are not claimed as RED. The fixture
    sweep, `scripts/work-payload-fixtures.unit.test.ts`, failed on all 50 existing transitions
    (no `payloadVersion: 1` reported); its collector test is not RED. GREEN: contract 77/77, unit
    397/397, `typecheck` clean. Five mutations, each confirmed applied: four killed at once; the
    fifth (removing the explicit "requires a condition" check) survived because the condition
    validator refused `undefined` anyway, so the test now asserts the refusal names the missing
    condition, and the mutant is killed. Version-1 payloads keep extra fields they always carried
    (the simulator's `blocker`, `dependency`) and refuse `condition` until the version is declared.
- [x] Task 2: Domain — assignment relation, retained condition, and the Phase 6 digest successor
      (spec §3.1, P-1).
  - Acceptance: work truth carries the active assignment and current condition; replay issues for
    an unknown work item, an inactive role assignment, a second active assignment, and work
    orphaned by `role.released`; no join by name or position.
  - **P-1, in this task:** a v2 digest recorded in a successor file beside
    `docs/evidence/phase-6/comparison-fixture.json`, and golden-state successors likewise; a v1
    digest function that strips only the §3 additions; a test asserting v1 still equals the frozen
    comparison digest and every frozen golden-state digest; rendered SVG digests compared in memory
    and unchanged. **No frozen file is edited.** If the reduction proof fails, work stops for a
    ruling.
  - Verify: unit tests; the reduction-proof test; `verify` green at the end of the task.

  - Result, 2026-09-25:
    - **Domain.** `WorkItemTruth` gains `assignment` and `condition`, both `null` by default.
      `work.assigned` / `work.released` are validated against staffing as it stood at that point in
      the log: `reduceWorkTruth` replays staffing through the newly exported `applyStaffingEvent`
      rather than a copy. Issues `WORK_ASSIGNMENT_INVALID`, `WORK_ALREADY_ASSIGNED`,
      `WORK_ORPHANED`. A version-2 transition retains its condition with the event's `source` and
      `trust`; the next transition clears it; a malformed version-2 payload is `MALFORMED_WORK_EVENT`
      and changes nothing. RED 11/11 on assertions. One RED was a harness bug, not behaviour: the
      test clock formatted seconds past 59, the envelope parser dropped the event, and the test
      clock now uses real time arithmetic.
    - **Moved assertions (P-4), type-only:** `accessible-outline`, `agent-projection`, `attention`
      and `office-scene` unit tests build `WorkItemTruth` literals, which now carry
      `assignment: null, condition: null`. No expectation changed.
    - **P-1.** `stripPhase7OAdditions` (one definition, `@cuckcode/testing`) and
      `phase6ComparisonFixtureDigestV1` / `goldenStateDigestV1`. The Phase 6 test "matches the frozen
      digest" now asserts the v1 digest equals the frozen one, and a new test asserts the full digest
      differs, so a strip that removed nothing cannot pass. **The reduction proof holds:** the
      comparison fixture and all five golden states reproduce their frozen digests, and all ten
      approved captures re-render byte for byte in memory. `sceneStateFrom` and the viewport list
      moved from `build-phase6-golden-states.ts` into `phase6-golden-states.ts` so the test and the
      builder share one definition.
    - Five mutations, each confirmed applied, all killed.
    - The owner wrote the successor record, `docs/evidence/phase-6/digest-successors-phase-7-o.json`,
      with `npm run phase7o:successors:write`, which refuses to write unless the reduction proof
      holds. The side-effect review did not change: Task 2 added no module to the fixture's import
      graph. The dogfood register gained DF-023. Provenance written by the owner.
- [x] Task 3: Domain — presence provenance and freshness (spec §3.3).
  - Acceptance: staffing retains `eventId` and `occurredAt` per agent; `projectOfficeScene` emits
    them; a missing or unparseable timestamp yields `unavailable`, not `delayed`;
    `projectManagerAttention` carries the condition and the assignment relation.
  - Verify: unit tests. The freshness RED is recorded against today's `delayed`.

  - Result, 2026-09-26:
    - Staffing keeps `updatedByEventId` / `updatedAt` per agent, moved by every event that sets
      presence or health (registration, role assignment and release, presence changes including
      the refused-active path) and by no other. `projectOfficeScene` emits them for agents in place
      of `null`. Freshness: a connected agent's comes from its record's time; a disconnected agent
      is always `unavailable` and a stale one `delayed`, however recent the record; a missing or
      unparseable time is `unavailable` for any subject, no longer `delayed`.
      `ManagerAttentionItem` carries `condition` and `assignment` (explicit `null` for questions and
      for work with none recorded).
    - RED 8/8 on assertions. GREEN: unit 420 + the successor test below, contract 77, integration
      67 + 3 skipped, `typecheck`, `typecheck:scripts` and `lint` clean.
    - **P-1 extended.** `stripPhase7OAdditions` now takes work, staffing and scene: it deletes the
      new work and staffing fields and resets agent scene fields to the `null` / `unavailable`
      Phase 6 always emitted. The reduction proof still holds for the comparison fixture and all
      five golden states, and all ten captures still re-render byte for byte.
    - **Moved assertion, type-only:** the disconnected-agent literal in `office-scene.unit.test.ts`
      gains the two provenance fields; its expectation (`freshness: "unavailable"`) is unchanged
      and still holds under the new rule.
    - Five mutations, each confirmed applied, all killed.
    - The owner rewrote the successor record with `npm run phase7o:successors:write` (it refuses
      without the reduction proof) and wrote provenance.
- [x] Task 4: Application — `projectOfficeReadModel` (spec §4, §7).
  - Acceptance: one pure projection in `packages/application/src/office-read-model.ts`; auxiliary
    records are refused for state, condition, blocker, approval, evidence and requested-action
    facts; rail/entity conflicts are reported; any replay issue blocks "current".
  - Verify: two-snapshot sensitivity (spec §8.1), model-level cross-surface agreement (§8.2), and
    all eight adversarial classes (§8.3).

  - Result, 2026-09-26: `packages/application/src/office-read-model.ts`, `projectOfficeReadModel`.
    - Entities come from a registry that carries layout only (id, label, relationship, and a
      person's agent id); an entry carrying anything else is reported as `REGISTRY_FACT_REFUSED`
      and the extra ignored. Zones are `layout_only`.
    - Work joins to a person through work → role assignment → agent → registry, with no name or
      position match. A person with none is `workRelation: "none_assigned"` with empty lists; an
      agent with no record is `unresolved`; runtime with no allowed record is
      `{ status: "unavailable", reason: "not_recorded" }`.
    - Auxiliary records may supply runtime binding and permissions only, marked with their source,
      version and fixture flag. Any other field refuses the whole record (`AUXILIARY_FACT_REFUSED`).
    - A cause event not in the log makes a view `supported: false`, clears its cause, stops its
      motion and, for a person, its zone (`CAUSE_EVENT_MISSING`). An approval citing an evidence
      version that is not recorded is `unresolved` (`APPROVAL_EVIDENCE_UNRESOLVED`). Any replay
      issue makes `current: false`. Work, staffing and replay issues pass through to the model's
      issue list.
    - Attention items are the domain's, each with `relatedEntityId`; a person's `attention` is
      exactly the model-level items joined to them, and an item nobody holds stays in the rail as
      `ATTENTION_UNJOINED`.
    - Tests: 20, covering §8.1 two-snapshot sensitivity, §8.2 agreement and all eight §7 classes.
      RED 20/20 on assertions, after the first stub was widened so that no RED was a `TypeError`
      and the test helper asserts a work view exists before reading it. Two test-side corrections
      before GREEN, neither a behaviour change: the clock was set too far after the log for
      "current" to be reachable, and moving a presence event before registration only reorders the
      log, so freshness is now varied through the clock and the record time within the log.
    - Seven mutations, each confirmed applied, all killed.
- [x] Task 5: Fixture logs and decision sufficiency (P-3, P-5, spec §5, §8.4).
  - Acceptance: the default office and the canonical named states are event logs in
    `apps/web/src/office-fixtures/`, each declaring its comprehension purpose; shell-only states
    layer over a log; overlap with the Phase 6 golden states is asserted.
  - Verify: the decision-sufficiency test fails first because today's default has no conditions,
    then passes on the new logs.

  - Result, 2026-09-26: `apps/web/src/office-fixtures/` (`index.ts`, `registry.ts`).
    - **Logs:** `default`, `empty`, `partial`, `stale`, `permission-denied`, `missing-artifact`,
      `test-failure`, `reviewer-disagreement`, `conflict`, `cancelled`. Each declares its purpose
      and the comprehension tasks it serves. `conflict` declares the one issue it exists to produce
      (`INVALID_WORK_TRANSITION`); every other log replays with no issue. `stale` is the default
      office read an hour after its last event.
    - **Two additions to P-5's list, stated:** `empty` (an empty log) and `cancelled` (a manager
      cancellation) are canonical, so they get logs rather than overlays.
    - **Overlays:** `loading`, `error`, `offline`, `canvas-loss`, `rate-limit`, `budget-limit` and
      `restart` render over the default log (`officeFixtureFor`).
    - **The default office, now truthful.** The graybox slice is `review_requested`, held by the
      Implementation Engineer, with passed unit and visual evidence and a recorded condition. The
      browser evidence is `blocked`, held by the Test Engineer, waiting on the failed capture
      `evidence_browser`, with a recorded condition. The Test Engineer's presence is `blocked`, so
      the Task 2 contradiction cannot be expressed.
    - **`OFFICE_REGISTRY`:** the thirteen office entities as layout only, for Task 6.
    - **RED was real:** against a naive translation of today's default (the same two items with no
      recorded conditions or evidence), criterion 4 failed with "no recorded condition", and T4
      failed on missing unit evidence. GREEN 6/6.
    - **P-3 overlap, narrower than proposed and stated in the test:**
      `scripts/office-fixtures-golden-overlap.unit.test.ts` asserts every office log records the
      Phase 6 frame's six agents and six role assignments identically. No office state reproduces a
      golden state's work sequence, because the office's default carries two items and the golden
      states one.
    - Five mutations, each confirmed applied, all killed. `lint`, `typecheck` and
      `typecheck:scripts` clean.
- [x] Task 6: Web — render rail, outline, scene cue and inspector from the model (spec §6).
  - Acceptance: no literal in any inspector field; condition text shown with its source and trust;
    precise absence wording; `officeShellEntities` holds IDs, labels and layout only; the Test
    Engineer contradiction is gone because both surfaces read one record.
  - Verify: component tests first, with the Test Engineer contradiction as the named RED; e2e; every
    moved assertion listed (P-4).

  - Result, 2026-09-26: new `apps/web/src/office-model.ts`; `office-shell.tsx` and
    `office-canvas.tsx` rewritten to read it.
    - **One model.** `OfficeWorkspace` replays the state's log and projects once
      (`officeModelFor`), and passes it to the shell. The rail items (`attentionItemsFrom`), the
      outline, the inspector, the project-bar revision and the disposition command's revision all
      read that value. `officeAttention` is removed; the shell's `attention` prop is replaced by
      `model`.
    - **`officeShellEntities`** is derived from `OFFICE_REGISTRY`: ids, labels, kind and
      relationship only. Zones show `Layout only — no canonical state record`.
    - **Inspector fields**, all from the person view: State (presence, health), Cause (presence
      event), Updated, Freshness (with the overlay and a not-current warning), Current work, Needs
      you (each attention item's reason and cause event), Blocker (condition summary, reason code,
      waiting-on, `reported by {source}, {trust}`), Requested action, Approval, Evidence
      (`id vN · kind · result`), Runtime binding and Permissions (`Unavailable in this fixture`
      unless recorded), Technical trail (revision, last event, entity id).
    - **Absence wording (spec §6):** `Work is not assigned`, `No reason recorded`,
      `No requested action recorded`, `No linked evidence recorded`, `No cause event recorded`,
      `No open attention item recorded`. `None recorded` appears only as
      `None recorded: no held work is blocked or waiting`, where the held work was examined.
    - **Not-current is never announced as current.** With a replay issue, the ready cause reads
      `Canonical workspace revision N is not current: <issue codes>.`
    - **RED, recorded before GREEN:** `office-inspector.component.test.tsx`, 6 tests, "Tests 6
      failed | 73 passed (79)", including the named Test Engineer contradiction (inspector
      `Blocker: None recorded`). Two more spec §6 tests were added after the first GREEN, and each
      failed first on its assertion ("Tests 2 failed | 79 passed (81)"): the inspector shows the
      rail item's own cause event, checked against the blocking event found in the log; and a
      non-current model (a `DUPLICATE_EVENT_CONFLICT`) is never stated as current. GREEN 81/81.
    - **Six mutations, each confirmed applied, all killed:** blocker literal `None recorded`; rail
      plain language not from the condition; shared cause boilerplate; revision literal `42`;
      Needs-you without the cause event; cause ignoring `model.current`.
    - **Moved assertions (P-4)**, each replaced by one of equal or greater strength:

      | File                                                                                                                                              | Old                                                                                     | New                                                                                                                                    | Reason                                       |
      | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
      | `apps/web/src/office-shell.component.test.tsx`                                                                                                    | hand-written `attentionItems` passed as a prop                                          | the model of the state's log                                                                                                           | the prop no longer exists                    |
      | same                                                                                                                                              | `attention_blocked_test`; labels `Test evidence is blocked`, `Graybox review requested` | `attention_work_browser_evidence`; `Provide current browser evidence: blocked`, `Deliver the approved graybox slice: review requested` | ids and labels derive from the recorded work |
      | same                                                                                                                                              | receipt `receipt_command_attention_graybox_review_approve`, `revision 42 → 43`          | `receipt_command_attention_work_graybox_slice_approve`, `revision N → N+1`, N the default log's length                                 | revision is the log's                        |
      | same                                                                                                                                              | empty rail via `attention={[]}`                                                         | `state="empty"` (the empty log)                                                                                                        | the rail is empty because the log is         |
      | `tests/e2e/phase-4-attention.spec.ts`                                                                                                             | the same ids, labels and receipt                                                        | as above                                                                                                                               | as above                                     |
      | `tests/e2e/phase-4-kickoff.spec.ts:89`, `tests/visual/phase-4-checkpoint-c-matrix.spec.ts:8,18`, `tests/visual/phase-4-kickoff-matrix.spec.ts:60` | `Canonical workspace revision 42 is current`                                            | `` `Canonical workspace revision ${N} is current` `` from `OFFICE_FIXTURES.default`                                                    | revision is the log's                        |

      No visual baseline changed: the Phase 4 matrices write per-run captures and compare no
      screenshots. `evidence-library` `revision 42` literals are unchanged; the library is Task 8.

    - **Two things not done, for the owner:**
      1. **The motion cue** (`?motion=handoff`) is still the Phase 4 `planSemanticMotion` fixture:
         canonical revision 44 and two handoff transitions that are not in any office log. Spec §7
         row 1 forbids a cue without a supporting canonical event. The default office draws no
         state cue in the scene, so the default path complies. Options: (a) show the cue only when
         the log records the handoff, adding handoff events to a log; (b) label it a Phase 4 motion
         fixture and keep it off the Phase 7-O paths; (c) remove it. Agent recommendation: (a),
         as part of Task 9's browser evidence.
      2. **`current` ignores work and staffing issues.** Task 4 set `current` from replay issues
         only, so the `conflict` log (`INVALID_WORK_TRANSITION`) is still stated current. The
         shell's `conflict` state presents its own cause, so nothing false shows today, but a ready
         office with a refused transition would say current. Agent recommendation: make any
         read-model issue block `current`, as a one-test amendment to Task 4.
    - **Owner rulings, 2026-09-26** ("2. approved 3. approved"):
      1. Motion cue: option (a). The cue shows only when the log records the handoff; added to
         Task 9.
      2. `current`: approved and done as a Task 4 amendment. `projectOfficeReadModel` now sets
         `current` false while any read-model issue stands, not only a replay issue. RED, test 5a
         in `office-read-model.unit.test.ts` against the unchanged projector: the refused
         transition's `INVALID_WORK_TRANSITION` was present, and `current` was still `true`
         ("Tests 1 failed | 449 passed (450)"). The RED run is the mutation: it is the old rule
         itself. GREEN: unit 450, component 81, `typecheck` clean.
    - `test:component` 81, `test:unit` 449, `test:e2e` 50, `test:a11y` 46, `test:visual` 62,
      `typecheck`, `typecheck:scripts`, `lint` clean, on the dirty tree before commit; `verify`
      at the commit below.

- [x] Task 7: Structural guard (R-3, spec §5).
  - Acceptance: a `scripts/*.test.mjs` test in `verify` fails on non-test `apps/web` source that
    constructs `ManagerAttentionItem`, read-model entity or inspector records as literals, using type
    names read from the packages' exports.
  - Verify: the guard passes on the tree and a deliberate violation is recorded as killed.

  - Result, 2026-09-26: `scripts/office-literal-guard.mjs` and `.test.mjs`, run as
    `npm run test:guard` inside `verify` after `test:runner`.
    - **Guarded types, read from the exports, not listed.** Every named object type reachable from
      the return types of `projectOfficeReadModel` (`@cuckcode/application`),
      `projectManagerAttention` (`@cuckcode/domain`) and `attentionItemsFrom`
      (`apps/web/src/office-model.ts`), using the TypeScript checker. Today that is 14 types:
      `ManagerAttentionItem`, `OfficeReadModel` and its views and issue, `OfficeAttentionItem`
      (the rail's record), `WorkConditionTruth`, `WorkAssignmentTruth`. A producer that is renamed
      or stops being exported fails the guard loudly.
    - **Contract types are excluded**, because they are the event vocabulary the fixture logs are
      allowed to write (spec §5). Without this, the logs' `WorkCondition` payloads were flagged.
    - **The rule.** An object literal in non-test `apps/web` source is an office record when its
      contextual type is guarded (annotation, array element, return type, `satisfies`), or, with no
      contextual type, when its keys cover a guarded type's required properties. It is an offender
      when it is written at module scope or every value in it is a literal. A record built inside
      a function from its inputs is a projection and is allowed. One finding per record.
    - **The inspector has no record type of its own**: it renders `OfficePersonView` directly, so
      guarding the read-model views covers it.
    - **RED, against a stub finding nothing:** tests 1 (guarded names) and 2 (deliberate
      violations) failed on their assertions. Tests 3 (allowed controls) and 4 (the tree is clean)
      cannot fail against a stub that finds nothing, and are named as such.
    - **GREEN 4/4.** Six mutations, each confirmed applied, all killed: the Phase 4
      `officeAttention` literal restored into `office-canvas.tsx` (test 4); no shape fallback, which
      missed the untyped rail record (test 2); no contract exclusion (test 4); nested views counted
      separately (test 2); every guarded literal flagged, including derived ones (tests 3, 4).
    - Not in scope and not guarded: the Evidence Library's `libraryProjection` and the kickoff
      fixtures in `office-canvas.tsx`. They are not office read-model records; the library is
      Task 8.

- [ ] Task 8: Evidence Library opens at item and version (spec §6).
  - Acceptance: `initialEvidence: { evidenceId, version }`; an unresolvable reference shows
    `Evidence link unavailable` with the ID and never substitutes another record.
  - Verify: component and e2e tests.

- [ ] Task 9: Browser evidence at 1440×900 and 1280×800 (spec §8.6). **Captures owner-run.**
  - Acceptance: every state the spec lists is captured; console, network, keyboard, pointer, focus
    return, zoom, reduced motion and non-colour meaning are each marked performed or not performed;
    changed baselines are captured under `CUCKCODE_REGENERATE_EVIDENCE=1` by the owner, with before,
    after and a V-severity disposition; V0/V1 findings go to the owner.
  - Also (owner ruling 2026-09-26, option (a)): the `?motion=handoff` cue is driven by handoff
    events recorded in an office log, not by the Phase 4 `planSemanticMotion` literals (revision
    44, two unrecorded transitions). With no recorded handoff, no cue is shown. Component RED first.
  - Verify: the capture manifest; the owner's dispositions recorded.

- [ ] Task 10: Comprehension preparation (spec §8.7).
  - Acceptance: the six task URLs, fixture logs and answer key are aligned to the accepted UI and
    committed; the key's SHA-256 is written into the run preamble; the owner starts the three-day
    interval from that commit.
  - Verify: the preamble hash equals the committed key's digest, checked by script.

- [ ] Task 11: **Owner-run** cold comprehension run.
  - Acceptance: all six tasks, with performed marks recorded at the time, exact answers written
    before the key is opened, and scoring under MDD §20. T3, T5 and T6 must actually be performed.

- [ ] Task 12: **Owner acceptance** of Phase 7-O, or bounded revisions.
