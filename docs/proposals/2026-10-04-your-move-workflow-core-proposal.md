# Your Move workflow-core proposal

**Status: proposed for workflow-proof owner approval; no event or command changes are authorized by this document.**
**Scope:** reconcile the approved Surface B §8 behavior with the existing workflow core, including the approved worktree-digest binding. This proposal supplements the approved Your Move implementation plan; it does not authorize W12, a provider run, promotion, push, deployment, or external notification.

## 1. Decision requested

Approve or amend the event and command changes in §3–§6 before implementation. The UI remains read-only over `replayProject` and all mutations remain in the event log through `executeWorkCommand`. A rejected proposal leaves the corresponding controls unavailable; it does not permit a Surface B side channel.

## 2. Current core facts

- `executeWorkCommand` currently accepts `create`, `assign`, `record_evidence`, and `request_review`. It checks the expected log revision, builds canonical events, validates them, replays candidates through `replayProject`, and returns a receipt.
- `replayProject` delegates work facts to `reduceWorkTruth`. Current work events include `work.created`, `work.transitioned`, `work.assigned`, `work.released`, `evidence.recorded`, `posture.recorded`, and `approval.recorded`.
- `approval.recorded` is an artifact/evidence-version binding. It does not record accept, send-back, defer, or withdrawal, and is not equivalent to a ruling receipt.
- `work.transitioned` can express ordinary lifecycle changes, but its current condition has no resurface timestamp or manager ruling identity. `paused` has no due/resurfaced semantics.
- A failed `evidence.recorded` result means a check failed. It does not mean the manager rejected evidence.
- `WorkContract` has no turn budget or contract-revision history. `turn-record` evidence can count recorded turns, but no canonical cap exists.
- Existing `work.created` records retain their historical meaning and must keep replaying unchanged.

## 3. Prototype event-name reconciliation

| Prototype name | Core reconciliation | Proposal |
|---|---|---|
| `evidence.rejected` | Not equivalent to `evidence.recorded` with `result: failed`. A send-back ruling already records the manager's decision while preserving the original evidence outcome. The approved rounds do not require a separate evidence-rejection action. | Do not add it. A ruling may name evidence versions it disputes; it never rewrites their checked/recorded/claimed state. Revisit only if a separately approved behavior needs rejection independent of send-back. |
| `work.turns_exhausted` | A fact computable from the contract's effective budget and canonical `turn-record` evidence. | Do not persist a duplicate event. Project exhaustion when verified attempted-turn records reach the effective budget; show missing/partial turn records as unknown, not exhausted. |
| `work.turns_granted` | A budget change is a manager decision and cannot be inferred from transitions. | Add a manager event carrying a positive integer grant and the budget revision it extends. |
| `work.rescoped` | `work.created` cannot revise a contract without losing its history. | Add a manager event carrying the full replacement contract and expected contract revision. Preserve earlier contracts and do not let evidence against superseded obligations satisfy the new contract unless the same evidence version remains applicable. |
| `work.closed_incomplete` | `work.transitioned` to `cancelled` means cancelled; it does not mean the bounded attempt ended incomplete. | Add a manager event carrying a required reason and the current work revision; project a distinct terminal `closed_incomplete` state. |
| `work.deferred` | A plain transition to `paused` does not require a reason or resurface point. | Represent defer as `work.ruling_recorded` with decision `defer`, required reason, and future UTC `resurfaceAt`. Do not add a duplicate `work.deferred` event. |
| `work.resurfaced` | Due status can be derived from the latest `work.deferred` event and the current clock; an automatic event writer would add a scheduler and another authority. | Do not add it. The read model may show “resurface due” once the logged time arrives, citing the defer event and projection time. A later manager decision uses the normal command path. |
| `work.nudged` | No existing event records a manager's nudge action. The local app has no delivery adapter, so an event cannot truthfully mean a person was notified. | Add a manager event for “nudge recorded/requested,” with note and target assignment. Until a delivery event/adapter exists, the UI and receipt must not say “sent” or “notified.” |
| `ruling.withdrawn` | A transition from verified to active does not withdraw or identify the approval that caused the state. | Add a compensating event referencing the ruling and its evidence-version snapshot. It appends history; it never edits or deletes the original ruling. |

Round 7 also needs snooze and dismiss. Add one `work.nudge_suppressed` event with disposition `snooze` or `dismiss` and an absolute UTC `until`: snooze sets `until = now + 2 days`; dismiss sets `until = now + 3 days`. The projection shows at most one quiet suggestion per work item and derives when suppression expires. Do not keep this preference only in browser storage.

## 4. Minimum manager command/event model

Extend the existing `WorkCommand` union and `toWorkCommand` mapping; do not add a second endpoint or writer. Proposed manager intents are `record_ruling`, `grant_turns`, `rescope`, `close_incomplete`, `nudge`, `suppress_nudge`, and `withdraw_ruling`. Every intent carries `expectedRevision`, command ID, project/work IDs, manager actor, and its validated payload. The server appends only the events returned by `executeWorkCommand`, then the UI rereads the log before changing any projected state.

Add `work.ruling_recorded` for the manager's explicit disposition because no current event expresses that fact. It carries a stable `rulingId`, decision (`accept`, `accept_with_exception`, `send_back`, or `defer`), source work revision, optional reason/note, optional resurface time for defer, and a canonical sorted evidence-version snapshot. The command derives the attestation from replayed evidence; the browser cannot submit its own count or verified claim.

- `accept` is allowed only when the latest evidence versions satisfy every contract obligation. It records the evidence snapshot and advances to `verified`; later completion remains an ordinary `work.transitioned` event.
- `accept_with_exception` requires an explicit non-empty override reason. It preserves failed/unverified evidence unchanged and projects a distinct exception state; it never upgrades evidence to checked or passed.
- `send_back` requires a reason and returns review to active while retaining all evidence versions.
- `defer` requires a reason and future UTC resurface time and records the paused outcome.
- `approval.recorded` keeps its current artifact-binding meaning. It is not fabricated when there is no versioned artifact to bind.

`ruling.withdrawn` is valid only within 60 seconds of the referenced ruling, while that ruling is still the latest work-scoped decision, and while its evidence-version snapshot is unchanged. Replay then restores the pre-ruling state derived from the referenced ruling; both events remain visible. If a later work/evidence event makes restoration ambiguous, refuse undo and retain the ruling. The receipt names the ruling, effect, and undo expiry.

`work.turns_granted`, `work.rescoped`, `work.closed_incomplete`, `work.nudged`, and `work.nudge_suppressed` are manager events with strict payload validators, source/trust checks, expected revisions, and explicit receipts. All replay through `reduceWorkTruth`; no UI reducer or mutable work-state cache is introduced.

## 5. Turn budget, rescoping, and exhaustion

Extend new bounded contracts with a positive `maxTurns`. Preserve old `work.created` schema-v1/v2 replay behavior; for a historical contract without a cap, project “turn budget not recorded” and do not infer exhaustion. Count attempted turns only from unique canonical `turn-record` events emitted by the workflow bridge, including failed/partial attempts that actually started. A missing or contradictory stream is an incomplete count, not zero.

The effective cap is the contract's `maxTurns` plus the sum of valid later `work.turns_granted` events. Rescope writes a full contract revision and is refused while the runner is active. It preserves spent-turn history; a changed budget cannot erase prior usage. Close-incomplete is a separate terminal decision with a reason and a receipt. The UI can show “Grant N more turns,” “Re-scope,” and “Close as incomplete” only after these commands exist.

## 6. Bind measured worktree identity to evidence

Extend the existing `evidence.recorded` payload with optional lowercase `worktreeSha256`. The shared command and persisted event validate its shape. The trusted evidence recorder, not a free-form browser field, measures and supplies the digest for repo-derived check evidence; review requires the recorded digest for relevant check evidence to match the final worktree digest. UI presentation includes the digest or explicitly says “worktree digest missing.” Output digest and worktree digest remain separate fields.

Use a versioned, cross-platform canonical digest policy: hash the current working-tree bytes for tracked files and non-ignored untracked files; normalize relative separators to `/`; sort paths by UTF-8 bytes; encode path, entry type, executable bit, byte length, and file bytes with unambiguous length prefixes; represent tracked deletions explicitly; hash symlink targets without following them; exclude `.git` and ignored files; preserve exact file bytes, including line endings. A force-added ignored file is tracked and therefore included. Report unsupported submodules or unreadable paths as a refusal, never silently omit them. The collector records the digest at evidence collection, and the final-review collector measures the same algorithm again.

Tradeoff: this binds the accepted evidence to a reproducible source-tree identity and makes later tree drift visible. It requires a shared algorithm, collector support, and rerunning relevant checks after source changes. It does not prove that a recorded command was honest or hermetic, nor that ignored dependencies or the host environment were identical; the evidence wording must not claim either.

## 7. RED–GREEN implementation gate

After owner approval, implementation stays in the normal workflow-proof process:

1. Add contract tests that fail for each proposed event, validation rule, and backward-compatibility case before adding implementation.
2. Add reducer tests for event replay, deterministic ordering, evidence-version preservation, due resurface derivation, turn counts, ruling undo, and refusal after intervening evidence/work changes.
3. Add `executeWorkCommand` tests for stale revisions, wrong actors, missing reasons/times, invalid budgets, duplicate IDs, invalid digests, command receipts, and atomic append candidates.
4. Add loopback API integration tests proving the same endpoint and event log are used, damaged/stale logs fail closed, and append/readback controls the UI result.
5. Add projection and adversarial UI tests for no optimism, no conversion of claims/records to checks, past-view write refusal, quiet suppression, and digest mismatch/missing states.
6. Run the required full `verify` and provenance checks for contract changes. Browser visuals remain separate owner review evidence.

## 8. Decisions still outside this proposal

- The approved workflow creates work only after a real agent-authored contract draft is available for manager review. The present core can save a validated contract but has no draft service. Do not label manager-written text as agent-drafted or persist a fake draft. This capability needs its own authorized source and normal workflow-proof scope.
- “Nudge recorded” is not a delivery receipt. A future notification adapter would need its own approved event and delivery evidence before the UI may say who was notified.
- This proposal does not authorize a Surface B real session, W12, the §20 comprehension run, or any live provider execution.

## 9. Owner decision

Approve this workflow-core change set as written, amend it, or decline it. In particular confirm the explicit ruling event and exception state, the derived (not persisted) exhausted/resurfaced states, the nudge receipt wording, and the canonical digest policy before implementation.
