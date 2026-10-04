# Workflow proof W6: how posture reaches the office read model

Status: **for owner ruling.** Approves nothing. No code changed for this document.
Date: 2026-10-04. Plan reference: W6 in `docs/proposals/2026-10-03-workflow-proof-plan.md`, marked
**[OWNER]**.

## The question

W7 (list view), W8 (office affordance) and W9 (parity test) each need to show a work item's posture:
requested, granted and declared, side by side. They read `projectOfficeReadModel`, which refuses
any auxiliary record that supplies state, a condition, a blocker, an approval, evidence, attention
or a requested action. The plan offered two routes: fit posture into the auxiliary channel (a), or
rule an extension (b). Since the plan was written, W6a made posture a canonical event, which adds a
third route (c).

## What the code actually does today

- Auxiliary records are keyed by `entityId`, a person or a zone, not by work item or run. They carry
  `source`, `version`, `fixture`, `runtimeBinding` (untyped, `unknown`) and `permissions` (strings).
  They are not in the event log.
- Posture is now `posture.recorded` events in the log, reduced into `WorkTruthState.postures`: per
  work item, a history of `{ runId, posture, eventId, recordedAt }` in canonical order. The record
  has `requested`, `granted`, `declared`, `match` and `differences`.
- `OfficeWorkView` already carries `evidence`, `assignment`, `condition` and `approval`, each taken
  from the canonical snapshot, never from auxiliary input.

## The three routes

| | (a) Auxiliary channel | (b) Widen the auxiliary whitelist | (c) Project from the canonical snapshot |
| --- | --- | --- | --- |
| Where posture comes from | A separate record handed to the model | A separate record, with a new allowed key | The log, through `snapshot.work.postures` |
| Can it be checked against the log? | No. It sits outside it | No | Yes. It is the log |
| Keyed by | Person or zone | Person or zone | Work item and run, as recorded |
| Three layers kept apart | Only by stuffing them into an untyped `runtimeBinding` | Typed, but a new fact class enters through a side door | Typed, from the existing `PostureRecord` |
| Refusal rule | Unchanged | Weakened: the rule exists to keep facts out of this channel | Unchanged |
| Duplicates a fact the log already holds | Yes | Yes | No |
| Parity across surfaces (W9) | Each surface must be handed the same record | Same | Free: both surfaces read the same model |

**(a)** fits the stated channel only on paper. Posture is per work item and per run, the channel is
per entity, and `runtimeBinding` is untyped, so the three layers would be unvalidated JSON that
nothing ties to the log. It also leaves two sources for one fact, since W6a already records it.

**(b)** is the extension the plan anticipated. It gives typed posture but reopens exactly the
boundary Phase 7-O drew, and still duplicates the log.

**(c)** adds one field to `OfficeWorkView`, taken from canonical state the same way `evidence` is. It
widens no input and loosens no refusal: an auxiliary record that tries to supply posture is still
refused whole. Because posture is a measured, strict-schema event with no state in it, projecting it
does not let a surface manufacture a more reassuring state.

## Cost evidence

I prototyped (c) as a throwaway change: one added field, populated from `snapshot.work.postures`,
`[]` when none is recorded. `tsc -b` stayed clean and the 39 test files under `packages/application`
and `apps/web` (297 tests) all passed. The change was reverted, so nothing is in the tree. This
measures the breakage risk of an additive field and says nothing yet about the new behavior. The
full suite was not run for the prototype.

## Recommendation: (c)

Project posture from the canonical snapshot as a new `postures` field on `OfficeWorkView`. Posture
is already a fact in the log, so a second channel is the worse design on both counts that matter
here: it can disagree with the log, and it weakens a boundary that exists for good reason.

RED first, in `office-read-model.unit.test.ts`:

1. A work item with a recorded posture shows requested, granted and declared side by side, in
   canonical history order, with `match` and `differences` carried as recorded.
2. A work item with no posture event has an empty `postures`. The model never invents a posture or
   says "unknown" for the role.
3. A mismatch (`match: false`) reaches the view with its named differences, not summarized.
4. An auxiliary record carrying `posture`, `granted`, `requested` or `declared` is still refused
   whole with `AUXILIARY_FACT_REFUSED`.
5. No input to `projectOfficeReadModel` changes: the projection reads only the snapshot.

Touches `packages/application/src/office-read-model.ts` and its unit test only. No `apps/web/src`
change in W6, so the `apps/web/src` freeze is not engaged until W7.

## What this does not settle

- How the surfaces show history when a work item has several postures: latest only, or all. The
  read model carries all; the choice is W7's.
- Whether a posture whose `granted` layer differs from `requested` should raise attention. It does
  not here: the read model stays free of any new attention source. If you want that, it is a
  separate ruling.

## Decision needed

Rule (a), (b) or (c). I recommend (c).
