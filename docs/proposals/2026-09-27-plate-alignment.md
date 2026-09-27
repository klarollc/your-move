# Plate alignment in the graybox (Task 9f) and the plates as the product target

**Status: APPROVED 2026-09-27** (P-0 to P-4 as recommended).

Author: agent, 2026-09-27. Owner instruction: "These specifications are what need to be met by
the software and rendering", then "split as recommended": structure, wording and interaction in
Phase 7-O now, rendering in Phase 7 in the existing order.

Governing plates: **AR-01** (the office carries the cues; the bar reads "1 question · 1 review"),
**AR-02** frames 4 and 6 (answer one thing; evidence takes the surface with a way back),
**AR-03** (blocked, unavailable and several requests are three different things) and **AR-04**
(one interaction at a time; no badges and technical noise). Pack hashes were re-checked on
2026-09-27 and match `docs/art-reference-approval-2026-09-27.md`.

## 1. Why

The approval record makes the pack a visual supplement and leaves implementation to a separate
specification. The owner has now made the plates the target for the product itself. Compared
with the 22:54 captures (commit be3cabd), the build misses them in two ways:

- **Structure and wording (fixable in graybox).** The scene shows no names or states, so the
  outline has become the real interface. The bar shows technical text ("Outcome: truthful
  graybox office", "Runtime connected", "Local session · revision 35") and a single
  "Manager attention (2)" that adds a blocker and a review together. Up to three contextual
  surfaces open at once: outline plus inspector, and in the evidence journey the outline, the
  Project Library and an evidence dialog together, whose first screen is raw identifiers. The
  stale notice reads "The last canonical update exceeded the freshness window", and the panels
  show "Canonical projection", "Priority 10 · blocked" and "State: Layout only — no canonical
  state record". `motionFrom` does not read freshness, so rule 6 (suspend work animation while
  updates are unavailable) appears unmet; a RED test will confirm or refute that.
- **Rendering (Phase 7).** Materials, lighting, adult figures, props and the isometric
  illustrated scene of AR-01. The MDD places these in Phase 7, after Phase 7-O acceptance and
  under its own specification. That order is kept.

## 2. Decisions needed

- **P-0, the plates as the target (MDD amendment).** Add to MDD §24 and the approval record:
  "AR-01 to AR-04 and the pack constitution are the acceptance target for the product's
  interface and rendering. Phase 7-O meets them for structure, wording and interaction in the
  graybox; Phase 7 meets them for rendering. Concept imagery is still not a pixel
  specification: the README's qualifications on names, colours, geometry and props stand."
  Recommendation: yes. Without it, the plates remain advisory and a future review can pass a
  build that misses them.
- **P-1, where the work lands.** Task 9f in Phase 7-O, before Task 10. The cold comprehension
  run can only be cold once per operator, so it should test the layout it will be accepted on.
  Recommendation: yes.
- **P-2, one contextual surface at a time (reverses A-2).** A-2 kept the outline open beside the
  inspector. AR-04 and rule 3 reject that. Proposal: the outline, the attention rail, the
  inspector, the Project Library and an opened evidence record are mutually exclusive.
  `Inspect …` from the outline replaces the outline with the inspector, which gains a
  `Back to outline` button that restores the outline with focus on the button that was used.
  Keyboard travel from person to person stays two keystrokes. Recommendation: yes.
- **P-3, cues in the scene.** Each person's name and plain state as a horizontal screen-space
  label over their desk ("Test Engineer · Blocked"), in amber only when the item needs the
  manager (rule 9). Zones keep their names only. Labels are information, not art, and fit the
  MDD's graybox list ("spatial hierarchy … attention handling"). 9e excluded "state marks on the
  figures" as Phase 7; this reverses that for text labels only. Figures, icons and art remain
  Phase 7. Recommendation: yes.
- **P-4, the attention count.** Replace "Manager attention (N)" with counts by canonical reason,
  showing only non-zero parts: questions (`question_open`, `waiting_input`), reviews
  (`review_requested`, `approval_required`) and blocked (`blocked`, `failed`). Today's default
  would read "1 blocked · 1 review". Recommendation: yes. Alternative: questions and reviews
  only, with blocked items shown in the scene but not counted, which is closer to rule 4 but
  hides a canonical attention item from the bar.

## 3. What 9f changes if approved

1. **Bar.** `CuckCode / {project name}` on the left and the split count on the right, plus
   `Office outline` and `Reset view`. Runtime and revision move into the outline's
   `Technical detail`. When the workspace is not current, the existing notice (A-4) still
   appears.
2. **One surface at a time,** per P-2, for outline, rail, inspector, Library and evidence.
3. **In-scene labels,** per P-3. The labels are the scene's accessible names too, so a
   screen-reader user and a sighted user meet the same words.
4. **Plain wording.** First screens use AR-03's language. Blocked: "Waiting for {condition}",
   then who can resolve it when canonical state records that. When it doesn't, the screen says
   "Who can resolve it: not recorded" rather than guessing. Unavailable: "Updates unavailable.
   Last confirmed {time}". Each person reads "Status unknown · last confirmed: {state}", with
   `Refresh workspace` kept. Removed from first screens: "Canonical projection", "Priority N",
   "Layout only — no canonical state record" (zones without state show no state line), and the
   "Canonical workspace revision N is current" sentence. All of these remain under
   `Technical detail` (rule 10).
5. **Several requests, one at a time.** The rail shows one item with "1 of 2" and Previous/Next.
   The disposition select and the required reason sit behind a `Respond` button on that item.
   No disposition option is removed.
6. **Evidence takes the surface.** An opened evidence record replaces the scene with
   `Back to office` at the top. The first screen reads "Browser evidence, version 1: failed. No
   summary recorded." Identifiers, work item, event and revision sit under `Detailed evidence`.
   The Project Library follows the same rule.
7. **Rule 6.** While the workspace is not current, work motion is suspended and people's states
   read as last confirmed. This is RED-first if the test confirms today's gap.

## 4. Not in 9f

- Rendering: materials, lighting, figures, props, the isometric illustrated scene (Phase 7).
- Answer-choice buttons as in AR-02 frame 4. `OpenQuestion` has no choices field, so this needs
  a contract change and its own proposal.
- "Assign work" and outcome-first assignment (AR-01, AR-02 frame 2). These are not in Phase
  7-O's scope.
- "See dependency" navigation where canonical state does not record the dependency.

## 5. What moves (P-4 rule), to be listed at the time

- Assertions on "Manager attention (N)", "Canonical projection", "Priority", "stale", "Layout
  only", the revision sentence and the freshness-window cause change to the new copy or move
  under `Technical detail`.
- Tests that assume the outline stays open beside the inspector (A-2) change to
  `Back to outline`.
- The evidence dialog tests change to a full-surface view with `Back to office`.
- The capture spec gains an in-scene label check, and the Phase 7-O captures are re-taken by
  the owner.
- Phase 4 accepted evidence is not edited.

## 6. Review

Current-build captures at 1440×900 and 1280×800 beside AR-01, AR-03 and AR-04 for default,
blocked, stale, several requests and evidence, with keyboard, reduced motion and console/network
checks. Concept approval is still not visual acceptance.
