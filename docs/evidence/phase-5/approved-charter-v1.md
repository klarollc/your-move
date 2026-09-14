# Approved charter v1 — Decision Notice

Status: **APPROVED BY THE OWNER 2026-09-14**, with the ten evidence gaps as blocking conditions.
Version: 1
Origin: the Task 17 bounded live D-25 round, `docs/evidence/phase-4/live-kickoff/task-17-run/run-attempt-2.json`
Ruling: `docs/evidence/phase-5/decision-record-2026-09-14-phase-5-authorization.md`

## The goal, as the round produced it

Quoted verbatim from the Delivery Lead's synthesis. It is not paraphrased, because the point of the
round was that the agents produced it:

> Retain and revise the Decision Notice seed into a manager-approval-gated, versioned charter and
> acceptance contract for an isolated, accessible component presenting exactly one authoritative
> decision with traceable evidence links, severity, due date, and deterministic acknowledge/defer
> outcomes; require criterion-linked RED/GREEN behavioral evidence, deterministic success and failure
> browser evidence, current-build visual evidence at explicitly approved viewports and browsers,
> accessibility verification, isolation/no-side-effect verification, artifact provenance and
> supersession tracking, and an independent release review that concludes only needs-work or
> eligible-for-owner-approval.

The round **retained and revised** the seed rather than accepting or replacing it, which is what D-23
invites and what makes this a charter rather than a restatement.

## Amendments folded in

Four roles returned `amend`; all four amendments are part of this charter.

| Role | Amendment |
| --- | --- |
| delivery-lead | Every unresolved gap carries a named owner and blocks implementation |
| product-designer | The charter must carry an explicit art-direction contract |
| implementation-engineer | The pre-implementation sequence is explicit: charter and schema approved first |
| test-engineer | A criterion-to-test traceability matrix and a testability gate are required |

The Visual QA Reviewer and the Release Reviewer returned `affirm`, both on the condition that the
gaps remain blocking. That condition is honoured by this charter.

## The ten gaps and their disposition

| # | Gap | Disposition |
| --- | --- | --- |
| 1 | Approving manager and owner unidentified | The project owner, in both roles |
| 2 | Viewports, browsers, a11y standard, AT coverage | D-07 matrix; WCAG 2.2 AA; **one screen reader, walkthrough performed** |
| 3 | Fixture schema, provenance, retention, supersession | Task 2 design work, on the Phase 2 content-address and immutability patterns |
| 4 | Acknowledge/defer semantics | Mutually exclusive; defer needs a future date and a reason, validated; both reversible; **undo is an event** |
| 5 | Severity taxonomy and date handling | `routine`/`significant`/`critical`; ISO-8601 UTC stored, locale-rendered; unknown severity and malformed date are **named explicit states** |
| 6 | Evidence links under no-network | Local fixture artifacts, resolved in-session; missing, invalid and unavailable each render a named state; **nothing external is fetched** |
| 7 | Art direction and state inventory | The Active system `reconciliation-b-clarity`; inventory is Task 3 and covers every state the contract names |
| 8 | Failure evidence, console/network, isolation | Task 6, reusing the Phase 4 patterns |
| 9 | Reviewer independence and identity | **Structural under 5-A**: a human implements, the promoted `release-reviewer` reviews |
| 10 | Ordering of charter approval vs current-build evidence | Sequential, not conflicting: charter → contract → RED → build → capture |

## Binding conditions

1. **No implementation begins before Task 2's acceptance contract exists.** This charter authorizes
   the work; it does not start it.
2. **An unanswered gap blocks the criterion that depends on it.** Gaps 3, 7 and 8 are dispositions to
   *produce* an answer, not answers themselves.
3. **Completion is never approval.** The Release Reviewer returns needs-work or
   eligible-for-owner-approval, and only the owner accepts.
4. **60 turns.** The run stops at the budget and reports what was reached.
5. **No external effect.** Isolated fixture, controlled session, no network, no deployment.

## What this charter deliberately does not claim

Under Decision 5-A the agents do **not** write the implementation. Phase 5 will therefore not
establish that this team can produce code — only that it can govern work to a standard an independent
reviewer accepts. The Phase 5 evidence packet must state that limit rather than let the phase read as
the stronger result.
