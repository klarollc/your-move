# Comprehension answer key

**Do not read this before completing `protocol.md`.** Opening it first voids the run.

Answers are drawn from the deterministic graybox fixtures in `apps/web/src/office-canvas.tsx`
and `apps/web/src/office-shell.tsx`. If a fixture changes, this key must change with it.

## T1 — Assignment and state

Six people, with these fixture states:

| Person | State |
| --- | --- |
| Delivery Lead | Available |
| Product Designer | Available |
| Implementation Engineer | Working on the approved graybox slice |
| Test Engineer | Reviewing deterministic tests |
| Visual QA Reviewer | Awaiting current-build evidence |
| Release Reviewer | Not yet requested |

**Pass** if each person is paired with a state close to the above in meaning, read from the
office or the outline without opening the inspector.

Furthest from needing you: **Release Reviewer** — "Not yet requested" is the only state that is
neither active, waiting, nor blocked.

**Fail** if states had to be guessed, if two or more people were conflated, or if the answer was
reconstructed from knowing the fixture.

## T2 — Attention

Two attention items, in derived priority order:

1. **Test evidence is blocked** — Test Engineer, reason `blocked`, priority 10.
   Plain language: "The Test Engineer needs the current browser evidence."
   Required action: "Redirect the evidence request or decline the blocker."
2. **Graybox review requested** — Implementation Engineer, reason `review_requested`, priority 40.
   Required action: "Approve, decline, defer, cancel, or redirect the request."

**Pass** if the blocked item is identified as the more urgent and a required action is stated in
the interface's own terms. **Fail** if the rail had to be hunted for, or if dismissal was
described as resolving the item — dismissal is explicitly not approval.

## T3 — Waiting versus blocked

- `permission-denied` — **missing**. A permission the run needs has been refused. Work cannot
  proceed regardless of what the manager does next until the permission question is settled.
- `offline` — **missing**, and additionally the workspace is not current. The cause line must not
  read "Canonical workspace revision 42 is current", and a Reconnect runtime action is offered.

**Pass** if both are read as impediments rather than as someone waiting on a manager decision,
and if the offline case is noticed to be showing stale rather than current state.
**Fail** if either was read as "waiting for me", or if the offline state was described as idle.

## T4 — Completed versus approved

**Nothing is approved.** The delivery area shows completed artifacts; the evidence surfaces label
lifecycle explicitly and completion is presented separately from approval. Approving would require
an explicit manager action recorded as an approval event — it cannot be inferred from completion
or from the artifact being present.

**Pass** if the answer is "no, nothing is approved" *and* the distinction is attributed to
something the interface said. **Fail** if completion was read as approval, or if the answer was
"I don't think so" without a stated basis.

## T5 — Evidence and next action

Fixture `?kickoff=revision`: six contributions, Delivery Lead synthesis.

- Proposal: **"Build the Decision Notice as the first isolated slice."**
- Dissent: **Release Reviewer** — "Independent review must stay separate from delivery."
- Not responded: **all six roles**. The revision round is open and no revision is recorded, so
  every role reads "No response recorded".
- Unresolved evidence gap: "No rendered evidence exists yet".
- Next required action: **a manager-approved charter.** The decision impact states "No work is
  authorised yet. A manager-approved charter is required first."

**Pass** if the proposal, the named dissenter, the absence of responses, and the charter
requirement are all read off the panel. **Fail** if silence was read as agreement, if the
dissent was summarised without attribution, or if work was believed to be underway.

## T6 — Truthfulness

**No, the team is not working.** Fixture `?kickoff=round` has three of six contributions and
synthesis blocked; the panel names the missing roles rather than implying consensus.

Signals that the office is showing recorded state rather than an animation of activity:

- states are specific and inspectable, and each names a cause and a freshness;
- the incomplete round names *which* roles are missing instead of showing a generic progress cue;
- nothing animates ambiently; motion appears only for a named transition at a named checkpoint;
- "No work is authorised yet" is stated rather than implied by absence.

**Pass** if the answer is "not working" and at least two truthfulness signals are named.
**Fail** if activity was inferred from the scene, or if the only basis given was "I know it's a
fixture" — that is knowledge from building it, not from reading it.

## Recording the result

Write the outcome into `run-<date>.md` beneath the responses, then record the count in
`docs/evidence/phase-4/red-green-log.md` under Task 15. Record a fail as a fail; the study exists
to be capable of failing.
