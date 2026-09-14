# Task 17 — the one bounded live D-25 kickoff

Status: **RUN PERFORMED 2026-09-14. Stopped at turn 7 of 13.** The approved allowance is spent.
Evidence: `run.json` in this directory — full transcript, bindings, and the stop.

## What ran

Six persistent Codex threads, one per promoted role, each isolated in its own controlled home
carrying only its composed brief and the credential. Read-only sandbox, `approvalPolicy: never`, no
tools, text-only. Every binding verified against the approved Task 16 packet: five roles on
`gpt-5.6-luna`, `release-reviewer` on `gpt-5.6-sol`, all at `medium`, protocol `0.146.0`, six
distinct material fingerprints.

**No external effect was observed at any point.** Containment held.

## What succeeded — the claim this project exists to test

**All six contributions were accepted.** Six distinct agents, distinct briefs, substantively
different positions:

- Four roles chose `proposal`; the **two reviewer roles both chose `critique`** — unprompted, and
  exactly the disposition their briefs describe.
- **14 disagreements and 32 uncertainties** recorded across the round.
- Every role named the "a green suite is not approval" risk in its own terms rather than a shared
  phrasing: the Test Engineer on assertions that restate inputs and skipped tests, the Visual QA
  Reviewer on screenshot diffs without named states, the Release Reviewer refusing certification on
  evidence with no claim-to-artifact mapping.

Six agents under one briefing produced six different readings and recorded where they disagreed.
That is the D-25 claim, demonstrated live rather than asserted.

## What failed, and whose fault it is

The synthesis was refused: `KICKOFF_SYNTHESIS_INCOMPLETE` at turn 7. The run stopped rather than
repairing, and everything before the stop is preserved.

**The cause is a defect in the prompt, not in the domain or the agents.** The Delivery Lead populated
`disagreementRegister[].roleId` with *contribution* identifiers — `contribution_test-engineer`
instead of `test-engineer`. The domain requires each disagreement to be attributed to an active role
and correctly refused a register that attributed positions to documents rather than to the roles
holding them.

It did that because the synthesis prompt said "Include every contributionId" immediately before
asking for the register, and the two identifier kinds sat adjacent with nothing distinguishing them.
The agent followed the nearest instruction.

Fixed in `phase4-kickoff-briefing.ts` and `run-phase4-kickoff.ts`: the task contract now states that
`roleId` is a role identifier, lists the six valid values, and says explicitly that it is never a
contribution identifier. The misleading sentence is gone.

## What this run does and does not establish

**Establishes:** six promoted roles can be bound, briefed identically, and run concurrently under the
packet's limits with containment intact; the roles are genuinely distinct in live use; disagreement
is produced and recorded rather than smoothed; the domain refuses a malformed synthesis rather than
accepting it; a stopped run is preserved as evidence.

**Does not establish:** that a complete thirteen-turn D-25 round can run end to end. Turns 7 through
13 — the synthesis and all six revisions — never happened. There is no charter, and Phase 5 has
nothing to execute.

## Disposition

The single approved live allowance is spent. A corrective rerun is a second provider run and
**requires explicit owner authorization**, as it did for the Task 12 live contract run on 2026-08-13,
where attempt one failed on cleanup and the owner authorized exactly one corrective rerun.

The fix is a prompt correction with no behavioural change to the domain, the harness, or the bindings.
