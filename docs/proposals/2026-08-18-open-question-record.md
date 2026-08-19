# Proposed specification: canonical open-question record

Status: **PROPOSED SPECIFICATION. Not authorized. No implementation.**
Author: Claude (Cowork), at owner request on 2026-08-18.
Provenance: `docs/evidence/dogfood-register.md` DF-005.
Authority: extends MDD §5 domain model, §8 canonical workflow state, §10 attention queue,
and the D-26 reciprocal-usability pillar. Requires owner approval before any plan or code.

## 1. Problem

CuckCode's canonical state can express what happened (events), what is known (knowledge records),
what was produced (artifacts and evidence), and what was decided (approvals and dispositions).
It cannot express **what a participant is unsure about.**

This is not a theoretical gap. Two concrete confirmations exist in the current codebase:

**Uncertainty exists only as prose inside another record.** `KickoffContribution` carries
`uncertainties: string[]` and `disagreements: string[]`. These are free-text strings inside a
kickoff contribution. They cannot be addressed, assigned, tracked to resolution, referenced from
elsewhere, or dispositioned. They exist for the duration of one kickoff and then become history.
The kickoff synthesis preserves a `disagreementRegister`, which is the right idea — scoped to a
single workflow and unavailable to the rest of the product.

**The attention queue structurally cannot carry a question.** `ManagerAttentionItem.reason` is
the closed union `blocked | waiting_input | failed | review_requested | approval_required`.
An agent's open question fits none of them. The nearest, `waiting_input`, is derived from a work
item in the `waiting_input` state — which asserts that work is halted pending manager input. Most
real questions do not halt work. Today an agent that wants to raise a doubt must either escalate
it as a blocker it isn't, fold it into a deliverable as prose, or drop it.

Observed directly on 2026-08-18: an agent found two modified evidence files with an unexplained
provenance and a medium-confidence hypothesis about the cause. There was no canonical record type
for "I found something, here is my confidence, here is what would confirm it." The finding
survived only because a human was present in the conversation. Running unattended, the same
finding becomes either a unilateral action or nothing.

MDD §4 already promises the capability: agents may "flag missing or contradictory context" and
"ask clarifying questions." No record type exists to flag them into. The promise is currently
unimplementable.

## 2. Proposed addition

A first-class canonical `OpenQuestion` record: attributable, addressable, evidence-linked,
resolvable only by explicit disposition, and projected to both participants.

### 2.1 Contract shape

Follows the existing `packages/contracts/src/kickoff.ts` conventions: `schemaVersion`,
`Validation<T>` with a closed issue-code union, and the shared `containsSecret` rejection.

```
OpenQuestion {
  schemaVersion: 1
  questionId: string
  projectId: string
  subject: { kind: "work_item" | "knowledge" | "artifact" | "role" | "kickoff" | "project"
             id: string }
  authorKind: "manager" | "agent"
  authorId: string
  roleId?: string
  raisedByEventId: string
  question: string
  whyItMatters: string
  confidence: "speculative" | "likely" | "confident"
  wouldBeResolvedBy: string[]
  evidenceRefs: string[]
  blocksWork: boolean
  addressedToRoleId?: string
  neededBy?: string
}
```

`confidence` is a bounded enum, not a number. A numeric confidence invites false precision and
cannot be compared meaningfully across agents or providers.

`wouldBeResolvedBy` is required and non-empty. A question that cannot state what would settle it
is a complaint, not a question, and the validator should reject it. This constraint exists to
keep the record useful rather than to police tone.

`blocksWork` is explicit and defaults to false. This is the field that keeps open questions
distinct from blockers — the distinction the attention union currently forces agents to fake.

### 2.2 Disposition

```
QuestionDisposition {
  dispositionId: string
  questionId: string
  authorKind: "manager" | "agent"
  authorId: string
  disposition: "answered" | "accepted_risk" | "superseded" | "rejected" | "deferred"
  reason: string
  evidenceRefs: string[]
  supersededByQuestionId?: string   // required when disposition is "superseded"
  reviewBy?: string                 // required when disposition is "deferred"
}
```

Rules:

- **Silence never resolves a question.** There is no timeout that closes a record. This mirrors
  MDD §4 principle 5 ("approval gates cannot be inferred from silence") and the kickoff rule that
  an absent revision is not affirmation.
- **`deferred` requires `reviewBy`.** A deferral without a date is a silent drop. This mirrors
  D-24's guaranteed review period.
- **Authority follows the D-11 knowledge pattern.** Any participant may raise a question or
  supply an `answered` disposition. Only the manager may close as `accepted_risk` or `rejected`,
  because both record a judgment that a known unknown will not be resolved.
- **Answering does not require agreement.** Multiple dispositions may attach to one question;
  the record retains all of them. No participant silently overwrites another's contribution
  (MDD §4 collaboration architecture).

### 2.3 Attention integration

Extend `ManagerAttentionItem["reason"]` with `question_open`, priority between `waiting_input`
(30) and `review_requested` (40) — proposed 35. Escalate to `blocked` priority when `blocksWork`
is true, and surface at `neededBy` when that timestamp passes.

This is a change to an owner-accepted Phase 1 projector and needs its own RED–GREEN evidence.

### 2.4 Knowledge relationship

The knowledge lifecycle already includes `contested`. A question whose subject is a knowledge
record should be able to move that record to `contested` without deleting or overwriting it, and
an `answered` disposition backed by evidence should be the input to a promotion decision — not
an automatic promotion. Agent-authored answers stay provisional under `determineInitialKnowledge-
Status`, unchanged.

### 2.5 Office representation

An open question is **not work**. Under the §9 semantic behavior map it must never be rendered as
activity, progress, or collaboration. Its truthful representation is an attention signal plus an
inspectable record, and its forbidden implication is that a question in flight means work is
happening on it.

The spatial anchor — manager desk, the raising agent's station, the Project Library for contested
knowledge, or some combination — is a composition decision under D-02 and `.ui-craft/spec.md`.
**This specification does not choose one.** It requires only that the record has a spatial origin
and a link back, consistent with the §10 rule that every attention item locates its office entity.

### 2.6 Reciprocal projection — D-26

The agent-facing projection must let an agent discover, without inference from failure:

- questions addressed to its role;
- questions it raised, with their current disposition;
- open questions on the work item or knowledge it is acting under, including those raised by
  other participants, so it does not unknowingly build on contested ground.

The manager and agent projections must expose the same identity, subject, confidence, evidence,
and disposition. This is exactly the parity assertion the reciprocal gate already requires.

## 3. What this does not do

- It does not create a ticketing system. Questions attach to canonical subjects and are derived
  into attention; they are not an independent task database (MDD §10).
- It does not let agents block the manager. `blocksWork` describes the agent's own work.
- It does not change kickoff behavior. See the open decision below.
- It does not authorize implementation, schema migration, or any Phase 4 scope change.

## 4. Open decision for the owner

`KickoffContribution.uncertainties` and `.disagreements`, and `KickoffSynthesis.disagreement-
Register`, are the same concept in narrower form. Three options:

1. **Leave kickoff alone.** Open questions are a parallel mechanism. Zero risk to owner-accepted
   Task 13 code; two representations of one concept persist.
2. **Kickoff emits open questions in addition.** Contributions keep their string fields; recording
   a contribution also raises `OpenQuestion` records for each uncertainty and disagreement.
   Additive, no migration, some duplication of truth.
3. **Kickoff references open questions.** String arrays become `questionId` arrays. One
   representation, but it modifies approved contracts, the aggregate, the store, migration 003,
   and every Task 13 test.

Recommendation: **option 2**, and only after the base record exists and has earned its keep.
Option 3 is correct in the long run and premature now.

## 5. Verification plan if approved

RED–GREEN, sliced to at most five files per commit, matching the Task 13 shape:

1. Contract: validation, secret rejection, required `wouldBeResolvedBy`, closed enums.
2. Domain: disposition rules, silence never resolves, `deferred` requires `reviewBy`,
   manager-only `accepted_risk`/`rejected`, multiple dispositions retained.
3. Attention projector: new reason, ordering, `blocksWork` escalation, `neededBy` surfacing.
4. Persistence: immutable attributable records, restart recovery, project isolation.
5. Reciprocal contract: manager and agent projections expose identical fields.

No UI work is proposed. Office representation is deliberately deferred to a composition decision.

## 6. Argument against this proposal

The strongest case for rejecting it: this is scope creep during Phase 4, generated by an agent
observing its own friction rather than by a manager journey. The product's stated first proof is
a six-role software-development slice, and no journey in MDD §7 requires an open-question record.
Kickoff already handles the one case where structured disagreement was specified as necessary.

The honest counter is that CuckCode's stated purpose, per the owner on 2026-08-18, is to find and
fix agent-side problems — and this is one, found by the intended method, in the intended way.
That does not make it urgent. It makes it real. Sequencing is the owner's call.
