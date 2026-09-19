# Decision record — the human screen-reader walkthrough is out of scope

Date: 2026-09-18
Ruled by: the owner, in session, asked to choose the width of the exclusion and choosing the
narrowest of three options offered
Amends: MDD section 19, Decision 5-D (the walkthrough half only), C-17
Overlay: `docs/evidence/phase-5/acceptance-contract-scope.json`

## The ruling

CuckCode is a single-user tool and its one user does not use a screen reader. The obligation to
perform a human screen-reader walkthrough is retired. C-17 is excluded from the acceptance contract
by overlay, MDD section 19's walkthrough requirement is withdrawn going forward, and Phase 8 no
longer inherits it.

## Out of scope is not met

No brief, verdict, packet or summary may count C-17 as satisfied. **What a screen reader announces
for any CuckCode surface has never been verified**, by anyone, at any point in this project. That
was true under the waiver, it was true under the 2026-09-18 met disposition, and it is true now.
The only thing that changed is that nobody is required to find out.

`formatC17Status` in `scripts/phase5-release-brief.ts` enforces this: the scope overlay outranks
both the waiver and the met disposition, and the wording it emits says the criterion is out of
scope, that this is not satisfaction, and what remains unverified. RED first — the assertion failed
against the two-argument function that reported "met by owner disposition" instead.

## What remains in scope, deliberately

- **The 46 automated accessibility tests, including every axe scan.** They catch ordinary markup
  defects and have found real ones in this project. They stay in the gate.
- **Keyboard operability.** The owner uses a keyboard. The 2026-09-18 `aria-disabled` change was a
  keyboard-reachability fix and stands on its own merits, unaffected by this ruling.
- **Accessible names, roles and semantic structure.** The C-09 state matrix and the surface
  contract both depend on them; removing them would break criteria nobody is retiring.

Two wider options were offered and declined: dropping screen-reader support as a product
requirement entirely, and retiring the accessibility suite along with it. The narrow cut was taken.

## What is preserved, not rewritten

The waiver, the met disposition, the walkthrough record with its five findings and its omissions,
and the three release-review passes that refused to certify against C-17 all stand as the record of
what was decided when. This ruling is prospective from 2026-09-18. Rewriting an accepted artifact
to match a later decision is the mutation behind D4-P-001 and D4-P-003, and the overlay exists so
that it is not done here.

The walkthrough's findings were addressed on their own terms before this ruling and are not
withdrawn by it: SR-03 and SR-04 were one defect and are fixed, SR-02 and SR-05 are reclassified as
artifacts of entering a state directly, and **SR-01 remains unresolved** pending a re-walk with the
surface recorded. That re-walk is no longer obligatory. If it never happens, SR-01 stays open in the
record rather than being closed by the scope change.

## Why this was worth doing rather than leaving alone

Three release-review passes spent turns refusing to certify a criterion the owner had already
decided he did not intend to satisfy, and a fourth would have done the same. A contract that asserts
a requirement nobody means to meet does not protect anything; it converts every future review into
a re-derivation of an objection that has already been answered. The cost of the ruling is one
overlay and five document amendments. The cost of not making it recurs per review.

## Open and unruled

The visible `role="alert"` channel still produces no change on a repeated identical refusal — the
sighted half of DF-019. That one affects the owner directly and is not touched by this ruling.
