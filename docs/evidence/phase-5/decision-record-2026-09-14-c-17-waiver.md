# Decision record — C-17 waived by the owner

Date: 2026-09-14
Ruled by: owner
Amends: Decision 5-D
Overlay: `docs/evidence/phase-5/acceptance-contract-waivers.json`

## The question put

Whether to perform the screen-reader walkthrough C-17 requires, and what it would establish.

The owner asked directly whether the step verifies anything the agents need. It does not. The
Decision Notice is a fixture; nobody will use it with a screen reader because nobody will use it.
Under Decision 5-A the agents did not write it. What C-17 was for is narrower: it is the only
criterion in the contract where the owner is the load-bearing part, and it guards the failure mode
where a criterion nobody wants to perform is quietly satisfied by adjacent evidence — forty-four
passing axe assertions sitting right there, ready to be called good enough.

Three options were put: a bounded walkthrough of roughly fifteen minutes, a full walk of all nine
journeys, or a recorded waiver.

## The ruling

**Waived.** Recorded as a waiver, not as a met criterion.

## Why this is not the Phase 4 failure repeated

The Phase 4 walkthrough was committed to, then not performed, and the gate closed on owner authority
with the shortfall written down afterwards. The artifact that records it
(`phase-4/comprehension/screen-reader-walkthrough.md`) is blunt about it: *"No screen reader was ever
attached to this interface."*

This is a waiver ruled before the gate rather than discovered after it, with its shortfall stated in
the same document that grants it. That is a legitimate governance act. It is still a waiver, and the
packet must read as one.

## What the phase may no longer claim

- No human listener has ever heard this interface.
- The nine focus destinations are asserted by tests and unconfirmed by ear.
- MDD §19's walkthrough requirement is unmet in two consecutive phases, and Phase 8 inherits it.
- W5 and W6 from the Phase 4 waiver remain open.

## What survives the waiver

The property Phase 5 was actually testing was whether the governance holds when a criterion is
inconvenient. It held. Three release-review passes ran against this build and all three refused to
certify, each naming C-17 unmet; none of them reached for the axe results. The system did not
self-certify around the gate — the owner elected not to walk it. Those are different facts and the
evidence packet must keep them apart.

## Consequence

C-17 is reported as **waived by owner** wherever criterion status is reported, never folded into a
satisfied count. `acceptance-contract-waivers.json` is an overlay beside the frozen contract; the
contract itself is not edited.
