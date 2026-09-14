# Decision record — Phase 5 Task 7 findings

Ruled by the owner on 2026-09-14, against `docs/evidence/phase-5/task-7-outcome.md` and the Visual
QA Reviewer's `NEEDS WORK` verdict in `docs/evidence/phase-5/visual-qa/pass-1.json`.

Four items were posed. All four were ruled. Nothing here was implemented before the ruling.

---

## 7-A, the over-length deferral reason → **implement the contract**

The reason textarea carried `maxLength=280`, so a person could never trigger the over-length refusal
the core implements, and one of the twenty required states was unreachable. The contract is explicit
in the other direction: *"show remaining count and reject overlong input rather than truncate it."*

**Ruled:** remove the cap, render a live remaining count and an explicit limit statement, and let the
core's existing refusal fire. Surface work only — the core's validation already exists and is
mutation-tested. No contract amendment.

## 7-B, the three drifting accessible names → **split by case**

Not every drift ran the same direction, and treating them alike would have meant either shipping a
worse button name or amending a contract that happened to be right.

| State | Ruling |
| --- | --- |
| `disabled` | **Build changes.** The status name is what a person searches for, and the contract fixed it as "disabled". |
| `undo-available` | **Contract amended.** A control reads as an imperative a person performs, not as a status sentence. |
| `date-malformed` | **Contract amended.** "Due date unavailable: malformed" tells a reader more than "Due date: malformed". |

The two amendments are recorded in `surface-contract/amendments.json` as an overlay. The Product
Designer's authored artifact is **not edited** — it is a record of what that role produced on the day
it produced it, and rewriting it to agree with a later decision is the exact move that destroyed the
RED capture. The fidelity check reads the authored contract and applies the overlay on top, so what
is being checked against is always visibly the contract *as amended, by whom, and why*.

## 7-C, controls removed rather than disabled → **disable, never remove**

In `saving` and `disabled` the action controls were removed from the DOM. The contract asks for
controls that expose disabled semantics, and removal also drops focus: a person who activates
Acknowledge is standing on a button that disappears underneath them.

**Ruled:** render the controls disabled with explanatory text in both states. This touches C-10,
where focus destinations are a contract term rather than an implementation detail.

## 7-D, developer wording read aloud → **the surface owns all wording**

An empty review date announced "Review date invalid. Choose a future date." because the form
pre-checked it. A past review date reached the core and announced its detail verbatim, so a screen
reader read *"a review time must be in the future; focus returns to the date field"* — an instruction
written for an implementer.

**Ruled:** the core keeps its detail strings for logs and tests; the component maps every refusal
code to a sentence written for a person, and announces that. One source of user-facing wording. This
also removes the duplicated validation the mutation testing exposed, where the form re-checked rules
the core already enforced and the only observable difference was the quality of the sentence.

---

## What this record does not authorize

Phase 7. Any change to the acceptance contract's twenty-one criteria. Re-running the Visual QA
annotation as though the findings were never made — the `NEEDS WORK` verdict stands as the record of
what the build was on 2026-09-14, and a later pass is a later pass.
