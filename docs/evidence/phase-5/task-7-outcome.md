# Phase 5 Task 7 — Visual QA capture and annotation

Ran 2026-09-14. Current-build evidence at both D-07 viewports, annotated by the promoted
`visual-qa-reviewer`. **Verdict: NEEDS WORK.** Turn ledger 4 of 60.

Nothing in this packet is high-fidelity evidence, a promoted baseline, or owner acceptance. Diffs
detect change; C-19 still needs the owner's own eyes.

---

## What was produced

| Artifact | What it is |
| --- | --- |
| `browser/<viewport>/<state>.png` | 40 captures — 20 states at 1440×900 and 1280×800 |
| `browser/<viewport>/<state>.aria.yaml` | The accessibility tree of each captured state |
| `browser/<viewport>/<state>.journey.json` | Console log, full request log, and reachability per state |
| `browser/<viewport>/isolation.json` | The Test Engineer's seven-step procedure, executed |
| `browser/<viewport>/isolation-deliberate-failure.json` | Step 7 — the injected violation, and the detector firing |
| `browser/capture-manifest.json` | The 40-cell join against the contract, with image digests |
| `browser/fidelity-check.json` | Contract accessible names against captured ones |
| `visual-qa/pass-1.json` | The reviewer's annotation, cross-checked |

Rebuild with `npm run phase5:capture` then `npm run phase5:fidelity`. The live annotation needs
`$env:CUCKCODE_LIVE_PHASE5='1'; npm run phase5:visualqa:run` and debits the ledger.

---

## What the captures prove, stated narrowly

All forty cells exist and **every image is byte-distinct from every other**. That check matters
because the first capture run produced four duplicate pairs: `pending` and `severity-significant`
were the same picture, because the base notice *is* significant, and `acknowledged` and
`undo-available` were the same picture, because undo is what acknowledgement leaves behind. Filed
that way, the matrix would have reported twenty states while holding eighteen. Severity and undo are
now captured scoped to their own elements.

The isolation procedure passes on five journeys: zero external requests, zero credential-shaped
strings in rendered output, console, or persisted state, zero storage writes, and all four evidence
outcomes present in every run. **Step 7 is the one that makes the other six mean anything** — an
injected `fetch` to a forbidden origin is caught by the same detector that reports the clean runs, so
a clean result is a finding rather than a silence.

Nine states pass axe with no violations. At 200% zoom, emulated by halving the viewport, the content
the contract forbids hiding is still present and the document does not scroll sideways. Under the
reduced-motion policy, no element inside the card carries a non-zero transition or animation
duration — asserted over every node, because one control left moving is exactly what an eyeball pass
misses.

---

## What it found

**Blocking — one of the twenty states cannot be entered.** The reason textarea carries
`maxLength=280`, so the browser refuses the 281st character and the over-length refusal the core
implements can never be triggered by a person. The contract is explicit in the other direction:
*"show remaining count and reject overlong input rather than truncate it."* The build truncates,
renders no counter, and states no limit. The capture spec now asserts the blockage itself, so if
`maxLength` is ever removed this stops being silently unreachable.

**Significant — three accessible names drift from the contract.**

| State | Contract | Build |
| --- | --- | --- |
| `disabled` | `Decision status: disabled` | `Decision status: unavailable` |
| `date-malformed` | `Due date: malformed` | section named `Due date`, text `Due date unavailable: malformed` |
| `undo-available` | `Undo available for the latest decision change` | `Undo latest decision change` |

Found by machine, not by reading: `phase5:fidelity` regex-matches each contract name against the
captured tree. Its first run reported seven states drifting, and four were false — the contract
writes `[artifact name]` as a placeholder the build correctly fills in, and treating the brackets as
literal text reported four correct implementations as defects. A guard refusing material that works,
again.

**Significant — inventory requirements absent from the tree.** `overdue` carries no explicit
past-due wording or escalation affordance. `saving` has no progress indicator and no disabled
duplicate submission. The second is a specific mismatch worth naming: in `saving` and `disabled` the
action controls are **removed** rather than disabled, so a keyboard user finds nothing where the
contract asks for a control that explains itself. Absent is not the same as disabled.

---

## A defect in the brief, recorded rather than buried

The reviewer's fourth finding says no browser, console, network, zoom or reduced-motion checks were
performed. **That is wrong, and it is the brief's fault, not the reviewer's.** The accessibility and
isolation suites had already run; the brief simply never mentioned them, so the reviewer reported the
limits of what it was shown — which is exactly what it should do — and its recommendation to perform
checks that already exist follows from a premise nobody gave it.

This is the second time in two days that a brief has handed a role a false or incomplete picture and
the project has been handed the answer back as evidence. The verification brief claimed there were no
component tests after Task 5 shipped them. The pattern is the same and it is worth stating as a rule:
**a brief is an evidence artifact, and its accuracy is a precondition of the answer's accuracy.**

The verdict is unaffected — a blocking unreachable state and three name drifts carry NEEDS WORK on
their own — so the annotation stands with this correction attached rather than being re-run.

---

## What no capture settles

The reviewer marked **sixteen of twenty states `cannot-tell-without-seeing`**, which is the correct
answer from an accessibility tree and the reason the cross-check fails any annotation that defers
nothing to a person. It was shown trees and image digests; it was told plainly it could not see the
images, and it did not pretend otherwise.

Still outstanding after Task 7: owner fidelity acceptance (C-19), the screen-reader walkthrough
(C-17, committed by Decision 5-D), and provenance (C-18, blocked on gap 3).
