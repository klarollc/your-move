# Phase 7 F-5: typeface shortlist

**Status: DECIDED 2026-09-28. The owner picked Pair B, Fira Sans + Fira Mono.** The "Not yet
performed" checks below still apply, starting with Windows Chromium rendering, before tokens are
set. Phase 7 specification F-5 (approved
2026-09-28): choose an embeddable, openly licensed humanist sans and monospace by rendered
comparison, vendor them locally, record licenses; the owner picks from three pairs.

Rendered sheet: `2026-09-28-f5-typeface-sheet.png` in this folder.

## Requirements (MDD §9, typography direction)

A warm humanist sans for management language (personable, not casual, not rounded-childlike, not
corporate-generic); a restrained monospace only for identifiers, commands, hashes and timestamps;
tabular figures for numeric evidence; accessible distinction between ambiguous glyphs; Windows
Chromium rendering; local or reliably pinned delivery; deterministic baselines.

## Why the Active system's faces are out

`reconciliation-b-clarity` names Iowan Old Style, Palatino Linotype and Segoe UI, plus Cascadia
Mono (`scripts/phase6-candidate-styles.ts`). All are resolved from the viewer's installed fonts.
Only Cascadia Mono is openly licensed (SIL OFL 1.1), so only it survives embedding (Phase 6
evidence packet, gap 3).

## The shortlist

All six faces are **SIL OFL 1.1**, confirmed from each package's metadata and `LICENSE` file.
Each is published on npm by Fontsource (`@fontsource/<name>`, version 5.3.0 checked), so delivery
can be an exact-pinned npm dependency, served locally, with no font CDN at runtime.

| Pair | Sans | Mono | For | Against |
| --- | --- | --- | --- | --- |
| **A** | Source Sans 3 (Paul D. Hunt, Adobe, 2012; variable 200–900) | Source Code Pro (Adobe) | One designed family; calm, compact, wide language coverage | The most neutral of the three: closest to "corporate-generic". `tnum` was **not found in the Fontsource Latin subset**; the full font must be checked before relying on it |
| **B** | Fira Sans (Spiekermann, du Carrois; bBox Type; humanist, from Meta) | Fira Mono | The warmest and most personable; large x-height reads well at the 12 px scene labels; `tnum` present | Fira Sans itself has not changed since 4.301 (2016; development moved to FiraGO). Stable rather than maintained. Fira Mono has three weights |
| **C** | Atkinson Hyperlegible Next (Braille Institute, 2025; seven weights, variable) | Atkinson Hyperlegible Mono (2024) | Built for legibility: the strongest glyph distinction (slashed zero, distinct I/l/1); `tnum` present | Its slashed zero appears in ordinary sans text ("09:00:30"), which reads technical in management language. The mono's upstream repository was archived on 2026-08-13 |

**Mono alternative for any pair:** Cascadia Mono, the Active system's own mono, also OFL 1.1 and on
npm. Choosing it keeps one Phase 6 face.

## Recommendation

**Pair B, Fira Sans + Fira Mono.** It is the closest match to "warm humanist, personable, not
casual" and to AR-01's plain label voice, has tabular figures in the subset we would ship, and its
mono distinguishes 0/O and 1/l/I. Pair C is the choice if glyph distinction outranks warmth. Pair A
is the safest and the most generic.

## Not yet performed

- **Windows Chromium rendering** (MDD §9): the sheet was rendered in headless Linux Chromium only.
  The pick should be confirmed on the owner's machine before tokens are set.
- Full-font feature check (the subset result for Source Sans 3's `tnum`).
- Rendered comparison at 1280×800, at 200% zoom, and inside the Phase 7 scene. The sheet is one
  1440-wide composition of sample UI text, not the product.
- Contrast is not measured here; it depends on Phase 7 materials.

Sources: [Source Sans 3](https://en.wikipedia.org/wiki/Source_Sans_3),
[Fira](https://en.wikipedia.org/wiki/Fira_(typeface)),
[Atkinson Hyperlegible Next](https://www.prnewswire.com/news-releases/braille-institute-launches-enhanced-atkinson-hyperlegible-font-to-make-reading-easier-302371657.html),
[Atkinson Hyperlegible Mono](https://github.com/googlefonts/atkinson-hyperlegible-next-mono).
