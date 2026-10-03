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
  - **Owner-approved 2026-10-02**: spec §10 (successor section), commit `941ebfe`. `verify`
    passed on `941ebfe` (owner-run, reported 2026-10-02).
- [ ] Task 2: Contract, version 3.
  - Acceptance: version 3 accepts a condition without `requestedAction` for `blocked` and
    `waiting_input` (D-1 as narrowed by D-4); refuses `waitingOn: manager` without a request; refuses a
    `review_requested` condition without a request; versions 1 and 2 unchanged; the fixture sweep
    replays every recorded event with no new failure.
- [ ] Task 3: Domain, attention follows the request.
  - Acceptance: a version-3 blocker without a request raises no attention item; with a request it
    does; a version-1 or version-2 blocker, and one with no condition, behave exactly as today.
    The Phase 6 reduction proof still holds (D-2).
- [ ] Task 4: Application, the resolver.
  - Acceptance: agent, evidence and external resolve to words; an id that resolves to nothing reads
    "not recorded"; no name is guessed.
- [ ] Task 5: Web, the inspector and labels.
  - Acceptance: component tests for "Nothing needs you. {resolver} can resolve it."; the label is
    neutral and has no "Needs you"; the bar count excludes the item; the comprehension key spec and
    the Task 9 captures of existing journeys are unchanged (D-3).
- [ ] Task 6: The `blocked-elsewhere` log, e2e and capture.
  - Acceptance: e2e at both viewports; a new journey in the Task 9 capture spec; owner re-capture
    and provenance.
- [ ] Task 7: Register. DF-029 moves to **fixed** in the status index, citing the commits.
