# DF-047 — streamed effects in kickoff classification (task draft)

Status: **owner-accepted 2026-10-04 after implementation and verification**.
Finding: `docs/evidence/dogfood-register.md`, DF-047.

## Progress checklist

- [x] Task 1 — include streamed items in shared kickoff classification and pass the clean owner-run
      verification gate.

## Evidence so far

- **RED, owner-run:** the focused test had 3 failures and 1 pass. The three failures were the
  omitted streamed file change, omitted unclassified streamed item, and missing streamed effect on
  a failed turn; deduplication passed.
- **GREEN, owner-run:** the focused test's failure guard did not throw. The test summary was not
  included in the pasted output.
- **Script typecheck, owner-run:** `npm.cmd run typecheck:scripts` exited 0.
- **Lint and format check, owner-run:** their nonzero-exit guards did not throw; the output was not
  included in the pasted excerpt.
- **Provenance, owner-run:** check passed with 426 artifacts, no missing ledger entries, and no
  stale digests.
- **Full verification, owner-run:** after the acceptance-docs commit `82017a3`, the failure guard
  did not throw and `git status --short` was empty. The detailed runner footer was not included in
  the pasted output.
- **Owner acceptance:** accepted on 2026-10-04. Record:
  `docs/evidence/workflow-proof/decision-record-2026-10-04-df-047-acceptance.md`.

## Problem

`scripts/phase4-kickoff-session.ts` classifies `run.turn?.items` only. `runTurn` also returns
`streamedItems`, so an effect present in `item/completed` but absent from `turn/completed` can be
missed. The Phase 5 release-review path shares `openKickoffSession` and inherits this behavior.

## Proposed task scope

Classify the union of the completed-turn items and completed streamed items, de-duplicated by item
identity. Preserve the existing item policy: allowed effects are reported, every item type remains
classified, unclassified types fail closed, and effects from a failed turn are still reported.
Do not change turn retry policy, sandbox posture, live-run behavior, provider protocol, or unrelated
Phase 5 review logic.

Likely files: `scripts/phase4-kickoff-session.ts`, a focused script unit test, and a deterministic
test fixture only if the existing unit-test harness cannot express notification ordering. The
separate fake app-server stream correction is committed at `7280de2` and is not part of this task.

## RED–GREEN–REFACTOR

1. **RED:** A streamed `fileChange` absent from `turn/completed.items` is reported as
   `runtime.file`.
2. **RED:** The same item present in both sources is reported once.
3. **RED:** An unclassified streamed item fails with `UNCLASSIFIED_ITEM_TYPE`.
4. **RED:** A streamed effect remains visible when the turn result is a failure.
5. **GREEN:** Merge and de-duplicate the two item sources before the shared classification logic.
6. **REFACTOR:** Keep the behavior common to kickoff callers; confirm the Phase 5 release-review
   path continues to use that same session boundary.

## Verification and approval boundary

The task required a focused deterministic test that first failed for the expected reason, script
typecheck/lint, and a clean owner-run `npm.cmd run verify`. The owner accepted the task and later
reported the full verification green after commit `82017a3`; the runner footer was not retained.
No live provider run was required or authorized.
The W6 acceptance prerequisite was met before implementation began.
