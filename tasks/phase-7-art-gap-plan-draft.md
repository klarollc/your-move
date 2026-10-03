# Phase 7 office art-gap implementation plan

**Status: OWNER-APPROVED 2026-10-03 for Task 5b only.** The owner approved this plan as written in chat. It elaborates the approved Phase 7 specification and plan into the remaining visual slices. Each later slice still needs its required owner approval and plate review; Task 6 planning follows Task 5b's owner capture and review.

## Objective

Bring the current SVG office toward the approved AR-01–AR-04 visual contract while preserving truthful state projection, the Active `reconciliation-b-clarity` system, the approved isometric floor and camera, and the accessible DOM equivalent. “Meets the art spec” means the owner accepts current-build evidence against the named plates; it does not mean copying a generated image pixel-for-pixel.

## Evidence reviewed

- Owner captures: `docs/evidence/phase-7/architecture/chromium-{1440,1280}/default-office.png`.
- Approved targets: `output/art-reference-2026-09-27/ab-reference-v1/01-office.png` through `04-preserve-avoid.png`; the four image hashes match `docs/art-reference-approval-2026-09-27.md`.
- Current requirements: `docs/phase-7-high-fidelity-spec-v0.1.md` (F-1–F-8), `tasks/phase-7-plan.md`, `tasks/phase-7-todo.md`, `.ui-craft/brief.md`, `.ui-craft/tokens.md`.

The reviewed app captures are the owner-generated Task 5 captures, not a new browser run. Visual findings below are planning observations, not a replacement for current-build QA or owner acceptance.

## Gap register

| Gap                                                                     | Evidence                                                                                                                                                              | Planned response                                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window-wall inner face is too grey; front cut tops read too dark/heavy. | Owner identified and agreed with these notes beside AR-01 on 2026-10-03.                                                                                              | Task 5b: wall-only lighter face treatment and mid-grey cut tops, retaining the fixed sun direction and the furniture palette.                     |
| Zone labels sit on the wall/window.                                     | Owner identified this beside AR-01; labels currently use the zone back-corner anchors.                                                                                | Defer placement and styling together to Task 8, as the handoff recommends; do not move them twice.                                                |
| Daylight patches have hard geometric edges.                             | Current captures show four crisp polygons; AR-01 and F-6 call for fixed soft daylight.                                                                                | Add a deterministic, state-invariant vector softness treatment in the shell slice, subject to owner approval.                                     |
| Furniture reads as sparse blocks rather than a working studio.          | Current captures have mostly blank cuboids; chairs, detailed shelving, desk equipment, paper/material props and textiles are missing or too slight relative to AR-01. | Task 6: build reusable vector furniture/material details by existing zone, without changing the floor plan or implying workflow state.            |
| No people appear in the application scene.                              | Current captures have zone/person labels but no figures; Task 3b deliberately deferred figures to avoid false presence.                                               | Task 7: add deterministic modular figures mapped only from canonical behavior/presence.                                                           |
| Person labels use large amber capsules for manager-needed states.       | Current captures give amber fill to multiple long labels; AR-01/AR-03 reserve amber for manager questions, while blocked work is neutral.                             | Task 8: use restrained neutral name/state plates and separate amber request markers from blocked/unknown presentation. Preserve text equivalents. |
| Labels can collide when the inspector is open.                          | Handoff records about 155 px between two desks at zoom 0.875 versus a 180 px label maximum; existing overlap coverage is default-view only.                           | Task 8: deterministic alternate anchors and collision checks at default and inspector-open camera transforms at both approved viewports.          |
| Room surfaces and props have little material character.                 | Current walls and floor are flat fills; the shelves, plants and desk objects have little silhouette or edge detail.                                                   | Task 6: restrained wood, plaster, textile, paper and foliage detail using authored SVG primitives and existing approved colors.                   |
| Header copy says “truthful graybox office.”                             | Visible in both current captures; reads as internal staging language beside AR-01’s project-workspace framing.                                                        | Task 8 polish: replace with the real fixture/project-workspace label already supported by the model; do not invent a product name.                |
| Selection/focus styling is not demonstrated by the default captures.    | AR-02 requires clear selection and evidence drill-down; default screenshots cannot establish this behavior.                                                           | Verify the current interaction first; add a subtle selected/focused scene treatment only if the browser evidence shows it is absent or unclear.   |
| Final visual acceptance evidence does not exist yet.                    | Task 9/10 remain open; no full Phase 7 state matrix, measured contrast/frame-time record or owner acceptance is recorded.                                             | Task 9 capture/evidence gate, then Task 10 owner review against AR-01–AR-04 and V2 dispositions.                                                  |

## Constraints

- Keep the current Phase 6 floor, zone geometry, camera limits and hit regions. Do not add zones, rotate the camera, or re-layout the office to imitate the raster plate.
- Author deterministic SVG geometry in the repository. Do not crop, trace or ship the approved concept images as product assets.
- Reuse the Active palette and approved Fira Sans/Fira Mono families. New numeric palette/type tokens or material directions require owner approval.
- Furniture and decoration cannot occlude names, targets, evidence, or keyboard interaction. Decorative detail cannot assert progress, collaboration, presence or completion.
- Lighting and architecture stay identical across workflow states. Amber is for actual manager requests; blocked dependency, unknown status and stale data remain distinct in text and appearance.
- Every behavior change follows RED–GREEN–REFACTOR. Never replace prior owner captures; write new, provenance-linked evidence.

## Ordered implementation slices

### Gate 0 — Owner ruling recorded 2026-10-03

The owner approved the recommendations below as written:

1. **Wall faces:** approve the wall-only light-side adjustment proposed in the handoff (approximately −8%/−4% shade treatment), with no change to furniture shading.
2. **Cut tops:** approve a mid-grey cap instead of charcoal.
3. **Labels:** defer both position and style to Task 8.
4. **Daylight:** soften the hard-edged patches in Task 5b using fixed vector gradients only, with no color-token changes.
5. **Evidence path:** use a new `phase-7/architecture-b/` capture slice so the owner-reviewed Task 5 evidence remains intact.

This ruling authorizes Slice 1 (Task 5b) only. Task 6 remains gated on Task 5b verification, owner captures and plate review, followed by its own plan approval.

### Slice 1 — Task 5b: finish the room shell

**Likely files:** `packages/ui-system/src/scene/styles.ts`, `render.ts`, `architecture.ts`, `architecture.unit.test.ts`, `tests/e2e/phase-7-architecture.spec.ts` (split if the approved change exceeds the repository’s small-slice limit).

1. Add RED assertions proving the plaster-only face treatment, neutral cap, fixed light, and state-invariant architecture; keep a mutation that restores the current heavy/grey treatment and prove the assertions fail.
2. Implement only the approved wall/cap/light treatments. Keep furniture shading and the frozen Phase 6 frame byte-stable.
3. Run focused scene/e2e checks, then the clean owner-run `verify` gate.
4. Owner captures both approved viewports into the approved new slice; verify their provenance/digests and compare beside AR-01. Stop for owner review before Task 6.

**Acceptance:** the wall reads as warm plaster, caps no longer dominate, daylight reads soft but remains fixed, and the office bounds/camera and all entity targets remain unchanged.

### Slice 2 — Task 6: make the existing zones read as purposeful places

**Planning gate:** after Slice 1’s owner review, submit/approve the Task 6 detail plan before building. Keep this work one coherent plate-review slice, with small RED–GREEN increments inside it.

1. Define a zone-to-prop inventory and a small reusable vector kit: desk tops/edge bands, chair seat/back/base, monitor/keyboard, shelf frame/book spines, paper/trays, counter panels, table legs, rug weave and restrained plant silhouettes.
2. Dress the **team area** with four readable workstations and chairs; the **collaboration table** with seating and a few neutral work materials; the **project library** with a legible shelf/cabinet silhouette and books; the **review station** with review surfaces and sample/document props; **reception** and **manager desk** with distinct counters/work surfaces; and **delivery** with ordered trays or document containers. No text or checkmarks that claim evidence or completion.
3. Add low-contrast material cues and contact grounding: wood edge/value variation, quiet plaster texture, restrained textile rugs, paper edges, and fuller but simple foliage. Keep the floor readable and retain current zone polygons as the canonical geometry/hit model.
4. Consider one low partition only if the approved Task 6 plan accepts it and the plate review shows the room remains open and targets stay clear; no new room/zone.
5. Add RED tests for furniture occupancy/zone ownership, painter ordering, bounds, label/target clearance and state invariance. Mutate a prop into a label/target and prove the guard catches it.
6. Run `verify`; owner captures both viewports and reviews the furnished plate before figures begin.

**Acceptance:** all seven existing zones are distinguishable by their furniture, each remains inside approved bounds, no target is hidden, the scene feels materially grounded without dashboard-like detail, and no prop implies live work.

### Slice 3 — Task 7: add truthful figures

**Likely files:** a new scene figure module, the scene renderer/composition, the canonical office behavior mapper, focused scene tests and behavior-map e2e tests.

1. Specify figure primitives and neutral manager-set defaults: adult proportions, varied silhouettes/hair/skin presentation and a wheelchair option, without tying appearance to role or seniority. No agent-authored identity briefs.
2. Map each semantic behavior row to seated, standing, traveling, paused or still/unknown treatment. Use canonical presence and transition evidence only; no fixed Phase 6 snapshot figures in the app.
3. RED-test every behavior row plus stale/offline/conflict and adversarial unsupported states; specifically prove blocked figures pause, unknown figures do not animate, travel requires a real transition, and reduced motion removes travel.
4. Integrate figures below DOM labels and above furniture according to the stable depth rule; prove figures do not steal entity selection or hide text/targets.
5. Run `verify`, then owner captures/review against AR-01 and AR-03 before adding state markers.

**Acceptance:** only supported presence is drawn; all six role placements are legible; varied appearance is not a semantic role signal; motion remains deterministic and reduced-motion safe.

### Slice 4 — Task 8: labels, attention cues, and selection treatment

1. Replace oversized status capsules with compact horizontal neutral plates. Preserve the full plain-language name/state in accessible DOM and keep Fira Sans sizing unless the owner separately approves a type-scale change.
2. Place role labels by person/desk and zone labels in clear interior positions, away from walls/windows. Add deterministic alternate anchors for the two long labels; assert no collision at 1440×900 and 1280×800, with default and inspector-open zoom.
3. Draw one restrained amber marker per actual manager request. Blocked-but-not-on-you stays neutral; unknown says “Status unknown” and remains still. Several requests follow AR-03 without stacking persistent panels or adding a dashboard.
4. Exercise keyboard selection, visible focus/selected state, inspector open/close and focus return against AR-02. Implement a scene focus treatment only if missing from the live interaction.
5. Replace the graybox header label with the project-workspace fixture label, retaining existing controls and accessible names.
6. RED-test request counts, blocked/unknown distinctions, label positions/collision handling and AR-03 adversarial fixtures; prove scene composition and lighting do not change with status. Run `verify`, then owner captures/review.

**Acceptance:** the office stays primary; labels are quiet, legible and non-overlapping; only actual manager requests use amber; one contextual surface is open at a time; keyboard focus and accessible names remain truthful.

### Slice 5 — Task 9: capture and measure the full contract

1. Use the existing Phase 7 capture harness for the approved 1440×900 and 1280×800 Chromium viewports. Cover the Phase 7-O ready/stale/offline/partial/conflict/blocked-elsewhere cases plus AR-03 blocked, unavailable/unknown and multiple-request scenarios.
2. Assert the fixed room, furniture and light remain byte-stable across state-only changes; capture figure/label/cue differences only where canonical state requires them.
3. Measure text/state-cue contrast over the actual rendered surfaces; record the approved frame-time measure under Q-5. Do not infer from the concept PNG.
4. Verify keyboard operation, focus return, reduced motion, 200% zoom, clean console and same-origin network behavior on both viewports. Do not claim unexercised browsers/devices.
5. Owner regenerates evidence; verify every digest and append provenance without rewriting prior evidence. Run full `verify` on the owner’s clean checkout.

**Acceptance:** every required state/view has current-build evidence, measured contrast and frame time, no V0/V1 remains, and each V2 issue has a recorded disposition.

### Gate 6 — Task 10 owner visual acceptance

Present current-build screenshots beside named AR-01–AR-04 plates, the state/interaction evidence, and the resolved gap register. The owner records whether the office meets the art target and any V2 dispositions. Visual-baseline promotion remains owner-run; do not report “meets art spec” before this ruling.

Task 11’s second cold comprehension run is optional under F-8, not a visual-art acceptance substitute; it would need a new key and a fresh owner-authorized interval.

## Risks and mitigations

| Risk                                                    | Mitigation                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Richness turns the office into a dense game scene.      | Add detail only when it clarifies place or work; compare every slice to AR-01/AR-04; preserve open floor and quiet labels.                                   |
| Decorative props imply agent progress or collaboration. | Keep props static and semantically neutral; only canonical behavior drives figures and motion.                                                               |
| Added detail harms legibility or camera fit.            | Preserve floor/camera; test bounds, hit targets and label clearance at both approved viewports before owner review.                                          |
| New colors or type sizes quietly become tokens.         | Reuse Active colors/Fira families; request separate owner approval for new numeric tokens or type scale.                                                     |
| Visual state cues leak into unrelated states.           | Keep architecture/light constant; test each state transition and adversarial fixture.                                                                        |
| A single turn cannot contain the required human gates.  | Execute the shortest valid sequence, but stop after each slice for owner captures/review as required by Q-3; do not promise final acceptance before Task 10. |

## Decision state

Task 5b is approved as written above. After its implementation and owner review, prepare the Task 6 plan against the observed room rather than treating this plan's prop inventory as approved assets.
