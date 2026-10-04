# DF-047 — streamed effects in kickoff classification (task draft)

Status: **approved by owner 2026-10-04; implementation authorized after W6 acceptance on 2026-10-04**.
Finding: `docs/evidence/dogfood-register.md`, DF-047.

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
fake app-server fixture only if the existing unit-test harness cannot express notification ordering.
The existing uncommitted `packages/runtime-codex/src/fixtures/fake-app-server.mjs` diff is not
assumed to be part of this task until its author and intended use are confirmed.

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

The task requires a focused deterministic test that first fails for the expected reason, script
typecheck/lint, and a clean owner-run `npm.cmd run verify`. No live provider run is required or
authorized. No DF-047 code changes are part of the current W6 work. Implement this task only after
W6 reaches its owner-accepted gate.
