# Decision record — retracting a derived supersession edge, and supersession within a class

Date: 2026-09-19
Ruled by: the owner, in session, after the state of the ledger was demonstrated
Criterion touched: C-18. Artifacts: `docs/evidence/phase-5/provenance/schema.json`,
`docs/evidence/provenance.jsonl`
Related: DF-012, DF-015, P-3, P-4

## What was found

`docs/evidence/provenance.jsonl` states that `phase-5/release-review/pass-5.json` is superseded by
`pass-8.json`, and that `pass-1.json` through `pass-4.json` are superseded by `pass-8.json` rather
than by `pass-5.json`.

Passes 6, 7 and 8 are not review passes in any sense that matters. Each carries `"verdict": null`,
`turnsSpent: 1`, and an `attempts` entry of `TURN_COMPLETION_INVALID`; pass 8 records
`stream disconnected before completion` against the ChatGPT Codex backend. They are records that an
attempt was made and produced nothing, and they are correct as such. What is wrong is the
supersession derivation applied to them: `derivePassSupersessions` orders every `pass-<N>.json` in a
directory and supersedes all but the highest, so each failed attempt silently retired the verdict
below it.

The consequence is not cosmetic. P-3 forbids a current artifact citing a superseded one, so the
ledger — the instrument C-18 exists to make authoritative — held that the current release verdict
was a failed connection attempt, while `docs/HANDOFF.md` cited pass 5 as current. Both could not be
right. This is DF-012's shape once more: a gate reporting closed while open, correct at every moment
anyone inspected the code, wrong at the boundary nobody examined. It was found by reading the
ledger, not by anything failing.

## The ruling

Four parts, ruled together.

**1. A retraction op.** `unsupersede` is added to the ledger vocabulary. It withdraws a supersession
edge that should never have been derived. It is keyed on the **pair** — the artifact and the thing
said to supersede it — and not on the artifact alone. Keying it on the artifact would exempt that
artifact from supersession permanently, so a later pass that genuinely replaced it could not say so.
Pair-keying means a future `pass-5 -> pass-9` edge is a different pair, emitted normally.

**2. Reader semantics.** An artifact's superseding artifact is the last edge naming it that has not
been retracted. Retracting a wrong edge therefore falls back to the earlier correct one rather than
dropping the artifact out of the superseded set — which is what restores `pass-1` through `pass-4`
to `pass-5` rather than leaving four passes spuriously current.

**3. Supersession applies within a class.** A pass supersedes an earlier pass only when both carry
the product their review exists to produce, or neither does. Failed attempts form their own
sequence: 6 is superseded by 8, 7 is superseded by 8, and none of them touches a pass that carries a
verdict. This is the structural half of the ruling, and it is what stops the next failed attempt
from recreating the defect and needing another hand-written retraction.

**4. What "carries a product" means is declared, not sniffed.** The three review schemas name their
product differently: `cuckcode.phase5-release-review.v1` carries `verdict`,
`cuckcode.phase5-verification.v1` carries `assessment`, `cuckcode.phase5-visual-qa.v1` carries
`annotation`. The map from schema id to product field is declared in the schema document, and a pass
whose schema is not in the map is **refused** rather than defaulted in either direction.

Fifteen edges are retracted: every edge from a pass that carries a verdict into a pass that does
not. Three edges are kept — `pass-6 -> pass-7`, `pass-6 -> pass-8`, `pass-7 -> pass-8` — because
under the class rule they are the correct relation.

## Rejected options

**Editing or rewriting the ledger.** P-4 exists because an append-only record that can be rewritten
is a mutable record with extra steps. The wrong lines stay; a retraction is an append.

**Retracting by artifact rather than by pair.** Simpler to implement and it would have made `pass-5`
permanently unsupersedable. The bug would have become a property of the artifact.

**Deciding "carries a product" from the `status` string.** Every failed pass begins
`NOT ACCEPTED.`, so a prefix test would work today. It is the greps-prose defect named in the
handoff: it passes on whatever phrasing it is handed and fails silently on the next wording.

**Excluding verdictless passes from the ordering entirely,** so that they neither supersede nor are
superseded. It retracts the same fifteen edges but leaves passes 6 and 7 current alongside 8, which
misdescribes three attempts at the same thing.

## What this ruling does not do

It does not change the content of any artifact. It does not alter the pass-5 verdict, which remains
the historical `NEEDS WORK`, 20 of 21, of 2026-09-14. It does not make Phase 5 eligible for owner
approval, and it is not an independent release-review refresh — that still requires a working
runtime connection. It restores the ledger's ability to say which artifact is current, and nothing
more.

## Evidence

Run in the container mirror described in the handoff, against an independent install. **Container
results, not final verification** — the Windows `npm run verify` is the gate.

**RED, recorded as an observation and not re-run after GREEN.** `UnsupersedeEntry` and its parse
branch were landed first as a deliberate stub — `supersededArtifacts` left ignoring retractions and
`derivePassSupersessions` given its `classOf` parameter and told to ignore it — so the first failure
would be an assertion rather than a missing export. `npx vitest run --project unit
scripts/phase5-provenance.unit.test.ts` reported **5 failed, 29 passed**: the fallback case, the
retract-the-only-edge case, and all three class cases, each on a value comparison. A second RED for
`retractedEdges`, stubbed to return an empty set, reported **1 failed**.

**Three of the new cases passed on the stub** — pair-keying, a pair re-asserted after its retraction,
and the P-6 reach check. They are recorded in the file as mutation checks rather than as evidence of
new behaviour, because a test that passes before the change is evidence that an exemption was not
widened, and nothing else.

**GREEN.** 36 tests in that file, 395 across all 58 unit files, `tsc -p tsconfig.scripts.json`
clean, prettier clean.

**The retraction itself.** Before appending, the five release-review passes that leave the P-2
exemption were re-digested against the ledger's records: all five matched
(`1449e62ef6f6`, `5b6d36e5fbec`, `a09c3359e057`, `626177d818ed`, `c0228c18de8e`). Fifteen
`unsupersede` lines were appended, and `appendOnlyViolation` was checked against the prior text
before the write. Resulting state: pass-1 through pass-4 to pass-5, **pass-5 current**, pass-6 and
pass-7 to pass-8, pass-8 current.

`npm run phase5:provenance -- --write` then appended two record entries — this decision record, and
the amended schema — and **no supersession edges at all**, which is the fallback working as ruled:
the derivation wants pass-1 through pass-4 to point at pass-5, and after the retraction the ledger
already says so. `ok: true`, 392 lines, 15 retractions, zero stale digests, zero superseded
citations, zero declaration conflicts, zero unclassified passes, and a second check run reported the
same, so the stage is idempotent.

**What this evidence does not establish.** The class rule was exercised against the sixteen pass
files that exist. No new review kind has been added since, so the refusal path for an undeclared
schema has unit coverage and no field exercise. And `authorizedBy` is required to be a non-empty
string; it is not resolved against the tree, so a retraction citing a decision record that does not
exist would be accepted.
