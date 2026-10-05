# Your Move — agent handoff package (2026-10-04)

Product name: **Your Move**. "CuckCode" remains the repo/codename only.

## Authority order (decisions in #1 win over everything else)
1. `surface-b-ui-spec.md` — every approved decision, truthfulness rule, and the round-decision log (§8).
2. `surface-b-app.html` — working prototype. Reference for **behavior**, not code to port. Implements rounds 2b–7.
3. `yourmove-round*.html` — visual reference for each approved round.
4. `studio-mockup.html` — Dusk palette visual reference.

## Do NOT port literally
- The Simulate buttons/controls (demo devices — implement the *states* they trigger, not the buttons), the in-memory log, the generic seed tasks, the "+3 days" clock.

## Architecture constraint (non-negotiable)
The UI is a **read-model projection of the event log only**. No new write paths. Every screen — calm screen, time-travel view, assignee lens — folds from the log. If a design needs a write path that bypasses the command path, the design loses; flag it instead of building it.

## Proposed event types (reconcile with the workflow core — the core is authoritative)
`evidence.rejected`, `work.turns_exhausted`, `work.turns_granted`, `work.rescoped`,
`work.closed_incomplete`, `work.deferred`, `work.resurfaced`, `work.nudged`, `ruling.withdrawn`.
Where the core already covers the semantics, use the core's events; where it doesn't,
propose the addition through the normal workflow-proof process. In particular `work.nudged`
and `ruling.withdrawn` (Round 7) sit in tension with the standing "no new event types" rule —
they are proposals awaiting ratification, not settled vocabulary.

## Suggested build order
1. Bring the existing core into full projection-only conformance.
2. Rounds 2b–5 (calm screen, scale/filtering, failure states, escalation detail).
3. Round 6 (master lamp, log time-travel, two-sided journey).
4. Round 7 (ruling session, away digest, nudge, undo, attestation, assignee lens, receipts).

## Done means
Every approved behavior in spec §8 is demonstrable against the real workflow core, and the
truthfulness rules (spec §5) hold under the failure drills — especially: no optimistic UI,
the log wins disagreements, and verified / recorded-but-unchecked / claimed stay distinct.
