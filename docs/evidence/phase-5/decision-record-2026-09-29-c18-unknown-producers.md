# Decision record: unknown producers and C-18

Date: 2026-09-29. Owner: "yes", to the question "Do the provenance ledger's unknown producers
satisfy C-18?"

## The facts the ruling rests on

The question was asked with the handoff's figure, 44 unknown producers, which dated from
2026-09-14. The live ledger (`npm run phase5:provenance`, 2026-09-29) reads **363 recorded
artifacts, 99 with `producerKind: unknown`**:

| Evidence tree | Unknown |
| --- | --- |
| `phase-7-o` | 36 |
| `runtime` | 16 |
| `phase-4` | 15 |
| `phase-2` | 7 |
| `phase-0` | 6 |
| `phase-5` | 6 |
| `phase-1` | 5 |
| `phase-3` | 4 |
| other | 4 |

C-18 is a Phase 5 acceptance criterion ("every evidence artifact" carries provenance). Its
Phase 5 subset is 6 artifacts.

## Ruling

The ledger's unknown producers satisfy C-18: each artifact is recorded with its digest, and an
unknown producer is stated as unknown rather than guessed. The ruling is scoped to C-18 and to
Phase 5 acceptance. It does not say that unknown producers are acceptable for evidence produced
from now on.

## Not ruled

The 36 `phase-7-o` artifacts are owner-run captures recorded after the Phase 7-O plan left "a
`phase-7-o` provenance producer rule" out of scope. Every new capture adds to that count. Whether
to add the rule is a separate decision.

**Ruled the same day (owner: "yes"):** `scripts/build-phase5-provenance.ts` gains a producer rule
for `phase-7-o/browser/`: the owner-run `tests/visual/phase-7o-office-captures.spec.ts`, authorized
by the Phase 7-O specification approval. A dry run before writing matched exactly the 30 capture
files and nothing else. The comprehension files and decision records under `phase-7-o` stay
unknown; no rule was asked for them.
