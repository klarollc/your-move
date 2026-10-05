# Your Move implementation plan v0.1

**Status:** approved by the owner on 2026-10-04 with the task breakdown and MDD amendment;
implementation authorized within this scope. Approval response: “Approve + bind digest.”

**Date:** 2026-10-04
**Spec:** `docs/your-move/reference/surface-b-ui-spec.md`
**Behavior reference:** `docs/your-move/reference/surface-b-app.html`
**Visual references:** `docs/your-move/reference/yourmove-round*.html` and
`docs/your-move/reference/studio-mockup.html`

## 1. Goal and boundary

Implement the approved Your Move behavior in §8 of the UI spec against the real workflow core.
Every view is folded from the canonical event log with `replayProject`; every mutation remains on
the one `executeWorkCommand` path and is reflected only after the accepted event is appended and
read back. The event log wins disagreements. Checked, recorded-not-checked, and claimed evidence
remain visibly distinct.

Your Move is the product name; CuckCode stays the repository and code name. Surface B is the
primary product surface. W8 and all further office-surface work remain shelved. W0–W6 and W9–W11
remain intact. W12 and the §20 comprehension run remain separately gated owner work; this plan does
not start a provider session, promote, push, or cause an external effect.

The package was copied byte-for-byte to `docs/your-move/reference/`; its source hashes are recorded
in `SHA256SUMS.txt`. The standalone `Downloads/your-move_app.html` is SHA-256-identical to the
package's `surface-b-app.html`. These HTML files remain references only.

## 2. Current W7 implementation: carry forward and rebuild

Carry forward, subject to focused re-checks:

- The default Surface B route, authenticated session and CSRF handling, `/api/log` read, replay
  through `replayProject`, and refresh after `/api/commands`.
- Create, assign, owner evidence, review-request command mapping through
  `toWorkCommand` → `executeWorkCommand` and the append-only log.
- The server-owned loopback runner start. The browser submits only the work item id; the server
  owns runner configuration and guards the log lock. This is a runner-control endpoint, not a
  second event writer.
- The Surface B import boundary that excludes the office scene/canvas.

Rebuild or revise:

- The current `work-list.tsx`/CSS does not implement the Dusk palette, Today/New work/Log views,
  attention rail, calm states, ordering, filtering, escalation panel, time travel, digest, lens, or
  the approved receipt behavior.
- The current projection flattens evidence to result/event id and drops its envelope source/trust;
  it must expose provenance and source revisions without upgrading reported claims to verified
  facts. Replace the office-shaped intermediate projection where that obscures these distinctions.
- The current create form saves a manager-entered contract immediately. It does not implement the
  approved plain-language → agent draft → manager review/approval flow. No UI may claim an agent
  drafted a contract unless a real, authorized draft source did so.
- The current projection has no revision-prefix/time-travel model and does not represent unreadable
  log ranges, projection/log disagreement, or evidence/run/worktree gaps with the required honesty.

## 3. Read-model and truthfulness design

Build one deterministic Your Move read model from the log response and `replayProject` snapshot.
The same projection supplies Today, the attention rail, calm/empty states, detail, Log, the visited
revision, away digest, nudge suggestions, assignee lens, receipts, and attestations. Time travel
replays a revision prefix; it does not keep a second mutable task store. Search, active view, and
per-session collapse choices are presentation preferences only and cannot change work truth.

Every displayed status/count/date/evidence claim carries the revision that supports it. Evidence
is checked only when the canonical event and completion judgement support it; a manager or agent
claim stays a claim. Missing run, worktree, or hash values are shown as missing. Silence is phrased
as “no signal since rNNN,” never as idle. Offline/stale/log-damaged states disable writes and retain
the age/revision of the cached projection. No action updates the visible result optimistically:
show “recording…” until the append succeeds and a fresh log read confirms the event.

Deterministic list ordering follows §8: longest-waiting first for Your move, most recent signal
first for In progress, FIFO for Queued, and newest verified first for Done. Filtering applies to
the list only; the rail remains global and is labelled unfiltered. Each figure names its source
revision. Collapse state is session-local; work state never is.

## 4. Workflow-core reconciliation

The current event vocabulary provides `work.created`, `work.assigned`, `work.released`,
`work.transitioned`, `evidence.recorded`, `approval.recorded`, and `posture.recorded`. These support
the existing work lifecycle, failure result, review request, approval evidence binding, and
provenance that is already present. `executeWorkCommand` currently accepts create, assign,
record-evidence, and request-review only. `executeAttentionCommand` validates dispositions but
does not append workflow events through the W5 command route.

Do not add prototype event names or UI-owned substitutes. The following distinctions are not
currently represented as first-class work facts; map them to existing semantics only when the
meaning is genuinely equivalent, otherwise submit the event/command change through the normal
workflow-proof approval process before implementing the write:

| Spec behavior                    | Existing core candidate                     | Gap to resolve                                                                                           |
| -------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Failed check / rejected evidence | `evidence.recorded` with `result: failed`   | A failed check is not necessarily a manager rejecting evidence; define the distinction.                  |
| Turn budget exhausted / granted  | turn-record evidence and work transitions   | No canonical work-contract turn budget or grant record is present.                                       |
| Re-scope                         | new work contract on `work.created`         | No contract-revision event exists.                                                                       |
| Close incomplete                 | `work.transitioned` to `cancelled`          | Cancellation does not state that bounded work ended incomplete.                                          |
| Defer / resurface                | `paused` / `waiting_input` transitions      | No work-level re-surface time or fired/resurfaced fact is represented.                                   |
| Nudge / snooze / dismiss         | none                                        | No persisted nudge or resting-window semantics.                                                          |
| Withdraw a ruling                | `verified` → `active` transition            | This does not withdraw the `approval.recorded` fact or bind a reversal to it.                            |
| Attested accept / send back      | `work.transitioned`, `approval.recorded`    | The present shared command route has no persisted manager ruling intent.                                 |
| Agent-drafted contract           | `work.created` accepts a validated contract | No pre-creation agent-draft service was found; a deterministic fake must not be labelled an agent draft. |

The owner approved the minimum reconciliation in
`docs/proposals/2026-10-04-your-move-workflow-core-proposal.md` on 2026-10-04. Its §7 gate is green.
The owner approved the separate agent-side speech-acts proposal as written on 2026-10-05; its §7
RED–GREEN gate is a separately tracked supplement and must run in order. Both proposals keep the
same command path, reducer and event log. The seven additive UI decisions are mapped in
`tasks/your-move-todo.md` and the approval record. They add no event kinds. W12, §20, contract-draft
service implementation and live provider sessions remain gated.

## 5. Build order

1. **Projection-only conformance.** Make a complete canonical projection over actual event-log
   reads, carrying source/trust/revision/provenance and representing stale, incomplete, damaged,
   and conflicting reads truthfully. Audit and carry over conforming W7 behavior.
2. **Rounds 2b–5.** Build fresh-empty/all-clear/filtered-empty calm states, deterministic groups,
   counts/collapse/filtering, phone-grade global rail, honest failure states, then the focused
   escalation panel. Failure fixtures drive tests; production UI has no Simulate controls and no
   test seed work.
3. **Round 6.** Add the global master lamp, event-log revision travel with full projection replay,
   and the two-sided ghost journey. Animate only after a confirmed event append; cancel on
   navigation and honor reduced-motion.
4. **Round 7.** Add log-derived ruling session, away digest, nudge suggestions, attested acceptance,
   assignee lens and receipts. The approved core command semantics are implemented through the
   shared command path. Undo is a compensating event; history is never rewritten. Preserve the
   approved truthfulness limits: no browser-side verification, no notification claims, per-line
   evidence states, real future UTC defer, and full re-scope contracts with a visible diff.

## 6. Worktree-bound evidence recommendation

**Recommendation: bind a worktree content digest into each relevant `evidence.recorded` event.**
The current review gate relies on owner procedure; the event records the output digest but no final
worktree identity, so the log alone cannot show that the checks describe the tree being accepted.
Record a canonical digest for the worktree at the time evidence is produced, and require the final
tree digest to match before review. The evidence collector should measure it around the check; a
digest typed in afterward is only another owner claim and does not prove the check ran against that
tree.

Tradeoff: this strengthens auditability and makes stale test/diff evidence detectable, at the cost
of a defined cross-platform digest policy (tracked, staged, unstaged and untracked files; ignored
files; symlinks and line endings), an evidence-run wrapper, and rerunning evidence whenever the
worktree changes. Hash binding proves identity of the recorded tree, not that the check itself was
honest or hermetic. Submit the field and collector through workflow-proof before changing the
event contract.

## 7. Acceptance evidence

- Deterministic tests first fail for each new projection or behavior and then pass after its
  implementation; test fixtures use actual canonical events, with adversarial stale, damaged,
  partial, failed, claimed, and conflicting records.
- The same event log gives the same work state in every Your Move view and after time travel.
- Every §8 decision is in a requirement-to-test/demo matrix. No unsupported state is silently
  omitted, inferred, or made actionable.
- Production build and project verification pass after implementation. Current-build browser
  captures cover the approved viewports; console/network, keyboard, reduced-motion and phone rail
  checks are directly exercised. These checks prepare evidence; only owner review can grant visual
  acceptance.
- No W12 live session, §20 comprehension session, office work, push, promotion, or external effect
  occurs as part of this plan.
