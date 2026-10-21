# Your Move structural pass — design record (2026-10-20)

## Approval and scope

This record implements the owner-supplied **Your Move — structural pass build brief (2026-10-20)**. The owner approved the divergence list `your-move-structural-divergences-2026-10-20.md` (Cinder's workspace copy; not in this repository) and confirmed on 2026-10-20 that Cinder's target board is aligned. The seven divergences D1–D7 are summarized below in the substance the brief gives them.

This is a structural re-composition of the hosted Work surface only. It changes where things are, not what they do. The backend, agent loop, tools, lamp pipeline, credentials, provider connections surface (including the owner-pass settings drawer), API contracts, and data model are untouched. The proposal gate, reply-and-resume, close-as-done, materials, and verdict behaviors are preserved exactly. No new features.

It amends the placement rules of [the UI revision design record](your-move-ui-revision-design-2026-10-19.md) where they conflict — chiefly "keep the paper detail beside the work surface" — and keeps everything else in that record: window truthfulness, ordering, paging, palette, and motion.

## The target

Cinder's target board, as confirmed by the owner:

- **The Street is the home and status instrument.** It is one composed scene, not a grid of cards.
- **The New Work slip sits above the street.**
- **One correspondence sheet at a time.**
- **The verdict sits in place under its utterance.**
- **Proposal approval is the sheet's visual climax.**
- **Amber strictly means "needs you"; cobalt is only for links and navigation.**

Home surface, top to bottom, and nothing else:

1. App nav: the brand once, Work / Connections, Sign out.
2. New Work slip.
3. One quiet status line: "N windows lit · oldest first", with the Street/List switch.
4. The Street scene.
5. The correspondence sheet, when an item is selected.
6. The queue strip.

## Divergences and their fixes

| ID | Divergence (substance) | Fix in this pass |
| --- | --- | --- |
| D1 | The brand and page chrome are repeated: a second "Your Move" H1, a "Work" eyebrow, and a global count beneath the nav that already carries the brand. | Remove the WorkExecutions header block. The brand appears once, in the nav. |
| D2 | Opening work deforms the scene: the `ym3__workspace--open` two-column re-grid squeezes the street to make room for the detail. | Remove the re-grid. The sheet renders full width below the street, and the street does not rescale, reflow, or compress. |
| D3 | The Street is a card grid: per-house "House N" headings, item counts, and item lists rather than one scene. | One composed scene per page: up to 3 houses on a shared ground line, 5 windows each, using the existing TownshipHouse drawing. Windows are buttons that select their item. |
| D4 | Home carries a dense table with search and filters. | Home gets a queue strip of window glyphs (lit = waiting on you, sage = running, dark = done), with the title and plain status. The table, search, filters, and status columns live in List view. |
| D5 | The collection switch ("All work & history"), search, filters, and history pagination sit on the home surface. | All of them move wholly into List view. Capability is unchanged; only the location changes. |
| D6 | The composer is an always-open form block, and the draft renders inside it. | A New Work slip (dashed paper, one describe field, "Draft it"), collapsed to slip height by default. The draft opens as a sheet in the sheet position: purpose / in scope / not included / done when as letter sections, the plain-words revision box, "Approve draft" as primary, and discard beside it. On approval the item joins the queue and the composer returns to the slip. |
| D7 | The detail panel behaves like a page: back button, kicker as navigation, sticky side column. | WorkPanel becomes the correspondence sheet. Its content and capabilities stay the same: transcript with owner replies and in-place lamp verdicts, proposal block, reply box, draw-the-curtain. It drops its page chrome. Closing the sheet returns to the street with nothing selected. |

## Rules carried forward unchanged

- **Window truthfulness and mapping** follow the UI revision record. One lit window means one item with a recorded unresolved owner action. Dark windows are capacity, never completed work. Oldest request comes first, with the stable ID breaking ties. Each house has 5 windows and each Street page has at most 3 houses. With more than 15 items, the pager reads "Windows 1–15 of N · Street page x of y".
- **Palette tokens:** sage canvas, stone paper `#D9D5CA`, ink `#27352F`, amber `#DDA64C`, cobalt for links/nav only.
- **Motion:** entrance ≤300ms on initial load only, reduced motion honored, and no animation implying unverified activity.
- **Keyboard and assistive-technology semantics** are kept for every window, row, and sheet control.

## Verification and evidence

`npm run verify` must exit 0, including provenance, contrast (extended to the sheet and slip surfaces), a11y, and visual suites. Tests change with the structure: selection no longer re-grids, street windows are buttons, and the table is absent from Street view but present in List.

Captures go in `docs/evidence/your-move-structural-pass/` at 1280×800 and 1920×945: street with no selection, street with a sheet open, the draft sheet, and List view. They double as the deferred walk-through Section 6 screenshots. They are synthetic, browser-routed fixtures with no credentials or owner content.

After the build, Haiku re-verifies at the tip, Cinder gates the pushed branch, and Nate merges. Pushes are owner-run.
