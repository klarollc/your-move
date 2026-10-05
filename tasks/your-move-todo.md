# Your Move implementation tasks

**Status:** approved by the owner on 2026-10-04 with the plan and MDD amendment; implementation is
authorized within this checklist. Approval response: “Approve + bind digest.”

## Preparation already performed

- Package Task 1 — imported the approved handoff byte-for-byte under
  `docs/your-move/reference/` and recorded its SHA-256 manifest.
- Package Task 2 — audited W7 and the current workflow vocabulary. Preserve the conforming log-read,
  shared create/assign/evidence/review path and server-owned runner start; record the layout,
  provenance, create-draft, ruling, and proposed-event gaps in the plan.
- Package Task 3 — compared branch register/provenance with main's current copies. The branch contains
  main's current tracer attempt 1–3 findings and both register digests (main `aa7619…`, current
  branch `410f1d…`); its provenance ledger contains the main ledger as a prefix plus the accepted
  W10 transcript and later proof records. No merge or main-worktree modification was performed.
- Package Task 4 — verified W11 §6 names `workflow-proof-seed\slugify-proof`, and verified the accepted
  W10 transcript is tracked at `docs/evidence/workflow/rehearsal/rehearsal.md`.
- Package Task 5 — added an explicit `superseded` status to the position-record validator using
  RED–GREEN; updated W7's position and checklist to identify the replacement package.
- Package Task 6 — recorded the owner-approved MDD amendment, plan, and implementation checklist.
  The approval boundary and digest decision are preserved in `docs/proposals/2026-10-04-your-move-design-amendment.md`.

## Proposed implementation sequence

- [x] Task 6 — record the approved MDD amendment, implementation plan, and task breakdown. Owner
      approval was given on 2026-10-04 (“Approve + bind digest”); docs are recorded and the
      position record reflects the approval.
- [x] Task 7 — workflow-core proposal approved as written by the owner on 2026-10-04. Implement
      strictly in proposal §7 order. Contract, reducer, command, loopback, and projection/adversarial
      UI stages passed focused RED–GREEN checks. Full `npm.cmd run verify` exited 0 on `82213a9`;
      provenance has no missing files or stale digests. No live runner or later gate was run.
- [ ] Task 8 — complete read-model-only conformance using `replayProject`: source/trust/revision
      provenance, checked/recorded-not-checked/not-recorded evidence, per-figure source revisions,
      explicit missing values, no inferred idle state, stale/offline/damaged log, readable gaps, and
      projection/log disagreement with one refresh action. No local work-state store.
- [ ] Task 9 — implement rounds 2b–3. Fresh empty and all-clear use the same calm screen; all-clear
      appears on every landing; a new your-move event interrupts it. Filtered empty names the active
      filters and hidden count. Use the approved group order and sort rules; collapse groups over about
      eight with a head-item line; persist collapse only for the browser session. Show fractional
      counts and the exact applied filters. Keep the complete oldest-first rail visible and unfiltered,
      including at phone width.
- [ ] Task 10 — implement round 4 using actual log/server states: disconnected age/revision banner
      with writes disabled and an honest calm-under-banner state; failed verification as a terra
      blocker with provenance; turn-cap counts and explicit grant/re-scope/close-incomplete choices;
      and damaged-log revision gaps with no inference across unreadable records. Keep Simulate controls,
      generic seed work and the synthetic clock out of production UI.
- [ ] Task 11 — implement round 5: the detail panel replaces only the list column and leaves the
      rail visible; render decision, agreement, three evidence states, risk, actions and matter-scoped
      log trail in that order. Blockers name dependent work. Defer captures a real future UTC time
      and reason; resurface-due is derived from the defer log event. Show per-line evidence states.
      Exception acceptance requires a reason and never upgrades evidence.
- [ ] Task 12 — implement round 6: one global lamp with lit/count and stale hollow/count states;
      Log revision travel re-folds the entire projection from that revision prefix, dims later events,
      marks the visited revision, disables past writes and returns to present. The ghost travels in both
      directions only after an append is confirmed; never move real rows, cancel on navigation, and
      disable flight for reduced-motion.
- [ ] Task 13 — implement round 7: a longest-waiting-first ruling session with skip/requeue behavior,
      quiet arrivals, progress and tally; first-visit away digest grouped as yours/evidence/motion/quiet
      with an empty digest when nothing happened; >3-day quiet suggestions and one suggestion per
      task; attestation generated from actual evidence lines; assignee counts and Unassigned group;
      and receipts that name only the log-recorded effect. Turn grants take a positive integer.
      The away digest reports its omitted-event count; retain the project-scoped read watermark.
      Re-scope records a full replacement agreement and shows an old-to-new diff to the assignee.
      Surface how long each matter has waited on the manager. Nudge, snooze and undo use the
      approved core commands and event log; receipts never claim notification.
- [ ] Task 14 — produce a §8 behavior-to-evidence matrix and run required unit/build/browser checks;
      capture current-build evidence at approved viewports and record limitations. Owner performs visual
      acceptance. W12 and the §20 comprehension run remain separately gated owner actions.
- [x] Task 15 — implement the approved agent-side speech acts from
      `docs/proposals/2026-10-04-your-move-agent-speech-acts-proposal.md`. Follow §7 in exact order:
      contracts; reducer; `executeWorkCommand`; loopback integration; projection/adversarial UI;
      full `verify` and provenance. All six gates passed on `82213a9`; full verification: unit 922,
      component 186, integration 153 passed/3 skipped, contract 152, e2e/a11y/visual 2 each at
      1440×900 and 1280×800. No manager question-answer event, inferred answer or notification
      delivery. W12 and §20 are not part of this task and were not run.

## Current implementation status — 2026-10-04

The source changes for the read-model, calm/list/detail, log travel, session/digest/lens, truthful
controls, and approved agent speech acts are present. The seven approved UI decisions and current
evidence are mapped in `docs/your-move/behavior-evidence-matrix.md`. The workflow-core and speech-act
§7 gates passed; full `npm.cmd run verify` and provenance passed on `82213a9`. Browser checks use an
ephemeral empty log and no runner at 1440×900 and 1280×800; they are technical QA, not owner visual
acceptance. The contract-draft service proposal is included as a draft; implementation awaits its
separate owner ruling. W12 and §20 remain separately gated and were not run.
