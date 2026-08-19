# Plan: canonical open-question record

Status: **PROPOSED PLAN. Implementation not authorized.**
Specification: `docs/proposals/2026-08-18-open-question-record.md` (owner-approved 2026-08-18).
Provenance: `docs/evidence/dogfood-register.md` DF-005.

## Authority question the owner must settle first

This work is **not inside Phase 4's approved scope.** AGENTS.md limits current authority to
"deterministic graybox office composition and behavior, the accessible DOM equivalent, loopback
application boundary, simulator-driven collaboration/kickoff workflow, strict rendered graybox QA,
manual accessibility, and the five-person comprehension study."

An open-question record is Phase 1/2-shaped work (contracts, domain, persistence, projection)
arriving during Phase 4. Three ways to place it, owner's choice:

1. **Interstitial work stream, Phase 4 paused.** Land Tasks 1–4 now, resume Task 14 after.
   Cleanest boundary; Phase 4 stalls.
2. **Deferred until after the graybox gate.** Phase 4 finishes untouched, then this runs.
   Lowest risk to existing evidence; the dogfood finding sits unaddressed longest.
3. **Phase 4 authority explicitly amended** to admit this work stream, recorded in AGENTS.md.
   Honest about what is happening; widens an approved boundary mid-phase.

Recommendation: **option 1**, with Task 5 deferred regardless (see below). Tasks 1–4 touch no
file Phase 4 depends on, so Task 14 resumes on unchanged ground.

## Sequencing constraint discovered during scoping

Specification §2.3 extends `ManagerAttentionItem["reason"]` with `question_open`. That union lives
in `packages/domain/src/attention.ts`, an **owner-accepted Phase 1 projector**, and Phase 4
Task 10's attention rail and its Checkpoint C capture matrix are built on it.

Changing it mid-Phase-4 risks invalidating accepted Task 10 evidence for a feature with no
Phase 4 consumer. Task 5 is therefore split out and separately gated. Tasks 1–4 deliver a
complete, tested, persisted, reciprocally projected record that nothing yet displays — which is
the correct state for a domain object whose office representation is deliberately undecided.

## Task sequence

Slice to at most five files per commit. RED–GREEN–REFACTOR throughout; a test that did not first
fail for the expected reason is not evidence.

### Task 1 — Contract and validation

Define `OpenQuestion` and `QuestionDisposition` with a closed issue-code union, following the
`packages/contracts/src/kickoff.ts` conventions.

Acceptance:

- `schemaVersion` pinned; closed enums for `subject.kind`, `authorKind`, `confidence`,
  `disposition`.
- `wouldBeResolvedBy` required and non-empty; a question that cannot state what would settle it
  is rejected.
- `blocksWork` explicit, defaulting false, and never inferred.
- `superseded` requires `supersededByQuestionId`; `deferred` requires `reviewBy`.
- Shared secret rejection applies to every free-text field.

Files: `packages/contracts/src/open-question.ts`, its contract test, `index.ts` export.
Scope: small.

### Task 2 — Domain aggregate and disposition rules

Acceptance:

- Silence never resolves a question; no timeout closes a record.
- Multiple dispositions may attach to one question and all are retained; no participant
  overwrites another's contribution.
- Only `authorKind: "manager"` may close as `accepted_risk` or `rejected`.
- Any participant may supply `answered`.
- Reopening requires a new question referencing the superseded one, never mutation.

Files: `packages/domain/src/open-question.ts`, unit test, `index.ts` export. Scope: medium.

### Task 3 — Persistence

Acceptance: immutable attributable records; restart recovery; conflict rejection; project
isolation; dispositions preserved in order; migration 004 additive and reversible in review.

Files: `packages/persistence/src/open-question-store.ts`, integration test, migration, `index.ts`.
Scope: medium.

### Task 4 — Commands and reciprocal read model

Acceptance:

- Exact revisioned receipts and attribution, matching the kickoff command pattern.
- Authority enforced at the command boundary, not only in the aggregate.
- Manager and agent projections expose identical identity, subject, confidence, evidence, and
  disposition (D-26 parity).
- The agent projection answers, without inference from failure: questions addressed to my role;
  questions I raised and their disposition; open questions on the work item or knowledge I am
  acting under, including those raised by others.
- No secrets, hidden reasoning, or filesystem paths cross the projection boundary.

Files: `packages/application/src/open-question-commands.ts`, `open-question-read-model.ts`,
their tests, `index.ts`. Scope: medium/large.

### Checkpoint — no Phase 4 regression

Full `npm.cmd run verify`. Every Phase 4 suite, capture matrix, and Checkpoint C artifact
unchanged. Confirm `git status` is clean of unexplained evidence drift before and after
(see defect-register D4-P-003).

## Separately gated

### Task 5 — Attention integration

Not authorized by approval of this plan. Requires a separate owner decision after Tasks 1–4,
because it modifies an owner-accepted Phase 1 projector that Phase 4 Task 10 depends on.

Acceptance: `question_open` at priority 35; escalation to blocked priority when `blocksWork`;
surfacing at `neededBy`; Task 10 rail and Checkpoint C evidence re-verified or re-captured with
recorded owner disposition.

### Not in scope at all

Office representation, spatial anchor, and any UI. Deferred to a D-02 composition decision.
Kickoff unification (specification §4) remains an open owner decision; the recommendation is the
additive option, and only after the base record has earned its keep.

## Proposed focused loop

```powershell
npm.cmd run test:questions
```

Defined as `vitest run --project contract --project unit --project integration open-question`,
matching `test:kickoff`. Add during Task 1 so the loop exists before there is anything to run.
