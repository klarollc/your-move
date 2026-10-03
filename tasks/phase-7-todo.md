# Phase 7 checklist: the rendered office

Status: **OWNER-APPROVED 2026-09-28.** Tasks start only after Phase 7-O acceptance, DF-029 and the fixture removal. Plan: `tasks/phase-7-plan.md`. Not authorized
before Phase 7-O acceptance, the DF-029 amendment and the Phase 5 fixture removal.

## Rules for every task

As Phase 7-O, plus: every rendering slice ends with owner-run captures at 1440×900 and 1280×800
beside its named plate, and the owner's comparison is recorded before the next slice (Q-3).

## Tasks

- [x] Task 1: Fonts (F-5, Q-4). Vendor `@fontsource/fira-sans` and `@fontsource/fira-mono` at exact
      versions with their OFL texts; a font sheet the owner captures in Windows Chromium; tokens set
      only after the owner confirms.
  - **Built 2026-10-03; open: the owner's install, `verify`, capture and confirmation, then tokens.**
    `@fontsource/fira-sans` and `@fontsource/fira-mono` 5.3.0, exact pins in `apps/web`; Latin
    files only (Fira Sans 400/500/600/700, Fira Mono 400/500/700, all Mono ships); bundled from the
    app's origin. Licence texts copied verbatim to `licenses/fonts/`, with versions and lockfile
    integrity in its README; both texts open "Google Inc.", which differs from the upstream Fira
    credits as far as is known, and is recorded rather than edited.
    - `?surface=font-sheet`: every face at 12, 13, 16 and 19 px in the office's own words, Mono
      with a glyph-confusion line; one screen at 1280×800; a readout counts loaded faces. The
      office itself does not load the fonts yet.
    - `tests/visual/phase-7-font-sheet.spec.ts`, both viewports: RED on the assertion (no sheet),
      then GREEN in the container. It requires all seven faces loaded from this origin, each sample
      computed in the face it names, no external request, and nothing cut off; the capture goes
      through `evidenceOutputPath` to `phase-7/fonts/<project>/font-sheet.png`.
    - `scripts/font-licences.unit.test.ts`: exact pin, installed version equal to it, OFL-1.1, and
      vendored text byte-identical to the installed `LICENSE`.
    - Mutations, each confirmed applied and killed: one face's import removed ("Fira Mono 500 did
      not load"); one byte added to a vendored licence; a range pin (`^5.3.0`).
    - The container's first capture cut the Mono column off below the fold (the office's global
      `overflow: hidden`); the sheet was relaid to fit one screen, and the spec now asserts it does.
    - `verify` GREEN through the runner (`p7t1-verify-1791044460`) on a clean tree at `b485534`:
      unit 612, component 146, integration 90 with 3 skipped, contract 85, e2e 90, a11y 46,
      visual 66 (the font sheet at both viewports in the owner's Windows Chromium).
    - **Owner capture and provenance, 2026-10-03:** `phase-7/fonts/chromium-1440/font-sheet.png`
      and `chromium-1280/font-sheet.png`. **Owner confirmation (Q-4): "Looks good."** Tokens may
      now be set.
  - **Tokens, built 2026-10-03 at `edd91fe`. `verify` GREEN through the runner
    (`p7tok-verify-1791046370`) on a clean tree at `edd91fe`: unit 612, component 146, integration
    90 with 3 skipped, contract 85, e2e 94, a11y 46, visual 66.** Owner rulings T-1 (load the faces from the
    one global stylesheet, so every surface sharing it has them) and T-2 (Mono applied now to the
    values in the two Technical detail disclosures). `.ui-craft/tokens.md` records the approved
    families first (families only; the scale stays unapproved). `--font-ui` and `--font-mono` on
    `:root` in `global.css`, which imports `fonts.css`.
    - `tests/e2e/phase-7-typography.spec.ts`, both viewports: RED on the assertion (`system-ui`),
      then GREEN. Office first screen and controls compute to Fira Sans; a Technical detail cause
      ID to Fira Mono; both faces loaded. On the fixture page the interface face is declared and
      loadable from that origin, and the Decision Notice card keeps its own "Segoe UI Variable"
      stack.
    - The fixture test first checked only the computed family, which a mutation showed passes with
      no font loaded; then it required a loaded face, which failed on the unchanged code because
      nothing visible there uses the face. It now forces a load, which proves the face is declared
      and served without depending on page text.
    - Mutations, each confirmed applied and killed: the Mono rule removed; the font import removed
      (both tests fail).
    - Container: e2e 92 of 94 at both viewports, the two failures the isolation spec's console
      404 for `/favicon.ico`, which the container's full Chromium requests and the owner's
      headless build does not (traced to the console message's own URL); a11y 46 of 46.
- [x] Task 2: Move the Phase 6 primitives into `packages/ui-system`. Acceptance: the golden states
      and the frozen frame re-render byte for byte from the new module; the scripts import it.
  - **Built 2026-10-03 at `d7c98dd`.** First `verify` (`p7t2-verify-1791047791`) failed one e2e at
    1440 with a blank page: DF-028's fourth occurrence, traced below. Second `verify`
    (`p7t2-verify2-1791048029`) GREEN on a clean tree at the same commit: unit 613, component 146,
    integration 90 with 3 skipped, contract 85, e2e 94, a11y 46, visual 66. `git mv` of `scripts/phase6-candidate-{geometry,
render,styles}.ts` to `packages/ui-system/src/scene/{geometry,render,styles}.ts`, contents
    unchanged apart from two relative imports and one comment; a separate entry point,
    `@cuckcode/ui-system/scene`, so short names such as `TILE`, `iso` and `depth` stay out of the
    main entry. Seven scripts and one test import it.
    - A pure move, so no RED: the acceptance is the existing proof in
      `scripts/phase7o-digest-successors.unit.test.ts` ("renders every approved capture byte for
      byte as it was approved"), plus the Phase 6 golden-state and comparison-frame tests: 24 of 24
      before the move and 24 of 24 from the new module.
    - Mutation, confirmed applied and killed: one hex digit of a reconciliation floor colour in the
      moved styles broke the byte-for-byte capture test, so the test reads the moved code.
    - Moved assertion (P-4): `packages/testing/src/phase6-provenance.unit.test.ts` checked that every
      in-tree source the frozen Phase 6 provenance register cites exists. The register keeps the
      approval-time paths (not edited), so the test now resolves them through a declared move map,
      and a new case requires each mapped old path gone and new path present (a recreated old file
      was caught).
    - `scripts/phase6-provenance.ts` still writes the old paths into the register it builds: they
      are the approval-time record, left unchanged.
    - **DF-028, first trace (2026-10-03).** The runner kept the failed run's output. The page was
      entirely blank. The trace shows the dev server's `/@react-refresh` request failing with
      `net::ERR_NO_BUFFER_SPACE` (the Windows socket-buffer error), after which no `.tsx` module
      can run and nothing renders. Unrelated to this task: the office does not import the moved
      module. Not yet in the register; proposed to the owner.
- [ ] Task 3: The SVG renderer behind the scene adapter. Acceptance: every existing scene, camera,
      label and zoom test passes against it; `render-error` replaces `canvas-loss` (Q-1) with
      moved assertions listed; captures show the Active office in the app.
  - **Split by owner ruling, 2026-10-03.** **3a**, the renderer swap at parity: an SVG renderer
    draws exactly what Pixi draws, behind the same adapter; `render-error` replaces `canvas-loss`
    (Q-1); every existing scene, camera, label and zoom test passes, with moved assertions listed.
    **3b**, the Active office: the scene layer draws the Phase 6 composition; label anchors and hit
    regions come from the same geometry; the camera frames the composition; tests that pin the
    graybox rectangles move and are listed; owner captures beside AR-01. Reason: the app's flat
    rectangles, the layout policy's 64×32 isometric tile and Phase 6's 34 px tile are three
    geometries, and a single change could not show which one a failing test was about.
  - **3a built 2026-10-03 at `6cc9475`; `verify` (`p7t3a-verify-1791049916`) GREEN on a clean tree:**
    unit 613, component 153, integration 90 with 3 skipped, contract 85, e2e 94, a11y 46, visual 66. `apps/web/src/svg-scene-renderer.ts` implements
    `SceneRendererPort`: one `<svg data-scene-renderer="svg" aria-hidden="true">` with a scene
    layer, one rectangle per descriptor at the same position, size, fill, opacity and stroke Pixi
    used, a click on a rectangle emitting `scene.entity.select`, sort by re-appending, camera as the
    layer's `translate`/`scale`. `office-canvas.tsx` mounts it in place of the Pixi renderer; the
    adapter, the camera and the outline are unchanged.
    - RED: the 7 renderer component tests failed on assertions against a stub (null results
      reported through a `must()` helper, not dereferenced). The state-list tests failed 3 of 3
      with `render-error` absent (one as a copy lookup on an unknown state). GREEN: 7 of 7 and 3 of 3.
    - Mutation, confirmed applied and killed: removing the rectangle's click listener failed
      "selects an entity on click".
    - Container run (not the gate): unit, component and contract 850 of 851, the miss the known
      container-only `phase5-script-paths` gap; e2e and a11y 140 of 140 at both viewports;
      format, lint, both typechecks, guard, scaffold and CSS scope clean.
    - `render-error` replaces `canvas-loss` (Q-1). Cause: "The office could not be drawn; the
      Office outline is the primary interface." Recovery: "Redraw the office". Runtime line:
      "Runtime connected; scene unavailable". A failed mount now sets `render-error`.
    - Moved assertions (P-4): the state row in `office-shell.component.test.tsx`; the state lists
      in `office-outline-on-demand.component.test.tsx` and `office-disposition-refusal.unit.test.ts`;
      `tests/e2e/phase-4-office-shell.spec.ts` now enters `/?state=render-error`, checks the new
      cause and button, and the SVG absent then present after recovery; the scene selector
      `canvas[data-scene-renderer="pixi"]` became the SVG selector in `phase-4-harness`,
      `scaffold-a11y`, `scaffold`, `phase-4-kickoff`, `phase-4-selection-inspector` and
      `phase-7o-office-captures` (whose method text now says "in the SVG scene").
    - Limitation: e2e reaches `render-error` by URL; no test forces a real mount failure in the
      browser.
    - Untouched: the Pixi probe and its specs (`phase-4-camera`, `phase-4-pixi-scene`,
      `phase-4-camera-a11y`), which Task 4 removes with Pixi.
  - **3b plan approved 2026-10-03 as recommended (rulings G-1 to G-3).** G-1: the camera frames the
    Phase 6 scene's own geometry; its rules (fixed rotation, zoom stops, fit with padding, pan
    clamp, 44 px minimum target, Reset view) are unchanged, its measurements now come from
    `@cuckcode/ui-system/scene`. G-2: no figures until Task 7 drives them from the behaviour map, so
    no offline or unknown agent is drawn as present. G-3: the DOM labels stay; the names Phase 6
    bakes into its drawing are left out.
  - **3b built 2026-10-03 at `52cafbb`; `verify` (`p7t3b-verify-1791052003`) GREEN on a clean tree:**
    unit 630, component 155, integration 90 with 3 skipped, contract 85, e2e 94, a11y 46, visual 66. `renderSceneLayer` and `renderSceneDefs` split the
    Phase 6 renderer into layers; `renderComposition` is built from them and still renders every
    approved capture byte for byte. `scene/entities.ts` gives each zone (its floor plate) and each
    person (the hull of desk and monitor) one outline, anchor and depth. `office-layout.ts` builds
    zones, role anchors, hit regions (the whole desk, at least 44 px square) and office bounds from
    them; the bounds snap outward to whole pixels so Reset view stays byte-exact. The office draws
    the Active system's scene once as art (`reconciliation-b-clarity`, no labels, no figures), with
    an invisible hit polygon per entity over it; the published Implementation Engineer point comes
    from its anchor. Labels: a person's sits on their own desk; a zone's sits above its back corner,
    where Phase 6 named it.
    - RED: the scene-layer and entity tests 7 of 7, the layout tests 11 of 16, the renderer tests 2
      of 9, each on an assertion. GREEN: all of them.
    - Mutations, each confirmed applied and killed: baked labels drawn anyway; figures drawn anyway;
      the monitor dropped from the desk outline; the hit region shrunk to a 44 px square at the
      anchor; the hit polygon's `pointer-events` removed; the art drawn outside the camera layer;
      person labels shifted 60 world px off their anchor (e2e).
    - Container run (not the gate): unit and component 784 of 785, the miss the known container-only
      `phase5-script-paths` gap; e2e and a11y 138 of 140, the misses the known container-only
      `/favicon.ico` 404 in `scaffold.spec.ts` at both viewports (traced); visual: the office captures
      pass, the Decision Notice fixture states fail only on the same favicon 404; format, lint, both
      typechecks, guard, scaffold, toolchain and CSS scope clean.
    - Moved assertions (P-4): `office-layout.unit.test.ts`'s projection policy (64×32 to the Phase 6
      scene's 34 px tile); `phase-7o-scene-labels.spec.ts`'s "desks run left to right" (the Active
      office groups four desks in the team area and two at review), replaced by "each label's
      centre is over its own person's hit region"; the label placements `above`/`below` became
      `desk`; zone labels moved from the lower-left corner to above the back corner.
    - Measured, not assumed: at 1280×800 the closest level pair (Product Designer, Implementation
      Engineer) is 198 px apart against the 180 px label maximum. With the inspector open (zoom
      0.875) that gap is about 155 px, so two long labels there can touch; the overlap test covers the
      default view only. Recorded for Task 7, when figures change where labels belong.
    - Still open for Task 3: the owner's captures of the Active office beside AR-01 at both
      viewports.
- [ ] Task 4: Remove Pixi (Q-2). Acceptance: no import remains; the dependency is gone; `verify`.
- [ ] Task 5: Architecture and light (AR-01). Walls with a deterministic cutaway rule, the window
      wall, baked daylight (F-6). Plate review.
- [ ] Task 6: Furniture per zone. Each zone's props say what it is for; nothing hides a label or a
      target. Plate review.
- [ ] Task 7: Figures (F-3). Modular adult figures; poses only from the semantic behavior map;
      paused when blocked; still when status is unknown; travel only on a real transition, none
      under reduced motion. Adversarial fixtures still refused through the new renderer. Plate
      review.
- [ ] Task 8: In-scene cues (F-7, after DF-029). One amber marker per manager request; neutral
      blocked; "Status unknown" without motion. AR-03 review.
- [ ] Task 9: Capture matrix and evidence (F-8). Every Phase 7-O state plus AR-03's three; contrast
      measured; frame time recorded (Q-5); owner-promoted baselines.
- [ ] Task 10: Owner visual acceptance against AR-01 to AR-04, V2 dispositions.
- [ ] Task 11 (recommended, not a gate): a second cold comprehension run on the rendered office.
