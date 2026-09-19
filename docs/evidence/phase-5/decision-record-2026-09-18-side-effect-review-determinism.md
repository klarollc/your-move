# Decision record — the side-effect review's digested body carries no wall-clock field

Date: 2026-09-18
Ruled by: the owner, in session, after the defect was demonstrated
Criterion touched: C-11 (static half). Artifact: `docs/evidence/phase-5/side-effect-review.json`
Related: DF-018, DF-013, D4-P-001, D4-P-003

## What was found

`npm run verify` could not pass twice in a row, and had been in that state since 2026-09-14.

Stage 16 is `phase5:provenance` in check mode. Stage 17 is `phase5:sideeffects`, whose builder
rewrites `side-effect-review.json` unconditionally, and the only field that changed between runs was
`ranAt`, a wall-clock timestamp inside the digested body. So every completed gate moved that
artifact's digest and guaranteed the next gate would fail one stage before the stage that caused it,
in a previous run. The residue was a permanently modified file in the worktree that three sessions
read as an evidence problem rather than a gate problem.

Nothing reads `ranAt`. It is write-only in this artifact and in five others that share the pattern.

## The ruling

Option 1 of two. The wall-clock field leaves the digested body. When the artifact was produced is
recorded by the ledger entry, which already carries `recordedAt`, and that is where run metadata
belongs. The artifact's content is now its findings, so its digest moves only when a finding moves.

The rejected option was declaring the producer so that a re-record by it is an expected append. That
would add a ledger line for every `verify` run forever and would make "the digest changed" stop
meaning anything for this artifact class. Reordering the two stages was considered and rejected as
insufficient on its own: the ledger would still hold an older digest.

## Evidence

**RED, recorded as an observation and not re-run after GREEN.** The projection was first extracted
from `scripts/build-phase5-side-effect-review.ts` into `composeSideEffectReview` in
`scripts/phase5-side-effect-review.ts` with `ranAt` deliberately retained, so the first failure would
be an assertion rather than a missing export. `npx vitest run --project unit
scripts/phase5-side-effect-review.unit.test.ts` reported 12 passed, 1 failed, the failure being
`C-11, DF-018: the same inputs produce the same bytes across a clock tick` on
`expect(second).toBe(first)`, with a diff showing only `ranAt`, nine milliseconds apart.

The assertion is idempotence rather than the absence of a named key. A key-absence check would pass
on an artifact that embedded a timestamp under another name, and it would not catch the next
nondeterministic field. It is asserted across a deliberate two-millisecond tick because a
same-millisecond comparison passes on the broken version — the mutation has to be observed to land
before a survivor is believed.

**GREEN.** 13 passed. The builder's summary is unchanged: 36 modules scanned, 2 external packages,
zero findings across network, credential, deployment, destructive and paid.

**The extraction is proven a no-op, by prediction before the fact.** The committed artifact was 4498
bytes. Stripping only the `ranAt` line from it predicts 4459 bytes at sha256
`ec57002a283dfabf436992715cc185d5c0bce88c6bfe7bcd1760cb293375870b`. The regenerated artifact is
4459 bytes at that exact digest, and `diff` against the prediction is empty. The change removed a
field and altered nothing else.

## What this does not fix, and is not ruled

`scripts/build-phase5-side-effect-review.ts` writes directly into `docs/evidence/` with no
regeneration gate. HANDOFF states that browser captures route through
`tests/support/evidence-output.ts` "and nothing else" and that a second write path must not be
added; `scripts/evidence-immutability.test.mjs` enforces that only against browser specs, so this
script was never in scope for the rule it violates. Removing `ranAt` makes the writes byte-stable
and the gate idempotent, but a `verify` stage still rewrites committed evidence on every run, which
is the class of thing behind D4-P-001 and D4-P-003. Whether an evidence builder inside the gate
should write at all, or check and refuse as `phase5:provenance` does, is open and unruled.

Five other artifacts carry the same write-only `ranAt` field: `phase-5/browser/determinism.json`,
the two `isolation.json` files, the two `isolation-deliberate-failure.json` files. They do not break
the gate today because they are written through the guarded path, which only reaches the evidence
tree when `CUCKCODE_REGENERATE_EVIDENCE=1`. That is a property of the guard, not of the artifacts.

## Acceptance

Two consecutive `npm run verify` runs, both green. One green run is what existed before and it
established nothing about idempotence.
