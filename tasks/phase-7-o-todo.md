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

- [x] Task 8: Evidence Library opens at item and version (spec §6).
  - Acceptance: `initialEvidence: { evidenceId, version }`; an unresolvable reference shows
    `Evidence link unavailable` with the ID and never substitutes another record.
  - Verify: component and e2e tests.

  - Scope, owner ruling 2026-09-26: narrow, as written; Task 8b (below) is drafted for approval
    to build the library's evidence from the log.
  - Result, 2026-09-26:
    - **Library.** `EvidenceLibrary` takes `initialEvidence: { evidenceId, version }` and opens the
      record with that ID **and** version. Otherwise it opens an `Evidence link unavailable` dialog
      with the ID, the version, and the versions the library does hold, and states that no other
      record was opened. The focused-evidence dialog now shows the version. Escape and
      `Close evidence` close both dialogs.
    - **Version on library records.** `BrowserLibraryProjection` evidence (and its input) gains a
      required `version`, passed through by `projectBrowserLibrary`. Every existing literal gained
      `version: 1`: `packages/application/src/evidence-library.unit.test.ts`,
      `apps/web/src/evidence-library.component.test.tsx`,
      `apps/web/src/office-shell.component.test.tsx` and the Phase 4 `libraryProjection` in
      `office-canvas.tsx`. No assertion changed.
    - **Inspector links.** When a library is available, the inspector's Evidence field has one
      `Open {evidenceId} v{version}` button per recorded evidence item. It opens the library at
      that item and version; closing the library returns focus to the button.
    - **Today, in the default office, every such link shows `Evidence link unavailable`**, because
      the library is still the Phase 4 list (`evidence_task_11_*`). That is the truthful result
      until Task 8b.
    - **Not changed:** the zone buttons (`Open Visual QA evidence`, `Open Release evidence`) still
      select by kind. They are not an inspector Evidence link; Task 8b addresses them.
    - **RED, against a stub accepting and ignoring `initialEvidence`:** `evidence-link.component.test.tsx`,
      5 tests, "Tests 5 failed | 81 passed (86)"; each failed because the dialog or the link did
      not exist, with the prop type-checking. GREEN 86/86.
    - **e2e** `tests/e2e/phase-7o-evidence-link.spec.ts` (both viewports) was written after GREEN,
      so its failing case is shown by mutation 3 instead: 2 failed under it.
    - **Three mutations, each confirmed applied, all killed:** matching by ID alone (2 component
      tests); falling back to another record for an absent version (1); not recording the link as
      the focus trigger (1 component test, and both e2e runs).
    - `test:component` 86, `test:unit` 450, `test:e2e` 52, `test:a11y` 46, `typecheck`,
      `typecheck:scripts`, `lint` clean on the dirty tree; `verify` at the commit.

- [x] Task 8b: the library's evidence from the office log. **Approved 2026-09-26 as recommended.**
  - Why: spec §1 says the Evidence Library reads the same canonical data as the rail and
    inspector. Today its evidence is the Phase 4 list, so no inspector link resolves.
  - Proposal: a projection in `packages/application` from `snapshot.work` evidence records
    (`evidenceId`, `version`, `kind`, `result`, `eventId`, `workItemId`) to library records. The
    origin entity is the work item's holder through its role assignment. `approved` only with the
    matching approval record covering that evidence version; otherwise completed and approved stay
    distinct.
  - Decisions needed:
    - **8b-1, lanes.** Library lanes are fixed as `test`, `visual`, `release`; the log records
      `unit`, `visual`, `browser`. Recommendation: lanes are the recorded kinds, derived. Mapping
      `unit` and `browser` to `test` would be an invented equivalence.
    - **8b-2, summary.** `evidence.recorded` has no summary text. Recommendation: no contract
      change; show kind, result, version, work item and cause event, and `No summary recorded`.
    - **8b-3, zone buttons.** `Open Visual QA evidence` and `Open Release evidence` select the first
      record of a kind. Recommendation: they open the library unfocused, and focused views come
      only from item-and-version links.
  - Moves expected (P-4), to be listed at the time: the Phase 4 library e2e and a11y lane names and
    `Complete — not approved`, and the review-station and delivery-area focused-evidence tests.
    Knowledge records stay Phase 4 data and are out of scope.
  - Sequencing: before Task 9's captures and Task 10's answer key, which would otherwise record
    the Phase 4 list.
  - Result, 2026-09-26:
    - **Projection.** `projectOfficeLibraryEvidence({ snapshot, model })` in
      `packages/application/src/evidence-library.ts`: one `LibraryEvidenceRecord` per recorded
      evidence item at the version the log holds, with its recorded kind, `failed` or `complete`,
      `approved` only when a manager approval cites that ID at that version, `summary: null`, the
      work item, the recording event, and the holder as origin (null when no one holds the work).
      `BrowserLibraryProjection` evidence is now `LibraryEvidenceRecord` (kind widened to the
      recorded string; summary and origin nullable; work item and cause event optional).
    - **Web.** `officeLibraryFor(state)` (`office-model.ts`) builds the library from the state's
      log; the Phase 4 knowledge records moved unchanged to `office-fixtures/knowledge.ts`. The
      Phase 4 evidence list is deleted. Lanes are grouped by recorded kind (8b-1); records show
      `No summary recorded` (8b-2); each record's button and dialog name it by ID and version; the
      dialog adds kind, work item and recording event, and omits `Locate origin` when there is
      none. Zone buttons are all `Open Project Library` and open it unfocused (8b-3);
      `initialEvidenceKind` is removed.
    - **The inspector's link now resolves in the default office:** `Open evidence_browser v1` opens
      `Evidence: evidence_browser v1`, failed, held by the Test Engineer.
    - **Guard.** `projectOfficeLibraryEvidence` is a guard producer, so `LibraryEvidenceRecord`
      literals in `apps/web` fail `test:guard`.
    - **RED:** unit, 3 tests in `office-read-model.unit.test.ts` against a stub returning `[]`,
      "Tests 3 failed | 450 passed (453)". Component, 3 tests in
      `office-library.component.test.tsx` against `officeLibraryFor` returning the Phase 4 list,
      "Tests 3 failed | 86 passed (89)", each on its assertion. GREEN: unit 453, component 89.
    - **Five mutations, each confirmed applied, all killed:** approval by ID without version;
      origin always null; kind forced to `test`; an invented summary; the Phase 4 evidence list
      restored into `office-model.ts` (guard test 4, three findings).
    - **Moved assertions (P-4):**

      | File                                                        | Old                                                                                                                           | New                                                                                                                                                                      | Reason                                                                              |
      | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
      | `apps/web/src/evidence-library.component.test.tsx`          | `View Automated verification`, dialog `Evidence: Automated verification`                                                      | `View evidence_test v1`, `Evidence: evidence_test v1`                                                                                                                    | records are named by ID and version                                                 |
      | `apps/web/src/evidence-link.component.test.tsx`             | dialog `Evidence: Automated verification` (twice)                                                                             | `Evidence: evidence_test v2`, `Evidence: evidence_browser v1`                                                                                                            | same                                                                                |
      | `apps/web/src/office-shell.component.test.tsx`              | review station `Open Visual QA evidence` opens `Evidence: Visual QA review`                                                   | `Open Project Library` opens unfocused (no dialog asserted), then `View evidence_visual v1`; origin located as before                                                    | 8b-3                                                                                |
      | `tests/e2e/phase-4-evidence-library.spec.ts`                | lanes `Test`, `Visual`, `Release`; one `Complete — not approved`; `View Automated verification`, origin `agent_test_engineer` | lanes = the log's recorded kinds, `Release` absent; `Complete — not approved` count = the log's passed records; `View evidence_browser v1`, origin `agent_test_engineer` | 8b-1; the log's evidence                                                            |
      | same, review-station test                                   | focused `Evidence: Visual QA review`, `zone_review`, `Approved`                                                               | unfocused on open; `evidence_graybox_visual v1`, `agent_implementation_engineer`, `Complete — not approved`                                                              | 8b-3; the log records no approval                                                   |
      | `tests/accessibility/phase-4-evidence-library-a11y.spec.ts` | focuses `View Automated verification`                                                                                         | focuses `View evidence_browser v1`                                                                                                                                       | same dialog, new name                                                               |
      | `tests/e2e/phase-7o-evidence-link.spec.ts`                  | the link shows `Evidence link unavailable`                                                                                    | the link opens `Evidence: evidence_browser v1`                                                                                                                           | the library now holds it; the unavailable path stays covered by the component tests |

      One Phase 4 claim is gone on purpose: the review station no longer shows an `Approved`
      visual record, because the office log records no approval.

    - `test:e2e` 52, `test:a11y` 46, `test:visual` 62, `test:unit` 453, `test:component` 89,
      `typecheck`, `typecheck:scripts`, `test:guard` clean on the dirty tree; `verify` at the
      commit.

- [ ] Task 9: Browser evidence at 1440×900 and 1280×800 (spec §8.6). **Captures owner-run.**
  - Acceptance: every state the spec lists is captured; console, network, keyboard, pointer, focus
    return, zoom, reduced motion and non-colour meaning are each marked performed or not performed;
    changed baselines are captured under `CUCKCODE_REGENERATE_EVIDENCE=1` by the owner, with before,
    after and a V-severity disposition; V0/V1 findings go to the owner.
  - Also (owner ruling 2026-09-26, option (a)): the `?motion=handoff` cue is driven by handoff
    events recorded in an office log, not by the Phase 4 `planSemanticMotion` literals (revision
    44, two unrecorded transitions). With no recorded handoff, no cue is shown. Component RED first.
  - Result, motion cue (9a), 2026-09-26:
    - **Domain.** Replay kept a handoff's participants but not its direction, so no cue could be
      attributed. `CollaborationTruth` gains an optional `handoff: { fromAgentId, toAgentId,
workItemId }`, set only for `handoff.recorded` events carrying all three. Collaborations are
      unchanged. No Phase 6 golden state records a handoff, so no frozen digest moves; `verify`'s
      reduction proofs confirm it.
    - **Read model.** `OfficeReadModel.handoffs`: each recorded handoff joined to office people,
      with its work item, recording event and revision (the event's position in the log). A
      handoff naming someone the office does not show is `HANDOFF_UNJOINED`, gets no view, and so
      blocks `current`.
    - **Default log.** After the graybox slice's review request, `handoff_graybox_review` hands it
      from the Implementation Engineer to the Visual QA Reviewer. The default log is now 35 events.
    - **Web.** `motionFrom(model, …)` in `office-model.ts` replaces the Phase 4 literals in
      `office-canvas.tsx`: one transition per recorded handoff. The travel label is `Handoff moving
to Visual QA Reviewer`; the reduced-motion label is `Handoff to Visual QA Reviewer recorded ·
revision K`. With no handoff there is no cue. The Phase 4 `delivery` transition is gone,
      because no log records it.
    - **RED, each on its assertion:** domain, 1 test ("1 failed | 453 passed"); read model, 2 of 3
      (the "none recorded" case cannot fail against an empty stub); web, 3 tests in
      `office-motion.unit.test.ts` against the Phase 4 cue ("3 failed | 457 passed (460)"). GREEN:
      unit 460, component 89.
    - **Four mutations, each confirmed applied, all killed:** a fixed revision of 44 (1 unit test);
      the domain dropping the direction (5); no `HANDOFF_UNJOINED` issue (1); a fallback cue with
      no handoff (the new e2e test, both viewports).
    - **Moved assertions (P-4)**, `tests/e2e/phase-4-failure-motion.spec.ts`: canonical revision
      `44` → the default log's length (twice); `Handoff recorded at Review station · revision 43` →
      `Handoff to Visual QA Reviewer recorded · revision K`, K the handoff event's position;
      announcement `Handoff moved to Review station` → `Handoff to Visual QA Reviewer recorded`.
      Added: no cue on `?state=empty&motion=handoff`. `test:e2e` 54, `test:a11y` 46, `test:visual` 62.
  - Result, captures (9b), 2026-09-26. Owner rulings the same day: add two logs selected with
    `?fixture=`; capture unassigned work as it is and file a finding; capture the production
    bundle on 4174 (decision 9-E).
    - **Logs.** `completed-unapproved` (the graybox slice verified then completed, evidence passed,
      no approval) and `unassigned` (`work_release_notes`, ready, held by nobody).
      `officeFixtureFor(state, fixtureId)` selects a named log over the ready shell; an unknown
      name is ignored. `?fixture=` is read in `main.tsx`. RED: 3 unit tests, "3 failed | 460
      passed (463)"; GREEN 463.
    - **Spec.** `tests/visual/phase-7o-office-captures.spec.ts`, `@visual`, one test per project.
      It runs 11 journeys: default, selected agent, blocked item, waiting, stale, offline, missing
      evidence, completed-unapproved, unassigned work, conflict, evidence link. Each asserts its
      state in words before capturing (the non-colour check). Probes: keyboard (skip link,
      outline, Tab to `Inspect Test Engineer`, Enter, Escape, focus back), pointer (a canvas click
      selects the Implementation Engineer; the inspector reads `waiting`), focus return (evidence
      dialog, then library), reduced motion (the handoff cue as a label, no animation), 200% zoom.
      It records console errors, every request and every failed request, and writes
      `manifest.json` per project. The comparison with the Active Phase 6 direction is marked not
      performed: it is the owner's.
    - **Dry run, ephemeral output, both projects:** 13 captures each; no console errors; 19
      requests, all same-origin, none failed; 6 Tab presses to the target; page horizontal scroll
      at 200%: 0 px.
    - **Two defects in my own work, caught before push.** (1) The first zoom probe set the
      emulation before navigating and asserted only the device-pixel ratio; its capture was
      indistinguishable from the unzoomed one. It now zooms after navigation, asserts `innerWidth`
      is half the viewport (as the Phase 5 matrix does), and captures through the same CDP
      session. A mutation (clearing instead of setting the override) fails it on both projects.
      (2) The spec's header comment named the committed-evidence path, which
      `scripts/evidence-immutability.test.mjs` forbids in any spec; `verify` failed on it and the
      comment was reworded.
    - **Findings for the owner's V-severity disposition** (agent's proposed severity in brackets):
      - **F-9-1, unassigned work is not visible** [V1 proposed]. `work_release_notes` appears
        nowhere in the office: the outline and inspector list work per person, and the rail shows
        work only when it needs attention.
      - **F-9-2, zoom clips the project bar** [V1 proposed]. At 200% the project bar clips its own
        controls: `Manager attention (2)` loses its count, `Reset view` is cut, and the outcome and
        revision text are truncated. The outline person cards are unreadable. The inspector stays
        readable. The page does not scroll horizontally; the clipping is inside fixed regions.
      - **F-9-3, outline buttons overlap names** [V2 proposed]. At both viewports, the `Inspect …`
        buttons in the outline person cards overlap the person's name, and card text wraps one
        word per line. The button's own label carries the name, so no fact is lost.
    - **Owner-run step, done 2026-09-26:** the owner regenerated the captures with
      `CUCKCODE_REGENERATE_EVIDENCE=1` into `docs/evidence/phase-7-o/browser/chromium-1440/` and
      `chromium-1280/` (13 captures and a manifest each), then ran `phase5:provenance:write`.
    - **Owner dispositions, 2026-09-26:** F-9-1 **V1**; F-9-2 **V1**; F-9-3 **V2**.
    - **Owner comparison with the Active Phase 6 direction (criterion 6), 2026-09-26:** the
      captures read as progressing toward a dense, technical dashboard that does not align with
      the art direction. Recorded as **F-9-4, drift from the art direction**; the owner ruled it
      **V1** the same day and chose the revision scope below (Task 9d). The Phase 7-O gate needs V0/V1 cleared, so F-9-1, F-9-2 and the ruling on F-9-4
      block Tasks 10 to 12.
  - Verify: the capture manifest; the owner's dispositions recorded.

- [x] Task 9d (**approved 2026-09-26 as recommended, with 9d-1 to 9d-3**): revise the text surfaces toward the art
      direction, and clear the V1 findings.
  - Why: F-9-4 (V1). The inspector leads with machine detail: event IDs, reason codes, trust
    words and the technical trail sit in the main view. Spec §6 says its first screenful answers
    what is happening, why, what needs the manager and what evidence supports it, with technical
    identifiers on demand. The outline cards have grown dense (F-9-3), the project bar fails at 200%
    zoom (F-9-2, V1), and unassigned work has no surface (F-9-1, V1).
  - Scope, owner ruling 2026-09-26: text surfaces and the V1 findings. The scene stays graybox;
    the gap to the Phase 6 golden states' drawn office is recorded as expected until Phase 7.
  - Proposal:
    1. **Inspector, plain first.** The first screen has four answers in sentences, each read
       from the model:
       - _What's happening_, for example "Blocked on Provide current browser evidence".
       - _Why_: the condition summary, attributed in words, for example "Reported by the system
         (verified)".
       - _What needs you_: the requested action, or "Nothing needs you".
       - _Evidence_: for example "Browser evidence, version 1: failed", with its Open link,
         followed by the approval in words.

       A persistent freshness warning appears only when the record is not current. The spec's
       absence phrases are kept. Everything else moves into a native `<details>` "Technical
       detail": cause event, updated time, reason code, waiting-on ID, presence and health,
       runtime binding, permissions, revision, last event, entity ID.

    2. **Outline cards, lean.** Each card shows the name, one state word (Blocked, Waiting, Idle,
       Unavailable), "Needs you" when a held item needs the manager, the relationship on its own
       line, and the Inspect button below the name, so nothing overlaps (F-9-3). Health appears
       only when it is not "connected".
    3. **Project bar survives 200% zoom (F-9-2).** Its items wrap onto a second row instead of
       clipping. `Manager attention (N)` and `Reset view` stay whole and inside the viewport.
    4. **Unassigned work (F-9-1).** The read model gains `unassignedWork` (work held by no one,
       as work views). The outline shows an "Unassigned work" group, only when there is any.
    5. **Re-capture.** After 9d, the owner reruns the Task 9 captures, and F-9-1 to F-9-4 are
       re-checked against them.
  - Decisions needed:
    - **9d-1, cause event on demand.** Spec §6 lists the cause event among what the inspector
      shows for a rail item, and also says technical identifiers are on demand. Recommendation:
      the first screen says when the fact was recorded ("Recorded 09:00:30"), and the event ID
      sits in Technical detail.
    - **9d-2, field names.** The first-screen terms become _What's happening_, _Why_, _What needs
      you_, _Evidence_ and _Approval_; the old terms move under Technical detail. Recommendation:
      yes. This moves assertions in `office-inspector`, `office-shell` (field list),
      `office-library` and `evidence-link` component tests, the Phase 4 selection-inspector e2e
      (`Technical trail`), and the Task 9 capture spec. Each is to be listed under P-4.
    - **9d-3, where unassigned work shows.** Recommendation: the outline only. A rail item for
      unassigned work that needs attention keeps today's behaviour (it names the work item). The
      scene is not changed.
  - Tests, RED first:
    - Component tests for the four answers, the disclosure and its contents, and the lean card.
    - e2e geometry at both viewports: the Inspect button's box does not intersect the name's.
    - At real 200% zoom, the attention button's full name, count included, is inside the
      viewport.
    - Unit and component tests for unassigned work.
    - Each is followed by mutations.
  - Out of scope: scene art and high-fidelity visuals (Phase 7), rail redesign, Evidence Library
    layout.
  - Result, 2026-09-27:
    - **Inspector.** The first screen is five answers from the model: _What's happening_
      ("Blocked on Provide current browser evidence"); _Why_ (the condition summary, "Reported by
      the system (verified)", "Recorded 09:00:30 UTC" when the condition's event is the work's
      cause); _What needs you_; _Evidence_ ("Browser evidence, version 1: failed", with an
      `Open Browser evidence, version 1` button); _Approval_ ("Not approved: browser evidence
      missing"). A note warns only when the record is not current: an agent that is not fresh, a
      shell overlay, or a model that is not current. Every earlier field is kept, unchanged, under
      a closed native `<details>` "Technical detail". Two fields are renamed there to avoid
      clashing with the first screen: `Approval status` and `Evidence records`.
    - **Outline.** Person cards show one state word ("Blocked", "Idle", "Unavailable"), "Needs
      you" when a held item needs the manager, the relationship, and the button below the name.
      The zone grid flows to fit instead of staying at three columns, and the Team area spans the
      full width, so names are not cut off when narrow or zoomed.
    - **Unassigned work (F-9-1).** `OfficeReadModel.unassignedWork` lists work no office person
      holds. The outline shows an "Unassigned work" group only when there is some.
    - **Project bar (F-9-2).** It wraps instead of spilling, with a 56 px minimum height. The
      shell's first grid row is `auto`. The bar's measured height is published as
      `--office-bar-height`, and the inspector, rail, library and kickoff panel start below it
      instead of at a fixed 56 px.
    - **RED:**
      - Unit: 1 test, "1 failed | 464 passed (465)".
      - Component: 7 tests in `office-plain-language.component.test.tsx`, "7 failed | 89 passed
        (96)".
      - e2e `phase-7o-layout.spec.ts`: first written too weak, since both checks passed against
        the defect. The overlap check measured the heading's box, but the name's text overflows
        that box. The zoom check tested ancestors that hide overflow, but the bar hides nothing;
        the scene paints over what spills out. Rewritten to measure the rendered text and to
        require controls inside the bar's own box, both then failed at both viewports.
      - After the first GREEN, the 200% capture showed two more defects, and the checks were
        extended to cover them: names cut off by their card (failed at 1280), and the open
        inspector covering the wrapped bar. That second check was not observed failing before
        the fix, because the earlier failure stopped the test first. It is established by
        mutation below, and the centre-only hit test it began with was found too weak and
        replaced by five points.
    - **GREEN:** unit 465, component 96, e2e 58, a11y 46, visual 64, `typecheck`,
      `typecheck:scripts`, `lint`.
    - **Mutations, each confirmed applied:**
      - Inspector pinned back at 56 px: killed only after the hit test was widened to five points.
      - Zone grid back to three columns with the Team area spanning two: killed.
      - Project bar at a fixed 56 px height: killed.
      - Attribution dropped from _Why_: killed. A first attempt did not apply, because of shell
        escaping, and was redone.
      - Cause event ID on the first screen: killed.
      - `unassignedWork` always empty: killed, in both unit and component tests.
      - One change survived its mutation: the people grid flowing to fit (`auto-fill`) was not
        needed once the Team area spans the full width, so it was reverted.
    - **Moved assertions (P-4, ruling 9d-2):**
      - The inspector's evidence button is renamed from `Open evidence_browser v1` to `Open
Browser evidence, version 1`, in `evidence-link.component.test.tsx` (twice),
        `office-library.component.test.tsx` and `tests/e2e/phase-7o-evidence-link.spec.ts`.
      - `office-inspector.component.test.tsx` reads the ID from `Evidence records` instead of
        `Evidence`.
      - The Task 9 capture spec's journeys now assert the plain first screen: _What's happening_,
        _Why_, _What needs you_, _Evidence_, _Approval_ and the freshness note, instead of State,
        Cause, Needs you, Blocker and Freshness. The unassigned-work journey now asserts the new
        group instead of the item's absence. Its field helper matches exact text, because
        Playwright cannot serialize a regular expression containing the apostrophe in "What's
        happening".
    - **Owner re-capture, 2026-09-27** (`5bdd529`). F-9-1 and F-9-2 read as resolved.
      9d introduced a regression. The zone grid flowing to fit put the zone cards in five narrow
      columns at 1440, where each `Locate …` button covered the zone's name: F-9-3's defect, on
      zones. The overlap check had covered people only. Now fixed:
      - The check covers zone cards. RED: 4 failed, both viewports, at normal size and at 200%.
      - Every outline card stacks name, state, then button. GREEN: e2e 58, visual 64, a11y 46.
      - The RED run against the unfixed CSS stands as the revert mutation.
    - **The art-reference supplement.** The owner approved it on 2026-09-27, and it applies
      from here (`docs/art-reference-approval-2026-09-27.md`; pack hashes verified). AR-04 and
      constitution rule 1 reject persistent card grids around the office. The Phase 4 Office
      outline is such a grid. Owner ruling, the same day: fix the regression, then draft a
      design amendment making the outline an on-demand surface (Task 9e, below), because the
      remaining part of F-9-4 cannot clear while the grid persists.

- [x] Task 9e (**approved 2026-09-27, A-1 to A-3 as recommended; A-4 ruled in implementation**):
      the Office outline on demand.
  - Proposal and decisions A-1 to A-3: `docs/proposals/2026-09-27-on-demand-office-outline.md`.
  - Why: F-9-4 (V1) cannot clear while a persistent card grid sits under the office (AR-04,
    constitution rule 1).
  - Baseline: the Codex branch merged by the owner, `95d7641`. Its `verify` passed on a clean tree
    (unit 557, component 96, integration 79 with 3 skipped, contract 78, e2e 58, a11y 46, visual
    64, `protocol:codex:drift`). It was pushed as `9282410` with one task-file commit from that
    session.
  - Result, 2026-09-27:
    - **MDD §10 amended (A-1).** The outline is available from any state by one keyboard action,
      and shown automatically when the scene is unavailable.
    - **Shell.**
      - The outline renders only when open. It opens from an `Office outline` bar button
        (`aria-expanded`) or the first-Tab skip link, now "Open the Office outline", which
        points at that button.
      - Focus moves into it on opening; Escape or `Close outline` returns focus.
      - It shares the left side with the rail: opening one closes the other. It stays open
        beside the inspector (A-2), narrowing when space is short.
      - In `loading`, `empty`, `error` and `canvas-loss` it opens by itself and fills the surface.
      - The shell is now two persistent structures: bar and office.
    - **Status notice (A-4).** When the workspace is not current, a notice under the bar carries
      the cause and its recovery button. When it is current, the revision sentence sits in the
      outline's header. Side panels start below the bar and the notice, which are measured.
    - **Headings.** The page `<h1>` is the product name in the bar. The outline's heading is now
      `<h2>`, zones `<h3>`, people `<h4>`.
    - **RED:** component, 8 of 13 new tests in `office-outline-on-demand.component.test.tsx`
      ("8 failed | 100 passed (108)"). The four scene-unavailable cases and the
      unassigned-reachable case could not fail while the outline was always shown, and are named
      as such. e2e: "the office fills the screen" failed at both viewports.
    - **Found during GREEN by existing tests, and fixed:**
      - The skip link's `#office-outline` target does not exist while the outline is closed (axe
        `skip-link`, the a11y scaffold spec).
      - The auto-opened outline covered the status notice, so `Retry canvas` could not be clicked
        (the Phase 4 canvas-loss e2e).
      - A further check, the outline running under the inspector at 200% on the 1280 viewport,
        was written and failed first, then fixed.
    - **Mutations, each confirmed applied, all killed:** outline open by default (7 component
      tests); skip link only focusing (2); rail not closing the outline (1); no automatic opening
      (4); no status notice (17); side panels measured from the bar alone (the canvas-loss e2e,
      both viewports).
      - Mutations 2 and 3 were first run with a broken restore step, which left mutation 1 in
        place and created a stray `apps/web/src/shell.9e.tsx`. Those runs are discarded; the file
        was restored, the stray copy moved out of the repo, and both were rerun.
    - **Moved assertions (P-4).** Shared helpers `openOfficeOutline(user)`
      (`apps/web/src/test-support/`) and `openOfficeOutline(page)` (`tests/support/`) are inserted
      before direct `Inspect …` and `Locate …` actions. That is 26 call sites across 6 component
      files and 9 specs, excluding the library's `Locate origin in office` and the rail's
      `Locate …`. Besides:
      - `office-shell.component.test.tsx`: three persistent structures become two; the skip link
        is "Open the Office outline" and opens the outline. The per-state test asserts the notice,
        then opens the outline. Initial-announcement checks run before opening.
      - `office-inspector` and `office-plain-language` component tests open the outline before
        reading zones, cards, unassigned work or the ready-state revision.
      - `tests/e2e/phase-4-office-shell.spec.ts`: two structures, the new skip link, outline
        content after opening, and the offline notice.
      - `phase-4-failure-motion`: the outline header checked after opening.
      - `phase-4-evidence-library` and `phase-4-selection-inspector`: scene widths measured
        after the outline opens (420 px and 320 px unchanged).
      - `scaffold.spec.ts`: the `<h1>` is "CuckCode".
      - `tests/visual/phase-4-checkpoint-c-matrix` and `phase-4-harness`: the notice and outline
        after opening.
      - The Task 9 capture spec: journeys wait for the scene; the default journey asserts no
        outline and no notice; a new `outline-open` journey; the keyboard probe uses the new skip
        link.
    - **GREEN:** component 108, e2e 60, a11y 46, visual 64, `typecheck`, `typecheck:scripts`,
      `lint`.
    - **Owner-run step:** re-capture the Task 9 evidence, then record provenance.

- [x] Task 9f (**approved 2026-09-27, P-0 to P-4 as recommended; 9f-1a ruled in
      implementation**): plate alignment in the graybox.
  - Proposal and decisions: `docs/proposals/2026-09-27-plate-alignment.md`. P-0 amends the MDD
    (Phase 7-O section) and the art approval record: the plates are the product target.
  - Governing plates: AR-01, AR-02 frames 4 and 6, AR-03, AR-04.
  - Baseline: `be3cabd`, `verify` passed on a clean tree.
  - Slices, each RED first:
    - 9f-1: the bar reads `CuckCode / {project}` with counts by canonical reason (P-4); runtime
      and revision move under `Technical detail`.
    - 9f-2: one contextual surface at a time (P-2), with `Back to outline` and focus return.
    - 9f-3: name and plain-state labels in the scene (P-3), amber only when the item needs the
      manager.
    - 9f-4: AR-03 wording on first screens; attention one item at a time behind `Respond`;
      evidence takes the surface with `Back to office`; work motion suspended while not current.
  - **Ruling 9f-1a (owner, during implementation).** MDD §14 item 1 requires project identity,
    current outcome and runtime health in the bar. Kept, in plain words: "CuckCode / truthful
    graybox office", a health word ("Connected", "Updates unavailable", "Offline"), then the split
    count. The revision moves under the outline's Technical detail. The canonical logs record no
    project name, so none is shown.
  - Result, 2026-09-27 (commits `79a1acf` to `3c80695`):
    - **9f-1.** RED: component 5 of 5 new tests, unit 4 of 4 (`attentionSummary` missing). The
      bar reads "1 blocked · 1 review"; unknown reasons count as "other" rather than being dropped.
    - **9f-2.** RED: component 5 of 6. "Goes back to the outline on Escape" could not fail: the
      old A-2 layout already returned focus with the outline open. A back stack holds the surface
      left, the name of the control used and, for the inspector, its selection. The kickoff is
      one of the exclusive surfaces too, under constitution rule 3, though P-2 did not name it.
      - Found in GREEN by the Phase 4 Library e2e: going back through two inspectors returned to
        an empty inspector. A component test was written and failed first, then fixed by keeping
        the selection on the stack.
      - Found in 9f-1 GREEN: the 200% zoom e2e at 1280 found the attention button off-screen with
        the outline and inspector both open. It did not recur once 9f-2 removed that layout; the
        cause was not isolated further.
      - `onLocateOrigin` now also passes the evidence, so going back returns to the record.
    - **9f-3.** RED: unit (function missing), e2e at both viewports. Labels sit over or under
      alternate desks, 12 px, amber with "Needs you" in the words, `pointer-events: none`, read as
      a list. Not measured: labels at 200% zoom, where the scene is below its approved minimum and
      no camera is drawn, so no labels are shown.
    - **9f-4, rule 6.** RED: unit 2, e2e 2 (stale showed `travel`). The motion plan is paused in
      the stale and offline states.
    - **9f-4, wording.** RED: component 6, unit 1. One new test first used a `banner` role inside
      a section, which cannot resolve; it was corrected before any implementation and RED rerun.
      Notices drop "Cause:"; stale and offline say what is shown is as last confirmed (with the
      latest recorded time) and current activity is unknown; people read "Status unknown" in the
      scene and "Status unknown · last confirmed: …" in the outline.
    - **9f-4, rail.** RED: component 4. One item at a time with "1 of N", Previous and Next; the
      disposition controls behind "Respond to …", all five options kept. A clamp test was added
      before the clamp mutation, because no test exercised dismissing the last item.
    - **9f-4, evidence.** RED: component 3, e2e 2. The Library covers the surface below the bar
      with "Back to inspector" and "Back to office"; a record says what it found first, with
      identifiers under "Detailed evidence".
    - **Mutations, each confirmed applied, all killed:** total count (unit 4, component 10); raw
      runtime text (2); outline kept open behind the inspector (4); no back (11); no amber (unit
      1); labels in one row (e2e, both viewports); labels taking the pointer (e2e, both); "Cause:"
      restored (3); known state while stale (1); raw state in the outline header (1); no Respond
      gate (1); no clamp (1); Library as a side panel (e2e 4); plain evidence line hidden (1);
      "Back to office" going back instead (1). The rule-6 and back-stack-selection REDs stand as
      the revert mutations.
    - **Moved assertions (P-4).** "Manager attention (2)" and "(1)" become the split counts
      (dismissing the blocked item leaves "1 review"). Tests holding a detached element across a
      surface change find it again by name. A-2 assertions become "the inspector replaces the
      outline". Scene widths: the inspector's 320 px and the Library's full surface are measured
      from the office with nothing open. The kickoff tests assert the outline is one action away
      in the bar. `Close Library` becomes `Back to inspector`. Rail tests click `Respond to …` and
      `Next item`. Stale and offline cause patterns, the outline header's state word (now the
      bar's health word), and "Layout only" (now under Technical detail) move. "Collapses an empty
      attention projection" had become vacuous after 9f-1 and now checks the bar for any count.
    - **Flake:** once, the Phase 5 decision-notice `overdue` visual at 1280 found no element on
      load; it passed on rerun and in `verify`.
    - **GREEN, `verify` on a clean tree at `3c80695`:** unit 568, component 134, integration 79
      with 3 skipped, contract 78, e2e 66, a11y 46, visual 64.
    - **Seen in current-build screenshots:** the rail's Previous/Next labels wrap to two lines at
      280 px; an open evidence record's dialog covers the Library's header buttons until it is
      closed; the disposition receipt still shows identifiers on its first screen. Fixed in 9f-5.
  - **9f-5 (owner: "Yes", fix before the re-capture), commit `28bc41d`:**
    - RED: component 2, e2e 4 (both new tests at both viewports). The first stepper check
      measured button height, which the controls' minimum height makes meaningless; it was
      rewritten to count rendered text lines, and its RED was taken by removing the new stepper
      rule (both viewports failed "Previous item wraps").
    - The stepper buttons are 14 px and do not wrap. An open record replaces the Library's lists
      as one card in flow and is no longer `aria-modal`; closing it refocuses the record's View
      button by name. The receipt reads "Approve recorded. The agent can see this decision.",
      with identifiers under "Receipt details".
    - Mutations, all killed: lists kept beside the record (1); the record as a fixed overlay again
      (e2e, both viewports); receipt details open (1).
    - Moved (P-4): the Library component test finds the View button again by name after closing.
    - GREEN, `verify` on a clean tree at `28bc41d`: unit 568, component 136, integration 79 with
      3 skipped, contract 78, e2e 70, a11y 46, visual 64.
    - Seen, not fixed: the record's plain sentence renders smaller than its heading, because a
      general Library paragraph rule wins over the new class. Fixed in 9f-6.
  - **9f-6 (owner: fix before the re-capture, 2026-09-28), commit `2f67a32`:**
    - Cause: since 9f-5 the record is a direct section child of the Library, so
      `.evidence-library > section > p` (12 px, grey) outranked `.focused-evidence-plain` (15 px).
    - RED: e2e 2 (the new test at both viewports), "Expected: >= 15, Received: 12"; the other 70
      passed. Run `9f6-red-1790627035` at `5b436cc`, test uncommitted.
    - GREEN: the rule is scoped as `.evidence-library .focused-evidence-plain`, and its margin no
      longer needs `!important`. e2e 72/72.
    - Mutation, confirmed applied, killed: the unscoped selector restored (e2e 2, both viewports).
    - Not changed: the sentence stays grey (`#55585a`, from the same Library rule); the class sets
      no colour and none was ruled.
    - GREEN, `verify` on a clean tree at `2f67a32`: unit 568, component 136, integration 79 with
      3 skipped, contract 78, e2e 72, a11y 46, visual 64.
  - Owner-run step: re-capture the Task 9 evidence, then record provenance. **Done 2026-09-28**
    (`0807363`, at `40c289d`): 12 journeys per viewport, console errors 0, 19 requests with none
    failed or external, 200% zoom horizontal scroll 0 px; 30 ledger lines appended.
  - **Owner comparison with the plates (criterion 6), 2026-09-28.** The owner found the captures
    "nowhere near what is expected for the UI" and, asked which gap that is, answered "mainly
    rendering". Disposition: the rendering gap to AR-01–AR-04 (figures, furniture, materials,
    lighting, the isometric illustrated scene) is **deferred to Phase 7 under P-0**; it is not a
    Phase 7-O finding, and these captures do not meet the plates. The owner chose a small Task 9g
    for non-rendering plate gaps before Task 10, then Task 10.
  - **Rule 4 finding, DF-029 (owner ruling 2026-09-28).** Blocked work reads amber "Needs you"
    because every blocked item is manager attention and every v2 condition requires a requested
    action; AR-03's "blocked, not on you" is not expressible. A named Phase 7-O finding, fixed by
    its own amendment after Phase 7-O (`9b0724c`).

- [x] Task 9g (**approved 2026-09-28, G-1 with "Locate", G-2, as recommended**): plain rail
      controls and a plain evidence heading.
  - Proposal: `docs/proposals/2026-09-28-task-9g-plain-rail-and-evidence.md`. Plates: AR-03
    column 3, AR-04; rules 2 and 10.
  - Result, commit `508173b`:
    - RED: component 2 of 2 new tests (`office-9g.component.test.tsx`), on assertions: the Locate
      control read "Locate Provide current browser evidence: blocked"; the record's first heading
      was not the plain finding. Run `9g-red-*` at `9b0724c`.
    - GREEN: the rail's controls show one word with the item in `aria-label`; the record's heading
      is its plain finding, and `evidence_browser v1` sits under `Detailed evidence` as "Record".
    - **Found in GREEN** by "replaces the rail when an item is located, and Escape returns to the
      rail": focus was lost on going back, because the 9f-2 back stack remembered and found
      controls by visible text. It now uses the accessible name (`accessibleNameOf`).
    - Mutations, each confirmed applied, all killed. Applied in one run, each caught by a
      different test: "Respond to {item}" visible again (G-1 test); the identifier heading
      restored (G-2 test); lookup by visible text (the focus-return test).
    - Moved assertions (P-4): none. Typecheck clean; e2e 72/72 unchanged.
    - GREEN, `verify` on a clean tree at `508173b`: unit 568, component 138, integration 79 with
      3 skipped, contract 78, e2e 72, a11y 46, visual 64.
  - Owner-run step: re-capture the Task 9 evidence, then record provenance. **Done 2026-09-28**
    (`02b6658`): only the blocked-item and evidence-link captures changed at each viewport.

- [x] Task 9h (**approved 2026-09-28 as proposed in chat**): a disposition is refused only where
      no decision can be recorded.
  - **Found while preparing Task 10**, from the rendered text at the task URLs: the rail accepted
    dispositions only in `ready` and `partial`, and elsewhere said "Refresh the current workspace
    before recording a disposition", including current canonical states whose attention item asks
    for that decision (`permission-denied`, `missing-artifact`, `test-failure`,
    `reviewer-disagreement`, `conflict`, `cancelled`). Proposed V1: the item and its controls
    contradicted each other. One of these states is a T3 task URL.
  - Owner ruling: refuse in `stale`, `offline`, `loading`, `error`, `restart`, each with its own
    reason; accept in the other twelve.
  - Result, commit `f504185`:
    - `dispositionRefusal(state)` in `office-model.ts`; the rail takes `refusal` instead of
      `available`. The stub extracted today's rule unchanged.
    - RED: unit 14 (the table over all seventeen states, on assertions); component 1
      ("accepts a manager disposition in the permission-denied state"). Not RED: `ready`,
      `partial` and `stale`, which the stub already matched, and the coverage test.
    - Mutation, confirmed applied, killed: `permission-denied` refusing again (unit 1,
      component 1).
    - Moved (P-4): "denies manager dispositions while offline" now expects offline's own reason;
      stale's is unchanged.
    - GREEN, `verify` on a clean tree at `f504185`: unit 586, component 139, integration 79 with
      3 skipped, contract 78, e2e 72, a11y 46, visual 64.
  - Owner-run step: none needed for the captures. No capture journey shows a refused or accepted
    disposition in a changed state (the stale journey is unchanged).

- [ ] Task 10: Comprehension preparation (spec §8.7).
  - Acceptance: the six task URLs, fixture logs and answer key are aligned to the accepted UI and
    committed; the key's SHA-256 is written into the run preamble; the owner starts the three-day
    interval from that commit.
  - Verify: the preamble hash equals the committed key's digest, checked by script.

- [ ] Task 11: **Owner-run** cold comprehension run.
  - Acceptance: all six tasks, with performed marks recorded at the time, exact answers written
    before the key is opened, and scoring under MDD §20. T3, T5 and T6 must actually be performed.

- [ ] Task 12: **Owner acceptance** of Phase 7-O, or bounded revisions.
