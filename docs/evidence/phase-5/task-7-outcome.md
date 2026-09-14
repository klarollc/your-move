# Phase 5 Task 7 — Visual QA capture and annotation

Ran 2026-09-14. Current-build evidence at both D-07 viewports, annotated by the promoted
`visual-qa-reviewer`. **Verdict: NEEDS WORK.** Turn ledger 4 of 60.

The verdict stands as the record of what the build was on the day it was annotated. All four
findings were ruled by the owner the same day and all four are now implemented — see *What the owner
ruled, and what moved*, below. A later annotation would be a later pass, and re-running this one to
make the verdict agree with the fix is exactly the overwrite this project refuses.

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

## What the owner ruled, and what moved

All four items were ruled on 2026-09-14 —
`decision-record-2026-09-14-task-7-findings.md`. Every one was implemented RED first.

- **7-A, the over-length reason → implement the contract.** `maxLength` removed, a live remaining
  count and an explicit limit statement added, and the core's refusal now fires for a person.
  `validation-reason-too-long` is reachable and captured; the capture asserts the *absence* of
  `maxlength`, because that attribute returning is exactly how this state would go quietly
  unreachable again.
- **7-B, the three drifting names → split by case.** The build moved for `disabled`. The contract was
  amended for `undo-available` and `date-malformed`, as an **overlay** in
  `surface-contract/amendments.json` — the Product Designer's authored artifact is not edited, and
  the fidelity check applies the overlay on top, refusing to apply an amendment whose stated base no
  longer matches. The check now reports **40 checked, 0 drifted**.
- **7-C, removed controls → disable, never remove.** Acknowledge and Defer are always rendered and
  disabled when the decision cannot be acted on. Entering `saving` moves focus to the status region,
  because disabling the focused control would otherwise drop focus to the body and C-10 forbids that.
- **7-D, developer wording read aloud → the surface owns every sentence.** One table maps every
  refusal code the core can return to a sentence written for a person; the core's `detail` is never
  announced. The map is keyed by `ValidationCode`, so a code added later without a sentence is a type
  error rather than a developer string arriving in someone's ear.

All twenty states are now reachable and captured at both viewports, and the fidelity check is clean.

## A defect in this script, found by its own output

The capture runner passed `--grep "@visual Phase 5"` through `execFile` with `shell: true`, so the
shell split it: Playwright received `@visual` as the pattern and `Phase` and `5` as positional file
filters. It appeared to work, because those strings happen to match the phase-5 filenames, and it
produced one failure that looked like a flake and did not reproduce. Collapsing the three runs into
one pattern containing parentheses and pipes made it unmissable. Recorded as **DF-014**.

**The generalisable part:** the first symptom was a single unreproducible failure, and the honest
reading of "I cannot reproduce it" is "I do not know what happened", not "it was nothing."

## What no capture settles

The reviewer marked **sixteen of twenty states `cannot-tell-without-seeing`**, which is the correct
answer from an accessibility tree and the reason the cross-check fails any annotation that defers
nothing to a person. It was shown trees and image digests; it was told plainly it could not see the
images, and it did not pretend otherwise.

Still outstanding after Task 7: owner fidelity acceptance (C-19), the screen-reader walkthrough
(C-17, committed by Decision 5-D), and provenance (C-18, blocked on gap 3).
