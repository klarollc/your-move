# Decision record — C-19 fidelity accepted by the owner

Date: 2026-09-14
Ruled by: owner
Evidence class: **human-visual-acceptance** (MDD §18, class 4)
Record: `docs/evidence/phase-5/c-19-owner-acceptance.json`

## The criterion

> The rendered component matches the art-direction contract for every state in the inventory.

Its testable assertion ends with the sentence that made this the one criterion no machinery could
close: **"Captures and diffs cannot satisfy the acceptance half."**

## What was looked at

The forty plates in `docs/evidence/phase-5/browser` — twenty contract states at both D-07 viewports —
presented as a contact sheet (`npm run phase5:contact-sheet`), each plate paired with the visual
treatment and non-colour cue the surface contract declared for it, and with the gap Visual QA
recorded as unsettleable from an accessibility tree.

Visual QA pass 2 marked **all twenty states `partial`**, stating for every one of them that the
visual treatment could not be judged from the tree it was given. That deferral is what this record
answers.

Every plate was verified against its manifest digest before the ruling was filed. A plate that had
drifted would make the ruling a statement about bytes that are gone; the recorder refuses in that
case rather than filing it, and the refusal was exercised before this record was written.

## The ruling

**Accepted.** No exceptions recorded.

## What was not supplied, and is therefore not claimed

The contact sheet keeps per-state marks in the viewer's own browser storage; they never reach the
repository. No per-state verdict was handed over, so the record does not contain one. Every state is
filed as `accepted-without-a-per-state-mark` under a whole-inventory acceptance, rather than as
twenty individual judgements that were never written down.

If the verdict block is supplied later, re-running the recorder with `--marks <file>` replaces the
blanket entries with the owner's actual per-state marks and notes.

## What this does not establish

- **Nothing about behaviour.** The behavioural claims about these states rest on the component and
  core tests. This record neither strengthens nor replaces them, and they do not substitute for it.
- **Nothing about what the component sounds like.** C-17 was waived the same day. No human listener
  has heard this interface.
- **Nothing about a future build.** The ruling is pinned to the forty plate digests in the record and
  says nothing about any capture taken after them.

## Consequence

C-19's human-visual-acceptance half exists for the first time. Whether the criterion is *satisfied*
remains a release-review judgement against the whole of its assertion, not something this record
asserts on its own.
