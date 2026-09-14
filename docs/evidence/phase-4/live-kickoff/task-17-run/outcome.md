# Task 17 — the bounded live D-25 kickoff

Status: **COMPLETE. Attempt 2 ran the full thirteen-turn round on 2026-09-14.**
Evidence: `run-attempt-1.json` (stopped), `run-attempt-2.json` (complete). Both preserved.

Two provider runs were performed. The owner authorized attempt 1, and authorized exactly one
corrective rerun after attempt 1 stopped — the same disposition given to the Task 12 live contract
run on 2026-08-13, where attempt 1 failed on cleanup.

## Attempt 1 — stopped at turn 7 of 13

Six contributions accepted; the synthesis refused with `KICKOFF_SYNTHESIS_INCOMPLETE`. The run
stopped rather than repairing and everything before the stop is preserved.

**The cause was a defect in the prompt, not in the domain or the agents.** The Delivery Lead filled
`disagreementRegister[].roleId` with *contribution* identifiers, because the synthesis prompt said
"Include every contributionId" immediately before asking for the register and nothing distinguished
the two identifier kinds. The domain correctly refused a register attributing positions to documents
rather than to the roles holding them.

Corrected in the task contract and the prompt: `roleId` is named as a role identifier, the six valid
values are listed, and it is stated that it is never a contribution identifier. No domain, harness or
binding behaviour changed.

## Attempt 2 — complete

**13 turns used. 6 responded. 0 silent. 0 failures. Not stopped.**

- Six contributions, one synthesis, six revisions.
- Thirteen distinct turn indices and **thirteen distinct raw responses** — no replay. This is the
  live confirmation of the `waitForTurnCompleted` fix; without it every turn after the first would
  have returned turn one's output and the round would have looked successful anyway.
- Six bindings, six distinct material fingerprints, five roles on `gpt-5.6-luna` and
  `release-reviewer` on `gpt-5.6-sol`, all verified against the approved packet.
- **No external effect observed at any point** across either attempt. Containment held.

### The synthesis

The Delivery Lead **retained and revised** the seed rather than accepting or replacing it: a
manager-approval-gated versioned charter for an isolated component presenting exactly one
authoritative decision with traceable evidence links, severity, due date, and deterministic
acknowledge/defer outcomes.

Its disagreement register attributes positions to **all six roles**, and it records **ten unresolved
evidence gaps** — the manager and owner for charter approval are unidentified; the viewport, browser
and accessibility conformance matrix is unspecified; the decision fixture and provenance rules are
unspecified; acknowledge and defer semantics are unresolved; the severity taxonomy and due-date
handling are undefined.

### The revisions

Four amend, two affirm. The split is role-consistent and was not prompted:

| Role | Response | Substance |
| --- | --- | --- |
| delivery-lead | amend | every unresolved gap needs a named owner and blocks implementation |
| product-designer | amend | the charter must carry an explicit art-direction contract |
| implementation-engineer | amend | make the pre-implementation sequence explicit: charter and schema first |
| test-engineer | amend | require a criterion-to-test traceability matrix and a testability gate |
| visual-qa-reviewer | affirm | the visual-QA boundary is correctly preserved |
| release-reviewer | affirm | the gaps remain blocking until resolved in an approved charter |

The two reviewer roles affirmed and the four building roles amended — reviewers holding a boundary,
builders adding specifics. That is what distinct briefs producing distinct behaviour looks like.

## State

`phase: revision`, `implementationAllowed: false`. **No charter is approved and none can be by any
agent.** The round produced a proposed goal, an attributed disagreement register and ten open gaps,
and it stops there. Only the manager approves a charter.

## What this establishes

Six promoted roles bound, briefed identically, run concurrently under the packet's limits with
containment intact; genuinely distinct behaviour in live use; disagreement produced, attributed and
preserved rather than smoothed; a complete D-25 round inside the thirteen-turn budget; and a domain
that refuses a malformed synthesis rather than accepting it.

It does not establish anything about implementation. Nothing has been built, and nothing may be until
the manager approves a charter.
