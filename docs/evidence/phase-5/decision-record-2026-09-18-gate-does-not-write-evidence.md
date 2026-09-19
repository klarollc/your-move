# Decision record — a verify stage reads committed evidence, it does not write it

Date: 2026-09-18
**Decided by the agent under owner delegation.** The owner said to follow the agent's
recommendation on this item rather than ruling it himself. Recorded this way deliberately: a later
reader should be able to see whose judgement it was, and it should not wear the owner's name.
Related: DF-018, D4-P-001, D4-P-003, C-11.

## What this changes

`npm run phase5:sideeffects` now **checks** and refuses; `npm run phase5:sideeffects:write`
regenerates. `verify` runs the checker, so the gate no longer writes into `docs/evidence` at all.

## Why, beyond the timestamp

Removing `ranAt` earlier today made this artifact's bytes stable and the gate idempotent. That fix
was correct and insufficient: idempotence became a property of the output happening to be
deterministic, which the next field someone adds removes again — silently, with the failure
surfacing one stage early on a later run, which is precisely how DF-018 hid for four days.

The repository already states the rule this script was breaking. Browser captures route through
`tests/support/evidence-output.ts` and reach `docs/evidence` only under
`CUCKCODE_REGENERATE_EVIDENCE=1`, and HANDOFF says not to add a second write path. But
`scripts/evidence-immutability.test.mjs` enforces that against browser **specs** only, so a builder
in `scripts/` was never in scope for a rule it violated. A guard exact inside a boundary nobody
examined — the recurring defect, one more time.

## Evidence

RED first, with a deliberate stub returning `{ ok: true, reason: "CURRENT" }` unconditionally so the
first failures would be assertions rather than a missing export. Two of three new assertions failed
on `toEqual` against that stub — a drifted artifact and a missing artifact both reported current.
The third passed, which is the stub agreeing with itself and evidence of nothing; it is recorded as
such. GREEN after implementing the comparison.

## The consequence, stated rather than discovered later

Regenerating this artifact is now deliberate. If the scan's inputs legitimately change — a new
module reachable from a declared entry point, say — `verify` fails with `artifact: "STALE"` and a
named remedy until someone runs `phase5:sideeffects:write` on purpose. That is the intended
behaviour and it is also the one way this change can irritate its owner, so it is written down here
rather than left to be found.

## Not done

The same treatment for the other five artifacts carrying a write-only `ranAt`
(`phase-5/browser/determinism.json`, the two `isolation.json`, the two
`isolation-deliberate-failure.json`). They do not break the gate today because they are written
through the guarded capture path. That is a property of the guard, not of the artifacts, and
extending the rule to them is unruled work.

Nor does this widen `evidence-immutability.test.mjs` to police builders as well as specs, which is
the test that would make this rule structural instead of observed. Also unruled, and the more
valuable of the two.
