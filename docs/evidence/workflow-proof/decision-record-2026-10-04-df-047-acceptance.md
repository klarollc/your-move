# DF-047 — owner acceptance

Date: 2026-10-04
Source: the owner's response “yes” to the explicit DF-047 acceptance request in session.

## Ruling

The owner accepts DF-047, streamed effects in kickoff classification.

## Evidence recorded

- The owner-run RED test had 3 failures and 1 pass. The failures demonstrated that streamed file
  changes, unclassified streamed items, and streamed effects on failed turns were omitted;
  duplicate completion/stream items were already counted once by the assertion.
- The focused GREEN test's nonzero-exit guard did not throw. Its summary was not included in the
  pasted output.
- `npm.cmd run typecheck:scripts` exited 0. The owner-run lint, format check, and provenance
  commands continued past their nonzero-exit guards; provenance check reported 426 artifacts,
  with no missing ledger entries or stale digests.
- The owner reported the clean-tree `npm.cmd run verify` green after commit `3fa041f`, and the
  following `git status --short` was empty. The detailed runner footer was not retained.

Implementation: `scripts/phase4-kickoff-session.ts`. Focused test:
`scripts/phase4-kickoff-session.unit.test.ts`. Task record: `tasks/df-047-todo-draft.md`.

No live provider run was required or performed for this task.
