# Phase 5 Task 5 — GREEN and REFACTOR

Status: **Complete 2026-09-14.** All seventeen criteria-named tests pass; the tree is green again.
RED record: `docs/evidence/phase-5/red-evidence.json` — seventeen failed for the declared reason.

## GREEN

`packages/domain/src/decision-notice.ts` implements the seven functions the tests specify. All 17
pass on the first implementation pass; the full repository suite is **429 passing, 3 skipped**.

The core is pure by construction — no clock, no storage, no DOM. C-08's determinism requirement is
broken precisely by a core that reaches for `Date.now()` because it is convenient, so there is
nothing in here that can.

Two decisions the tests forced, both worth stating:

- **A malformed event is refused as malformed even when the decision has already been actioned.**
  The event could not be understood, so "you already acted" would be a claim about an event nobody
  successfully read. The deeper fault is reported first.
- **Overdue is derived, never stored.** Storing it would mean a decision is overdue because
  something remembered to write that down, and the office would show a stale fact whenever nothing
  did.

## REFACTOR

Deferral validation extracted to `checkDeferral`, so `applyAction` reads as its sequence of
refusals rather than as one long chain. Behaviour held: the same seventeen tests pass unchanged,
before and after.

## Mutation evidence

Three properties broken deliberately, each killing the test that claims it:

| Mutation | Result |
| --- | --- |
| Undo erases the action it reverses | C-13 fails — append-only is real |
| Every refusal collapses to one code | 3 tests fail — the codes are distinguished, not decorative |
| Two statuses share a signature | C-07 fails — distinguishable, not merely annotated |

## A near-miss worth recording

Immediately after GREEN, re-running the RED capture **overwrote the RED evidence** with a passing
run. The record that the tests had ever failed was destroyed, and recovered from the commit.

RED evidence is a recorded observation, not a live report. The capture script now refuses to
overwrite an existing record unless `CUCKCODE_OVERWRITE_RED=1` is set for a genuinely new RED phase.
The failure mode was mine, it was silent, and nothing in the harness would have caught it — the file
would simply have said the tests passed, which by then was true and completely beside the point.

## Limits

This is the pure core only. No component, no DOM, no browser evidence, no visual capture. C-17,
C-19 and C-21 need artifacts that do not exist yet, and C-18 and C-20 remain blocked on gaps 3 and 8.
Tasks 6 and 7 produce the browser and visual evidence.
