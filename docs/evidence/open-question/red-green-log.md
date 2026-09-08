# RED-GREEN evidence: canonical open-question record

Specification: `docs/proposals/2026-08-18-open-question-record.md` (owner-approved 2026-08-18).
Plan: `tasks/open-question-plan.md`. Placement: interstitial, Phase 4 paused, owner decision
2026-08-18.

## Execution environment note

Tasks 1-4 are being developed in a Linux container holding an independent `npm install` of this
repository's `package-lock.json`. The owner's Windows environment remains the authority for any
result involving native modules or a browser. Contract, unit, and component projects run
identically in both; `better-sqlite3` cannot be built in the container (its node headers download
is blocked), so **every persistence integration result must come from the owner's machine.**

Cross-check performed before any new code was written: `vitest run --project contract --project
unit kickoff` produced 4 files / 11 tests passing in the container, exactly matching the owner's
Windows run of `test:kickoff` (5 files / 13 tests) minus the 2 persistence integration tests that
cannot run there. The harness is consistent; the gap is known and named.

## Task 1 - Contract and validation

Date: 2026-08-18

- RED 1: the focused contract suite failed to import the absent `./open-question.js`.
  `Test Files 1 failed (1) | Tests no tests`. The failure reason was the missing module, which is
  the intended RED for a new contract, matching the Task 13 pattern.
- GREEN 1: 9 contract tests passed. Coverage: an attributable agent question that states what
  would resolve it is accepted; a question with an empty or blank `wouldBeResolvedBy` is rejected
  as `QUESTION_UNRESOLVABLE`; `blocksWork` must be an explicit boolean and is never inferred from
  shape; `schemaVersion` is pinned and every enum is closed (`confidence`, `subject.kind`,
  `authorKind`, `disposition`); secrets are rejected in free text on both records; a complete
  disposition is accepted; `superseded` without a successor id and `deferred` without `reviewBy`
  are both rejected as `QUESTION_DISPOSITION_INCOMPLETE`; every disposition requires a reason.
- Static gates: Prettier formatted and re-checked clean, ESLint clean at `--max-warnings 0`,
  and `tsc -b packages/contracts` clean under `strict`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes`.
- Files: `packages/contracts/src/open-question.ts`, `open-question.contract.test.ts`,
  `index.ts` export, and the `test:questions` focused loop in `package.json`.
- Owner re-verification still required on Windows: `npm.cmd run test:questions`.

### Design decisions recorded

- `confidence` is a bounded enum rather than a number. Numeric confidence from a language model
  is false precision and is not comparable across agents or providers.
- `wouldBeResolvedBy` is required and non-empty. This is the constraint that keeps the record a
  question rather than a complaint, and it is enforced with its own issue code so the failure is
  legible rather than a generic validation error.
- `blocksWork` is explicit with no default. This is the field that keeps an open question
  distinct from a blocker, which is the distinction `ManagerAttentionItem` currently cannot
  express.

### Evidence boundary

Task 1 proves contract validation only. It does not prove disposition rules, persistence,
authority enforcement, reciprocal parity, attention integration, or any office representation.
No Phase 4 file was modified.

## Task 2 - Domain aggregate and disposition rules

Date: 2026-08-18

- RED 1: the focused unit suite failed to import the absent `./open-question.js` domain module.
  `Test Files 1 failed (1) | Tests no tests`.
- GREEN 1: 10 unit tests passed. Coverage: a raised question starts `open` with no dispositions
  and a duplicate id is rejected; a disposition for an unraised question is rejected; any
  participant may answer but an agent answer leaves the question open; a manager answer closes
  it; `accepted_risk` and `rejected` are refused to agents; every disposition is retained in
  order and none overwrites an earlier one; a closed question refuses further dispositions so
  reopening requires a new superseding question; deferral parks rather than resolves and becomes
  due again at its review date; an undispositioned question always requires disposition; a
  disposition whose `questionId` does not match its target is rejected.
- Static gates: Prettier, ESLint at `--max-warnings 0`, and `tsc -b packages/domain` all clean.
- Regression: the container's full unit and contract projects passed at 42 files / 175 tests,
  confirming no existing suite was disturbed.
- Files: `packages/domain/src/open-question.ts`, `open-question.unit.test.ts`, `index.ts` export.
- Owner re-verification still required on Windows: `npm.cmd run test:questions`.

### Design decisions recorded

- **An agent's answer does not close a question; a manager's does.** This follows the D-11
  knowledge rule that agent findings stay provisional until manager promotion. An agent supplying
  an answer is making a contribution, not granting acceptance. The alternative - letting any
  answer close - would let the participant who raised a doubt also dismiss it, which is the
  failure mode the record exists to prevent.
- **`deferred` is manager-only and produces a third status rather than closure.** Deferral is a
  scheduling decision about someone else's question, and a deferred question is parked, not
  resolved. `questionsRequiringDisposition` re-surfaces it once `reviewBy` has passed.
- **Time never resolves anything.** `questionsRequiringDisposition` takes `nowIso` as an explicit
  argument and only ever *adds* records to the due list. There is no code path in which the
  passage of time closes a question, which is the executable form of the specification's
  "silence never resolves" rule and of MDD principle 5.
- **A closed record is immutable.** `QUESTION_CLOSED` is returned rather than appending, so
  history cannot be rewritten to make a decision look different after the fact.

### Evidence boundary

Task 2 proves in-memory aggregate rules only. It does not prove persistence, restart recovery,
command-boundary authority, reciprocal parity, attention integration, or office representation.
No Phase 4 file was modified.

## Task 3 - HELD. Suspected pre-existing failure on main.

Date: 2026-08-18. Status: **not started; blocked pending owner verification.**

While reading `packages/persistence/src/project-store.ts` to match the existing migration
pattern, a probable pre-existing regression surfaced.

`project-store.ts` line 96 sets `db.pragma("user_version = 3")` and applies three migrations:
`001_initial`, `002_runtime_trust`, and `003_kickoff`. The Task 13 commit `85e97cf`
("feat(persistence): store immutable kickoff records") introduced the third.

`project-store.integration.test.ts` line 21 still asserts:

```
expect(store.schema()).toMatchObject({
  applicationId: 1129661259,
  userVersion: 2,
  migrations: [ { id: "001_initial", ... }, { id: "002_runtime_trust", ... } ],
});
```

Both halves of that assertion look stale. A controlled probe of `toMatchObject` semantics was run
in the container to check whether either would actually fail rather than be tolerated:

- a two-element expected array matched against a three-element actual **fails**;
- `userVersion: 2` matched against an actual `3` **fails**.

Both were confirmed failing in an isolated probe test. The probe proves the matcher semantics,
**not** the real test result - the integration project cannot run in the container because
`better-sqlite3` will not build there. The conclusion is therefore high-confidence and unverified.

Why it plausibly went unnoticed: the Task 13 evidence records "persistence integration 2/2",
which is the focused kickoff-store run, not the integration project. No full `npm run verify`
appears to have run since Task 13 landed. Checkpoint C's 12-file / 38-test integration result
predates it.

This is filed as the first real instance of the record type being built:
`docs/evidence/open-question/questions/question_migration_assertion_001.json`. It validates
against `validateOpenQuestion` and is recorded with `blocksWork: true`, because Task 3 adds
migration `004_open_question` and bumps `user_version` to 4. Adding a fourth migration on top of
an unresolved failing assertion would entangle a pre-existing defect with new work and make the
Task 3 RED ambiguous.

Resolution required before Task 3 begins: `npm.cmd run test:integration` on the owner's
environment, and a decision on whether repairing the assertion is a separate corrective commit.

### Note on the governance implication

If confirmed, this is a second instance of the D4-P-002 pattern: a documented gate that did not
execute. Task 13's evidence line reads as broader verification than the commands actually run.
The fix is not more review; it is that a task which changes shared schema must run the full
project that covers it, not only its own focused files.

## Task 3 - Persistence

Date: 2026-08-18

Preceded by the corrective commit for D4-P-004. Main was red before this task began; it was
returned to green (40 passed / 1 skipped) and confirmed by the owner before Task 3 started.

- RED 1: `open-question-store.integration.test.ts` failed to import the absent
  `./open-question-store.js`. Confirmed by the owner on Windows; the container cannot run the
  integration project because `better-sqlite3` will not build there.
- GREEN 1: 45 passed / 1 skipped across the integration project, up from 40 / 1. The five new
  tests cover: a question and its dispositions surviving close and reopen with order preserved;
  conflicting reuse of a record id throwing `OPEN_QUESTION_RECORD_CONFLICT`; an identical record
  re-stored with different key order being idempotent rather than a conflict; project isolation
  across both tables; and migration `004_open_question` applying with both tables present and
  `userVersion === migrations.length`.
- Both halves of this RED-GREEN cycle were executed by the owner. The container contributed
  static gates only: full `tsc -b` across every package, ESLint at `--max-warnings 0`, and
  Prettier, all clean.
- Files: `packages/persistence/src/open-question-store.ts`,
  `open-question-store.integration.test.ts`, `project-store.ts` (migration 004, user_version 4),
  `project-store.integration.test.ts` (deliberate enumeration update), `index.ts` export.

### Design decisions recorded

- **Canonical serialization for conflict detection.** The store uses `stableStringify` from the
  domain package rather than `JSON.stringify`. Two records with identical values but different
  key order are the same record, so re-storing one is idempotent. A test asserts this directly.
- **Known inconsistency left untouched.** `kickoff-store.ts` uses raw `JSON.stringify` for the
  same conflict check and is therefore key-order sensitive: a semantically identical record could
  be reported as `KICKOFF_RECORD_CONFLICT`. `event-store.ts` already uses `stableStringify`. The
  stricter precedent was followed here. `kickoff-store` is owner-accepted Task 13 code and was
  **not** modified; this is recorded so the divergence is visible rather than silent.
- **Explicit `sequence` column.** Disposition order is a stored fact with
  `UNIQUE(question_id, sequence)`, not an artifact of rowid assignment, so it survives a reindex
  or future migration.
- **Real foreign key** from `question_dispositions.question_id` to `open_questions(question_id)`.
  Foreign keys are already `ON` and `002_runtime_trust` uses them, so this matches house style
  and prevents a disposition referencing a question that does not exist.
- **Persistence stays dumb.** The store returns raw records. Reconstruction through the domain
  reducers belongs in the application layer, matching `kickoff-store`. The package already
  depends on `@cuckcode/domain`, so this was a deliberate boundary choice, not a constraint.

### Evidence boundary

Task 3 proves storage, retrieval, ordering, conflict rejection, isolation, and migration only.
It does not prove command authority, reciprocal parity, attention integration, or any office
representation. No Phase 4 file was modified.

## Task 4 - Commands and reciprocal read model

Date: 2026-08-18

- RED 1: both focused suites failed to import the absent `./open-question-commands.js` and
  `./open-question-read-model.js`. The 19 existing open-question tests continued to pass, so the
  RED was isolated to the new files.
- GREEN 1: 32 tests passed across the four open-question files (9 contract, 10 domain unit,
  7 command unit, 6 reciprocal contract).
- Regression: the container's full unit and contract projects passed at 44 files / 188 tests,
  up from 42 / 175 before this work stream began. Full `tsc -b` across every package, ESLint at
  `--max-warnings 0`, and Prettier all clean.
- Files: `packages/application/src/open-question-commands.ts`, `open-question-commands.unit.test.ts`,
  `open-question-read-model.ts`, `open-question-read-model.contract.test.ts`, `index.ts` exports.

### A test was corrected during GREEN, and why that is not test-fitting

The first parity test asserted that *every* agent sees the identical shared record. It failed:
the `release` role, which neither raised the question nor acts on its subject, correctly saw
nothing. The assertion contradicted a sibling test in the same file that requires exactly that
scoping.

The test was wrong, not the implementation. It conflated two distinct properties: **visibility**,
which is legitimately scoped by role and subject, and **parity**, which must be absolute. The
corrected assertion checks that where an agent can see a record at all, it is identical to the
manager's, and it asserts a non-zero number of viewers so it cannot pass vacuously.

Recorded explicitly because "the test failed so I changed the test" is normally a TDD smell. The
distinction here is that the implementation was never adjusted to make the assertion pass; the
assertion was replaced with the property it was meant to express in the first place.

### Design decisions recorded

- **Parity is structural, not asserted.** One `SharedQuestionRecord` is built per question and
  the same object reference is handed to both the manager view and every agent view. There is no
  second construction path that could drift, so parity cannot silently regress. The contract test
  verifies the property; the design makes violating it require deliberate effort.
- **Authority is enforced twice, on purpose.** `managerOnlyDispositions` is duplicated in the
  command boundary and the aggregate. A caller that bypasses the command layer still cannot
  bypass the domain, and vice versa. The duplication is deliberate defence in depth and is
  commented as such.
- **Attribution is checked before authority.** A command whose payload author does not match the
  actor fails as `QUESTION_ATTRIBUTION_MISMATCH` rather than as an authority error, so an
  impersonation attempt is never reported as a mere permission problem.
- **Stale commands return `retrySafe: true` and a `requiredAction` sentence.** This is the D-26
  actionable-error requirement applied literally: the caller is told the operation is safe to
  retry and exactly what to do first, rather than inferring it from a bare code.
- **Absolute filesystem paths are redacted at the projection boundary.** Windows drive paths,
  UNC paths, and POSIX absolute paths become `[redacted_path]`. Evidence is addressed by
  reference, not by location on whichever machine produced it. Relative repository references
  pass through unchanged, because they are portable identifiers rather than machine paths.

### Evidence boundary

Task 4 proves command authority, receipts, and reciprocal projection only. It does not prove
persistence wiring of the command layer, attention integration, office representation, or any
Phase 4 behavior. No Phase 4 file was modified.

## Checkpoint - no Phase 4 regression

Date: 2026-08-18. Executed by the owner on Windows. Result: **PASS.**

Full `npm.cmd run verify`, every stage green:

- Static and contracts: Codex protocol 4 tests / 275 schemas at exact version 0.146.0; Agency
  Agents 3 tests / 6 Candidate roles at commit `ebe9c99`; qualification 16; scaffold 2; graybox
  evidence 3; workspace contract 4.
- Formatting, ESLint at `--max-warnings 0`, and TypeScript all clean.
- Behavior: 33 unit files / 133 tests; 3 component files / 30 tests; 14 integration files /
  45 tests with 1 guarded live test skipped; 11 contract files / 55 tests.
- Build: production Vite build, 851 modules.
- Browser: 34 E2E, 12 axe, and 12 rendered visual tests across Chromium 1440x900 and 1280x800.

No Phase 4 file was modified by this work stream. The only changed Phase 2 file is
`project-store.ts` (migration 004) and its integration test, both intended.

**Evidence drift check (defect D4-P-003).** The visual suite writes into
`docs/evidence/phase-4/layout-trials/`. All four committed PNGs were verified byte-identical to
`HEAD` after this run, so the accepted Task 5 evidence is intact. This is now the second
independent confirmation that the graybox capture is deterministic to the byte. The structural
hazard named in D4-P-003 remains open regardless: the capture is deterministic today, so the
overwrite is a no-op, but nothing prevents a future intentional change from silently rewriting
owner-reviewed evidence.

## Owner gate - Tasks 1 to 4

**Accepted by the owner on 2026-08-18 with no changes requested.**

Delivered: a canonical open-question record that is validated, governed by explicit disposition
rules, persisted immutably with ordered dispositions, reachable through an authority-enforcing
command boundary, and projected identically to the manager and to every agent entitled to see it.

Nothing displays it. That is the intended resting state: the office representation is deliberately
deferred to a D-02 composition decision, and Task 5 (attention integration) remains unauthorized
because it modifies an owner-accepted Phase 1 projector that Phase 4 Task 10 depends on.

Total new coverage across the work stream: 32 tests over four files, plus the D4-P-004 corrective
commit that returned `main` to green before any of it began.

## Task 5 — Attention integration (2026-09-08)

Authorized 2026-09-08. Delivered the same day. **The task was larger than its acceptance line.**

### The blocker the specification did not anticipate

Spec §2.3 asked for `question_open` at priority 35 with escalation on `blocksWork` and `neededBy`.
Implementing it revealed that `ManagerAttentionItem` requires `updatedAt` and **an `OpenQuestion`
carried no timestamp of any kind** — `neededBy` and `reviewBy` are future deadlines, not
occurrence times. The causing event was no help either: `raisedByEventId` names it, but
`CanonicalProjectSnapshot` keeps only `eventIds` and discards event timestamps.

Three options were put to the owner: add `raisedAt` to the contract; use read time as `updatedAt`;
or make `updatedAt` optional. The second lies and makes the projection non-deterministic per call,
which would destabilise the Checkpoint C captures. The third is likely barred by the workspace
contract, which rejects attention items missing freshness. **The owner chose the contract change
on 2026-09-08.**

### RED and GREEN, both on the owner's Windows machine

Two behavioural REDs, each preceded by a deliberate stub so the first failure was an assertion
rather than a compile error.

1. **Contract.** `raisedAt` added to the type and to every fixture, with no validation. RED: 2 of
   3 new tests failed — a question with no `raisedAt` validated successfully, and `"yesterday"`
   was accepted. GREEN after validating with `parseUtcTimestamp`, the same check `events.ts`
   applies to `occurredAt`. 12/12.
2. **Projector.** Union and priority table extended, second parameter accepted and ignored. RED:
   3 of 4 new tests failed, all with the question absent from the projection. GREEN after reading
   `questionsRequiringDisposition`. 5/5.

In both cases one new test passed before and after. Those are guards against over-correction —
"accepts a UTC timestamp", and "projects nothing for questions when no register is supplied" —
and are recorded as guards, not as RED evidence.

**Full `npm run verify` green on Windows**: unit 133 → 137, contract 55 → 58, component 42,
integration 47, e2e 46, a11y 18, **visual 22 with no committed capture changed**. The rail renders
identically, so Task 10 evidence was re-verified rather than re-captured and no owner disposition
on a changed capture was required.

`tsc` caught one defect neither ESLint nor Prettier could: a second construction site in
`open-question-store.integration.test.ts` that rebuilds a question field-by-field — deliberately,
to prove key order does not matter to the store — and so did not receive `raisedAt` from the
fixture edit. Typecheck cannot run from the agent side; the owner's run found it.

### Design decision recorded

An escalated question keeps `reason: "question_open"` and only its priority moves to 10. Renaming
it `blocked` would sort more simply and would assert a work state canonical state does not hold —
precisely the substitution agents are forced into today, and the reason this record type exists.
Owner-agreed 2026-09-08.
