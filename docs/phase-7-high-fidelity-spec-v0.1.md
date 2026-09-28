# Phase 7 specification v0.1: high-fidelity office

**Status: DRAFT 2026-09-28, awaiting owner decisions F-1 to F-8.** Drafting authorized by the owner
2026-09-28. **Implementation is not authorized.** Phase 7 begins only after Phase 7-O is accepted
(MDD §24), and needs this specification, a plan and a checklist, each owner-approved.

Author: agent.

## 1. Authority and target

- **MDD §24, Phase 7.** Deliverables: approved materials, lighting, avatars, typography, props,
  motion, reduced-motion treatment and visual regression baselines. Gate: Phase 7-O accepted; a
  rendered capture matrix; V0/V1 cleared; V2 disposition; explicit owner visual approval.
- **MDD §9**: D-02 spatial model and camera contract, D-08 visual thesis, material and palette
  thesis, avatar shape language, typography direction, motion contract, lighting and depth
  contract, semantic behavior map, ambient behavior contract.
- **P-0 (2026-09-27).** AR-01 to AR-04 and the pack constitution are the acceptance target for
  rendering. The pack's qualifications stand: concept imagery is not a pixel specification;
  names, raster colors, geometry and props are not binding; AR-01 is the composition anchor.
- **Owner disposition 2026-09-28.** The Phase 7-O captures are "nowhere near" the plates, "mainly
  rendering". This phase exists to close that gap.
- The Active visual system `reconciliation-b-clarity` (Phase 6) and its frozen evidence stay
  immutable.

## 2. Starting point, as the tree stands

| Piece | What exists | Where |
| --- | --- | --- |
| Active visual system | A deterministic **isometric vector office**: zones as floor plates, desks, shelving, plants, screens, standing figures, labels; SVG built by script. Rendered **only into evidence**, never by the app. | `scripts/phase6-candidate-{geometry,render,styles}.ts`, `docs/evidence/phase-6/golden-states/*.svg` |
| App scene | Pixi 8 `Graphics` drawing **flat screen-space rectangles** per zone and desk (the graybox), with DOM labels over it (Task 9f-3). | `apps/web/src/pixi-scene-renderer.ts`, `office-canvas.tsx`, `office-scene-adapter.ts` |
| Layout policy | An isometric projection (tile 64×32, elevation 24), camera bounds, zoom limits, depth rules. | `packages/ui-system/src/office-layout.ts`, `office-camera.ts` |
| Motion | Semantic motion planning; reduced-motion; motion paused when not current (9f-4). | `packages/ui-system/src/semantic-motion.ts` |
| Known Phase 6 gaps | The generated half of the approved hybrid medium (6-C) was never produced; four of six named typefaces cannot be embedded. | `docs/evidence/phase-6/phase-6-evidence-packet.md` |

So the fastest route to the plates is not new art from nothing: it is **putting the approved
isometric system into the app**, then raising its fidelity toward AR-01.

## 3. Gap to the plates

- **AR-01 (composition).** Rooms read as rooms: walls with cutaways, a window wall with daylight,
  furniture that says what each zone is for, adult figures seated or standing at the place their
  work puts them, and sparse horizontal labels ("Name · state"). Today: flat boxes, no figures.
- **AR-02 (interaction).** Selection close views and focus without free camera. Mostly present in
  structure since 9f; needs a rendered selection and focus treatment.
- **AR-03 (difficult states).** Blocked, unknown and several requests read differently _in the
  scene_: a paused figure, a "Status unknown" figure without motion, question marks over the
  requesters. Today: text labels only.
- **AR-04 (preserve/avoid).** Holds already for structure (9f); must survive the added detail:
  no badges, no technical noise, one interaction at a time.

## 4. Decisions needed

- **F-1, renderer.**
  (a) **Recommended: SVG in the DOM**, generated from the Phase 6 primitives moved into
  `packages/ui-system` as a tested module. Deterministic by construction (the golden states
  already are), exact visual baselines, text and focus in the same tree as the labels, no WebGL
  context to lose. Thirteen entities and their props are well within SVG's comfort.
  (b) Keep Pixi and port the primitives to Pixi `Graphics`. Keeps today's renderer and its tests,
  but re-implements an approved system in a second medium and keeps canvas-loss as a failure
  mode.
  (c) Pixi with raster sprites; depends on F-2 (b).
  _Consequence of (a):_ the Pixi renderer, `canvas-loss` state and probe retire under P-4, each
  listed; the scene adapter and read model are unchanged.
- **F-2, asset medium.**
  (a) **Recommended: vector-first, authored in the repository,** raising the Phase 6 primitives
  toward AR-01 with material treatments (wood, plaster, charcoal, textile), cutaway walls,
  window light and modular figures. Every asset is code, reviewed and versioned like the rest.
  (b) Raster illustrated sprites. Closest to AR-01's finish, but needs an asset source with
  provenance for every image. The pack's generated plates **cannot** be cut into assets: the
  approval covers visual guidance only, and distribution of the artwork is not authorized.
  (c) The 6-C hybrid (vector now, a generated layer later), recording the generated half as
  still absent until an owner-approved source exists.
- **F-3, figures.** Modular adult figures per MDD §9 (proportions, silhouettes, varied skin tones,
  hair, body presentations, mobility aids), poses limited to the semantic behavior map: seated at
  desk, standing, walking only on a real transition, paused for blocked. **Recommended:** Phase 7
  ships the figure system with neutral, manager-set defaults. **The agent-authored identity
  briefs** (MDD §9, six briefs and one Candidate through the full review path) need the live
  runtime and their own review flow, so **defer them to a separate phase**. Alternative: include
  them, which makes Phase 7 depend on live runs.
- **F-4, composition.** **Recommended:** keep the Phase 6 zone geometry and the D-02 camera
  contract (golden states, camera tests, outline equivalence all depend on it) and move the
  _dressing_ toward AR-01: walls and cutaways, a window wall, furniture per zone, a lounge only if
  the MDD's zone list gains one (it does not today). Alternative: re-lay the floor to AR-01's plan,
  which reopens D-02 measurements and every layout test.
- **F-5, typography.** The two-family system of MDD §9. Four of six Phase 6 faces cannot be
  embedded. **Recommended:** choose an embeddable, openly licensed humanist sans and monospace by
  rendered comparison at both viewports, vendor them locally, and record licenses. Owner picks
  from a shortlist of three pairs.
- **F-6, lighting.** One fixed soft-daylight rig, **baked into the vector shading** (fills and
  contact shadows), never state-dependent (MDD §9). Recommended: yes.
- **F-7, scene state cues.** AR-03's in-scene distinctions: blocked = a paused figure and a
  neutral label; unknown = a figure without motion and "Status unknown"; a request = one amber
  marker over the requester, reserved for manager attention (rule 9). **Sequencing:** DF-029
  (blocked, but not on you) changes which blockers are amber; implement it **before** these cues
  so they are drawn once. Recommended: yes.
- **F-8, evidence and baselines.** A Phase 7 capture matrix at 1440×900 and 1280×800 over the
  Phase 7-O states plus AR-03's three, with named checkpoints, owner-run regeneration and
  provenance; Phase 6 and Phase 7-O evidence untouched (the v1-digest pattern from P-1).
  A second cold comprehension run after Phase 7 is **recommended but not a gate**: the rendered
  office may read differently from the graybox, and only a run can say so.

## 5. Acceptance (draft)

1. Rendered at both viewports, the default office reads as AR-01 by the owner's eye: office
   dominant, rooms legible, figures at their work, sparse labels. The owner's comparison is
   recorded per plate, as in Task 9.
2. Every semantic behavior-map row has a rendered treatment, and none implies more than canonical
   state (the §7 adversarial fixtures still pass through the new renderer).
3. The outline, labels, keyboard paths, focus return, reduced motion, 200% zoom and console and
   network checks pass as in Phase 7-O criterion 6.
4. Contrast of text and state cues over the rendered materials is measured, not assumed.
5. `verify` green; new baselines owner-promoted; V0/V1 cleared; V2 dispositioned.

## 6. Out of scope

Agent-authored identity briefs (F-3, if deferred); answer choices for questions (needs an
`OpenQuestion` contract change); "Assign work" and outcome-first assignment; free camera; a
day/night cycle; the Phase 5 fixture removal (its own specification); DF-029 itself (its own
amendment, `docs/proposals/2026-09-28-df-029-blocked-not-on-you.md`).

## 7. Order after Phase 7-O acceptance

1. DF-029 amendment (changes which blockers need the manager).
2. Phase 5 fixture removal from the production bundle (D-24 follow-on).
3. Phase 7 plan and checklist from this specification, then implementation.
