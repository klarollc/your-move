# Phase 7 Task 6 — proposed task breakdown

**Status: OWNER-APPROVED 2026-10-03 — implementation authorized.** This breakdown implements the
owner-approved `tasks/phase-7-task-6-plan.md`. Task 5's clean `verify` on `a582953` passed. The owner approved source and test edits within this breakdown.

## Entry conditions

- Task 5/5b clean owner-run `verify` passes on the clean `a582953` commit.
- The owner-approved Task 6 detail plan is recorded in the repository.
- The owner approves this task breakdown.
- The approved AR-01/AR-04 pack hashes still match the local reference files.

Each implementation task follows RED–GREEN–REFACTOR: capture the expected failing assertion,
implement the smallest change that makes it pass, then refactor without changing rendered output.
Keep the office static and state-neutral throughout this task.

## Tasks

### 6.1 — Inventory, zone ownership, and test fixtures

- Record the existing prop and workstation anchors against the seven canonical `ZONES`.
- Add a deterministic projected-footprint test helper and baseline assertions for floor bounds,
  zone ownership, unchanged entity polygons, labels/anchors, and camera inputs.
- Add the first RED tests for the missing workstation chairs, shelf detail, and useful work-surface
  cues. Include overlap and safe-inset mutation cases.
- **Expected result:** tests identify the missing furniture contracts while confirming the existing
  canonical geometry and interactions remain fixed.
- **Likely files:** `packages/ui-system/src/scene/geometry.ts`, new
  `packages/ui-system/src/scene/furniture.unit.test.ts`.

### 6.2 — Reusable furnishing kit and team desks

- Add bounded, deterministic helpers for tabletop/edge, restrained supports, chair seat/back/base,
  monitor/keyboard, blank paper/tray, and surface/leg details.
- Refine all four team workstations and add one empty static chair to each.
- Test shapes, geometry bounds, stable painter order, and unchanged agent/label anchors.
- **Expected result:** each team station reads as furniture and remains clear of names, targets,
  and safe insets; chairs do not imply actual agent presence.
- **Likely file:** `packages/ui-system/src/scene/render.ts`, plus the Task 6 unit test.

### 6.3 — Collaboration table and seating

- Refine the current shared table's edge/support and replace block-like stools with a balanced,
  bounded set of empty chairs.
- Add only a few unmarked shared materials if they survive the clearance checks.
- **Expected result:** the furniture affords gathering without showing or claiming a current
  collaboration event.
- **Likely files:** `geometry.ts` only if new static anchors are needed; `render.ts`; unit test.

### 6.4 — Project library and review station

- Divide the existing shelf into a few compartments and add a small varied set of blank book
  spines; retain the existing cabinet and plant anchors.
- Refine the two review surfaces with a few blank sheets/sample forms, without document content,
  stamps, ticks, scores, or sign-off marks.
- **Expected result:** storage and review are distinguishable by affordance alone, with no asserted
  knowledge or review outcome.
- **Likely files:** `render.ts`, unit test.

### 6.5 — Reception, manager, and delivery surfaces

- Add quiet front/edge/support details to the two counters/desks, leaving the manager board
  unmarked.
- Refine delivery's current containers into orderly, shallow trays with neutral paper edges.
- **Expected result:** these three spaces read as reception, management, and delivery through
  silhouette and material, not state or text.
- **Likely files:** `render.ts`, unit test.

### 6.6 — Floor material, existing rug, and plants

- Add sparse floorboard marks over existing floor/zone fills, clipped to the unchanged floor
  polygon and below furniture; preserve all polygon paths and zone fills.
- Refine only the current rug footprint with quiet textile edge/detail.
- Add a few simple leaf silhouettes to existing plant props using current palette roles.
- **Expected result:** the broad floor, rug, and plants gain restrained material grounding without
  looking patterned, noisy, or expanded into new zones.
- **Likely files:** `render.ts`, unit test.

### 6.7 — Cross-zone regression and browser review

- Assert every furnished zone is within canonical bounds, with deterministic draw order and no
  furniture overlap of visible label plates; preserve canonical transparent targets and prove their operability.
- Check both viewports and inspector-open zoom; preserve the separately tracked Task 8
  label-to-label collision unchanged.
- Compare the static furniture layer across ready, stale, offline, partial, conflict, blocked,
  waiting, unknown, and collaboration fixtures. Assert no additional text, focus, event handler,
  or animation is introduced.
- Mutate a chair/tray into a label/boundary and floor seams outside the floor mask; prove each
  relevant guard fails.
- Add browser-level checks for the final DOM/SVG and no new console/network errors.
- **Expected result:** all guards fail for their intended defect and pass after the fix; existing
  accessibility/keyboard/reduced-motion behavior remains intact.
- **Likely files:** new `tests/e2e/phase-7-furniture.spec.ts` or a specifically selected existing
  Phase 7 e2e spec; `packages/ui-system/src/scene/furniture.unit.test.ts`.

### 6.8 — Clean gate, owner captures, and plate review

- Run the approved focused and full verification commands; require a clean owner-run `verify` on
  the committed tree through the visible runner.
- Update the existing visual spec's `SLICE` constant to `furniture`; do not overwrite earlier
  evidence. The owner captures both approved viewports and provenance is checked against the new
  hashes.
- Directly perform and record browser console/network, keyboard, and reduced-motion checks at the
  approved viewports.
- Present the current build beside AR-01 and AR-04; record the owner's exact review. Stop before
  Task 7 figures until that review is captured.
- **Expected result:** the furniture slice is verified and reviewable. This is not full Phase 7
  acceptance; Task 7–10 remain, and Task 10 is the art-acceptance gate.
- **Likely files:** `tests/visual/phase-7-active-office.spec.ts`; owner-run evidence under the new
  `docs/evidence/phase-7/furniture/` slice; checklist/status files after the gate.

## Final task gate

All seven zones read through quiet, static furniture and material cues; the Active palette and
canonical geometry/state remain unchanged; bounds, clearances, painter order, state invariance,
accessibility, and browser checks pass; the clean runner gate and owner evidence are complete; the
owner has reviewed the furnished plate. Do not start Task 7 until that last review is recorded.

The plan's approval is separate from this task-breakdown approval. Both are separate from approval
of the full Phase 7 art outcome.

## Owner ruling — 2026-10-03

The owner instructed: orchestrate Luna subagents to complete Task 6 and consider this approval of
the proposed implementation breakdown. This authorizes 6.1–6.8 within the plan boundaries. The
final browser spec is tests/e2e/phase-7-furniture.spec.ts. Owner-run evidence, clean verification
and the owner's plate review retain their separate execution and acceptance boundaries.

## Owner-approved clearance correction — 2026-10-03

The owner approved this narrow correction in chat: preserve hit polygons exactly, keep furniture
behind their transparent targets, prove targets remain operable, and require no furniture overlap
with visible label plates. This supersedes literal nonintersection with hit geometry and published
transparent targets in the original wording: zone targets cover their floors and person targets
cover their desks by design. Bounds, safe-inset, camera, visible-label and mutation guards remain.

## Owner-approved opt-in scope amendment — 2026-10-03

The owner approved adding apps/web/src/office-canvas.tsx for the single furniture: true option,
and updating the existing renderer unit test's parity assertion for the intentional furniture
addition. A distinct furniture option keeps frozen Phase 6 output unchanged and avoids coupling
furniture to Task 5's architecture option. No other behavior or path change is authorized.

## Owner-approved existing desk overlay — 2026-10-03

Browser checks confirmed person-label anchors are at the center of the existing tabletops. The
owner approved retaining this existing desk-under-own-label relationship only. Label plates remain
opaque and above all art. Every added chair, paper, plant detail, rug mark, and floor seam must
avoid every label plate. This is not a general exemption for new furniture or foreign labels.
