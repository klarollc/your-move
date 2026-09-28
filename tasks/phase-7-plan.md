# Implementation plan: Phase 7, the rendered office

Status: **DRAFT 2026-09-28, for owner approval.** Specification:
`docs/phase-7-high-fidelity-spec-v0.1.md`, **owner-approved 2026-09-28** (F-1 to F-8; F-5 decided,
Fira Sans + Fira Mono). **Not authorized before Phase 7-O is accepted**, and runs after the DF-029
amendment and the Phase 5 fixture removal (spec §7). Checklist: `tasks/phase-7-todo.md`, approved
separately.

## Outcome

The app renders the Active isometric office as SVG, raised toward AR-01: rooms, window light,
furniture that says what each zone is for, and adult figures placed and posed by canonical state.
Labels, outline, keyboard paths and every Phase 7-O guarantee still hold. The owner compares the
rendered captures with the plates and approves or rules on each gap.

## Approach

1. **Move before changing.** The Phase 6 primitives (`scripts/phase6-candidate-geometry.ts`,
   `-render.ts`, `-styles.ts`) move into `packages/ui-system` as a tested module first, **with no
   change in output**: every golden-state SVG and the frozen comparison frame re-render byte for byte
   (the P-1 reduction-proof pattern). Only then does any rendering change.
2. **Replace the renderer behind the adapter.** `office-scene-adapter.ts` already turns the read model
   into scene descriptors; an SVG renderer consumes them in place of `pixi-scene-renderer.ts`. The
   DOM labels, outline and camera contract stay.
3. **Raise fidelity in slices, each captured.** Architecture and light, then furniture, then
   figures, then in-scene cues. Each slice ends with captures at both viewports beside the named
   plate, so drift is seen per slice, not at the end.

## Decisions this plan needs

- **Q-1, the `canvas-loss` shell state.** It exists because WebGL can lose its context; SVG cannot.
  **Recommendation:** replace it with a general `render-error` state ("The office could not be
  drawn; the outline is the primary interface"), keeping the outline-first fallback, and list the
  moved assertions (P-4). Alternative: retire it outright.
- **Q-2, Pixi.** **Recommendation:** remove `pixi.js` and its probe once the SVG renderer passes
  every scene test, in its own task, so the dependency is not carried unused.
- **Q-3, per-slice owner review.** **Recommendation:** the owner looks at each slice's captures
  beside the plate before the next slice starts (four short reviews), rather than one review at the
  end. Slower per slice; far cheaper than a late "nowhere near".
- **Q-4, the Windows font check.** F-5 requires Fira to be confirmed in Windows Chromium before
  tokens are set. **Recommendation:** the first task renders a font sheet in the owner's Chromium
  (owner-run capture) and the owner confirms.
- **Q-5, performance.** No budget exists today. **Recommendation:** a measured frame-time check at
  both viewports for the default office and the busiest state, recorded, not gated, in this phase.

## Risks

- **Detail versus rule 3 and AR-04.** Added furniture must not become noise or hide state. Each
  slice's review checks AR-04's avoid column explicitly.
- **Contrast over materials.** Label and cue contrast is measured on the rendered captures (spec
  §5 item 4), not assumed from tokens.
- **The frozen Phase 6 evidence.** Nothing under `docs/evidence/phase-6` is edited; the move is
  proven by re-rendering.
