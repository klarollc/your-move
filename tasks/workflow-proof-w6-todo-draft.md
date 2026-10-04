# Workflow proof W6 — task breakdown draft

Status: **owner-accepted 2026-10-04 after implementation and verification**.
Plan: `docs/proposals/2026-10-03-workflow-proof-plan.md`.
Design ruling: `docs/evidence/workflow-proof/decision-record-2026-10-04-w6-posture-projection.md`.

## Scope

Add canonical posture history to `OfficeWorkView` so both workflow surfaces can read the same
requested, granted and declared posture. Read only from `CanonicalProjectSnapshot`; keep the
auxiliary-input refusal rule unchanged. Limit implementation to
`packages/application/src/office-read-model.ts` and
`packages/application/src/office-read-model.unit.test.ts` unless a failing typecheck proves another
application consumer needs an additive update. Do not change `apps/web/src`, `packages/ui-system`,
the event schema, or attention behavior.

## RED–GREEN–REFACTOR

1. **RED:** Add read-model assertions for a work item with two posture events: both records appear
   in canonical history order and preserve all fields, including named differences on a mismatch.
   Confirm the test fails because `OfficeWorkView` has no `postures` projection.
2. **RED:** Assert that a work item without posture events returns `postures: []` and does not
   invent a role capability or state.
3. **RED:** Assert that auxiliary records containing `posture`, `requested`, `granted` or `declared`
   are refused whole with `AUXILIARY_FACT_REFUSED`.
4. **GREEN:** Project each work item's `snapshot.work.postures` history onto its `OfficeWorkView`
   without changing the projection inputs or auxiliary whitelist.
5. **REFACTOR:** Keep one canonical mapping path, preserve readonly types and existing view
   ordering, and remove any duplicated test setup introduced by the change.

## Verification and done-when

- [x] The focused unit test failed first for the expected missing-field behavior: owner-run RED on
      2026-10-04, 2 failed and 35 passed; the shown failure was `postures` expected `[]`, received
      `undefined`.
- [x] The focused unit test then passed: owner-run GREEN on 2026-10-04, 37/37 passed.
- [x] TypeScript workspace build passed: owner-run `npm.cmd run typecheck`, exit 0.
- [x] Owner reported `npm.cmd run verify` green after commit `7280de2`; the supplied terminal tail
      shows 42 accessibility and 68 visual tests passed. The detailed runner footer was not retained.
- [x] Owner accepted W6 on 2026-10-04. Acceptance record:
      `docs/evidence/workflow-proof/decision-record-2026-10-04-w6-acceptance.md`.
- No visual or browser acceptance is claimed; W6 changes the read model only.

## Owner acceptance

- [x] Task 6 — canonical posture history projection, accepted by owner 2026-10-04.
- W7–W9 remain blocked pending their own task approvals.

## Approval boundary

W7–W9 remain blocked on completion and approval of their own tasks.
