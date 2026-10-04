# Phase 7 Task 6 — furniture per zone: detail plan

**Status: OWNER-APPROVED 2026-10-03. Task 6 implementation authorized by separate breakdown approval.**
The owner approved this detail plan in chat. It follows the approved Phase 7 specification, approved
Phase 7 plan, and owner-approved art-gap direction. Entry conditions are satisfied by the Task 5 clean
verification result and separate owner approval of the Task 6 task breakdown.

**Date:** 2026-10-03  
**Governing slice:** Phase 7 Task 6, after Task 5/5b closes and before Task 7 figures.  
**Visual review target:** approved AR-01 with AR-04's preserve/avoid rules.

## Outcome

Make each of the seven existing zones read as a purposeful part of a calm contemporary studio by
refining its existing furniture and adding a small number of functional, static props. Keep the
approved isometric floor, camera, zone polygons, hit regions, anchors, and Active
`reconciliation-b-clarity` palette. Furniture must describe place and affordance; it must not claim
that an agent is present, working, collaborating, waiting, blocked, or finished.

This is one furniture slice with small RED–GREEN–REFACTOR increments. It does not claim the whole
office meets the art target. Task 7 figures, Task 8 labels/state cues, Task 9's capture matrix, and
Task 10's owner visual acceptance remain necessary.

## Evidence and observed gaps

- The approved AR-01 reference hash is still
  `1f0a29c7dd89ac39153540a1fd5de6fd0b4ee85e2dc969580d20f51c8e617fdd`.
- Task 5b's owner-reviewed current-build capture is
  `docs/evidence/phase-7/architecture-b/chromium-1440/default-office.png`; its owner review was
  “slice meets expectations”. The second approved viewport is in the same `architecture-b` slice.
- Compared with AR-01, the room shell and fixed daylight now read. The strongest remaining Task 6
  gaps are: workstations have box-like tops and screens without recognizable seating or small work
  materials; the collaboration stools read as blocks; library storage lacks shelf divisions and
  books; delivery containers and review surfaces lack their material/use cues; counters and desks
  lack grounded fronts, edges, and legs; and the broad floor and plants have little material detail.
- The approved seven-zone list has no lounge. MDD §9 / Phase 7 F-4 do not authorize adding one.
  Do not cut raster objects from the art pack; it is visual guidance, not an asset source.

## Scope

### In scope

1. A small deterministic SVG furnishing kit: layered top and edge, restrained legs/front panel,
   chair seat/back/base, monitor and keyboard details, divided shelf with book spines, blank paper
   and tray forms, table legs, a quiet floorboard cue, fuller simple foliage, and textile detail on
   the already-anchored rug.
2. A zone-to-furniture inventory for the existing seven zones:

   | Zone                | Furnishing direction                                                                                                                                                    |
   | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Reception           | Refine the existing counter into a legible low reception/work surface with a grounded front and edge; at most one small neutral tray.                                   |
   | Manager desk        | Refine the existing desk with an edge/front and a small paper/work-surface cue; keep the existing board quiet and unmarked.                                             |
   | Project library     | Turn the existing shelf into a divided shelf with a few varied blank book spines; retain the low cabinet as storage.                                                    |
   | Team area           | Refine the four existing agent desks and add one unoccupied chair per station; add only a restrained monitor/keyboard or paper detail where it clarifies a workstation. |
   | Collaboration table | Give the existing table a clear top, edge, and legs; replace block-like stools with a small, balanced set of empty chairs and a few blank work materials.               |
   | Delivery            | Refine the existing boxes into orderly shallow document trays/containers; no status labels or completion marks.                                                         |
   | Review station      | Refine both existing agent desks as review surfaces with a few blank sheets or neutral sample cards; no ticks, stamps, scores, or readable claims.                      |

3. Reuse only existing Active palette roles and current type choices. Keep material cues low-contrast:
   warm wood surfaces/edges, charcoal supports, off-white paper/plaster, muted textile, and the
   existing restrained greenery. Add no new semantic color or numeric design token.
4. Keep all new shapes static, decorative to assistive technology, and behind the existing
   accessible labels and interaction targets.

### Out of scope

- Moving/resizing the floor, zone polygons, desks' canonical anchors, agents, labels, hit regions,
  camera, zoom stops, or walls/windows/light.
- Adding a lounge, zone, partition, office area, or any behavior-map/state cue.
- Figures or agent presence, travel, collaboration signals, workflow badges, live artifact previews,
  readable document text, checkmarks, stamps, logos, progress, or completion claims.
- New tokens, palette changes, font changes, raster/sprite imports, use of AR artwork as source
  material, baseline promotion, or edits to earlier evidence.
- Fixing the known long-label collision at inspector zoom; track it for Task 8. This slice must
  prove that its furniture does not add a collision with labels, published targets, or hit polygons.

## Implementation sequence after approval

Do not begin until Task 5 has a clean owner-run `verify` exit and the owner has approved this plan
and the Task 6 task breakdown. For every behavioral/structural assertion below, first add a failing
test that fails for the intended missing furniture/contract, then implement, then refactor without
changing the output contract.

### Proposed change boundary

- `packages/ui-system/src/scene/geometry.ts`: only add/adjust static prop kinds or anchors if the
  approved furniture inventory requires them. Do not change `ZONES`, agent anchors, entity
  polygons, or camera inputs.
- `packages/ui-system/src/scene/render.ts`: render the approved furniture and material details;
  keep architecture and dynamic state cues in their existing separate paths.
- `packages/ui-system/src/scene/furniture.unit.test.ts` (new): deterministic inventory, bounds,
  painter order, material/piece contracts, and static-layer invariance.
- `tests/e2e/phase-7-furniture.spec.ts` (new) or an explicitly listed existing Phase 7 e2e spec:
  browser-level label/target clearance, decoration/accessibility, state-invariant furniture, and
  both accepted viewport sizes. The Task 6 checklist will name the final chosen spec before code.
- `tests/visual/phase-7-active-office.spec.ts`: change only the slice identifier from
  `architecture-b` to `furniture` and add non-writing assertions needed to establish the captured
  slice. Never overwrite prior evidence.
- Update `tasks/phase-7-todo.md`, `position.json`, and `docs/HANDOFF.md` only at their applicable
  approval/evidence gates. If an additional path is needed, stop and amend the approved task scope
  first.

### 6.0 — Freeze the inventory and occupancy model

- Record each existing prop/workstation anchor and its owning zone from `scene/geometry.ts`.
- Define a deterministic per-shape footprint/bounds description for tests; derive projected bounds
  through the existing isometric transform instead of hand-entered screenshot coordinates.
- Define exclusions for visible label plates and published label anchors. Preserve
  current labels and targets byte-for-byte where applicable.
- RED: a furniture/zone inventory assertion fails for the known missing chair, shelf, and surface
  detail. GREEN: the inventory includes only approved zone IDs and stays inside each zone's safe
  interior and the existing floor/camera frame.

### 6.1 — Establish the shared furniture primitives

- Extend the existing SVG piece-building path in `packages/ui-system/src/scene/render.ts`; add only
  the minimum prop metadata in `scene/geometry.ts` if new chair/tray anchors are needed.
- Keep layer order explicit and deterministic: floor/zone, rear supports, furniture bodies,
  surface objects, then the existing entity/label interaction projections.
- RED: tests reject a missing/flat edge, missing chair back/seat/support, missing shelf divisions,
  unstable ordering, or non-deterministic SVG. GREEN: reusable pieces draw from existing palette
  fields, expose bounded geometry, and add no text or event handlers.
- Refactor repeated shapes into named helpers only after the tests pass; keep the rendered result
  fixed through refactor.

### 6.2 — Make the team workstations read as workstations

- Refine all four existing `deskPiece` outputs consistently: readable top/edge, understated support,
  and a small monitor/keyboard or neutral work-material cue where it does not compete with the
  future figures or labels.
- Add one empty, static chair to each workstation. Chair orientation follows its own desk, not role
  identity; chair shape/color never encodes an agent state or demographic.
- RED: each of the four desks lacks its chair/support/work-surface structure. GREEN: all four are
  distinguishable as workstations; furniture bounds avoid labels and preserve the anchor and
  target geometry.

### 6.3 — Clarify the shared collaboration place

- Refine the existing collaboration table with an edge and visible legs; replace the two block
  stools with a restrained, balanced set of empty chairs placed within the collaboration zone.
- Add at most a few unmarked paper/material forms, sized to remain subordinate to the table.
- RED: the table lacks legibility as a shared surface and seating. GREEN: it reads as a place for
  people to gather without implying that anyone is currently collaborating.

### 6.4 — Give library and review their distinct functions

- Divide the existing library shelf into a few calm compartments and add varied, blank book spines;
  preserve the existing cabinet and plant anchors.
- Refine both review workstations with a small number of blank paper/sample forms that read as
  surfaces for examining material; avoid document thumbnails, content, approval marks, or scores.
- RED: tests fail when shelf structure/books or neutral review materials are omitted. GREEN: the
  library reads as shared storage and the review zone as a place to inspect work, with no implied
  canonical knowledge or review outcome.

### 6.5 — Refine reception, manager, and delivery furnishings

- Add quiet front/edge/support definition to the existing reception and manager counters; keep the
  manager board unmarked and the surfaces sparse.
- Turn delivery's existing box forms into shallow, orderly containers/trays with neutral paper
  edges. Their arrangement stays identical in every workflow state.
- RED: specific shape/structure assertions fail for the current undifferentiated blocks. GREEN:
  the three zones are differentiated by furniture silhouette and materials alone.

### 6.6 — Ground materials, rug, and foliage

- Add sparse, low-contrast floorboard seams/value variation over the existing floor and zone fills,
  clipped to the current floor interior and drawn below furniture. Keep the canonical floor and
  zone polygons and their fills unchanged. Seams must not resemble a grid, metric, or added zone
  boundary.
- Refine the existing rug with a quiet textile edge and a small amount of texture; do not add a new
  rug footprint or extend the current one into another zone.
- Refine each existing plant using a few overlapping leaf silhouettes and a grounded pot, reusing
  the existing greenery/wood palette fields. Keep the foliage simple and within its zone's safe
  interior.
- RED: tests fail when a floor mark escapes the floor polygon, furniture order changes, or the
  existing rug/plant no longer has its bounded footprint. GREEN: floor seams are deterministic and
  subordinate; the floor remains open; plants read as foliage at both viewports without growing
  into labels or interaction geometry.

### 6.7 — Cross-zone regression and simplification

- Assert all furniture is inside its canonical zone's approved safe interior and floor/camera bounds;
  catch any overlap with existing visible label boxes; preserve transparent target geometry and operability at
  both approved viewport scales and inspector-open zoom. Keep the known label-to-label Task 8 issue
  recorded without broadening this task.
- Assert fixed furniture SVG is byte-identical across ready, stale, offline, partial, conflict,
  blocked, waiting, unknown, and collaboration fixture states. Furniture cannot react to state.
- Assert deterministic painter order, decorative accessibility treatment, no additional focusable
  node, no animated element, and no added text/status glyph.
- Add mutation checks that move a chair/tray into a label or zone boundary and prove the relevant
  occupancy/clearance assertion fails.
- Add mutation checks for floor seams outside the floor mask and excess plant/rug bounds.
- Inspect density beside AR-01 and AR-04's avoid column. Remove details that do not clarify the
  zone or that make the scene toy-like, noisy, dashboard-like, or harder to read.

## Verification and owner gate

1. Run focused scene tests after each increment. Then run formatting, lint, type checks, relevant
   unit/component/integration/contract/e2e/a11y/visual suites, provenance and production build as
   applicable to the approved task breakdown.
2. Obtain a clean owner-run `verify` on the committed, clean tree through the visible agent runner.
   A test count or local container run is not a substitute for its clean result.
3. Only after implementation is stable, change the visual spec's `SLICE` constant to `furniture`
   and have the owner run the existing capture recipe (new path; never overwrite `architecture/` or
   `architecture-b/`) at 1440×900 and 1280×800. Verify both hashes against new provenance entries;
   the agent does not regenerate owner evidence.
4. Review current-build screenshots side by side with AR-01 and AR-04. Directly exercise the
   keyboard path, reduced-motion setting, and current Chromium console/network at the approved
   viewports. Record exactly what was exercised and any visible defect; do not infer these checks
   from tests or screenshot diffs.
5. Stop for the owner's plate review before Task 7 figures begin. Record the owner's exact words
   and any remaining gaps. Do not call the office art-complete from this slice; Task 10 is the
   explicit Phase 7 visual acceptance gate.

## Task 6 acceptance criteria

- All seven existing zones have furniture that distinguishes their use, using static, semantically
  neutral vector art and the Active palette; floor, rug, and existing plant treatments add quiet
  material grounding without adding zones or changing canonical geometry.
- No zone, camera, world anchor, label, keyboard target, canonical state projection, or accessible
  interaction contract changes.
- No furniture intersects a visible label plate, floor boundary, or approved camera
  frame at either viewport/required zoom; the test demonstrates RED via a deliberate overlap
  mutation.
- The office remains quiet and open, with visual emphasis on the room and future truthful people;
  no decorative object claims work state, evidence, collaboration, or completion.
- Clean owner-run verification passes; owner-run captures and provenance are sound; browser,
  keyboard, reduced-motion, and console/network checks are recorded; the owner reviews the plate.

## Risks and mitigations

| Risk                                                   | Mitigation                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detail becomes toy-like or noisy.                      | Keep one restrained kit, low-contrast materials, sparse surface objects, and compare against AR-01/AR-04 at each slice.                                |
| A static chair or paper is mistaken for live activity. | No figures, readable marks, state color, motion, or state-dependent furnishing; assert byte-identical furniture across states.                         |
| Added forms obscure labels or targets.                 | Project shape bounds and test against existing DOM labels, anchors, hit geometry, both viewports, and inspector zoom; prove the guard with a mutation. |
| A prop forces a camera or layout change.               | Keep each prop within the current zone and frame; reduce or omit the prop rather than move canonical geometry.                                         |
| Task 6 is mistaken for Phase 7 acceptance.             | Stop after owner plate review; Task 7–10 remain and only Task 10 can accept the full visual target.                                                    |

## Approval requested

The owner approved this Task 6 scope, sequence, boundaries, and acceptance criteria as written on
2026-10-03. The clean Task 5 gate and separate Task 6 task-breakdown approval still precede any
Task 6 source or test changes.

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
