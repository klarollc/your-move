# Your Move agent-side speech acts proposal

**Status: approved as written by the owner on 2026-10-05; implementation is authorized under §7.**
**Scope:** add three attributable agent speech acts to the approved Your Move workflow core: questions, agreement-change proposals, and disputes of manager send-back rulings. This proposal supplements the approved 2026-10-04 workflow-core proposal. It does not authorize W12, a live provider run, promotion, deployment, or external notification.

## 1. Decision requested

Approve or amend the event and command changes below before implementation. Agent speech acts must use the existing `executeWorkCommand` path, the existing loopback endpoint, the canonical append-only log, and `replayProject`. The UI remains a read-model projection. A refused or unapproved action stays unavailable; it does not create a side channel.

## 2. Current core facts

- `executeWorkCommand` currently permits manager actors only. Agent-facing mutations need authenticated actor binding and explicit authorization for a small set of intents; accepting an `actorType: "agent"` value from a browser request is not sufficient.
- `work.rescoped` records a manager-approved, full replacement contract and preserves contract history. It is not a proposal and cannot represent a decline.
- `work.ruling_recorded` with `decision: "send_back"` records the manager's ruling. It does not record whether the assigned agent disputes that ruling.
- The shared log can preserve a participant contribution in the matter trail, but there is no current agent question or proposal event.

## 3. Event and command reconciliation

| Requested speech act / proposed event | Existing core reconciliation | Proposed command and result |
|---|---|---|
| Ask a question → `work.question_asked` | No current work event records an agent-authored question. A state transition would falsely turn speech into a lifecycle change. | Add `work.ask_question`; append the attributed question to the work trail without changing work state or requiring a ruling. |
| Propose an agreement change → `work.rescope_proposed` | Existing `work.rescoped` changes the active contract and is manager-authored. An agent proposal must not replace that contract. | Add `work.propose_rescope`; append a full replacement proposal with its expected contract revision. The active agreement remains unchanged pending a manager decision. |
| Approve a proposal → existing `work.rescoped` | The approved core already defines full replacement, sequential contract revisions, and preservation of history. It lacks a link back to an agent proposal. | Extend manager `work.rescope` with optional `proposalId`. Approval emits `work.rescoped` with the full contract and that proposal reference. Existing manager-originated re-scope remains valid without a proposal reference. |
| Decline a proposal → `work.rescope_declined` | No current event records the manager's refusal; silently dropping a proposal would erase a real decision. | Add manager `work.decline_rescope`; append the proposal ID and a required reason. It does not change the active contract. |
| Dispute a send-back → `work.send_back_disputed` | `work.ruling_recorded` with `send_back` records the manager's decision, not the assigned agent's response. Rewriting or withdrawing that ruling would conflate the two voices. | Add `work.dispute_send_back`; append the referenced send-back ruling ID and a required dispute statement. It does not reverse the ruling or change evidence state. |

Each proposed event gets one reconciliation note:

- **`work.question_asked`:** additive trail event. Do not encode the question as `work.transitioned`, alter the contract, or infer that it was answered. Surface it as an agent-authored question; the event alone does not claim that work is blocked.
- **`work.rescope_proposed`:** additive proposal event carrying the complete candidate contract and expected current contract revision. It never mutates the active contract or its evidence applicability. A manager approval is a separate `work.rescoped` event; a decline is `work.rescope_declined`.
- **`work.rescope_declined`:** additive manager disposition linked to exactly one existing proposal. It records the reason and leaves the current contract and evidence history unchanged. It is not a generic event for deleting or hiding proposals.
- **`work.send_back_disputed`:** additive agent response linked to exactly one current send-back ruling. Preserve both contributions. It does not imply acceptance, cancel the send-back, or mark evidence checked.

## 4. Command identity and authorization

Extend `WorkCommand` and `toWorkCommand`; do not add an endpoint or writer. Proposed agent intents are `ask_question`, `propose_rescope`, and `dispute_send_back`. Proposed manager intent is `decline_rescope`; the existing `rescope` intent handles approval with an optional proposal reference.

The server derives the agent identity and role assignment from its authenticated runner/session context. The request body cannot select an arbitrary agent ID or role assignment. The command's expected log revision, work ID, command ID, receipt, canonical replay, and atomic append rules remain in force for manager and agent intents. Only these enumerated agent intents may use an agent actor; create, assign, evidence verification, review, ruling, and other manager authority remain unavailable to the agent actor.

## 5. Validation rules

- Every intent requires a valid project/work ID, unique command ID, exact current `expectedRevision`, and a server-authenticated actor. Stale writes refuse without append.
- The authenticated role assignment must currently belong to the named agent and be assigned to the named work item in the replayed project. Released, mismatched, or cross-project assignments refuse. The browser may not supply the authenticated identity.
- Question text is non-empty after trimming and bounded to 2,000 characters. It is plain participant-authored content, not a check result, status transition, or instruction to exceed the recorded permission ceiling.
- A rescope proposal includes a stable unique `proposalId`, the current `expectedContractRevision`, and a complete `boundedWorkContractSchema`-valid replacement contract. Reject if its source contract revision is stale. Preserve the full proposal as submitted; do not apply it or rebase it silently. The effective active agreement remains the latest manager-approved contract.
- A manager approval references an open proposal whose expected contract revision still matches. It uses the existing rescope refusal rules, including refusal while the runner is active, and writes the full replacement plus `proposalId`. If the contract changed, the proposal remains historical and the manager must decline it or create a new proposal; do not silently accept stale terms.
- A manager decline references one existing, not-yet-disposed proposal and requires a non-empty reason bounded to 2,000 characters. A proposal may be approved or declined at most once. A repeated or competing disposition refuses atomically.
- A send-back dispute references the latest work-scoped `work.ruling_recorded` event with `decision: "send_back"`, names a non-empty statement bounded to 2,000 characters, and is unique per ruling. If a later manager ruling supersedes it, the agent must not dispute the old ruling as current.
- Speech-act events use participant attribution and reported-content trust; authenticated identity is recorded separately from verification of the statement's truth. No speech act converts recorded, claimed, or failed evidence into checked/passing evidence.

## 6. Read-model behavior and limits

All four new event kinds replay through `reduceWorkTruth` and appear in the matter-scoped trail with actor, trust, timestamp, and source revision. Agent-originated questions and disputes may appear in manager attention and digest projections as recorded contributions, but neither is represented as a lifecycle transition. Proposal state is derived from proposal and disposition events; the log remains the source of truth.

The proposal does not add a manager question-answer event or infer an answer. A question remains visible as asked; a later state or contract event does not relabel it answered. It does not add an automatic agent response to an approved re-scope, nor notification delivery. Those behaviors need separately scoped commands/events if required.

## 7. RED–GREEN implementation gate after a ruling

1. Add contract tests that fail for each proposed event schema, attribution rule, validation rule, invalid actor, stale revision, duplicate proposal/dispute ID, and old-log replay case; then add implementation.
2. Add reducer tests for deterministic replay, unchanged active contract after proposal/decline, linked approval, proposal disposition conflicts, retained send-back plus dispute history, and unchanged evidence states.
3. Add `executeWorkCommand` tests for authenticated agent-role binding, manager-only boundaries, stale work/contract/ruling revisions, required reasons and text, invalid full contracts, duplicate IDs, receipts, and atomic append.
4. Add loopback integration tests proving all intents use the same endpoint and event log, the server binds identity rather than trusting request fields, and damaged/stale logs fail closed.
5. Add projection and adversarial UI tests for no optimism, visible attribution, no state/evidence conversion, stale proposal refusal, read-only time travel, and receipt text that makes no delivery claim.
6. Run full `verify` and provenance checks for the implementation change.

## 8. Non-goals

This proposal does not authorize agent-side contract drafting before `work.created`, automatic negotiation, question-answer tracking, an agent permission to assign or self-verify evidence, history rewriting, side-channel messages, notification delivery, W12, or the §20 comprehension run. The separate contract-draft service remains behind its own brief proposal and owner ruling.

## 9. Owner decision

The owner approved this proposal **as written** on 2026-10-05. Implementation must follow the
RED–GREEN sequence in §7. The owner ruling is recorded in
`docs/evidence/workflow-proof/decision-record-2026-10-05-your-move-agent-speech-acts-approval.md`.
No manager question-answer event, inferred answer, notification delivery, W12 session, or §20
comprehension run is authorized.
