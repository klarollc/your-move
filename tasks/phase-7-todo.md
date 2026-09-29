# Phase 7 checklist: the rendered office

Status: **OWNER-APPROVED 2026-09-28.** Tasks start only after Phase 7-O acceptance, DF-029 and the fixture removal. Plan: `tasks/phase-7-plan.md`. Not authorized
before Phase 7-O acceptance, the DF-029 amendment and the Phase 5 fixture removal.

## Rules for every task

As Phase 7-O, plus: every rendering slice ends with owner-run captures at 1440×900 and 1280×800
beside its named plate, and the owner's comparison is recorded before the next slice (Q-3).

## Tasks

- [ ] Task 1: Fonts (F-5, Q-4). Vendor `@fontsource/fira-sans` and `@fontsource/fira-mono` at exact
      versions with their OFL texts; a font sheet the owner captures in Windows Chromium; tokens set
      only after the owner confirms.
- [ ] Task 2: Move the Phase 6 primitives into `packages/ui-system`. Acceptance: the golden states
      and the frozen frame re-render byte for byte from the new module; the scripts import it.
- [ ] Task 3: The SVG renderer behind the scene adapter. Acceptance: every existing scene, camera,
      label and zoom test passes against it; `render-error` replaces `canvas-loss` (Q-1) with
      moved assertions listed; captures show the Active office in the app.
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
