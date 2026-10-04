# Workflow-proof W0 — baseline findings (2026-10-04)

Read-only. Implements plan task W0 (`docs/proposals/2026-10-03-workflow-proof-plan.md`). No source was changed by this task. Facts below were read from the repo on 2026-10-04 unless marked **[unverified]**. Container results are inner-loop only; the Windows `verify` remains the authority.

## 1. The uncommitted work was the DF-044 fix, and it is now on the branch

The six modified files in the main working copy were:

- `packages/runtime-codex/src/turn-runner.ts` and test: `runTurn` now returns `streamedItems`, the items announced through `item/completed`, on both success and failure.
- `scripts/tracer-guards.ts` and test: new `mergeTurnItems`; `judgeTracerTurn` judges `turn.items` merged with `streamedItems`, de-duplicated by item id.
- `scripts/run-tracer-attempt.ts`: passes `streamedItems` to the judge, records `streamedItemCount` and `streamedItemTypes` per turn.
- `docs/evidence/dogfood-register.md`: DF-046 entry; DF-042 owner product signal and severity (high); DF-042 D-26 clause text.

Checks run in a container mirror (Linux, Node 22, independent install, `--ignore-scripts`): `tsc -b` clean, `tsc -p tsconfig.scripts.json` clean, unit project 92 files / 685 tests passing, Prettier clean on all changed files. Not run: integration, e2e, a11y, visual, lint, `check:toolchain`, and the full Windows `verify`. Harness count was not cross-checked against the owner's.

Committed to branch `workflow-proof` (33b9cf8): the five source files and the two proposal docs. **Not committed:** the register edits. `docs/evidence/provenance.jsonl` records the register by hash; the latest record matches HEAD's copy, not the working copy, so `phase5:provenance` would likely fail until `npm run phase5:provenance:write` is run. That write is owner-run. The DF-046 severity and D-26 clause remain `[owner to confirm]`.

## 2. Coverage of DF-043 to DF-046 by existing code

| Entry | Covered | Still open |
|---|---|---|
| DF-043 posture downgrade | Runner reads posture back and refuses on mismatch (`checkObservedPosture`). | The check is hardcoded to the tracer's posture (`workspaceWrite`, no network, `never`). There is no general requested-versus-granted comparison and no record holding both. |
| DF-044 incomplete completion record | Judge reads the merged stream (section 1). | No `partial` flag. A grep for "partial" finds only `Partial<typeof TURN_LIMITS>`. Nothing tells the surface that `turn/completed` and the stream disagreed. The text-only check in `role-exercise.ts` was not examined. |
| DF-045 blind role says done | None. | No capability self-report and no rule that blocks "done" without evidence. |
| DF-046 no read path | None. | Cause is still inferred (`shell_tool` and `unified_exec` are `"disable"` in `feature-policy.ts`); not tested. R-1 does not change it. |

## 3. Contracts that already exist and affect the plan

- **`runtimeBindingReportSchema`** (`packages/contracts/src/runtime.ts`) already carries `sandboxPosture` (type, networkAccess, approvalPolicy, multiAgentMode), `permissionCeiling`, `capabilityIds`, a nullable `toolIds` (null means the adapter does not enumerate tools; `[]` means it found none) and nullable `observedMcpServers`. This is the granted layer and the honesty convention for it. W1 should extend this shape rather than add a parallel one. For Codex, native tools are not enumerated, so an observed read/write/run capability cannot be read from this report; the declared layer must be labelled declared.
- **`work.created`** payload, as reduced by `work-truth.ts`, is `workItemId`, `outcome`, `requiredEvidenceKinds`. The D-26 fields (exclusions, acceptance criteria, dependencies, permission ceiling, stop conditions, definition of done) have no home. W3 therefore needs a contract change (a versioned payload or a separate work-contract record). That brings a full verify and a provenance check. Whether a payload version field can be added without breaking existing fixtures is **[unverified]**.
- **`work.assigned`** needs a role assignment valid against staffing at that point in the log (the reducer replays staffing alongside). `assignWorkItem` must therefore depend on a valid role assignment, not just a work item. This was not in the plan's W3 text.
- **Work transitions** use `fromRevision` and a legal-transition table; `blocked`, `waiting_input`, `review_requested`, `verified` and `completed` exist. W4's rules map onto these states.
- **`appendEvents` and `readEvents`** exist in `packages/persistence/src/event-store.ts` (SQLite via `better-sqlite3`, hash-checked, rejects id conflicts). The owner confirmed the file-log data path for W5. Note for that decision: the persistence path already exists and validates events, but it needs `better-sqlite3`, which only runs on the owner's Windows machine and not in the container.

## 4. Corrections to the plan

1. **W2 is smaller than planned.** Streamed-item judging exists. The remaining work is the `partial` flag and its display, plus examining the text-only check in `role-exercise.ts`.
2. **W1 extends `runtimeBindingReportSchema`.** It adds a requested layer and a declared-capability layer, and generalizes `checkObservedPosture`.
3. **W3 needs a contract change** for the work contract, and `assignWorkItem` depends on a valid role assignment.
4. **W5 gains a note** about the existing event store (section 3).
5. **Worktree creation is owner-run.** The existing worktrees list as "prunable" from the device shell because their recorded paths are Windows paths. A worktree created from the Linux shell would record a Linux path the owner's git cannot resolve. Run in PowerShell:
   `git worktree add .worktrees/workflow-proof workflow-proof`

## 5. Open items for the owner

1. Run `npm run phase5:provenance:write`, then commit the register edits (and set DF-046's severity and D-26 clause when ready).
2. Create the worktree (section 4, item 5).
3. Run a full Windows `verify` on branch `workflow-proof` to confirm the container result before more is built on it.
4. Confirm W1 starts as "extend the binding report".
