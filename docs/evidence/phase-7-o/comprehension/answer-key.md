# Phase 7-O comprehension answer key

**Do not read this before every answer in the response sheet is written.** Opening it first voids
the run (`protocol.md`, rule 2).

Authority: MDD §20; Phase 7-O spec §8.7; `tasks/phase-7-o-todo.md` Task 10. Written 2026-09-28
against the build that adds this file.

**Every fact quoted below is asserted on the rendered interface** at its task URL by
`tests/e2e/phase-7o-comprehension-key.spec.ts`, which runs inside `verify`. The key was written
from the rendered text, not from the fixture source. If the interface changes, that spec fails and
this key must change with it, which changes its SHA-256 and so the protocol preamble.

A criterion passes only if the written answer is correct **and** the operator did not mark it as
answered from memory of building the interface.

## T1 — Assignment and state

Office `/`. Scene labels and outline:

| Person                  | State shown                | Work held, from the inspector                                         |
| ----------------------- | -------------------------- | --------------------------------------------------------------------- |
| Delivery Lead           | Idle                       | None ("Work is not assigned")                                         |
| Product Designer        | Idle                       | None                                                                  |
| Implementation Engineer | Waiting · Needs you        | "Waiting for your review of Deliver the approved graybox slice"       |
| Test Engineer           | Blocked · Needs you        | "Blocked on Provide current browser evidence"                         |
| Visual QA Reviewer      | Waiting                    | None; "Nothing needs you"                                             |
| Release Reviewer        | Idle                       | None                                                                  |

Furthest from needing you: **any of the three Idle people** (Delivery Lead, Product Designer,
Release Reviewer), or the answer that they tie. The Visual QA Reviewer is also acceptable if the
answer rests on "Nothing needs you". Naming the Implementation Engineer or the Test Engineer fails.

**Pass** if all six states are right and the two held work items are named in substance.
**Fail** if a state was guessed, two people were conflated, or the Visual QA Reviewer's "Waiting"
was read as waiting on the manager.

Recorded limitation, not a scoring rule: the scene and outline show states only; the work each
person holds is one step away, in the inspector.

## T2 — Attention

Office `/`. The bar reads "1 blocked · 1 review". The rail shows one item at a time:

1. **"Provide current browser evidence: blocked"** (1 of 2). "The Test Engineer needs current
   browser evidence; the recorded capture failed on an earlier build." Manager action: "Redirect
   the evidence request or decline the blocker."
2. **"Deliver the approved graybox slice: review requested"** (2 of 2). "The graybox slice is ready
   for the manager's disposition." Manager action: "Approve, decline, defer, cancel, or redirect
   the request."

**Pass** if both items are found and a requested action is stated in the interface's terms for at
least the first. **Fail** if only one item was found, or if Dismiss was described as resolving an
item: dismissing hides it from the rail and records nothing.

## T3 — Missing versus waiting on you

- `/?state=stale` — **information is missing; nothing says anyone is waiting on you now.** The bar
  reads "Updates unavailable"; the notice: "Updates unavailable. What the office shows is as last
  confirmed at 09:00 UTC; current activity is unknown." Every person reads "Status unknown", and the
  rail refuses a disposition: "Refresh the current workspace before recording a disposition."
  **Pass** if read as not current / unknown. **Fail** if read as people working, idle, or as a
  decision you can make now.
- `/?state=permission-denied` — **waiting on you.** The bar reads "Permission blocked"; the notice:
  "The required permission request was denied; the agent did not continue." The Test Engineer is
  "Blocked · Needs you"; its inspector's Why: "The permission to run the browser capture was
  denied; the Test Engineer stopped." What needs you: "Review the permission boundary, then redirect
  or cancel the work." **Pass** if the Test Engineer is read as blocked and the next move as the
  manager's permission decision. An answer of "missing: a permission" passes only if it also says
  the decision is yours. **Fail** if read as waiting on another agent or on evidence.
  _Changed from the Phase 4 key_, which called this "missing": the recorded condition now names the
  manager as what the work waits on.
- `/?state=partial` — **information is missing** for two people. The bar reads "Partially
  available"; the notice: "Two agent records are unavailable; four current records remain
  visible." The Visual QA Reviewer and the Release Reviewer read "Unavailable". The other four are
  current, so the Test Engineer and the Implementation Engineer still need you as on `/`.
  **Pass** if the two unavailable people are read as unknown, not idle or stopped, and the rest as
  current. **Fail** if "Unavailable" was read as waiting on you.

## T4 — Completed versus approved

Office `/`, Delivery area: "No activity is recorded here.", with "Open Project Library".

**Nothing is approved.** In the Library's Evidence lanes, Unit and Visual evidence read "Complete —
not approved", and Browser evidence reads "Failed". The Implementation Engineer's inspector reads
"Approval: Not approved"; the Test Engineer's reads "Not approved: browser evidence missing".
Approving the graybox slice takes an explicit manager disposition on the review request (Respond,
then Approve, with a reason), recorded as a decision.

**Pass** if the answer is "no" with a basis the interface stated, and approval is described as an
explicit manager action. **Fail** if completion or passed evidence was read as approval.

## T5 — Evidence and next action

`/?kickoff=revision`, opened from the Collaboration table or the Manager desk ("Open collaborative
kickoff").

- Proposal: **"Build the Decision Notice as the first isolated slice."** (briefing and Delivery
  Lead synthesis).
- Dissent: **Release Reviewer**, "Independent review must stay separate from delivery".
- Not responded: **all six roles**, each "No response recorded".
- Unresolved evidence gap: "No rendered evidence exists yet".
- Next required action: **a manager-approved charter.** "No work is authorised yet. A
  manager-approved charter is required first."

**Pass** if proposal, named dissenter, the absence of responses and the charter requirement are
all read off the panel. **Fail** if silence was read as agreement, the dissent was unattributed,
or work was believed to be under way.

## T6 — Truthfulness

`/?kickoff=round`, then `/`.

**No, the team is not working.** The kickoff panel reads "Synthesis is blocked. No entry yet from
Test Engineer, Visual QA Reviewer, Release Reviewer. Consensus is not inferred from an incomplete
round." and "No work is authorised yet. A manager-approved charter is required first." On `/`, no
person is shown working: three Idle, two Waiting, one Blocked.

Signals the interface gives that it shows recorded state, not an animation of activity:

- the incomplete round names which roles have not contributed, and says consensus is not inferred;
- "No work is authorised yet" is stated;
- states are specific, and each held item's Why names who reported it and when ("Reported by the
  system (verified). Recorded …");
- no ambient animation plays in the office;
- when updates are unavailable the office says so and shows "Status unknown" (seen in T3).

**Pass** if "not working" and at least two of these signals are named. **Fail** if activity was
inferred from the scene, or the only basis was "it is a fixture".

## Scoring

MDD §20: six of six met; five of six met with the failure recorded as a named finding; four or
fewer not met. Score only tasks marked performed at the time. A task not performed leaves the run
incomplete and neither passes nor fails.
