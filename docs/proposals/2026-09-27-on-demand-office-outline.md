# The Office outline on demand — design amendment

**Status: PROPOSAL. Approves nothing, amends no requirement, authorizes no implementation.**

Author: agent, 2026-09-27. Raised by F-9-4 (V1, drift toward a dense technical dashboard) and by
the owner-approved art supplement of the same day (`docs/art-reference-approval-2026-09-27.md`).
Owner instruction: "Fix regression, then amend."

Governing plates: **AR-01** (the office is the default working surface) and **AR-04**
(preserve and avoid). Constitution rules 1 and 3 apply: no persistent card grids around the
office, and one contextual interaction at a time. The manager question this serves is "who needs
me, and on what?", answered in the office rather than in a grid beneath it.

## 1. The conflict

Since Phase 4 the Office outline has been one of three persistent structures, alongside the
project bar and the scene. It occupies the bottom 280 px (240 px on short viewports) as a grid of
zone and person cards. `tests/e2e/phase-4-office-shell.spec.ts` and
`apps/web/src/office-shell.component.test.tsx` assert that the three persistent structures
exist.

AR-04 rejects this arrangement in so many words: "Office reduced to decoration" beside cards.
Constitution rule 1: "Persistent metrics, card grids, technical status sidebars, and log streams
do not surround it." Task 9d made the cards legible, but a legible card grid under the office is
still a card grid under the office. The remaining part of F-9-4 cannot clear while it persists.

## 2. What must not be lost

MDD §10 ("Non-spatial equivalent"): the outline "exposes the same people, zones, states,
relationships, and actions in a logical hierarchy. This is an equivalent primary interface, not
a degraded afterthought." MDD §9 also requires that keyboard controls and the outline provide
equivalent navigation. Phase 7-O spec §6 requires selection from the outline and the scene to
reach the same entity, with Escape-close and focus return.

"On demand" must therefore mean one keystroke away at all times, with identical content and
actions, rather than hidden.

## 3. Proposal

1. **Default: the office fills the space below the project bar.** The outline is not rendered
   as a persistent region.
2. **Opening it.** An `Office outline` button in the project bar, and the existing first-Tab skip
   link (renamed "Open the Office outline"), both open it as a panel over the left of the office,
   the same slot as the attention rail, and move focus into it. Escape or `Close outline` closes
   it and returns focus to what opened it.
3. **Same content, same actions.** People, zones, states, relationships, `Inspect …` and
   `Locate …`, and the Unassigned work group, all from the same read model. Nothing is removed.
4. **One contextual surface at a time.** The outline and the attention rail share the left slot:
   opening one closes the other. `Inspect …` from the outline opens the inspector on the right
   and keeps the outline open, so a keyboard user can move from person to person. Closing the
   inspector returns focus to the `Inspect …` button that opened it.
5. **When the scene cannot be the surface, the outline is.** In `canvas-loss`, `loading`,
   `error` and `empty`, the outline opens automatically and fills the space, as today's copy
   already says ("the Office outline is the primary interface").
6. **Reduced motion and zoom.** The panel opens without animation under reduced motion. At 200%
   zoom it takes the full width below the bar.

## 4. Decisions needed

- **A-1, MDD text.** Amend §10 to say the outline is "an equivalent primary interface, available
  from any state by one keyboard action and shown automatically when the scene is unavailable".
  Recommendation: yes. Without it, the MDD still reads as requiring a persistent region.
- **A-2, outline beside the inspector.** Keep the outline open when the inspector opens
  (recommended: it is navigation, and the inspector is the one contextual interaction), or close
  it and reopen it on return.
- **A-3, where the work lands.** Recommendation: a Phase 7-O task, 9e, before Task 10. The
  comprehension answer key and task URLs must be written against the accepted layout. Deferring it
  to Phase 7 would mean aligning Task 10 to a layout the art supplement already rejects.

## 5. What moves (P-4), to be listed at the time

- The "three persistent structures" assertions become two (project bar and scene), plus an
  assertion that the outline opens in one action from the skip link and from the bar.
- Every test that clicks `Inspect …` or `Locate …` directly must open the outline first. That is
  38 call sites in 18 files. A shared test helper keeps each move to one line.
- The Task 9 capture spec gains an "outline open" journey. The Phase 7-O captures are re-taken by
  the owner.
- Phase 4 accepted evidence is not edited.

## 6. Out of scope

Scene art and state marks on the figures (Phase 7), the rail's design, the Evidence Library
layout, and camera behaviour.
