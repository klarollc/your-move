# Specification: a canonical project position record (DF-001 to DF-003)

**Status: DRAFT 2026-09-28, for owner decisions S-1 to S-5.** Drafting authorized by the owner
2026-09-28. Implementation not authorized.

Author: agent. Sources: DF-001, DF-002, DF-003 in `docs/evidence/dogfood-register.md` (all
**open**); MDD D-26 (reciprocal usability) and §15 (deterministic context assembly).

## 1. The problem, as the register recorded it

- **DF-001.** Every session starts by reconstructing where the project stands from `README.md`,
  `AGENTS.md`, the MDD, plans, checklists, logs and `git log`. Position is derived, never stated.
  `docs/HANDOFF.md` and the agent's own memory notes are hand-kept, lower-fidelity versions of the
  context packet MDD §15 specifies for CuckCode's agents.
- **DF-002.** A checkbox cannot say "authorized but not started", "started, one slice landed",
  "done but not accepted". Those states had to be assembled from three files and the tree.
- **DF-003.** What the agent may do now is stated in prose in four places (AGENTS.md, the
  checklist's status line, the plan, the spec). They agree today; nothing makes them keep agreeing.

This session added fresh instances: the handoff was three days stale; the D-24 disposition was on an
unmerged branch while `main` still read as undisposed; and the cold-run interval rule ("nothing under
`apps/web/src` before the run") exists only as a sentence.

## 2. Proposal

One file, `position.json` at the repository root, validated by a schema and checked by tests
against the documents it summarizes. It is the first thing a joining agent reads, and it is shaped
as the object CuckCode's product would hand its own agents, so the repository becomes the prototype.

Sketch, as the tree stands today:

```json
{
  "schemaVersion": 1,
  "asOf": { "commit": "<the commit that last changed this file>", "recordedAt": "2026-09-28T23:00:00Z" },
  "phases": [
    {
      "id": "7-O",
      "state": "in_progress",
      "checklist": "tasks/phase-7-o-todo.md",
      "tasks": [
        { "id": "10", "state": "done", "gate": { "verify": "f1ca1be" } },
        { "id": "11", "state": "authorized", "runBy": "owner",
          "notBefore": "2026-10-01T21:50:00Z", "reason": "MDD §20 three-day interval from f1ca1be" },
        { "id": "12", "state": "pending_owner", "runBy": "owner" }
      ]
    },
    { "id": "7", "state": "specified", "spec": "docs/phase-7-high-fidelity-spec-v0.1.md",
      "authorizedAfter": ["7-O:12"] }
  ],
  "authority": {
    "authorized": ["docs and plans", "backend changes that do not change what the office shows"],
    "frozenPaths": [
      { "paths": ["apps/web/src/**", "packages/ui-system/src/**"],
        "until": "7-O:11", "reason": "MDD §20 cold-run interval" }
    ],
    "ownerRunOnly": ["evidence writes (phase5:provenance:write)", "live runs", "promotion"]
  },
  "pendingRulings": [
    { "id": "DF-030:provider_identities", "question": "Record a time, or keep the exemption?" }
  ],
  "dates": [{ "what": "Phase 5 D-24 review", "due": "2026-10-09", "state": "disposed" }]
}
```

Task states (DF-002): `proposed`, `approved` (plan approved, task not yet authorized), `authorized`,
`in_progress` (with the last landed slice's commit), `done` (gate passed, commit cited),
`pending_owner`, `accepted`, `blocked` (with who can resolve it — the same idea as DF-029).

## 3. What makes it more than another document

- **Checked against the checklists.** A test fails if a checklist task is missing from the record,
  if a `[x]` task is not `done` or `accepted`, or if a `done` task cites no gate commit.
- **Checked against git.** A test fails if a cited commit does not exist, or if `asOf.commit` is
  older than the newest commit that changed a checklist (the record went stale, as the handoff did).
- **Executable authority (optional, S-4).** A test fails if any commit after a freeze started
  touches a frozen path before its `until` task is done. The interval rule becomes a guard, not a
  sentence.
- **The handoff keeps its narrative** (why, lessons, traps) and loses its status table, which the
  record replaces.

## 4. Decisions needed

- **S-1, scope.** (a) **Recommended: the repository record first**, as the prototype, then a
  product specification (a position read model and authority record in the §15 context packet)
  after Phase 7-O, informed by what the prototype taught. (b) Product first.
- **S-2, which is primary.** **Recommended:** the record is primary for state and authority; the
  checklists stay primary for results and evidence prose; tests keep the two consistent.
  Alternative: generate the record from the checklists, which cannot express DF-002's states
  without new markup in every checklist.
- **S-3, the state vocabulary** above. Recommendation: as listed.
- **S-4, executable freezes.** Recommendation: yes, starting with the current interval rule, since
  it is live and costly to break by accident.
- **S-5, who updates it.** **Recommended:** the commit that changes a task's state updates its row,
  as with the register index; an agent session ends by checking the record is current. The owner's
  rulings are recorded by the agent in the same commit as the ruling's document.

## 5. Method, when authorized

Test first: the schema and the checklist-consistency test fail on the absent record; the record is
written from the checklists and verified; git and freeze checks follow, each with a mutation. Scripts
only (`scripts/`), plus the record; no application code, so it can be built during an interval.

## 6. Not in this specification

The product-side read model and its surface in the office (S-1 b, later); automating rulings;
changing the MDD's authority order (the record summarizes authority, it does not outrank the MDD).
