# DF-029 checklist: blocked but not on you

Status: **OWNER-APPROVED 2026-09-28.** Tasks start only after Phase 7-O acceptance. Plan: `tasks/df-029-plan.md`. Not authorized
before Phase 7-O acceptance.

## Rules for every task

As Phase 7-O: RED on an assertion before GREEN, never re-run after; one mutation per new guard,
confirmed applied; `verify` through the runner on a clean tree at the end of each task; evidence
writes owner-run; moved assertions listed (P-4).

## Tasks

- [x] Task 1: Spec successor section (docs only).
  - Acceptance: §3.2 version 3; §6 resolver wording; §7 ninth class ("a blocker without a request,
    waiting on an agent: never Needs you, never counted, never in the rail; the inspector names the
    resolver"); §8.4 addition. Owner-approved before Task 2.
  - **Owner-approved 2026-10-02**: spec §10 (successor section), commit `941ebfe`. `verify` GREEN through the runner (`df029-verify-1791006882`) on a clean tree at `505dd32`:
    unit 590, component 139, integration 90 with 3 skipped, contract 85, e2e 88, a11y 46,
    visual 64.
  - **Correction, 2026-10-02.** `8a45391` recorded `verify` as passed at `941ebfe`. It could not
    have: `phase5:provenance` fails on the Phase 7-O run sheet, committed in `6287924` without its
    ledger entry. The agent assumed the pass from "done" instead of asking; the runner found the
    failure at `6ba9734`. The owner recorded the entry on 2026-10-02.
- [x] Task 2: Contract, version 3.
  - Acceptance: version 3 accepts a condition without `requestedAction` for `blocked` and
    `waiting_input` (D-1 as narrowed by D-4); refuses `waitingOn: manager` without a request; refuses a
    `review_requested` condition without a request; versions 1 and 2 unchanged; the fixture sweep
    replays every recorded event with no new failure.
  - **Built 2026-10-02 at `4f585e8`.** `verify` GREEN through the runner (`df029-verify-1791006882`) on a clean tree at `505dd32`:
    unit 590, component 139, integration 90 with 3 skipped, contract 85, e2e 88, a11y 46,
    visual 64. `WorkConditionV3` and a
    version-3 payload variant; version 2's checks and messages are unchanged. Consumers still read
    only version 2, so a version-3 condition reaches the domain as no condition (attention, as
    today) until Task 3.
    - RED, on the assertion: 5 of 7 new tests failed against "unsupported payloadVersion 3". Two
      passed vacuously at RED (strict request validation; version 2 still requiring a request).
    - GREEN: contract file 19 of 19; contract + unit + component 814 of 814; `tsc -b` clean; ESLint
      and Prettier clean; the fixture sweep 2 of 2 (container, Node 22).
    - Mutations, each confirmed applied and killed: the manager-without-request refusal; the
      review-without-request refusal; validation of a recorded version-3 request (this one also
      gives meaning to the test that passed vacuously at RED). A first attempt at the last
      mutation did not parse and was discarded, not counted.
    - Moved assertion (P-4): the unknown-version test now uses `payloadVersion: 4`, since 3 is
      valid.
- [x] Task 3: Domain, attention follows the request.
  - Acceptance: a version-3 blocker without a request raises no attention item; with a request it
    does; a version-1 or version-2 blocker, and one with no condition, behave exactly as today.
    The Phase 6 reduction proof still holds (D-2).
  - **Built 2026-10-02 at `e6149b1`, fixed at `f065782`. `verify` GREEN through the runner
    (`df029-t3-verify2-1791007535`) on a clean tree at `f065782`: unit 594, component 139,
    integration 90 with 3 skipped, contract 85, e2e 88, a11y 46, visual 64.** The domain keeps a version-3
    condition; `blocked` and `waiting_input` raise attention only when the condition carries a
    request or no condition is recorded. `failed` is unchanged (D-4).
    - Stub first: `WorkConditionTruth` widened to `WorkConditionV3`. `tsc` then named four sites in
      `apps/web` that assumed a request; each got the narrowest type-safe change, with output
      unchanged for every version-1 and version-2 log (814 of 814 still green). Inspector wording
      for an absent request is Task 5's.
    - RED, on the assertion: the version-3 condition read as `null`; a request-less blocker raised
      attention. Two preservation tests (a request still raises; no condition still raises) passed
      at RED, as characterisation.
    - GREEN: contract + unit + component 818 of 818; `tsc -b`, ESLint, Prettier clean.
    - D-2: the reduction proof, Phase 6 comparison, golden overlap and fixture sweep 18 of 18,
      unchanged.
    - Mutations, each confirmed applied and killed: the `blocked` request guard; the
      `waiting_input` request guard; the no-condition fallback (six tests failed).
    - Moved assertion (P-4): the office-fixtures sufficiency check reads an optional request
      (`?.summary.length ?? 0`), still failing when no request is recorded.
    - **First `verify` at `e6149b1` failed** in `test:guard`: `WorkConditionV3` was written with
      TypeScript's `Omit`, which is declared outside `packages/contracts`, so the literal guard
      read it as an office record and flagged the five fixture conditions. Fixed by declaring the
      type in full (with a shared `RequestedAction`); the container reproduced the failure and the
      fix. The agent had not run the guard suites before committing; it now does.
- [x] Task 4: Application, the resolver.
  - Acceptance: agent, evidence and external resolve to words; an id that resolves to nothing reads
    "not recorded"; no name is guessed.
  - **Built 2026-10-02 at `deb6389`. `verify` GREEN through the runner (`df029-t4-verify-1791007884`)
    on a clean tree at `deb6389`: unit 599, component 139, integration 90 with 3 skipped, contract 85,
    e2e 88, a11y 46, visual 64.** `OfficeWorkView.resolver`, derived
    per held item: an agent id recorded in staffing, named by the registry's label for that agent;
    an evidence id by its recorded kind and version ("Unit evidence, version 2"); `external` as
    "an external dependency"; the manager as "the manager"; anything else `not_recorded` with its
    id. Null when no condition is recorded.
    - **D-5, owner-approved 2026-10-02.** The plan says "through staffing to its role name".
      No canonical record holds a role's display name, so the name is the registry's label for the
      agent, and the agent must also be recorded in staffing. Neither alone is enough.
    - Stub first (`resolver: null`), then RED on the assertion: 5 of 5 new tests.
    - GREEN: the read-model file 34 of 34; contract + unit + component 823 of 823; `tsc -b`,
      `typecheck:scripts`, ESLint, Prettier, `test:guard`, `test:scaffold` clean.
    - The staffing half of the agent rule was untested at GREEN; a case was added (a registry name
      whose agent is not in staffing) and proved by mutation.
    - Mutations, each confirmed applied and killed: dropping the staffing check; guessing the first
      recorded evidence for an unknown id; naming an external dependency from its id.
- [x] Task 5: Web, the inspector and labels.
  - Acceptance: component tests for each D-6 sentence (spec §10.1); the label is
    neutral and has no "Needs you"; the bar count excludes the item; the comprehension key spec and
    the Task 9 captures of existing journeys are unchanged (D-3).
  - **Built 2026-10-02 at `073884a`. `verify` GREEN through the runner (`df029-t6-verify-1791011534`) on a clean tree at `f2d6cfa`:
    unit 603, component 146, integration 90 with 3 skipped, contract 85, e2e 90, a11y 46,
    visual 64. D-3 held: the comprehension-key e2e and the
    existing capture journeys passed unchanged.**
    `needsYouPlain`: a held `blocked` or `waiting_input` item whose condition has no request adds
    its D-6 sentence after one "Nothing needs you."; beside the manager's requests it adds the
    sentence without that phrase. Labels, the bar and the rail needed no change: they follow
    attention (Task 3). The technical "Requested action" still reads "No requested action recorded"
    for such an item, which is true.
    - RED, on the assertion: 4 of 4 sentence tests (the inspector said only "Nothing needs you").
      The label, bar, rail and today's-wording tests passed at RED: the first three were made true
      by Task 3, the last pins today's behaviour.
    - Two unit tests for paths the default office cannot reach (two such items; one beside a
      request) were written after GREEN and proved by mutation.
    - GREEN: contract + unit + component 832 of 832; `tsc -b`, `typecheck:scripts`, ESLint,
      Prettier, `test:guard`, `test:scaffold` clean.
    - Mutations, each confirmed applied and killed: dropping the request filter; evidence worded as
      "can resolve it"; dropping the sentences beside a request.
- [x] Task 6: The `blocked-elsewhere` log, e2e and capture.
  - Acceptance: e2e at both viewports; a new journey in the Task 9 capture spec; owner re-capture
    and provenance.
  - **Built 2026-10-02 at `f2d6cfa`; code half GREEN on the same run, `verify` GREEN through the runner (`df029-t6-verify-1791011534`) on a clean tree at `f2d6cfa`:
    unit 603, component 146, integration 90 with 3 skipped, contract 85, e2e 90, a11y 46,
    visual 64. **
  - **Owner re-capture and provenance, 2026-10-03:** `blocked-elsewhere.png` at both viewports and
    both manifests (one journey added; request count 19 to 20). The other twelve captures were
    byte-identical. Four ledger entries, each matching its file. The ledger attributes them to the
    Phase 7-O spec approval by folder; DF-029's authority is its approved amendment (2026-09-28).
  - **Owner comparison with AR-03 column 1, 2026-10-03:** "approved, it matches." `verify` GREEN through the runner
    (`df029-t6-verify2-1791012127`) on a clean tree at `fc2016d`: unit 603, component 146,
    integration 90 with 3 skipped, contract 85, e2e 90, a11y 46, visual 64. `OFFICE_FIXTURES["blocked-elsewhere"]`
    (`?fixture=blocked-elsewhere`): the default office with the Test Engineer's blocker recorded
    at version 3, waiting on the Implementation Engineer, with no request. The default log is
    unchanged.
    - Stub first (the log identical to the default office), then RED on the assertion: the
      blocker waited on evidence; the §10.4 sweep found nothing to check.
    - §10.4 enforced by a sweep over every office log: each blocker not on the manager resolves
      its reason, cause and resolver; an empty sweep fails.
    - e2e `tests/e2e/df029-blocked-elsewhere.spec.ts`, both viewports: the bar reads "1 review",
      the card has no "Needs you", the inspector reads "Nothing needs you. Implementation Engineer
      can resolve it.", the rail omits the blocker. Run in the container (Chromium by explicit
      executable path, a scratch config outside the repo), after cross-checking that harness on
      the comprehension-key spec: 16 of 16, as on Windows. It failed on the assertion at both
      viewports with the log reverted to the stub, and passed with it.
    - Capture journey `blocked-elsewhere` added to the Task 9 capture spec. The container cannot
      run that spec (a console 404 on its unchanged baseline too), so it is checked by `verify` on
      Windows.
    - Contract + unit + component 834 of 834; `tsc -b`, `typecheck:scripts`, ESLint, Prettier,
      `test:guard`, `test:scaffold` clean.
    - Two `verify` runs at `073884a` stopped at e2e start: ports 4173 and 4174 were held by
      another project's agent on the owner's machine, not by CuckCode.
- [ ] Task 7: Register. DF-029 moves to **fixed** in the status index, citing the commits.
