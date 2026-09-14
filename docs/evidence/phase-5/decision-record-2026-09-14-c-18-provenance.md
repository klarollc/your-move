# Decision record — C-18 provenance, the sidecar ledger

Date: 2026-09-14
Ruled by: owner
Closes: charter gap 3
Schema: `docs/evidence/phase-5/provenance/schema.json`
Ledger: `docs/evidence/provenance.jsonl`

## The question put

Where artifact provenance and supersession should live. The charter dispositioned gap 3 as **design
work inside Phase 5 Task 2, not an owner decision** — and Task 2 closed without producing it, which
is why C-18 sat at `blocked-on-gap` through three release reviews.

The state of provenance before this ruling: nine different ad-hoc field names — `assessedVersions`,
`artifactVersions`, `previousPasses`, `supersedes`, `responseSha256`, `sourceDigests`,
`decisionRecord`, and two spellings of a timestamp — spread across fifteen files. The other two
hundred and sixty-three had nothing.

Four options were put: a sidecar append-only ledger, an in-band envelope on every artifact, both
split by date, or deriving provenance from git and descoping C-18.

## The ruling

**Sidecar ledger, append-only.** Retention: nothing is pruned, ruled in the same breath.

## Why

Recording that an artifact has been superseded, in the artifact itself, means writing into a file
whose owner gate has already closed. That is the mutation behind defects D4-P-001 and D4-P-003, and
the evidence-immutability guard exists to stop it. Appending a line mutates nothing.

The repository had already converged on this shape four separate times without naming it:
`amendments.json`, `focus-contract.json`, `journeys.json` and `pass-2-crosscheck-correction.json` are
all records placed *beside* an artifact rather than into it. The ruling makes the existing practice
the rule.

The split option was rejected for a specific reason: it would have put a date boundary between two
mechanisms, and "a guard is exact inside a boundary nobody examined" is DF-010 through DF-015.

## What was found while building it

- **A field named for a relation it does not express.** `amendments.json` carries
  `"supersedes": ".../surface-contract.json"` and does not supersede it — it amends two names in a
  contract that stays authoritative and stays cited everywhere. Deriving a supersession edge from
  that field would have marked the live contract superseded and then forbidden every honest citation
  of it. Supersession is therefore derived from the `pass-N` convention only, and the schema records
  the field it deliberately ignores.
- **The guard caught its own author on the first run.** `schema.json` named
  `verification/verification.json` — a superseded pass — inside a field the enforcement did not
  recognise as historical. The fix was to name the field for what it holds
  (`supersededPassAliases`), not to widen the exemption until the file passed.

## What this does not claim

Forty-three artifacts, almost all of them from phases 0 to 4, are recorded with
`producerKind: "unknown"`. No code in the tree writes those files and their authorship is recorded
nowhere, so the ledger states that the origin is not established rather than inventing one. Whether
a ledger with forty-three unknowns satisfies C-18's *"every evidence artifact"* is a release-review
judgement. It is not asserted here.

C-18 moves from `blocked-on-gap` to `ready`. Ready means assessable, not met.
